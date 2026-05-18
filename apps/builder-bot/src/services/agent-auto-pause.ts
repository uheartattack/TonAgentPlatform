/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENT AUTO-PAUSE
 *
 * Stops misbehaving agents to prevent log spam + API waste:
 *   • NO_API_KEY                 — pause IMMEDIATELY (no point retrying)
 *   • 401 invalid_api_key        — pause after 3 consecutive errors
 *   • 402 insufficient_credits   — pause after 3 consecutive errors
 *   • Custom reason              — pause + custom message
 *
 * Counters live in agent_state under `_err_counter_<key>` and reset on any
 * successful run via recordSuccess().
 *
 * Notifies the agent owner via bot DM with concrete instructions on how
 * to fix + resume.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';

let _pool: Pool | null = null;
function getPool(): Pool {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _pool = require('../db').pool as Pool;
  return _pool;
}

export type PauseReason =
  | 'NO_API_KEY'
  | 'INVALID_API_KEY'        // 401
  | 'INSUFFICIENT_CREDITS'   // 402
  | 'TPM_EXCEEDED'           // 413 — Tokens Per Minute limit
  | 'CONTEXT_OVERFLOW'
  | 'CIRCUIT_BREAKER'
  | 'CUSTOM';

interface PauseSpec {
  threshold: number;           // how many consecutive errors before pause
  emoji: string;
  title: string;
  ruInstructions: string;
  enInstructions: string;
}

