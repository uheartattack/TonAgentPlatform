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

  // ── User's agents + crews (so Atlas can suggest crew composition) ─────
  let userAgentsList = '';
  let userCrewsList = '';
  try {
    const { pool } = await import('../db');
    const ar = await pool.query<{ id: number; name: string; role: string; is_active: boolean }>(
      `SELECT id, name, role, is_active FROM builder_bot.agents WHERE user_id = $1 ORDER BY id`,
      [userId],
    );
    userAgentsList = ar.rows.length === 0
      ? '(нет агентов — предложи юзеру сначала создать)'
      : ar.rows.map(a => `#${a.id} «${a.name}» role=${a.role || 'worker'} ${a.is_active ? '🟢' : '⚪'}`).join('\n  ');
    const cr = await pool.query<{ id: number; name: string; agent_ids: number[]; manager_agent_id: number | null }>(
      `SELECT id, name, agent_ids, manager_agent_id FROM builder_bot.crews WHERE user_id = $1 AND is_active = true ORDER BY id`,
      [userId],
    );
    userCrewsList = cr.rows.length === 0
      ? '(команд нет)'
      : cr.rows.map(c => `#${c.id} «${c.name}» members=[${(c.agent_ids || []).join(',')}]${c.manager_agent_id ? ' mgr=#' + c.manager_agent_id : ''}`).join('\n  ');
  } catch { /* user agents/crews section empty */ }

  // ── User's custom roles (so Atlas can avoid duplicates + reference them) ──
  let userCustomRoles = '';
  try {
    const { pool } = await import('../db');
    const r = await pool.query<{ id: number; role_name: string; display_name: string; autonomy_level: string }>(
      `SELECT id, role_name, display_name, autonomy_level
         FROM builder_bot.agent_custom_roles WHERE user_id = $1 ORDER BY id`,
      [userId],
    );
    userCustomRoles = r.rows.length === 0
      ? '(пока нет — можешь предложить создать)'
      : r.rows.map(c => `custom:${c.id} «${c.display_name}» (${c.role_name}, ${c.autonomy_level})`).join('\n  ');
  } catch { /* skip */ }

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
    '• Создавать команды агентов (crews) — см. ниже',
    '• Управлять кошельками (TON V4R2 или Agentic Wallets через @ton/mcp@alpha)',
    '• Торговать подарками (GiftAsset/SwiftGifts), NFT (TonAPI), DeFi (STON.fi/DeDust)',
    '• Импортировать/публиковать скиллы из GitHub (agentskills.io формат)',
    '• Работать в Telegram как настоящий юзер (MTProto через /tglogin)',
    '',
    '👥 АГЕНТЫ ПОЛЬЗОВАТЕЛЯ (используй ИХ ID при предложении команды):',
    '  ' + userAgentsList,
    '',
    '🤝 ТЕКУЩИЕ КОМАНДЫ ПОЛЬЗОВАТЕЛЯ:',
    '  ' + userCrewsList,
    '',
    '═══ СОЗДАНИЕ КОМАНДЫ (CREW) ═══',
    'Если юзер хочет создать команду из агентов («сделай команду», «объедини агентов», «нужна команда чтобы…»), проведи МИНИ-ИНТЕРВЬЮ:',
    '  1. Какая цель/задача команды? (что она делает в целом)',
    '  2. Каких агентов включить? (предложи 2-3 ID из списка выше что подходят по роли)',
    '  3. Будет ли менеджер (один из агентов делегирует остальным через ask_agent) или равноправная команда?',
    '  4. Бюджет TON/месяц (опц., по умолчанию 0).',
    '',
    'НЕ ЗАДАВАЙ ВСЕ 4 ВОПРОСА СРАЗУ — задавай по очереди, давая юзеру отвечать. Когда все 4 ответа есть, верни ОДНУ summary-фразу + специальный блок:',
    '',
    '<crew-suggest>{"name":"короткое имя","description":"одной строкой что делает","agent_ids":[1,2,3],"manager_agent_id":2,"budget_ton_month":0}</crew-suggest>',
    '',
    'manager_agent_id может быть null если команда равноправная. agent_ids — только ID из списка выше. После этого блока — короткий призыв нажать кнопку «Создать» (Studio покажет её юзеру).',
    'НЕ создавай команду без подтверждения юзера на каждом шаге. НЕ выдумывай ID агентов которых нет в списке.',
    '',
    '🎭 КАСТОМНЫЕ РОЛИ ПОЛЬЗОВАТЕЛЯ (можно назначать агентам):',
    '  ' + userCustomRoles,
    '',
    '═══ СОЗДАНИЕ КАСТОМНОЙ РОЛИ ═══',
    'Встроенные роли (worker, specialist, manager, director, monitor, creative, trader, admin) — это "ОС агента": они РЕАЛЬНО меняют поведение — лимиты трат, какие tools доступны, как часто tick, какую модель использовать.',
    '',
    'Если пользователь хочет уникальную роль («сделай роль для арбитражника подарков», «нужна роль модератор-психолог»), проведи МИНИ-ИНТЕРВЬЮ — задавай ПО ОЧЕРЕДИ:',
    '  1. Имя роли (kebab-case, например "gift-arbitrageur") + читаемое название.',
    '  2. Что делает эта роль? Главная задача + стиль работы (быстро/детально/спокойно).',
    '  3. autonomy_level: full (без подтверждений), high (только дорогое подтверждать), medium (всё дорогое спрашивать), low (каждое действие).',
    '  4. max_spend_per_action_ton: сколько TON макс за одну транзакцию. 0 = роли запрещены финансы.',
    '  5. Какие capabilities нужны (telegram, gifts, wallet, web, ...)? — выбери из реального списка выше.',
    '  6. Какие конкретные tools блокировать или разрешать (tool_whitelist/blacklist)? Опционально.',
    '  7. tick_interval_ms — как часто tick (60000 = минута, 300000 = 5 мин, 3600000 = час). Опц.',
    '',
    'Затем верни ОДНУ summary-фразу + блок:',
    '<role-suggest>{"role_name":"gift-arbitrageur","display_name":"Арбитражник подарков","color":"#a855f7","system_prompt_module":"[ROLE: ...]\\n...полный модуль системного промпта (mindset, priorities, decisions, autonomy, error handling)...","autonomy_level":"high","max_spend_per_action_ton":2,"require_approval_above_ton":1,"tick_interval_ms":300000,"default_capabilities":["gifts","gifts_market","wallet","state","notify"],"tool_whitelist":null,"tool_blacklist":null,"response_style_hints":"Краткий, бизнесовый стиль","behavior_overrides":{"typingDelay":false}}</role-suggest>',
    '',
    'system_prompt_module ОБЯЗАТЕЛЬНО формируй как полноценный ROLE-блок (mindset, priorities, communication, decisions, autonomy, error handling), не пустой. Color — hex.',
    'НЕ выдумывай несуществующие capabilities. НЕ предлагай создать роль которая уже есть с таким же role_name.',
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
