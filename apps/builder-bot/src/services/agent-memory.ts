/**
 * agent-memory.ts — per-chat sessions, daily logs, AI compaction, knowledge.
 * Gives agents long-term memory across restarts and context resets.
 */
import { randomUUID } from 'crypto';
import OpenAI from 'openai';

let _pool: any = null;
async function getPool() {
  if (!_pool) { const { pool } = await import('../db'); _pool = pool; }
  return _pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// PER-CHAT SESSIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface AgentSession {
  id: string;
  agentId: number;
  chatId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  summary: string | null;
  messageCount: number;
  tokensUsed: number;
}

/** Get or create active session for agent+chat */
export async function getOrCreateSession(agentId: number, chatId?: string): Promise<AgentSession> {
  const pool = await getPool();
  const cid = chatId || '__proactive__';

  // Find active (not ended) session
  const res = await pool.query(
    `SELECT * FROM builder_bot.agent_sessions WHERE agent_id=$1 AND chat_id=$2 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
    [agentId, cid]
  );
  if (res.rows[0]) {
    const r = res.rows[0];
    return { id: r.id, agentId: r.agent_id, chatId: r.chat_id, startedAt: r.started_at, endedAt: r.ended_at, summary: r.summary, messageCount: r.message_count, tokensUsed: r.tokens_used };
  }

  // Create new session
  const id = randomUUID();
  await pool.query(
    `INSERT INTO builder_bot.agent_sessions (id, agent_id, chat_id) VALUES ($1, $2, $3)`,
    [id, agentId, cid]
  );
  return { id, agentId, chatId: cid, startedAt: new Date(), endedAt: null, summary: null, messageCount: 0, tokensUsed: 0 };
}

/** End session with summary */
export async function endSession(sessionId: string, summary: string, tokensUsed: number = 0): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `UPDATE builder_bot.agent_sessions SET ended_at=NOW(), summary=$2, tokens_used=$3 WHERE id=$1`,
    [sessionId, summary.slice(0, 5000), tokensUsed]
  );
}

/** Increment message count */
export async function incrementSessionMsgs(sessionId: string): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `UPDATE builder_bot.agent_sessions SET message_count = message_count + 1 WHERE id=$1`,
    [sessionId]
  );
}

/** Get recent session summaries for an agent (last N) */
export async function getRecentSessionSummaries(agentId: number, limit: number = 5): Promise<string[]> {
  const pool = await getPool();
  const res = await pool.query(
    `SELECT summary, chat_id, ended_at FROM builder_bot.agent_sessions
     WHERE agent_id=$1 AND summary IS NOT NULL AND ended_at IS NOT NULL
     ORDER BY ended_at DESC LIMIT $2`,
    [agentId, limit]
  );
  return res.rows.map((r: any) => `[${r.chat_id || 'proactive'} ${new Date(r.ended_at).toISOString().slice(0, 16)}] ${r.summary}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY LOGS
// ═══════════════════════════════════════════════════════════════════════════

/** Append content to today's daily log */
export async function appendDailyLog(agentId: number, content: string): Promise<void> {
  const pool = await getPool();
  const timestamp = new Date().toISOString().slice(11, 19);
  const entry = `## ${timestamp}\n${content}\n---\n`;

  await pool.query(
    `INSERT INTO builder_bot.agent_daily_logs (agent_id, log_date, content)
     VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT (agent_id, log_date)
     DO UPDATE SET content = builder_bot.agent_daily_logs.content || $2`,
    [agentId, entry]
  ).catch((err) => {
    // Only fallback if it's a unique constraint / relation-not-found error (23505 / 42P01)
    const code = err?.code;
    if (code === '23505' || code === '42P01' || code === '42P07') {
      console.warn('[AgentMemory] appendDailyLog primary insert failed (constraint/relation):', err?.message);
      pool.query(
        `INSERT INTO builder_bot.agent_daily_logs (agent_id, content) VALUES ($1, $2)`,
        [agentId, entry]
      ).catch((err2) => { console.warn('[AgentMemory] appendDailyLog fallback insert failed:', err2?.message); });
    } else {
      console.error('[AgentMemory] appendDailyLog unexpected error:', err?.message);
    }
  });
}

/** Get recent daily log (today + yesterday, max 100 lines each) */
export async function getRecentDailyLog(agentId: number): Promise<string> {
  const pool = await getPool();
  const res = await pool.query(
    `SELECT log_date, content FROM builder_bot.agent_daily_logs
     WHERE agent_id=$1 AND log_date >= CURRENT_DATE - 1
     ORDER BY log_date DESC LIMIT 2`,
    [agentId]
  );

  const parts: string[] = [];
  for (const r of res.rows) {
    const lines = (r.content || '').split('\n');
    const maxLines = 100;
    if (lines.length > maxLines) {
      const dropped = lines.length - maxLines;
      parts.push(`# ${r.log_date}\n_[... ${dropped} earlier lines omitted]_\n${lines.slice(-maxLines).join('\n')}`);
    } else {
      parts.push(`# ${r.log_date}\n${r.content}`);
    }
  }
  return parts.join('\n\n');
}

/** Cleanup old daily logs */
export async function cleanupOldDailyLogs(agentId: number, maxAgeDays: number = 60): Promise<number> {
  const pool = await getPool();
  const res = await pool.query(
    `DELETE FROM builder_bot.agent_daily_logs WHERE agent_id=$1 AND log_date < CURRENT_DATE - $2`,
    [agentId, maxAgeDays]
  );
  return res.rowCount || 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// AI COMPACTION (summarize old messages before dropping them)
// ═══════════════════════════════════════════════════════════════════════════

/** Summarize messages using the agent's AI provider */
export async function summarizeMessages(
  messages: Array<{ role: string; content: string }>,
  aiClient: OpenAI,
  model: string,
): Promise<string> {
  // Build transcript for summarization
  const transcript = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      const role = m.role === 'assistant' ? 'Agent' : m.role === 'tool' ? 'Tool' : 'User';
      const content = typeof m.content === 'string' ? m.content.slice(0, 500) : JSON.stringify(m.content).slice(0, 200);
      return `${role}: ${content}`;
    })
    .join('\n');

  if (transcript.length < 50) return '';

  try {
    const res = await aiClient.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Summarize this conversation transcript concisely. Focus on:
1. Key decisions and actions taken
2. Important information learned
3. Open items and next steps
4. User preferences discovered

Write in the SAME LANGUAGE as the conversation. Max 500 chars. No headers, just bullet points.`,
        },
        { role: 'user', content: transcript.slice(0, 8000) },
      ],
      max_tokens: 300,
    });
    return res.choices[0]?.message?.content?.trim() || '';
  } catch (e: any) {
    console.warn(`[AgentMemory] Summarization failed: ${e.message?.slice(0, 100)}`);
    // Fallback: extract last few meaningful messages
    const fallback = messages
      .filter(m => m.role === 'assistant' && typeof m.content === 'string' && m.content.length > 20)
      .slice(-3)
      .map(m => (m.content as string).slice(0, 100))
      .join(' | ');
    return fallback ? `[Auto-summary] ${fallback}` : '';
  }
}

/**
 * Smart compaction: summarize old messages → save to daily log → trim context.
 * Returns the trimmed messages array.
 */
export async function compactContext(
  agentId: number,
  messages: Array<{ role: string; content: string }>,
  aiClient: OpenAI,
  model: string,
  keepRecent: number = 8,
): Promise<{ messages: Array<{ role: string; content: string }>; summarized: boolean }> {
  if (messages.length <= keepRecent + 2) {
    return { messages, summarized: false };
  }

  // Find clean cut point (don't split tool call/result pairs)
  let cutPoint = messages.length - keepRecent;
  // Walk backward to find boundary where no orphaned tool results
  for (let attempt = 0; attempt < 30 && cutPoint > 1; attempt++) {
    const msg = messages[cutPoint];
    if (msg.role === 'tool' || msg.role === 'function') {
      cutPoint--; // don't cut before a tool result
    } else {
      break;
    }
  }
  if (cutPoint <= 1) return { messages, summarized: false };

  // Extract messages to summarize (skip system[0])
  const toSummarize = messages.slice(1, cutPoint);
  const kept = [messages[0], ...messages.slice(cutPoint)]; // system + recent

  // AI summarization
  const summary = await summarizeMessages(toSummarize, aiClient, model);

  if (summary) {
    // Save summary to daily log
    await appendDailyLog(agentId, `Session summary (${toSummarize.length} msgs compacted):\n${summary}`);

    // Inject summary as context message
    kept.splice(1, 0, {
      role: 'user',
      content: `[Предыдущий контекст — краткое резюме ${toSummarize.length} сообщений]\n${summary}`,
    });

    console.log(`[AgentMemory] Agent #${agentId} compacted ${toSummarize.length} msgs → summary (${summary.length} chars)`);
  } else {
    console.log(`[AgentMemory] Agent #${agentId} compacted ${toSummarize.length} msgs (no summary available)`);
  }

  return { messages: kept, summarized: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY DIGEST (injected into agent context)
// ═══════════════════════════════════════════════════════════════════════════

/** Build a memory digest block for the agent's context */
export async function buildMemoryDigest(agentId: number): Promise<string> {
  const parts: string[] = [];

  try {
    // Recent session summaries
    const summaries = await getRecentSessionSummaries(agentId, 3);
    if (summaries.length > 0) {
      parts.push(`📝 Предыдущие сессии:\n${summaries.map(s => `  • ${s}`).join('\n')}`);
    }
  } catch {}

  try {
    // Today's daily log (brief)
    const log = await getRecentDailyLog(agentId);
    if (log && log.length > 10) {
      // Truncate to last 500 chars
      const truncated = log.length > 500 ? '...' + log.slice(-500) : log;
      parts.push(`📅 Дневник:\n${truncated}`);
    }
  } catch {}

  if (parts.length === 0) return '';
  return `\n━━━ ДОЛГОСРОЧНАЯ ПАМЯТЬ ━━━\n${parts.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PER-CHAT CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/** Build context block specific to the current chat (session history, chat dossier) */
export async function buildChatContext(agentId: number, chatId: string): Promise<string> {
  if (!chatId || chatId === '__proactive__') return '';
  const pool = await getPool();
  const parts: string[] = [];

  // Chat dossier
  try {
    const dossier = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2`,
      [agentId, `chat_dossier:${chatId}`]
    );
    if (dossier.rows[0]?.value) {
      parts.push(`📋 Досье чата ${chatId}:\n${String(dossier.rows[0].value).slice(0, 500)}`);
    }
  } catch {}

  // Recent session summaries for THIS chat
  try {
    const res = await pool.query(
      `SELECT summary, ended_at FROM builder_bot.agent_sessions
       WHERE agent_id=$1 AND chat_id=$2 AND summary IS NOT NULL AND ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT 3`,
      [agentId, chatId]
    );
    if (res.rows.length > 0) {
      const sums = res.rows.map((r: any) => `  • [${new Date(r.ended_at).toISOString().slice(0, 16)}] ${r.summary}`);
      parts.push(`📝 История этого чата:\n${sums.join('\n')}`);
    }
  } catch {}

  if (parts.length === 0) return '';
  return `\n━━━ КОНТЕКСТ ЧАТА ${chatId} ━━━\n${parts.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/** Collect user dossier from ALL chats where this user appeared */
export async function buildUserContext(agentId: number, senderId: string): Promise<string> {
  if (!senderId) return '';
  const pool = await getPool();
  const parts: string[] = [];

  // User dossier (main)
  try {
    const dossier = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2`,
      [agentId, `contact:${senderId}`]
    );
    if (dossier.rows[0]?.value) {
      try {
        const d = JSON.parse(dossier.rows[0].value);
        const lines: string[] = [];
        if (d.name) lines.push(`Имя: ${d.name}`);
        if (d.username) lines.push(`@${d.username}`);
        if (d.relationship) lines.push(`Отношение: ${d.relationship}`);
        if (d.notes?.length) lines.push(`Заметки: ${d.notes.slice(-3).join('; ')}`);
        if (d.firstSeen) lines.push(`Первый контакт: ${d.firstSeen}`);
        if (d.messageCount) lines.push(`Сообщений: ${d.messageCount}`);
        if (lines.length > 0) parts.push(`👤 Досье ${senderId}:\n  ${lines.join('\n  ')}`);
      } catch {
        parts.push(`👤 Досье: ${String(dossier.rows[0].value).slice(0, 300)}`);
      }
    }
  } catch {}

  // Notes about this user from different chats
  try {
    const notes = await pool.query(
      `SELECT key, value FROM builder_bot.agent_state WHERE agent_id=$1 AND key LIKE $2 LIMIT 5`,
      [agentId, `contact_note:${senderId}:%`]
    );
    if (notes.rows.length > 0) {
      const noteLines = notes.rows.map((r: any) => {
        const chatFrom = r.key.split(':')[2] || '?';
        return `  • [чат ${chatFrom}] ${String(r.value).slice(0, 150)}`;
      });
      parts.push(`📝 Заметки о пользователе:\n${noteLines.join('\n')}`);
    }
  } catch {}

  if (parts.length === 0) return '';
  return `\n━━━ ПРОФИЛЬ СОБЕСЕДНИКА ━━━\n${parts.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/** Record a milestone event */
export async function recordMilestone(agentId: number, event: string): Promise<void> {
  await appendDailyLog(agentId, `⭐ MILESTONE: ${event}`);
}

/** Auto-update user interaction stats in dossier */
export async function touchUserDossier(agentId: number, userId: number, senderId: string, senderName?: string, senderUsername?: string, chatId?: string): Promise<void> {
  if (!senderId) return;
  const pool = await getPool();
  const key = `contact:${senderId}`;

  try {
    const existing = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2`,
      [agentId, key]
    );

    let dossier: any = {};
    if (existing.rows[0]?.value) {
      try { dossier = JSON.parse(existing.rows[0].value); } catch {}
    }

    // Update stats
    dossier.name = senderName || dossier.name || '';
    dossier.username = senderUsername || dossier.username || '';
    dossier.lastSeen = new Date().toISOString();
    dossier.messageCount = (dossier.messageCount || 0) + 1;
    if (!dossier.firstSeen) dossier.firstSeen = new Date().toISOString();

    // Track which chats this user appeared in
    if (chatId) {
      if (!dossier.seenInChats) dossier.seenInChats = [];
      if (!dossier.seenInChats.includes(chatId)) {
        dossier.seenInChats.push(chatId);
        if (dossier.seenInChats.length > 20) dossier.seenInChats = dossier.seenInChats.slice(-20);
      }
    }

    const { getAgentStateRepository } = await import('../db/schema-extensions');
    await getAgentStateRepository().set(agentId, userId, key, JSON.stringify(dossier));
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// SELF-EVOLVING PROMPT — agent learns its domain and adapts personality
// ═══════════════════════════════════════════════════════════════════════════

