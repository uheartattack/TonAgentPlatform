/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS — Studio AI assistant system prompt builder
 *
 * Single source of truth for what Atlas knows. Used by:
 *   - api-server.ts POST /api/chat/stream  (production)
 *   - eval/atlas/run-evals.ts              (eval harness)
 *
 * The system prompt is built at REQUEST TIME with LIVE inventory:
 *   - CAPABILITY_TOOL_MAP keys (real capability IDs)
 *   - listSkillsForAgent() (real 12 built-in + user/public skills)
 *   - agentTemplates (real template IDs)
 *
 * Plus extra LEARNED RULES appended from `atlas-prompt-rules.md` — this is
 * the file the training loop edits to fix specific failure modes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';

const RULES_FILE = path.resolve(__dirname, '..', 'config', 'atlas-prompt-rules.md');

export interface AtlasContext {
  page?: string;
  agentId?: number | string;
}

/**
 * Build the full Atlas system prompt for a given user + context.
 * Pulls live platform data; never returns a static string.
 */
export async function buildAtlasSystemPrompt(userId: number, context?: AtlasContext): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  // ── Live platform inventory ──────────────────────────────────────────────
  let realCaps = '';
  let realSkills = '';
  let realTemplates = '';
  let skillCount = 0;

  try {
    const { CAPABILITY_TOOL_MAP, TOOLSET_PROFILES } = await import('../agents/ai-agent-runtime');
    realCaps = Object.keys(CAPABILITY_TOOL_MAP).sort().join(', ');
    // TOOLSET_PROFILES intentionally NOT mixed into the capability list —
    // their keys (e.g. "gifts_market") are user-facing labels, not capability
    // IDs, and Atlas mistakes them for real caps if exposed inline.
    // If you need to surface profiles, do it under a separate header.
    void TOOLSET_PROFILES;
  } catch { /* fail open — caps section empty */ }

  try {
    const { listSkillsForAgent } = await import('./skill-registry');
    const skills = await listSkillsForAgent(0, userId);
    skillCount = skills.length;
    realSkills = skills.map(s => `${s.name}: ${s.description.slice(0, 70)}`).join('\n  ');
  } catch { /* skills section empty */ }

  try {
    const tplMod = await import('../agent-templates');
    const agentTemplates = (tplMod as any).agentTemplates;
    if (Array.isArray(agentTemplates)) {
      realTemplates = `${agentTemplates.length} шаблонов: ` +
        agentTemplates.slice(0, 12).map((t: any) => t.id || t.name).filter(Boolean).join(', ');
    }
  } catch { /* templates section empty */ }

  // ── Learned rules (training-loop-edited) ─────────────────────────────────
  let learnedRules = '';
  try {
    if (fs.existsSync(RULES_FILE)) {
      learnedRules = fs.readFileSync(RULES_FILE, 'utf-8').trim();
    }
  } catch { /* no learned rules yet */ }

  const lines: string[] = [
    'Ты — Atlas, главный AI-ассистент TON Agent Platform.',
    `Сегодня: ${dateStr}.`,
    '',
    '🚨 ПРАВИЛА АНТИ-ГАЛЛЮЦИНАЦИЙ — ОБЯЗАТЕЛЬНО:',
    '• ВСЕГДА используй ТОЛЬКО те имена capabilities, скиллов, шаблонов, провайдеров которые указаны НИЖЕ.',
    '• НИКОГДА не выдумывай имена типа "TON_Storage", "Code_interpreter", "Calendar" — таких НЕТ.',
    '• Если пользователь спрашивает «есть ли X» — ищи X в списке. Если нет → честно скажи «такого нет, но есть Y которое делает похожее».',
    '• Если не уверен — скажи «не помню точно, посмотрите в Studio → Capabilities» а НЕ придумывай.',
    '',
    '📦 РЕАЛЬНЫЕ CAPABILITIES (точные ID, регистр важен):',
    realCaps || '(не загружены)',
    '',
    `🧠 РЕАЛЬНЫЕ SKILLS (agentskills.io spec, всего ${skillCount}):`,
    '  ' + (realSkills || '(не загружены)'),
    '',
    '📋 РЕАЛЬНЫЕ ШАБЛОНЫ:',
    '  ' + (realTemplates || '(не загружены)'),
    '',
    '🤖 РЕАЛЬНЫЕ AI ПРОВАЙДЕРЫ (7): gemini, anthropic, openai, groq, deepseek, openrouter, together. Платформенный fallback: Atlas через Gemini 2.5 Flash.',
    '',
    '🛠 ЧТО МОЖНО ДЕЛАТЬ:',
    '• Создавать агентов: скажи "создай агента [описание]"',
    '• Управлять кошельками (TON V4R2 или Agentic Wallets через @ton/mcp@alpha)',
    '• Торговать подарками (GiftAsset/SwiftGifts), NFT (TonAPI), DeFi (STON.fi/DeDust)',
    '• Импортировать/публиковать скиллы из GitHub (agentskills.io формат)',
    '• Работать в Telegram как настоящий юзер (MTProto через /tglogin)',
    '',
    'Отвечай кратко и по делу. Говори на языке пользователя. Когда перечисляешь возможности — бери имена ИЗ СПИСКА ВЫШЕ.',
  ];

  // Learned rules are part of the (mostly) static prefix — they only change a
  // few times per day during training loop iterations. Cache-friendly.
  if (learnedRules) {
    lines.push('');
    lines.push('━━━ LEARNED RULES (training loop) ━━━');
    lines.push(learnedRules);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  // Pattern #10 — explicit boundary between cacheable static prefix and
  // per-request dynamic tail. Anthropic SDK path splits on this marker
  // and applies cache_control: ephemeral to the prefix only.
  lines.push('\n\n<!-- DYNAMIC -->\n\n');

  // Dynamic tail — changes per request (page context, agent target, etc.)
  if (context) {
    lines.push(`Контекст: страница="${context.page}", агент=${context.agentId || 'нет'}`);
  }

  return lines.filter(Boolean).join('\n');
}

/**
 * Returns the raw learned rules content (for inspection / editing by loop).
 */
export function readLearnedRules(): string {
  try {
    return fs.existsSync(RULES_FILE) ? fs.readFileSync(RULES_FILE, 'utf-8') : '';
  } catch { return ''; }
}

/**
 * Overwrite learned rules. Used by the training-loop iterator.
 */
export function writeLearnedRules(content: string): void {
  const dir = path.dirname(RULES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RULES_FILE, content, 'utf-8');
}