const SPECS: Record<PauseReason, PauseSpec> = {
  NO_API_KEY: {
    threshold: 1,
    emoji: '🔑',
    title: 'API key not configured',
    ruInstructions: 'Открой Studio → Профиль → API ключи → добавь свой ключ. После — открой агента и нажми Start.',
    enInstructions: 'Open Studio → Profile → API keys → add your key. Then open the agent and click Start.',
  },
  INVALID_API_KEY: {
    threshold: 3,
    emoji: '🚫',
    title: 'API key invalid or expired',
    ruInstructions: 'Текущий ключ агента неверный или истёк. Открой Studio → настройки агента → AI Settings → обнови ключ. Затем Start.',
    enInstructions: 'Current API key is invalid or expired. Open Studio → agent settings → AI Settings → update the key. Then Start.',
  },
  INSUFFICIENT_CREDITS: {
    threshold: 3,
    emoji: '💸',
    title: 'AI provider — insufficient credits',
    ruInstructions: 'У провайдера закончился баланс. Пополни счёт у провайдера или переключи агента на бесплатный (Gemini AI Studio). Затем Start.',
    enInstructions: 'Provider account is out of credits. Top up the provider balance or switch the agent to a free one (Gemini AI Studio). Then Start.',
  },
  TPM_EXCEEDED: {
    threshold: 3,
    emoji: '⏱️',
    title: 'Token-per-minute limit hit',
    ruInstructions: 'У провайдера (видимо Groq) маленький TPM лимит — твой запрос больше, чем разрешено в минуту. Переключи агента на Gemini (1М контекст бесплатно), либо увеличь интервал агента, либо отключи лишние tools/capabilities.',
    enInstructions: 'Provider (likely Groq) has a low TPM limit — your request exceeds the per-minute allowance. Switch the agent to Gemini (1M context free), or increase the agent interval, or disable extra tools/capabilities.',
  },
  CONTEXT_OVERFLOW: {
    threshold: 5,
    emoji: '📏',
    title: 'Context overflow — persistent',
    ruInstructions: 'Контекст агента стабильно переполняется. Переключи на модель с большим окном (Gemini 128K, Claude 200K) или сократи system prompt.',
    enInstructions: 'Agent context keeps overflowing. Switch to a larger-window model (Gemini 128K, Claude 200K) or shorten system prompt.',
  },
  CIRCUIT_BREAKER: {
    threshold: 10,
    emoji: '⚡',
    title: 'Repeated API failures',
    ruInstructions: 'Агент слишком часто получает ошибки от AI. Проверь статус провайдера, либо переключи на другого.',
    enInstructions: 'Agent keeps getting errors from AI. Check provider status or switch to a different one.',
  },
  CUSTOM: {
    threshold: 1,
    emoji: '⏸️',
    title: 'Agent paused',
    ruInstructions: 'Открой агента в Studio для деталей.',
    enInstructions: 'Open the agent in Studio for details.',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Counter increment / reset
// ─────────────────────────────────────────────────────────────────────────

/** Increment consecutive error counter. Returns new count.
 * Looks up owner user_id from agents table — agent_state requires user_id NOT NULL.
 */
export async function incrementErrorCount(agentId: number, reason: PauseReason): Promise<number> {
  const pool = getPool();
  try {
    const key = `_err_counter_${reason}`;
    // Need owner user_id for agent_state composite key (agent_id, user_id, key)
    const ownerRes = await pool.query(`SELECT user_id FROM builder_bot.agents WHERE id = $1`, [agentId]);
    if (!ownerRes.rows[0]) return 0;
    const ownerId = ownerRes.rows[0].user_id;

    const res = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id = $1 AND key = $2`,
      [agentId, key],
    );
    let count = 0;
    if (res.rows[0]) {
      try {
        const v = typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value;
        count = typeof v === 'number' ? v : (typeof v?.count === 'number' ? v.count : 0);
      } catch { count = 0; }
    }
    count = count + 1;
    // UNIQUE constraint in agent_state is (agent_id, key) — not including user_id
    await pool.query(
      `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (agent_id, key) DO UPDATE SET value = $4::jsonb, updated_at = NOW()`,
      [agentId, ownerId, key, JSON.stringify(count)],
    );
    return count;
  } catch (e: any) {
    console.warn(`[AutoPause] incrementErrorCount failed for #${agentId}:`, e?.message);
    return 0;
  }
}

/** Called after each successful tick — wipes all error counters for this agent. */
export async function recordSuccess(agentId: number): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `DELETE FROM builder_bot.agent_state WHERE agent_id = $1 AND key LIKE '_err_counter_%'`,
      [agentId],
    );
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// Core: pause + notify
// ─────────────────────────────────────────────────────────────────────────

/** Sets is_active=false, notifies owner via bot DM, logs the event. Idempotent. */
export async function pauseAgent(
  agentId: number,
  userId: number,
  reason: PauseReason,
  details?: string,
): Promise<{ paused: boolean; alreadyPaused: boolean }> {
  const pool = getPool();
  try {
    // Check if already paused (idempotent)
    const cur = await pool.query(
      `SELECT is_active, name FROM builder_bot.agents WHERE id = $1`,
      [agentId],
    );
    if (!cur.rows[0]) return { paused: false, alreadyPaused: false };
    const alreadyPaused = cur.rows[0].is_active === false;
    if (alreadyPaused) return { paused: false, alreadyPaused: true };

    // Pause the agent
    await pool.query(
      `UPDATE builder_bot.agents SET is_active = false WHERE id = $1`,
      [agentId],
    );

    // Wipe error counters so resume gets a clean slate
    await recordSuccess(agentId).catch(() => {});

    // Mark notification sent so we don't spam — store directly via pool to
    // avoid coupling to the in-source state repository module (path may vary)
    try {
      await pool.query(
        `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())
         ON CONFLICT (agent_id, key) DO UPDATE SET value = $4::jsonb, updated_at = NOW()`,
        [agentId, userId, '_paused_reason', JSON.stringify({ reason, at: new Date().toISOString(), details })],
      );
    } catch {}

    // Notify owner via bot DM
    const spec = SPECS[reason];
    const name = cur.rows[0].name;
    const text = [
      `${spec.emoji} <b>Agent #${agentId} «${escHtml(name)}» — paused</b>`,
      ``,
      `<b>Reason:</b> ${spec.title}`,
      details ? `<b>Details:</b> ${escHtml(details).slice(0, 300)}` : '',
      ``,
      spec.ruInstructions,
    ].filter(Boolean).join('\n');

    try {
      const botToken = process.env.BOT_TOKEN;
      if (botToken && userId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userId,
            text,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: 'Open agent in Studio', url: `https://tonagentplatform.com/studio.html` },
              ]],
            },
          }),
        });
      }
    } catch (e: any) {
      console.warn(`[AutoPause] notify owner ${userId} failed:`, e?.message);
    }

    // Log in DB directly to avoid runtime-circular imports
    try {
      await pool.query(
        `INSERT INTO builder_bot.agent_logs (agent_id, level, message, created_at)
         VALUES ($1, 'warn', $2, NOW())`,
        [agentId, `[AutoPause] Agent paused: ${reason}${details ? ' — ' + details.slice(0, 100) : ''}`],
      );
    } catch {}

    return { paused: true, alreadyPaused: false };
  } catch (e: any) {
    console.warn(`[AutoPause] pauseAgent failed for #${agentId}:`, e?.message);
    return { paused: false, alreadyPaused: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Single helper called from runtime when an error occurs
// ─────────────────────────────────────────────────────────────────────────

/**
 * Records an error and pauses the agent if threshold reached.
 * Returns true if the agent was just paused (caller can stop further work).
 */
export async function recordErrorMaybePause(
  agentId: number,
  userId: number,
  reason: PauseReason,
  details?: string,
): Promise<boolean> {
  const spec = SPECS[reason];
  const count = await incrementErrorCount(agentId, reason);
  if (count >= spec.threshold) {
    const result = await pauseAgent(agentId, userId, reason, details);
    return result.paused;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