interface PromptEvolution {
  domain: string;           // detected domain (crypto, content, support, etc.)
  topics: string[];         // recurring topics
  personality: string[];    // learned personality traits
  rules: string[];          // self-imposed rules from feedback
  lastEvolvedAt: string;
  evolveCount: number;
  interactionsSinceEvolve: number;
}

const EVOLVE_INTERVAL = 50; // evolve prompt every N interactions

/** Track interaction and trigger self-evolution when threshold reached */
export async function trackInteractionForEvolution(
  agentId: number,
  userId: number,
  message: string,
  chatId?: string,
): Promise<void> {
  const { getAgentStateRepository } = await import('../db/schema-extensions');
  const repo = getAgentStateRepository();
  const key = '_prompt_evolution';

  try {
    const raw = await repo.get(agentId, key).catch(() => null);
    let evo: PromptEvolution = raw?.value ? JSON.parse(raw.value) : {
      domain: '', topics: [], personality: [], rules: [],
      lastEvolvedAt: '', evolveCount: 0, interactionsSinceEvolve: 0,
    };

    evo.interactionsSinceEvolve++;

    // Track topics from message (simple keyword extraction)
    const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    for (const w of words.slice(0, 5)) {
      if (!evo.topics.includes(w) && evo.topics.length < 50) evo.topics.push(w);
    }
    if (evo.topics.length > 50) evo.topics = evo.topics.slice(-30);

    await repo.set(agentId, userId, key, JSON.stringify(evo));
  } catch {}
}

/** Check if evolution is needed and return data for AI to process */
export async function checkEvolutionNeeded(agentId: number): Promise<{ needed: boolean; data?: PromptEvolution }> {
  try {
    const { getAgentStateRepository } = await import('../db/schema-extensions');
    const repo = getAgentStateRepository();
    const raw = await repo.get(agentId, '_prompt_evolution').catch(() => null);
    if (!raw?.value) return { needed: false };
    const evo: PromptEvolution = JSON.parse(raw.value);
    return { needed: evo.interactionsSinceEvolve >= EVOLVE_INTERVAL, data: evo };
  } catch { return { needed: false }; }
}

/** Execute prompt self-evolution via AI */
export async function evolvePrompt(
  agentId: number,
  userId: number,
  currentPrompt: string,
  aiClient: OpenAI,
  model: string,
): Promise<{ evolved: boolean; additions?: string }> {
  const { getAgentStateRepository } = await import('../db/schema-extensions');
  const repo = getAgentStateRepository();

  try {
    const raw = await repo.get(agentId, '_prompt_evolution').catch(() => null);
    if (!raw?.value) return { evolved: false };
    const evo: PromptEvolution = JSON.parse(raw.value);

    // Get recent daily log for context
    const recentLog = await getRecentDailyLog(agentId);
    // Get recent session summaries
    const summaries = await getRecentSessionSummaries(agentId, 5);

    const res = await aiClient.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Ты — аналитик AI-агента. Проанализируй данные о работе агента и предложи улучшения для его system prompt.

ТЕКУЩИЙ ПРОМПТ АГЕНТА:
${currentPrompt.slice(0, 2000)}

ДАННЫЕ ДЛЯ АНАЛИЗА:
- Частые темы: ${evo.topics.slice(-20).join(', ')}
- Текущий домен: ${evo.domain || 'не определён'}
- Кол-во взаимодействий: ${evo.interactionsSinceEvolve}
- Эволюций было: ${evo.evolveCount}

ПОСЛЕДНИЕ СЕССИИ:
${summaries.slice(0, 3).join('\n')}

ДНЕВНИК (последнее):
${(recentLog || '').slice(-1000)}

ЗАДАЧА: На основе данных определи:
1. В какой сфере работает агент (крипто, контент, поддержка, трейдинг, модерация, etc.)
2. Какие паттерны поведения стоит добавить
3. Какие правила вытекают из опыта

ОТВЕТЬ СТРОГО JSON:
{
  "domain": "определённый домен",
  "additions": "2-5 коротких правил/наблюдений для добавления в промпт (каждое на новой строке, начиная с •)",
  "personality_note": "краткая заметка о стиле общения который сформировался"
}

Если данных мало или промпт уже хорош: {"skip": true}`,
        },
        { role: 'user', content: 'Проанализируй и предложи эволюцию.' },
      ],
      max_tokens: 500,
    });

    const text = res.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { evolved: false };

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.skip) {
      // Reset counter but don't evolve
      evo.interactionsSinceEvolve = 0;
      await repo.set(agentId, userId, '_prompt_evolution', JSON.stringify(evo));
      return { evolved: false };
    }

    const additions = parsed.additions || '';
    if (!additions || additions.length < 10) {
      evo.interactionsSinceEvolve = 0;
      await repo.set(agentId, userId, '_prompt_evolution', JSON.stringify(evo));
      return { evolved: false };
    }

    // Update evolution state
    evo.domain = parsed.domain || evo.domain;
    evo.interactionsSinceEvolve = 0;
    evo.evolveCount++;
    evo.lastEvolvedAt = new Date().toISOString();
    if (parsed.personality_note) {
      evo.personality.push(parsed.personality_note);
      if (evo.personality.length > 10) evo.personality = evo.personality.slice(-5);
    }

    await repo.set(agentId, userId, '_prompt_evolution', JSON.stringify(evo));

    // Append evolution to agent's prompt
    const pool = await getPool();
    const evolutionBlock = `\n\n═══ САМООБУЧЕНИЕ (эволюция #${evo.evolveCount}, ${new Date().toISOString().slice(0, 10)}) ═══\nДомен: ${evo.domain}\n${additions}\n═══════════════════════════════`;

    // Wrap read-modify-write in a transaction to avoid race conditions
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');
      await dbClient.query(
        `UPDATE builder_bot.agents SET code = code || $1 WHERE id = $2`,
        [evolutionBlock, agentId]
      );

      // Also update in trigger_config.code
      const agentRow = await dbClient.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1 FOR UPDATE', [agentId]);
      if (agentRow.rows[0]) {
        const tc = agentRow.rows[0].trigger_config || {};
        if (tc.code) {
          tc.code = tc.code + evolutionBlock;
          await dbClient.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tc), agentId]);
        }
      }
      await dbClient.query('COMMIT');
    } catch (txErr) {
      await dbClient.query('ROLLBACK').catch((rbErr) => { console.error('[AgentMemory] ROLLBACK failed:', rbErr?.message); });
      throw txErr;
    } finally {
      dbClient.release();
    }

    await appendDailyLog(agentId, `🧬 Prompt evolution #${evo.evolveCount}: domain=${evo.domain}\n${additions}`);
    console.log(`[AgentMemory] Agent #${agentId} evolved prompt (#${evo.evolveCount}): domain=${evo.domain}, +${additions.length} chars`);

    return { evolved: true, additions };
  } catch (e: any) {
    console.warn(`[AgentMemory] Evolution failed for agent #${agentId}: ${e.message?.slice(0, 100)}`);
    return { evolved: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROACTIVE CHAT ENGAGEMENT — weighted multi-factor scoring per chat
// ═══════════════════════════════════════════════════════════════════════════

interface ChatEngagement {
  chatId: string;
  score: number;               // weighted engagement score
  mentionCount: number;        // @username tags (weight: 3)
  replyToAgentCount: number;   // replies to agent's messages (weight: 2)
  nameInTextCount: number;     // agent name mentioned in text (weight: 1.5)
  reactionCount: number;       // reactions on agent msgs (weight: 1)
  questionCount: number;       // questions in chat (weight: 0.5)
  agentReplyCount: number;     // times agent replied here
  replyCount?: number;         // generic reply count (alias)
  lastActivityAt: string;
  burstTimestamps: number[];   // timestamps of recent interactions (for burst detection)
  proactiveEnabled: boolean;
  ownerOverride?: boolean;
}

// ── Scoring weights ──
const W_MENTION = 3.0;        // direct @tag
const W_REPLY_TO_AGENT = 2.0; // replied to agent's message
const W_NAME_IN_TEXT = 1.5;   // "бот", "агент", agent name in text
const W_REACTION = 1.0;       // reacted to agent's message
const W_QUESTION = 0.3;       // asked a question (?)
const W_BURST_BONUS = 5.0;    // >5 interactions in 30 min

const PROACTIVE_SCORE_THRESHOLD = 15; // enable proactive at this score
const PROACTIVE_DECAY_HOURS = 72;     // disable if no activity for N hours
const BURST_WINDOW_MS = 30 * 60_000;  // 30 min window for burst detection
const BURST_MIN_COUNT = 5;            // min interactions for burst bonus

/** Track a chat engagement event with weighted scoring */
export async function trackChatEngagement(
  agentId: number,
  userId: number,
  chatId: string,
  event: 'mention' | 'reply_to_agent' | 'name_in_text' | 'reaction' | 'question' | 'agent_replied',
): Promise<void> {
  const { getAgentStateRepository } = await import('../db/schema-extensions');
  const repo = getAgentStateRepository();
  const key = `chat_engagement:${chatId}`;

  try {
    const raw = await repo.get(agentId, key).catch(() => null);
    let eng: ChatEngagement = raw?.value ? JSON.parse(raw.value) : {
      chatId, score: 0, mentionCount: 0, replyToAgentCount: 0,
      nameInTextCount: 0, reactionCount: 0, questionCount: 0,
      agentReplyCount: 0, lastActivityAt: '', burstTimestamps: [],
      proactiveEnabled: false,
    };

    const now = Date.now();
    let scoreAdd = 0;

    switch (event) {
      case 'mention':
        eng.mentionCount++;
        scoreAdd = W_MENTION;
        break;
      case 'reply_to_agent':
        eng.replyToAgentCount++;
        scoreAdd = W_REPLY_TO_AGENT;
        break;
      case 'name_in_text':
        eng.nameInTextCount++;
        scoreAdd = W_NAME_IN_TEXT;
        break;
      case 'reaction':
        eng.reactionCount++;
        scoreAdd = W_REACTION;
        break;
      case 'question':
        eng.questionCount++;
        scoreAdd = W_QUESTION;
        break;
      case 'agent_replied':
        eng.agentReplyCount++;
        scoreAdd = 0; // agent replying doesn't add to engagement score
        break;
    }

    eng.score = Math.min(eng.score + scoreAdd, 10000); // cap score
    eng.lastActivityAt = new Date().toISOString();

    // Burst detection: filter old timestamps first, then push
    eng.burstTimestamps = eng.burstTimestamps.filter(t => now - t < BURST_WINDOW_MS).slice(-20);
    eng.burstTimestamps.push(now);
    if (eng.burstTimestamps.length >= BURST_MIN_COUNT && scoreAdd > 0) {
      eng.score = Math.min(eng.score + W_BURST_BONUS, 10000);
      console.log(`[Proactive] Agent #${agentId} burst detected in chat ${chatId} (${eng.burstTimestamps.length} events in 30min)`);
    }

    // Auto-enable proactive mode if score threshold reached
    if (!eng.proactiveEnabled && !eng.ownerOverride && eng.score >= PROACTIVE_SCORE_THRESHOLD) {
      eng.proactiveEnabled = true;
      const reasons = [];
      if (eng.mentionCount > 0) reasons.push(`${eng.mentionCount} mentions`);
      if (eng.replyToAgentCount > 0) reasons.push(`${eng.replyToAgentCount} replies`);
      if (eng.nameInTextCount > 0) reasons.push(`${eng.nameInTextCount} name refs`);
      if (eng.reactionCount > 0) reasons.push(`${eng.reactionCount} reactions`);
      const reasonStr = reasons.join(', ') || `score=${eng.score.toFixed(1)}`;
      console.log(`[Proactive] Agent #${agentId} auto-enabled in chat ${chatId} (${reasonStr})`);
      await appendDailyLog(agentId, `🟢 Proactive mode auto-enabled in chat ${chatId}: ${reasonStr}`);
    }

    await repo.set(agentId, userId, key, JSON.stringify(eng));
  } catch {}
}

// Backward-compatible aliases
export async function trackChatMention(agentId: number, userId: number, chatId: string): Promise<void> {
  return trackChatEngagement(agentId, userId, chatId, 'mention');
}
export async function trackChatReply(agentId: number, userId: number, chatId: string): Promise<void> {
  return trackChatEngagement(agentId, userId, chatId, 'agent_replied');
}

/** Check if proactive mode is enabled for a chat */
export async function isProactiveChat(agentId: number, chatId: string): Promise<boolean> {
  try {
    const { getAgentStateRepository } = await import('../db/schema-extensions');
    const repo = getAgentStateRepository();
    const raw = await repo.get(agentId, `chat_engagement:${chatId}`).catch(() => null);
    if (!raw?.value) return false;
    const eng: ChatEngagement = JSON.parse(raw.value);

    // Decay: disable if no activity for N hours (unless owner override)
    if (eng.proactiveEnabled && !eng.ownerOverride && eng.lastActivityAt) {
      const hoursSince = (Date.now() - new Date(eng.lastActivityAt).getTime()) / 3_600_000;
      if (hoursSince > PROACTIVE_DECAY_HOURS) {
        eng.proactiveEnabled = false;
        eng.score = Math.max(0, eng.score * 0.5); // halve score on decay
        // Use agentId as userId for system-initiated decay (agent's own state)
        await repo.set(agentId, agentId, `chat_engagement:${chatId}`, JSON.stringify(eng));
        console.log(`[Proactive] Agent #${agentId} proactive decayed in chat ${chatId} (${hoursSince.toFixed(0)}h inactive)`);
        return false;
      }
    }

    return eng.proactiveEnabled;
  } catch { return false; }
}

/** Owner toggle proactive mode for a chat */
export async function setProactiveChat(agentId: number, userId: number, chatId: string, enabled: boolean): Promise<void> {
  const { getAgentStateRepository } = await import('../db/schema-extensions');
  const repo = getAgentStateRepository();
  const key = `chat_engagement:${chatId}`;

  try {
    const raw = await repo.get(agentId, key).catch(() => null);
    let eng: ChatEngagement = raw?.value ? JSON.parse(raw.value) : {
      chatId, score: 0, mentionCount: 0, replyToAgentCount: 0,
      nameInTextCount: 0, reactionCount: 0, questionCount: 0,
      agentReplyCount: 0, lastActivityAt: '', burstTimestamps: [],
      proactiveEnabled: false,
    };
    eng.proactiveEnabled = enabled;
    eng.ownerOverride = true;
    await repo.set(agentId, userId, key, JSON.stringify(eng));
  } catch {}
}

/** Get all proactive chats for an agent */
export async function getProactiveChats(agentId: number): Promise<ChatEngagement[]> {
  try {
    const { getAgentStateRepository } = await import('../db/schema-extensions');
    const repo = getAgentStateRepository();
    const allKeys = await repo.listKeys(agentId);
    const engKeys = allKeys.filter((k: string) => k.startsWith('chat_engagement:'));

    const results: ChatEngagement[] = [];
    for (const key of engKeys.slice(0, 50)) {
      const raw = await repo.get(agentId, key).catch(() => null);
      if (raw?.value) {
        try {
          const eng: ChatEngagement = JSON.parse(raw.value);
          if (eng.proactiveEnabled) results.push(eng);
        } catch {}
      }
    }
    return results;
  } catch { return []; }
}

/** Build proactive chats context block */
export async function buildProactiveContext(agentId: number): Promise<string> {
  const chats = await getProactiveChats(agentId);
  if (chats.length === 0) return '';

  const lines = chats.map(c => {
    const stats = [];
    if (c.mentionCount) stats.push(`${c.mentionCount} тегов`);
    if (c.replyToAgentCount) stats.push(`${c.replyToAgentCount} реплаев`);
    if (c.reactionCount) stats.push(`${c.reactionCount} реакций`);
    if (c.agentReplyCount) stats.push(`${c.agentReplyCount} ответов`);
    return `  • ${c.chatId}: score=${c.score.toFixed(0)} (${stats.join(', ')})${c.ownerOverride ? ' [owner]' : ' [auto]'}`;
  });
  return `\n🟢 ПРОАКТИВНЫЕ ЧАТЫ (отвечай даже без упоминания):\n${lines.join('\n')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURABLE SELF-MEMORY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/** Memory settings for an agent — stored as agent_state key `_memory_settings` */
export interface MemorySettings {
  // Category toggles (true = enabled)
  enableMemories: boolean;      // remember/recall (mem:* keys)
  enableLessons: boolean;       // save_lesson (lesson:* keys)
  enableKnowledge: boolean;     // knowledge_save/search (kb:* keys)
  enableContacts: boolean;      // contact dossiers (contact:* keys)
  enableChatDossiers: boolean;  // chat_dossier:* keys
  enableEvolution: boolean;     // self-evolving prompt

  // Retention limits
  maxMemories: number;          // max mem:* entries (default 200)
  maxLessons: number;           // max lesson:* entries (default 30)
  maxKnowledge: number;         // max kb:* entries (default 100)
  maxContacts: number;          // max contact:* entries (default 500)
  memoryTTLDays: number;        // auto-expire memories after N days (0 = never)
  lessonTTLDays: number;        // auto-expire lessons after N days (0 = never)

  // Priority settings for context injection
  priorityCategories: string[]; // ordered priority: ['memories','contacts','lessons','knowledge']
  maxContextTokens: number;     // max tokens budget for memory injection (default 2000)

  // Evolution settings
  evolveInterval: number;       // interactions between evolutions (default 50)
  maxEvolutions: number;        // max total evolutions (default 20, 0 = unlimited)
}

const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  enableMemories: true,
  enableLessons: true,
  enableKnowledge: true,
  enableContacts: true,
  enableChatDossiers: true,
  enableEvolution: true,
  maxMemories: 200,
  maxLessons: 30,
  maxKnowledge: 100,
  maxContacts: 500,
  memoryTTLDays: 0,
  lessonTTLDays: 0,
  priorityCategories: ['memories', 'contacts', 'lessons', 'knowledge'],
  maxContextTokens: 2000,
  evolveInterval: 50,
  maxEvolutions: 20,
};

/** Get memory settings for agent (with defaults) */
export async function getMemorySettings(agentId: number): Promise<MemorySettings> {
  try {
    const { getAgentStateRepository } = await import('../db/schema-extensions');
    const repo = getAgentStateRepository();
    const raw = await repo.get(agentId, '_memory_settings').catch(() => null);
    if (raw?.value) {
      return { ...DEFAULT_MEMORY_SETTINGS, ...JSON.parse(raw.value) };
    }
  } catch {}
  return { ...DEFAULT_MEMORY_SETTINGS };
}

/** Save memory settings for agent */
export async function setMemorySettings(agentId: number, userId: number, settings: Partial<MemorySettings>): Promise<MemorySettings> {
  // Validate numeric ranges
  if (settings.maxMemories !== undefined) settings.maxMemories = Math.max(1, Math.min(10000, Math.floor(settings.maxMemories)));
  if (settings.maxLessons !== undefined) settings.maxLessons = Math.max(1, Math.min(1000, Math.floor(settings.maxLessons)));
  if (settings.maxContextTokens !== undefined) settings.maxContextTokens = Math.max(100, Math.min(20000, Math.floor(settings.maxContextTokens)));
  if (settings.memoryTTLDays !== undefined) settings.memoryTTLDays = Math.max(0, Math.min(3650, Math.floor(settings.memoryTTLDays)));
  if (settings.evolveInterval !== undefined) settings.evolveInterval = Math.max(5, Math.min(1000, Math.floor(settings.evolveInterval)));

  const { getAgentStateRepository } = await import('../db/schema-extensions');
  const repo = getAgentStateRepository();
  const current = await getMemorySettings(agentId);
  const merged = { ...current, ...settings };
  await repo.set(agentId, userId, '_memory_settings', JSON.stringify(merged));
  return merged;
}

/** Check if a memory category is enabled */
export async function isCategoryEnabled(agentId: number, category: 'memories' | 'lessons' | 'knowledge' | 'contacts' | 'chatDossiers' | 'evolution'): Promise<boolean> {
  const settings = await getMemorySettings(agentId);
  switch (category) {
    case 'memories': return settings.enableMemories;
    case 'lessons': return settings.enableLessons;
    case 'knowledge': return settings.enableKnowledge;
    case 'contacts': return settings.enableContacts;
    case 'chatDossiers': return settings.enableChatDossiers;
    case 'evolution': return settings.enableEvolution;
    default: return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

export interface MemoryStats {
  totalKeys: number;
  categories: {
    memories: number;    // mem:*
    lessons: number;     // lesson:*
    knowledge: number;   // kb:*
    contacts: number;    // contact:*
    chatDossiers: number;// chat_dossier:*
    engagement: number;  // chat_engagement:*
    system: number;      // _* keys
    other: number;
  };
  totalSizeBytes: number;
  oldestKey?: { key: string; age: string };
  newestKey?: { key: string; age: string };
  evolutionCount: number;
  sessionsCount: number;
  dailyLogsCount: number;
}

/** Get comprehensive memory statistics for an agent */
export async function getMemoryStats(agentId: number): Promise<MemoryStats> {
  const pool = await getPool();

  const categories = { memories: 0, lessons: 0, knowledge: 0, contacts: 0, chatDossiers: 0, engagement: 0, system: 0, other: 0 };
  let totalSizeBytes = 0;

  // Count keys by category
  const keysRes = await pool.query(
    `SELECT key, length(value::text) as size FROM builder_bot.agent_state WHERE agent_id = $1`,
    [agentId]
  );

  for (const row of keysRes.rows) {
    const k: string = row.key;
    const size = parseInt(row.size) || 0;
    totalSizeBytes += size;

    if (k.startsWith('mem:')) categories.memories++;
    else if (k.startsWith('lesson:')) categories.lessons++;
    else if (k.startsWith('kb:')) categories.knowledge++;
    else if (k.startsWith('contact:') && !k.startsWith('contact_note:')) categories.contacts++;
    else if (k.startsWith('chat_dossier:')) categories.chatDossiers++;
    else if (k.startsWith('chat_engagement:')) categories.engagement++;
    else if (k.startsWith('_')) categories.system++;
    else categories.other++;
  }

  // Evolution count
  let evolutionCount = 0;
  try {
    const evoRaw = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id=$1 AND key='_prompt_evolution'`, [agentId]
    );
    if (evoRaw.rows[0]?.value) {
      const evo = JSON.parse(evoRaw.rows[0].value);
      evolutionCount = evo.evolveCount || 0;
    }
  } catch {}

  // Sessions count
  const sessRes = await pool.query(
    `SELECT COUNT(*) as cnt FROM builder_bot.agent_sessions WHERE agent_id=$1`, [agentId]
  );
  const sessionsCount = parseInt(sessRes.rows[0]?.cnt) || 0;

  // Daily logs count
  const logsRes = await pool.query(
    `SELECT COUNT(*) as cnt FROM builder_bot.agent_daily_logs WHERE agent_id=$1`, [agentId]
  );
  const dailyLogsCount = parseInt(logsRes.rows[0]?.cnt) || 0;

  return {
    totalKeys: keysRes.rows.length,
    categories,
    totalSizeBytes,
    evolutionCount,
    sessionsCount,
    dailyLogsCount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY MANAGEMENT — TTL, cleanup, compression
// ═══════════════════════════════════════════════════════════════════════════

/** Clear all entries in a memory category */
export async function clearMemoryCategory(
  agentId: number,
  category: 'memories' | 'lessons' | 'knowledge' | 'contacts' | 'chatDossiers' | 'engagement' | 'all',
): Promise<number> {
  const pool = await getPool();

  const prefixMap: Record<string, string> = {
    memories: 'mem:',
    lessons: 'lesson:',
    knowledge: 'kb:',
    contacts: 'contact:',
    chatDossiers: 'chat_dossier:',
    engagement: 'chat_engagement:',
  };

  if (category === 'all') {
    // Delete all non-system keys
    const res = await pool.query(
      `DELETE FROM builder_bot.agent_state WHERE agent_id = $1 AND key NOT LIKE '\\_%'`,
      [agentId]
    );
    return res.rowCount || 0;
  }

  const prefix = prefixMap[category];
  if (!prefix) return 0;

  const res = await pool.query(
    `DELETE FROM builder_bot.agent_state WHERE agent_id = $1 AND key LIKE $2`,
    [agentId, `${prefix}%`]
  );
  return res.rowCount || 0;
}

/** Enforce retention limits — delete oldest entries exceeding max count */
export async function enforceRetentionLimits(agentId: number): Promise<{ pruned: number }> {
  const settings = await getMemorySettings(agentId);
  const pool = await getPool();
  let pruned = 0;

  const limits: Array<{ prefix: string; max: number }> = [
    { prefix: 'mem:', max: settings.maxMemories },
    { prefix: 'lesson:', max: settings.maxLessons },
    { prefix: 'kb:', max: settings.maxKnowledge },
    { prefix: 'contact:', max: settings.maxContacts },
  ];

  for (const { prefix, max } of limits) {
    if (max <= 0) continue;
    // Count entries
    const countRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM builder_bot.agent_state WHERE agent_id = $1 AND key LIKE $2`,
      [agentId, `${prefix}%`]
    );
    const count = parseInt(countRes.rows[0]?.cnt) || 0;
    if (count <= max) continue;

    // Batch delete oldest (by key sort — timestamps sort naturally)
    const toDelete = count - max;
    const delRes = await pool.query(
      `DELETE FROM builder_bot.agent_state WHERE agent_id = $1 AND key IN (SELECT key FROM builder_bot.agent_state WHERE agent_id = $1 AND key LIKE $2 ORDER BY key ASC LIMIT $3)`,
      [agentId, `${prefix}%`, toDelete]
    );
    pruned += delRes.rowCount || 0;
  }

  return { pruned };
}

/** Apply TTL — delete entries older than configured days */
export async function applyMemoryTTL(agentId: number): Promise<{ expired: number }> {
  const settings = await getMemorySettings(agentId);
  const pool = await getPool();
  let expired = 0;

  // TTL for memories (mem:* keys)
  if (settings.memoryTTLDays > 0) {
    const keysRes = await pool.query(
      `SELECT key, value FROM builder_bot.agent_state WHERE agent_id = $1 AND key LIKE 'mem:%'`,
      [agentId]
    );
    const cutoff = Date.now() - settings.memoryTTLDays * 86400_000;
    for (const row of keysRes.rows) {
      try {
        const val = JSON.parse(row.value);
        const savedAt = val.savedAt ? new Date(val.savedAt).getTime() : 0;
        if (savedAt > 0 && savedAt < cutoff) {
          await pool.query(`DELETE FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2`, [agentId, row.key]);
          expired++;
        }
      } catch {}
    }
  }

  // TTL for lessons (lesson:* keys — timestamp in key name)
  if (settings.lessonTTLDays > 0) {
    const keysRes = await pool.query(
      `SELECT key FROM builder_bot.agent_state WHERE agent_id = $1 AND key LIKE 'lesson:%'`,
      [agentId]
    );
    const cutoff = Date.now() - settings.lessonTTLDays * 86400_000;
    for (const row of keysRes.rows) {
      const ts = parseInt(row.key.replace('lesson:', ''));
      // Validate ts is a reasonable epoch ms (after 2020 = 1577836800000)
      if (!isNaN(ts) && ts > 1_577_836_800_000 && ts < cutoff) {
        await pool.query(`DELETE FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2`, [agentId, row.key]);
        expired++;
      }
    }
  }

  return { expired };
}

/** Compress old memories — summarize many into few consolidated entries */
export async function compressMemories(
  agentId: number,
  userId: number,
  aiClient: OpenAI,
  model: string,
  category: 'memories' | 'lessons' = 'memories',
): Promise<{ compressed: number; consolidated: number }> {
  const { getAgentStateRepository } = await import('../db/schema-extensions');
  const repo = getAgentStateRepository();
  const prefix = category === 'lessons' ? 'lesson:' : 'mem:';

  // Get all entries in category
  const pool = await getPool();
  const res = await pool.query(
    `SELECT key, value FROM builder_bot.agent_state WHERE agent_id = $1 AND key LIKE $2 ORDER BY key ASC`,
    [agentId, `${prefix}%`]
  );

  if (res.rows.length < 10) return { compressed: 0, consolidated: 0 };

  // Take oldest half for compression
  const half = Math.floor(res.rows.length / 2);
  const toCompress = res.rows.slice(0, half);

  // Build text from entries
  const entries = toCompress.map((r: any) => {
    try {
      const val = JSON.parse(r.value);
      return val.text || val.value || val.lesson || String(r.value).slice(0, 200);
    } catch {
      return String(r.value).slice(0, 200);
    }
  });

  try {
    const aiRes = await aiClient.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Сожми ${entries.length} записей памяти AI-агента в 3-5 консолидированных записей.
Каждая запись — одна строка. Сохрани ключевые факты, удали дубли и устаревшее.
Ответь JSON массивом строк: ["запись 1", "запись 2", ...]`,
        },
        { role: 'user', content: entries.join('\n---\n') },
      ],
      max_tokens: 500,
    });

    const text = aiRes.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { compressed: 0, consolidated: 0 };

    const consolidated: string[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(consolidated) || consolidated.length === 0) return { compressed: 0, consolidated: 0 };

    // Delete old entries
    for (const row of toCompress) {
      await pool.query(`DELETE FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2`, [agentId, row.key]);
    }

    // Save consolidated entries
    for (const entry of consolidated) {
      const key = `${prefix}compressed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await repo.set(agentId, userId, key, JSON.stringify({
        text: entry,
        category: 'consolidated',
        importance: 'high',
        savedAt: new Date().toISOString(),
        compressed: true,
        sourceCount: toCompress.length,
      }));
    }

    await appendDailyLog(agentId, `🗜️ Memory compression: ${toCompress.length} ${category} → ${consolidated.length} consolidated entries`);
    return { compressed: toCompress.length, consolidated: consolidated.length };
  } catch (e: any) {
    console.warn(`[AgentMemory] Compression failed: ${e.message?.slice(0, 100)}`);
    return { compressed: 0, consolidated: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIORITY-BASED MEMORY INJECTION
// ═══════════════════════════════════════════════════════════════════════════

/** Build memory digest with priority and token budget */
export async function buildPrioritizedMemoryDigest(agentId: number, chatId?: string, senderId?: string): Promise<string> {
  const settings = await getMemorySettings(agentId);
  const { getAgentStateRepository } = await import('../db/schema-extensions');
  const repo = getAgentStateRepository();

  const parts: string[] = [];
  let tokensUsed = 0;
  const maxTokens = settings.maxContextTokens;
  const estTokens = (s: string) => Math.ceil(s.length / 3.5); // rough estimate

  // Process categories in priority order
  for (const cat of settings.priorityCategories) {
    if (tokensUsed >= maxTokens) break;
    const budget = maxTokens - tokensUsed;

    try {
      let block = '';

      switch (cat) {
        case 'memories': {
          if (!settings.enableMemories) break;
          const keys = await repo.listKeys(agentId) || [];
          const memKeys = keys.filter((k: string) => k.startsWith('mem:')).slice(-20);
          if (memKeys.length === 0) break;

          const entries: string[] = [];
          for (const key of memKeys.slice(-10)) {
            const raw = await repo.get(agentId, key).catch(() => null);
            if (!raw?.value) continue;
            try {
              const val = JSON.parse(raw.value);
              const importance = val.importance === 'high' ? '❗' : val.importance === 'medium' ? '•' : '·';
              entries.push(`${importance} ${val.text || val.value || ''}`);
            } catch {
              entries.push(`· ${String(raw.value).slice(0, 100)}`);
            }
          }
          if (entries.length > 0) {
            block = `🧠 Мои воспоминания (${memKeys.length} записей):\n${entries.join('\n')}`;
          }
          break;
        }

        case 'contacts': {
          if (!settings.enableContacts) break;
          if (!senderId) break;
          block = await buildUserContext(agentId, senderId);
          break;
        }

        case 'lessons': {
          if (!settings.enableLessons) break;
          const keys = await repo.listKeys(agentId) || [];
          const lessonKeys = keys.filter((k: string) => k.startsWith('lesson:')).slice(-10);
          if (lessonKeys.length === 0) break;

          const entries: string[] = [];
          for (const key of lessonKeys.slice(-5)) {
            const raw = await repo.get(agentId, key).catch(() => null);
            if (!raw?.value) continue;
            try {
              const val = JSON.parse(raw.value);
              const icon = val.category === 'error' ? '❌' : val.category === 'success' ? '✅' : '💡';
              entries.push(`${icon} ${val.text || ''}`);
            } catch {}
          }
          if (entries.length > 0) {
            block = `📚 Уроки из опыта:\n${entries.join('\n')}`;
          }
          break;
        }

        case 'knowledge': {
          if (!settings.enableKnowledge) break;
          const keys = await repo.listKeys(agentId) || [];
          const kbKeys = keys.filter((k: string) => k.startsWith('kb:')).slice(-10);
          if (kbKeys.length === 0) break;

          const entries: string[] = [];
          for (const key of kbKeys.slice(-5)) {
            const raw = await repo.get(agentId, key).catch(() => null);
            if (!raw?.value) continue;
            try {
              const val = JSON.parse(raw.value);
              entries.push(`📎 ${val.title || key}: ${(val.content || '').slice(0, 100)}`);
            } catch {}
          }
          if (entries.length > 0) {
            block = `📖 База знаний (${kbKeys.length} записей):\n${entries.join('\n')}`;
          }
          break;
        }
      }

      if (block) {
        const blockTokens = estTokens(block);
        if (blockTokens <= budget) {
          parts.push(block);
          tokensUsed += blockTokens;
        } else {
          // Truncate to fit budget
          const maxChars = Math.floor(budget * 3.5);
          parts.push(block.slice(0, maxChars) + '...');
          tokensUsed = maxTokens;
        }
      }
    } catch {}
  }

  // Always add session summaries and daily log (core memory)
  if (tokensUsed < maxTokens) {
    try {
      const summaries = await getRecentSessionSummaries(agentId, 3);
      if (summaries.length > 0) {
        const block = `📝 Предыдущие сессии:\n${summaries.map(s => `  • ${s}`).join('\n')}`;
        const bt = estTokens(block);
        if (tokensUsed + bt <= maxTokens) {
          parts.push(block);
          tokensUsed += bt;
        }
      }
    } catch {}
  }

  if (tokensUsed < maxTokens) {
    try {
      const log = await getRecentDailyLog(agentId);
      if (log && log.length > 10) {
        const remaining = Math.floor((maxTokens - tokensUsed) * 3.5);
        const truncated = log.length > remaining ? '...' + log.slice(-remaining) : log;
        parts.push(`📅 Дневник:\n${truncated}`);
      }
    } catch {}
  }

  // Chat-specific context
  if (chatId && settings.enableChatDossiers) {
    try {
      const chatCtx = await buildChatContext(agentId, chatId);
      if (chatCtx) parts.push(chatCtx);
    } catch {}
  }

  if (parts.length === 0) return '';
  return `\n━━━ ДОЛГОСРОЧНАЯ ПАМЯТЬ ━━━\n${parts.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/** Browse memory entries by category with pagination */
export async function browseMemory(
  agentId: number,
  category?: string,
  offset: number = 0,
  limit: number = 10,
): Promise<{ entries: Array<{ key: string; preview: string; size: number }>; total: number }> {
  const pool = await getPool();

  // Clamp pagination params
  offset = Math.max(0, Math.floor(offset));
  limit = Math.max(1, Math.min(100, Math.floor(limit)));

  let prefix = '';
  if (category === 'memories') prefix = 'mem:';
  else if (category === 'lessons') prefix = 'lesson:';
  else if (category === 'knowledge') prefix = 'kb:';
  else if (category === 'contacts') prefix = 'contact:';
  else if (category === 'chatDossiers') prefix = 'chat_dossier:';
  else if (category === 'engagement') prefix = 'chat_engagement:';
  else if (category === 'system') prefix = '_';

  const whereClause = prefix ? `AND key LIKE $2` : `AND key NOT LIKE '\\_%'`;
  const params: any[] = [agentId];
  if (prefix) params.push(`${prefix}%`);

  const countRes = await pool.query(
    `SELECT COUNT(*) as cnt FROM builder_bot.agent_state WHERE agent_id = $1 ${whereClause}`,
    params
  );
  const total = parseInt(countRes.rows[0]?.cnt ?? '0', 10) || 0;

  const dataRes = await pool.query(
    `SELECT key, value, length(value::text) as size FROM builder_bot.agent_state WHERE agent_id = $1 ${whereClause} ORDER BY key DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const entries = dataRes.rows.map((r: any) => {
    let preview = '';
    try {
      const val = JSON.parse(r.value);
      preview = val.text || val.title || val.name || val.value || JSON.stringify(val).slice(0, 80);
    } catch {
      preview = String(r.value).slice(0, 80);
    }
    return { key: r.key, preview: preview.slice(0, 80), size: parseInt(r.size) || 0 };
  });

  return { entries, total };
}

/** Run maintenance: enforce limits + TTL + daily log cleanup */
export async function runMemoryMaintenance(agentId: number): Promise<{ pruned: number; expired: number; logsDeleted: number }> {
  const { pruned } = await enforceRetentionLimits(agentId);
  const { expired } = await applyMemoryTTL(agentId);
  const logsDeleted = await cleanupOldDailyLogs(agentId, 60);
  return { pruned, expired, logsDeleted };
}
