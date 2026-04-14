/**
 * engagement.ts — Complete engagement system for beta testing platform
 *
 * Exports functions and data for:
 *   1. Onboarding quest (7 steps)
 *   2. Daily quests (7 days, 2 levels)
 *   3. Weekly events (4 events)
 *   4. Zone tasks (60 tasks, 10 per zone)
 *   5. Achievements (70+)
 *   6. Daily digest
 *   7. Ping inactive testers
 *   8. Hall of fame
 *   9. Quality score
 *  10. Internship info
 *  11. Streak multiplier
 *  12. Weekly decay
 *
 * Usage: import { ... } from './engagement';
 * DB: require('./db').pool  or  require('./db/index').pool
 */

import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// Custom Emoji helper
// ═══════════════════════════════════════════════════════════════════════════════

const CE: Record<string, string> = {
  fire:    '5420315771991497307',
  trophy:  '5409008750893734809',
  diamond: '5471952986970267163',
  rocket:  '5445284980978621387',
  crown:   '5467406098367521267',
  bug:     '5397991236361527676',
  bulb:    '5472146462362048818',
  coin:    '5375296873982604963',
  lab:     '5411512278740640309',
  check:   '5427009714745517609',
  star:    '5469741319330996757',
  target:  '5350460637182993292',
  cart:    '5431499171045581032',
  sparkle: '5472164874886846699',
};

function ce(name: string, fb: string): string {
  return CE[name]
    ? `<tg-emoji emoji-id="${CE[name]}">${fb}</tg-emoji>`
    : fb;
}

function escHtml(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getPool(): Pool {
  return require('./db').pool || require('./db/index').pool;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ONBOARDING QUEST
// ═══════════════════════════════════════════════════════════════════════════════

export interface OnboardingStep {
  id: string;
  title: string;
  titleEn: string;
  xp: number;
  check: string;
  optional?: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'provider',    title: 'Выбери AI-провайдера',         titleEn: 'Choose AI provider',         xp: 3,  check: 'config' },
  { id: 'first_agent', title: 'Создай первого агента',        titleEn: 'Create first agent',          xp: 10, check: 'agents_count' },
  { id: 'chat_agent',  title: 'Напиши агенту сообщение',      titleEn: 'Message your agent',          xp: 5,  check: 'agent_chat' },
  { id: 'checkin',     title: 'Сделай /checkin',              titleEn: 'Do /checkin',                 xp: 3,  check: 'checkin' },
  { id: 'zone',        title: 'Выбери зону тестирования',     titleEn: 'Pick testing zone',           xp: 5,  check: 'zones' },
  { id: 'feedback',    title: 'Отправь первый фидбек',        titleEn: 'Send first feedback',         xp: 10, check: 'feedback' },
  { id: 'invite',      title: 'Пригласи друга (бонус)',       titleEn: 'Invite a friend (bonus)',     xp: 20, check: 'referral', optional: true },
];

export interface QuestProgress {
  currentStep: number;
  completed: string[];
  totalXP: number;
}

export async function getQuestProgress(userId: number): Promise<QuestProgress> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'quest_progress'`,
    [userId],
  );
  if (res.rows.length > 0) {
    const v = res.rows[0].value as any;
    return {
      currentStep: v.currentStep ?? 0,
      completed: v.completed ?? [],
      totalXP: v.totalXP ?? 0,
    };
  }
  return { currentStep: 0, completed: [], totalXP: 0 };
}

async function saveQuestProgress(userId: number, progress: QuestProgress): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
     VALUES ($1, 'quest_progress', $2::jsonb, NOW())
     ON CONFLICT (user_id, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [userId, JSON.stringify(progress)],
  );
}

export async function checkQuestStep(userId: number, stepId: string): Promise<boolean> {
  const pool = getPool();
  const step = ONBOARDING_STEPS.find(s => s.id === stepId);
  if (!step) return false;

  switch (step.check) {
    case 'config': {
      const r = await pool.query(
        `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'ai_provider'`,
        [userId],
      );
      return r.rows.length > 0;
    }
    case 'agents_count': {
      const r = await pool.query(
        `SELECT COUNT(*) as cnt FROM builder_bot.agents WHERE user_id = $1`,
        [userId],
      );
      return parseInt(r.rows[0]?.cnt || '0', 10) >= 1;
    }
    case 'agent_chat': {
      const r = await pool.query(
        `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'agent_chat_count'`,
        [userId],
      );
      const cnt = (r.rows[0]?.value as any)?.count ?? 0;
      return cnt >= 1;
    }
    case 'checkin': {
      const r = await pool.query(
        `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'last_checkin'`,
        [userId],
      );
      return r.rows.length > 0;
    }
    case 'zones': {
      const r = await pool.query(
        `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'testing_zones'`,
        [userId],
      );
      const zones = (r.rows[0]?.value as any)?.zones ?? [];
      return zones.length >= 1;
    }
    case 'feedback': {
      const r = await pool.query(
        `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'feedback_count'`,
        [userId],
      );
      const cnt = (r.rows[0]?.value as any)?.count ?? 0;
      return cnt >= 1;
    }
    case 'referral': {
      const r = await pool.query(
        `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'referral_count'`,
        [userId],
      );
      const cnt = (r.rows[0]?.value as any)?.count ?? 0;
      return cnt >= 1;
    }
    default:
      return false;
  }
}

export async function advanceQuest(userId: number): Promise<{ advanced: boolean; newStep?: string; completed?: boolean }> {
  const progress = await getQuestProgress(userId);
  const requiredSteps = ONBOARDING_STEPS.filter(s => !s.optional);
  const allSteps = ONBOARDING_STEPS;

  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (progress.completed.includes(step.id)) continue;
    const done = await checkQuestStep(userId, step.id);
    if (done) {
      progress.completed.push(step.id);
      progress.totalXP += step.xp;
      progress.currentStep = i + 1;

      const allRequiredDone = requiredSteps.every(s => progress.completed.includes(s.id));
      await saveQuestProgress(userId, progress);

      if (allRequiredDone) {
        return { advanced: true, completed: true };
      }
      return { advanced: true, newStep: step.id };
    }
  }
  return { advanced: false };
}

export async function formatQuestMessage(userId: number, ru: boolean): Promise<string> {
  const progress = await getQuestProgress(userId);
  const total = ONBOARDING_STEPS.filter(s => !s.optional).length;
  const doneCount = progress.completed.filter(
    id => !ONBOARDING_STEPS.find(s => s.id === id)?.optional,
  ).length;
  const pct = Math.round((doneCount / total) * 100);

  const barLen = 10;
  const filled = Math.round((pct / 100) * barLen);
  const bar = ''.padStart(filled, '\u2588') + ''.padStart(barLen - filled, '\u2591');

  let msg = `${ce('rocket', '\u{1F680}')} <b>${ru ? 'Онбординг-квест' : 'Onboarding Quest'}</b>\n\n`;
  msg += `${bar} ${pct}%  (${doneCount}/${total})\n`;
  msg += `${ce('coin', '\u{1FA99}')} XP: <b>${progress.totalXP}</b>\n\n`;

  for (const step of ONBOARDING_STEPS) {
    const done = progress.completed.includes(step.id);
    const icon = done ? ce('check', '\u2705') : (step.optional ? '\u{2B50}' : '\u{25CB}');
    const title = ru ? step.title : step.titleEn;
    const opt = step.optional ? (ru ? ' (бонус)' : ' (bonus)') : '';
    const xpStr = done ? `<s>+${step.xp} XP</s>` : `+${step.xp} XP`;
    msg += `${icon} ${escHtml(title)}${opt} — ${xpStr}\n`;
  }

  if (pct >= 100) {
    msg += `\n${ce('trophy', '\u{1F3C6}')} <b>${ru ? 'Квест завершён! Отличная работа!' : 'Quest complete! Great job!'}</b>`;
  } else {
    const nextStep = ONBOARDING_STEPS.find(s => !progress.completed.includes(s.id) && !s.optional);
    if (nextStep) {
      msg += `\n${ce('target', '\u{1F3AF}')} <b>${ru ? 'Следующий шаг' : 'Next step'}:</b> ${ru ? nextStep.title : nextStep.titleEn}`;
    }
  }

  return msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DAILY QUESTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface DailyQuestLevel {
  title: string;
  titleEn: string;
  xp: number;
}

export interface DailyQuestDay {
  standard: DailyQuestLevel;
  hardcore: DailyQuestLevel;
}

export const DAILY_QUESTS: Record<number, DailyQuestDay> = {
  0: { // Sunday
    standard: { title: 'Пройди 3 тест-сценария',                            titleEn: 'Complete 3 test scenarios',                           xp: 15 },
    hardcore: { title: 'Полный аудит Onboarding — 10+ скринов, отчёт',      titleEn: 'Full Onboarding audit — 10+ screenshots, report',     xp: 40 },
  },
  1: { // Monday
    standard: { title: 'Создай агента с 5 тулами и пришли скрин',           titleEn: 'Create agent with 5 tools and send screenshot',       xp: 15 },
    hardcore: { title: 'Агент-мониторщик цены TON с алертами',              titleEn: 'TON price monitor agent with alerts',                 xp: 40 },
  },
  2: { // Tuesday
    standard: { title: 'Найди и зарепорть 2 бага',                          titleEn: 'Find and report 2 bugs',                              xp: 15 },
    hardcore: { title: 'Воспроизведи и задокументируй 5 багов со скринами', titleEn: 'Reproduce and document 5 bugs with screenshots',      xp: 40 },
  },
  3: { // Wednesday
    standard: { title: 'Протестируй DeFi-фичи: баланс + swap',             titleEn: 'Test DeFi features: balance + swap',                  xp: 15 },
    hardcore: { title: 'Полный DeFi flow: staking + swap + мониторинг',     titleEn: 'Full DeFi flow: staking + swap + monitoring',         xp: 40 },
  },
  4: { // Thursday
    standard: { title: 'Проверь 3 шаблона из маркетплейса',                 titleEn: 'Test 3 marketplace templates',                        xp: 15 },
    hardcore: { title: 'Создай и опубликуй свой шаблон в маркетплейс',      titleEn: 'Create and publish your own template to marketplace', xp: 40 },
  },
  5: { // Friday
    standard: { title: 'Напиши пост или видео-обзор платформы',             titleEn: 'Write a post or video review of the platform',        xp: 15 },
    hardcore: { title: 'Туториал: создание агента от А до Я (видео/текст)', titleEn: 'Tutorial: agent creation A-Z (video or text)',        xp: 40 },
  },
  6: { // Saturday
    standard: { title: 'Пригласи 2 друзей и помоги им начать',              titleEn: 'Invite 2 friends and help them get started',          xp: 15 },
    hardcore: { title: 'Организуй мини-тестатон с 5 участниками',           titleEn: 'Organize a mini test-a-thon with 5 participants',     xp: 40 },
  },
};

export function getDailyQuest(dayOfWeek?: number): DailyQuestDay {
  const dow = dayOfWeek ?? new Date().getDay();
  return DAILY_QUESTS[dow] || DAILY_QUESTS[0];
}

export function formatDailyQuestMessage(ru: boolean, dayOfWeek?: number): string {
  const quest = getDailyQuest(dayOfWeek);
  const dayNames = ru
    ? ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dow = dayOfWeek ?? new Date().getDay();

  let msg = `${ce('target', '\u{1F3AF}')} <b>${ru ? 'Ежедневный квест' : 'Daily Quest'}</b> — ${dayNames[dow]}\n\n`;
  msg += `${ce('star', '\u2B50')} <b>${ru ? 'Стандарт' : 'Standard'}:</b>\n`;
  msg += `${ru ? quest.standard.title : quest.standard.titleEn}\n`;
  msg += `${ce('coin', '\u{1FA99}')} +${quest.standard.xp} XP\n\n`;
  msg += `${ce('fire', '\u{1F525}')} <b>${ru ? 'Хардкор' : 'Hardcore'}:</b>\n`;
  msg += `${ru ? quest.hardcore.title : quest.hardcore.titleEn}\n`;
  msg += `${ce('coin', '\u{1FA99}')} +${quest.hardcore.xp} XP\n`;

  return msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. WEEKLY EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface WeeklyEvent {
  id: string;
  title: string;
  titleRu: string;
  start: string;
  end: string;
  type: string;
  bonusMultiplier?: number;
  bonusXP?: number;
  reward: string;
}

export const WEEKLY_EVENTS: WeeklyEvent[] = [
  {
    id: 'break_it_1',
    title: '\u{1F528} Break It Week',
    titleRu: '\u{1F528} \u041D\u0435\u0434\u0435\u043B\u044F \u0411\u0430\u0433\u043E\u0432',
    start: '2026-04-14',
    end: '2026-04-20',
    type: 'bugs',
    bonusMultiplier: 2,
    reward: 'Bug Hunter tag',
  },
  {
    id: 'agent_challenge_1',
    title: '\u{1F916} Agent Challenge',
    titleRu: '\u{1F916} \u0421\u043E\u0437\u0434\u0430\u0439 \u0410\u0433\u0435\u043D\u0442\u0430',
    start: '2026-04-21',
    end: '2026-04-27',
    type: 'agents',
    bonusXP: 20,
    reward: '100 Points',
  },
  {
    id: 'content_week_1',
    title: '\u{1F4E2} Content Week',
    titleRu: '\u{1F4E2} \u041D\u0435\u0434\u0435\u043B\u044F \u041A\u043E\u043D\u0442\u0435\u043D\u0442\u0430',
    start: '2026-04-28',
    end: '2026-05-04',
    type: 'content',
    bonusXP: 30,
    reward: '150 Points',
  },
  {
    id: 'finals_1',
    title: '\u{1F3C6} Finals',
    titleRu: '\u{1F3C6} \u0424\u0438\u043D\u0430\u043B \u0421\u0435\u0437\u043E\u043D\u0430',
    start: '2026-05-05',
    end: '2026-05-11',
    type: 'finals',
    reward: 'Internship invite',
  },
];

export function getCurrentEvent(): WeeklyEvent | null {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return WEEKLY_EVENTS.find(e => today >= e.start && today <= e.end) || null;
}

export function formatEventMessage(ru: boolean): string {
  const evt = getCurrentEvent();
  if (!evt) {
    return `${ce('star', '\u2B50')} <b>${ru ? '\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0438\u0432\u0435\u043D\u0442\u0430' : 'No active event'}</b>\n${ru ? '\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u0438\u0432\u0435\u043D\u0442\u044B \u0441\u043A\u043E\u0440\u043E!' : 'Next events coming soon!'}`;
  }

  const endDate = new Date(evt.end + 'T23:59:59');
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const diffHours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

  const timer = diffDays > 0
    ? `${diffDays}${ru ? 'д' : 'd'}`
    : `${diffHours}${ru ? 'ч' : 'h'}`;

  let msg = `${ce('fire', '\u{1F525}')} <b>${ru ? evt.titleRu : evt.title}</b>\n\n`;
  msg += `${ru ? '\u0414\u0430\u0442\u044B' : 'Dates'}: ${evt.start} \u2014 ${evt.end}\n`;
  msg += `\u23F3 ${ru ? '\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C' : 'Remaining'}: <b>${timer}</b>\n\n`;

  if (evt.bonusMultiplier) {
    msg += `${ce('sparkle', '\u2728')} ${ru ? '\u0411\u043E\u043D\u0443\u0441' : 'Bonus'}: x${evt.bonusMultiplier} XP ${ru ? '\u0437\u0430 \u0431\u0430\u0433\u0438' : 'for bugs'}\n`;
  }
  if (evt.bonusXP) {
    msg += `${ce('coin', '\u{1FA99}')} ${ru ? '\u0411\u043E\u043D\u0443\u0441' : 'Bonus'}: +${evt.bonusXP} XP\n`;
  }
  msg += `${ce('trophy', '\u{1F3C6}')} ${ru ? '\u041D\u0430\u0433\u0440\u0430\u0434\u0430' : 'Reward'}: <b>${escHtml(evt.reward)}</b>\n`;

  return msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ZONE TASKS (60 tasks, 10 per zone, 2 per level 1-5)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ZoneTask {
  id: string;
  zone: string;
  level: number;
  title: string;
  titleEn: string;
  xp: number;
  autoCheck: boolean;
  checkType?: string;
}

export const ZONE_TASKS: ZoneTask[] = [
  // ── CORE (core) ──────────────────────────────────────────────────────────
  { id: 'core_1a', zone: 'core', level: 1, title: 'Запусти /start и пройди приветствие',                         titleEn: 'Run /start and complete the welcome flow',                    xp: 5,  autoCheck: true,  checkType: 'start_command' },
  { id: 'core_1b', zone: 'core', level: 1, title: 'Проверь /help — все команды работают',                        titleEn: 'Check /help — all commands work',                             xp: 5,  autoCheck: false },
  { id: 'core_2a', zone: 'core', level: 2, title: 'Создай агента через описание на ЕЯ',                         titleEn: 'Create agent via natural language description',               xp: 10, autoCheck: true,  checkType: 'agents_count' },
  { id: 'core_2b', zone: 'core', level: 2, title: 'Переименуй агента и измени расписание',                       titleEn: 'Rename agent and change its schedule',                        xp: 10, autoCheck: false },
  { id: 'core_3a', zone: 'core', level: 3, title: 'Запусти агента вручную и проверь логи',                       titleEn: 'Run agent manually and check the logs',                       xp: 15, autoCheck: true,  checkType: 'execution_count' },
  { id: 'core_3b', zone: 'core', level: 3, title: 'Проверь остановку агента (graceful stop)',                     titleEn: 'Test agent graceful stop',                                    xp: 15, autoCheck: false },
  { id: 'core_4a', zone: 'core', level: 4, title: 'Создай 3 агента разных типов (cron, webhook, ai_agent)',       titleEn: 'Create 3 agents of different types (cron, webhook, ai_agent)', xp: 20, autoCheck: true,  checkType: 'agents_variety' },
  { id: 'core_4b', zone: 'core', level: 4, title: 'Протестируй голосовые команды для создания агента',            titleEn: 'Test voice commands for agent creation',                      xp: 20, autoCheck: false },
  { id: 'core_5a', zone: 'core', level: 5, title: 'Stress-test: создай 10 агентов и запусти одновременно',        titleEn: 'Stress-test: create 10 agents and run simultaneously',        xp: 30, autoCheck: true,  checkType: 'agents_10' },
  { id: 'core_5b', zone: 'core', level: 5, title: 'Полный цикл жизни агента: создание, настройка, запуск, удаление', titleEn: 'Full agent lifecycle: create, configure, run, delete',     xp: 30, autoCheck: false },

  // ── DEFI (defi) ──────────────────────────────────────────────────────────
  { id: 'defi_1a', zone: 'defi', level: 1, title: 'Проверь баланс TON через /wallet',                            titleEn: 'Check TON balance via /wallet',                               xp: 5,  autoCheck: true,  checkType: 'wallet_check' },
  { id: 'defi_1b', zone: 'defi', level: 1, title: 'Посмотри цену TON через агента',                              titleEn: 'Check TON price via agent',                                   xp: 5,  autoCheck: false },
  { id: 'defi_2a', zone: 'defi', level: 2, title: 'Создай агента мониторинга цены TON',                          titleEn: 'Create a TON price monitoring agent',                         xp: 10, autoCheck: true,  checkType: 'defi_agent' },
  { id: 'defi_2b', zone: 'defi', level: 2, title: 'Протестируй DeDust swap симуляцию',                            titleEn: 'Test DeDust swap simulation',                                 xp: 10, autoCheck: false },
  { id: 'defi_3a', zone: 'defi', level: 3, title: 'Проверь STON.fi swap flow от начала до конца',                 titleEn: 'Test STON.fi swap flow end-to-end',                           xp: 15, autoCheck: false },
  { id: 'defi_3b', zone: 'defi', level: 3, title: 'Протестируй tonstakers staking интерфейс',                     titleEn: 'Test tonstakers staking interface',                           xp: 15, autoCheck: false },
  { id: 'defi_4a', zone: 'defi', level: 4, title: 'Создай DeFi агента: мониторинг + алерты + swap',               titleEn: 'Create DeFi agent: monitoring + alerts + swap',               xp: 20, autoCheck: false },
  { id: 'defi_4b', zone: 'defi', level: 4, title: 'Проверь обработку ошибок при недостатке средств',              titleEn: 'Test error handling for insufficient funds',                  xp: 20, autoCheck: false },
  { id: 'defi_5a', zone: 'defi', level: 5, title: 'Полный DeFi pipeline: price check, simulate, execute swap',   titleEn: 'Full DeFi pipeline: price check, simulate, execute swap',     xp: 30, autoCheck: false },
  { id: 'defi_5b', zone: 'defi', level: 5, title: 'Протестируй мультитокен портфолио мониторинг',                 titleEn: 'Test multi-token portfolio monitoring',                       xp: 30, autoCheck: false },

  // ── GIFTS (gifts) ────────────────────────────────────────────────────────
  { id: 'gifts_1a', zone: 'gifts', level: 1, title: 'Посмотри каталог подарков через /gifts',                     titleEn: 'Browse gift catalog via /gifts',                              xp: 5,  autoCheck: true,  checkType: 'gifts_viewed' },
  { id: 'gifts_1b', zone: 'gifts', level: 1, title: 'Проверь цены на 3 разных подарка',                           titleEn: 'Check prices for 3 different gifts',                          xp: 5,  autoCheck: false },
  { id: 'gifts_2a', zone: 'gifts', level: 2, title: 'Создай агента мониторинга цен подарков',                     titleEn: 'Create gift price monitoring agent',                          xp: 10, autoCheck: true,  checkType: 'gift_agent' },
  { id: 'gifts_2b', zone: 'gifts', level: 2, title: 'Протестируй арбитраж-сканер подарков',                       titleEn: 'Test gift arbitrage scanner',                                 xp: 10, autoCheck: false },
  { id: 'gifts_3a', zone: 'gifts', level: 3, title: 'Проверь floor price через GiftAsset API',                    titleEn: 'Verify floor price via GiftAsset API',                        xp: 15, autoCheck: false },
  { id: 'gifts_3b', zone: 'gifts', level: 3, title: 'Сравни цены Fragment vs SwiftGifts',                         titleEn: 'Compare Fragment vs SwiftGifts prices',                       xp: 15, autoCheck: false },
  { id: 'gifts_4a', zone: 'gifts', level: 4, title: 'Протестируй покупку подарка (testnet или минимальная цена)',  titleEn: 'Test gift purchase (testnet or minimum price)',               xp: 20, autoCheck: false },
  { id: 'gifts_4b', zone: 'gifts', level: 4, title: 'Проверь листинг подарка на продажу',                         titleEn: 'Test listing a gift for sale',                                xp: 20, autoCheck: false },
  { id: 'gifts_5a', zone: 'gifts', level: 5, title: 'Полный арбитраж-цикл: сканирование, покупка, перепродажа',   titleEn: 'Full arbitrage cycle: scan, buy, resell',                    xp: 30, autoCheck: false },
  { id: 'gifts_5b', zone: 'gifts', level: 5, title: 'Нагрузочный тест: 100 запросов к GiftAsset за 1 минуту',     titleEn: 'Load test: 100 GiftAsset requests in 1 minute',              xp: 30, autoCheck: false },

  // ── TELEGRAM (telegram) ──────────────────────────────────────────────────
  { id: 'tg_1a', zone: 'telegram', level: 1, title: 'Протестируй inline-кнопки в меню бота',                      titleEn: 'Test inline buttons in bot menu',                             xp: 5,  autoCheck: false },
  { id: 'tg_1b', zone: 'telegram', level: 1, title: 'Проверь команду /profile — данные корректны',                titleEn: 'Verify /profile — data is correct',                           xp: 5,  autoCheck: true,  checkType: 'profile_check' },
  { id: 'tg_2a', zone: 'telegram', level: 2, title: 'Протестируй уведомления от агента',                          titleEn: 'Test agent notifications',                                    xp: 10, autoCheck: false },
  { id: 'tg_2b', zone: 'telegram', level: 2, title: 'Проверь маркетплейс: поиск и установка шаблона',             titleEn: 'Test marketplace: search and install template',               xp: 10, autoCheck: true,  checkType: 'marketplace_used' },
  { id: 'tg_3a', zone: 'telegram', level: 3, title: 'Протестируй webhook-агента (внешний триггер)',               titleEn: 'Test webhook agent (external trigger)',                       xp: 15, autoCheck: false },
  { id: 'tg_3b', zone: 'telegram', level: 3, title: 'Проверь Telegram MTProto авторизацию (/tglogin)',            titleEn: 'Test Telegram MTProto auth (/tglogin)',                       xp: 15, autoCheck: false },
  { id: 'tg_4a', zone: 'telegram', level: 4, title: 'Протестируй мультиязычность (RU/EN переключение)',           titleEn: 'Test multilingual support (RU/EN switching)',                 xp: 20, autoCheck: false },
  { id: 'tg_4b', zone: 'telegram', level: 4, title: 'Проверь работу бота при плохом соединении',                  titleEn: 'Test bot behavior with poor connection',                      xp: 20, autoCheck: false },
  { id: 'tg_5a', zone: 'telegram', level: 5, title: 'Протестируй все callback-кнопки (полный UI тест)',           titleEn: 'Test all callback buttons (full UI test)',                    xp: 30, autoCheck: false },
  { id: 'tg_5b', zone: 'telegram', level: 5, title: 'Проверь поведение бота при 50+ агентах у пользователя',      titleEn: 'Test bot behavior with 50+ agents per user',                  xp: 30, autoCheck: false },

  // ── STUDIO (studio) ──────────────────────────────────────────────────────
  { id: 'studio_1a', zone: 'studio', level: 1, title: 'Открой dashboard и проверь загрузку данных',               titleEn: 'Open dashboard and verify data loading',                     xp: 5,  autoCheck: false },
  { id: 'studio_1b', zone: 'studio', level: 1, title: 'Проверь отображение списка агентов на dashboard',          titleEn: 'Verify agent list display on dashboard',                      xp: 5,  autoCheck: false },
  { id: 'studio_2a', zone: 'studio', level: 2, title: 'Протестируй настройки AI-провайдера в UI',                 titleEn: 'Test AI provider settings in the UI',                         xp: 10, autoCheck: false },
  { id: 'studio_2b', zone: 'studio', level: 2, title: 'Проверь слайдеры конфигурации агента',                     titleEn: 'Test agent configuration sliders',                            xp: 10, autoCheck: false },
  { id: 'studio_3a', zone: 'studio', level: 3, title: 'Протестируй API-эндпоинты (/api/agents, /api/stats)',      titleEn: 'Test API endpoints (/api/agents, /api/stats)',                xp: 15, autoCheck: false },
  { id: 'studio_3b', zone: 'studio', level: 3, title: 'Проверь логирование и историю выполнения на dashboard',    titleEn: 'Verify logging and execution history on dashboard',           xp: 15, autoCheck: false },
  { id: 'studio_4a', zone: 'studio', level: 4, title: 'Протестируй мобильную адаптацию dashboard',                titleEn: 'Test dashboard mobile responsiveness',                        xp: 20, autoCheck: false },
  { id: 'studio_4b', zone: 'studio', level: 4, title: 'Проверь экспорт данных и бэкап агентов',                   titleEn: 'Test data export and agent backup',                           xp: 20, autoCheck: false },
  { id: 'studio_5a', zone: 'studio', level: 5, title: 'Полный security-аудит: XSS, инъекции, авторизация',        titleEn: 'Full security audit: XSS, injections, authorization',         xp: 30, autoCheck: false },
  { id: 'studio_5b', zone: 'studio', level: 5, title: 'Нагрузочный тест API: 100 запросов за 30 секунд',          titleEn: 'API load test: 100 requests in 30 seconds',                   xp: 30, autoCheck: false },

  // ── COMMUNITY (community) ────────────────────────────────────────────────
  { id: 'comm_1a', zone: 'community', level: 1, title: 'Вступи в Telegram-чат тестировщиков',                     titleEn: 'Join the testers Telegram chat',                              xp: 5,  autoCheck: false },
  { id: 'comm_1b', zone: 'community', level: 1, title: 'Представься в чате и расскажи о себе',                    titleEn: 'Introduce yourself in the chat',                              xp: 5,  autoCheck: false },
  { id: 'comm_2a', zone: 'community', level: 2, title: 'Помоги другому тестировщику решить проблему',             titleEn: 'Help another tester solve an issue',                          xp: 10, autoCheck: false },
  { id: 'comm_2b', zone: 'community', level: 2, title: 'Напиши первый баг-репорт в чат',                          titleEn: 'Write your first bug report in chat',                         xp: 10, autoCheck: false },
  { id: 'comm_3a', zone: 'community', level: 3, title: 'Предложи улучшение или feature request',                  titleEn: 'Suggest an improvement or feature request',                   xp: 15, autoCheck: false },
  { id: 'comm_3b', zone: 'community', level: 3, title: 'Создай гайд или FAQ для новичков',                        titleEn: 'Create a guide or FAQ for newcomers',                         xp: 15, autoCheck: false },
  { id: 'comm_4a', zone: 'community', level: 4, title: 'Пригласи 5 новых тестировщиков',                          titleEn: 'Invite 5 new testers',                                        xp: 20, autoCheck: true,  checkType: 'referral_5' },
  { id: 'comm_4b', zone: 'community', level: 4, title: 'Организуй обсуждение/голосование по фиче',               titleEn: 'Organize a feature discussion or vote',                       xp: 20, autoCheck: false },
  { id: 'comm_5a', zone: 'community', level: 5, title: 'Стань ментором: помоги 10 людям за неделю',               titleEn: 'Become a mentor: help 10 people in a week',                   xp: 30, autoCheck: false },
  { id: 'comm_5b', zone: 'community', level: 5, title: 'Напиши полный обзор платформы (1000+ слов)',              titleEn: 'Write a full platform review (1000+ words)',                  xp: 30, autoCheck: false },
];

export function getTasksForUser(userId: number, zones: string[], level: number): ZoneTask[] {
  return ZONE_TASKS.filter(t => zones.includes(t.zone) && t.level <= level);
}

export async function formatTasksMessage(tasks: ZoneTask[], completedIds: string[], ru: boolean): Promise<string> {
  if (tasks.length === 0) {
    return ru ? '<i>Нет задач для выбранных зон и уровня</i>' : '<i>No tasks for selected zones and level</i>';
  }

  const zoneNames: Record<string, { ru: string; en: string }> = {
    core:      { ru: 'Ядро платформы',     en: 'Core Platform' },
    defi:      { ru: 'DeFi',               en: 'DeFi' },
    gifts:     { ru: 'Подарки & NFT',      en: 'Gifts & NFT' },
    telegram:  { ru: 'Telegram & UI',      en: 'Telegram & UI' },
    studio:    { ru: 'Studio & API',       en: 'Studio & API' },
    community: { ru: 'Комьюнити',          en: 'Community' },
  };

  const grouped: Record<string, ZoneTask[]> = {};
  for (const t of tasks) {
    if (!grouped[t.zone]) grouped[t.zone] = [];
    grouped[t.zone].push(t);
  }

  let msg = `${ce('lab', '\u{1F9EA}')} <b>${ru ? 'Задачи тестирования' : 'Testing Tasks'}</b>\n\n`;

  for (const zone of Object.keys(grouped)) {
    const name = zoneNames[zone] || { ru: zone, en: zone };
    msg += `<b>${ru ? name.ru : name.en}</b>\n`;
    for (const t of grouped[zone]) {
      const done = completedIds.includes(t.id);
      const icon = done ? ce('check', '\u2705') : '\u{25CB}';
      const title = ru ? t.title : t.titleEn;
      const xpStr = done ? `<s>+${t.xp}</s>` : `+${t.xp}`;
      msg += `  ${icon} [L${t.level}] ${escHtml(title)} ${xpStr}\n`;
    }
    msg += '\n';
  }

  const doneCount = tasks.filter(t => completedIds.includes(t.id)).length;
  const totalXP = tasks.filter(t => completedIds.includes(t.id)).reduce((sum, t) => sum + t.xp, 0);
  msg += `${ce('coin', '\u{1FA99}')} ${ru ? 'Выполнено' : 'Completed'}: ${doneCount}/${tasks.length} | XP: ${totalXP}`;

  return msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ACHIEVEMENTS (70+)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AchievementStats {
  questCompleted: boolean;
  totalBugs: number;
  totalFeedback: number;
  totalAgents: number;
  totalXP: number;
  streakDays: number;
  referralCount: number;
  tasksCompleted: number;
  dailyQuestsCompleted: number;
  weeklyEventsParticipated: number;
  zonesCompleted: number;
  chatMessages: number;
  voiceCommands: number;
  defiSwaps: number;
  giftsTraded: number;
  templatesPublished: number;
  templatesInstalled: number;
  contentPosts: number;
  helpGiven: number;
  loginDays: number;
  agentTypes: number;
  level5Tasks: number;
  hardcoreQuests: number;
  criticalBugs: number;
  screenshotsAttached: number;
  nightActivity: boolean;
  weekendActivity: boolean;
  firstDayJoin: boolean;
  perfectWeek: boolean;
  communityVotes: number;
  apiEndpointsTested: number;
  uniqueToolsUsed: number;
  consecutiveDailyQuests: number;
  mentorSessions: number;
  bugsVerified: number;
  featuresRequested: number;
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  titleRu: string;
  desc: string;
  descRu: string;
  check: (stats: AchievementStats) => boolean;
  secret?: boolean;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Onboarding ───────────────────────────────────────────────────────────
  { id: 'first_steps',       emoji: '\u{1F393}', title: 'First Steps',           titleRu: '\u041F\u0435\u0440\u0432\u044B\u0435 \u0448\u0430\u0433\u0438',          desc: 'Complete onboarding quest',                    descRu: '\u0417\u0430\u0432\u0435\u0440\u0448\u0438 \u043E\u043D\u0431\u043E\u0440\u0434\u0438\u043D\u0433',                       check: (s) => s.questCompleted,            tier: 'bronze' },
  { id: 'quick_learner',     emoji: '\u{1F4A1}', title: 'Quick Learner',         titleRu: '\u0411\u044B\u0441\u0442\u0440\u044B\u0439 \u0443\u0447\u0435\u043D\u0438\u043A',        desc: 'Complete onboarding in under 1 hour',          descRu: '\u041E\u043D\u0431\u043E\u0440\u0434\u0438\u043D\u0433 \u043C\u0435\u043D\u044C\u0448\u0435 \u0447\u0435\u043C \u0437\u0430 \u0447\u0430\u0441',          check: (s) => s.questCompleted && s.firstDayJoin, tier: 'silver', secret: true },

  // ── Bug hunting ──────────────────────────────────────────────────────────
  { id: 'first_blood',       emoji: '\u{1F41B}', title: 'First Blood',           titleRu: '\u041F\u0435\u0440\u0432\u0430\u044F \u043A\u0440\u043E\u0432\u044C',          desc: '1 bug report',                                 descRu: '1 \u0431\u0430\u0433-\u0440\u0435\u043F\u043E\u0440\u0442',                              check: (s) => s.totalBugs >= 1,            tier: 'bronze' },
  { id: 'bug_hunter',        emoji: '\u{1F50D}', title: 'Bug Hunter',            titleRu: '\u041E\u0445\u043E\u0442\u043D\u0438\u043A \u043D\u0430 \u0431\u0430\u0433\u0438',       desc: '5 bug reports',                                descRu: '5 \u0431\u0430\u0433-\u0440\u0435\u043F\u043E\u0440\u0442\u043E\u0432',                          check: (s) => s.totalBugs >= 5,            tier: 'silver' },
  { id: 'exterminator',      emoji: '\u{1F9F9}', title: 'Exterminator',          titleRu: '\u0418\u0441\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B\u044C',             desc: '15 bug reports',                               descRu: '15 \u0431\u0430\u0433-\u0440\u0435\u043F\u043E\u0440\u0442\u043E\u0432',                         check: (s) => s.totalBugs >= 15,           tier: 'gold' },
  { id: 'bug_overlord',      emoji: '\u{1F451}', title: 'Bug Overlord',          titleRu: '\u041F\u043E\u0432\u0435\u043B\u0438\u0442\u0435\u043B\u044C \u0431\u0430\u0433\u043E\u0432',      desc: '50 bug reports',                               descRu: '50 \u0431\u0430\u0433-\u0440\u0435\u043F\u043E\u0440\u0442\u043E\u0432',                         check: (s) => s.totalBugs >= 50,           tier: 'platinum' },
  { id: 'critical_finder',   emoji: '\u{1F6A8}', title: 'Critical Finder',       titleRu: '\u041D\u0430\u0448\u0451\u043B \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439',     desc: 'Report a critical bug',                        descRu: '\u041D\u0430\u0448\u0451\u043B \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0431\u0430\u0433',           check: (s) => s.criticalBugs >= 1,         tier: 'gold' },
  { id: 'screenshot_pro',    emoji: '\u{1F4F8}', title: 'Screenshot Pro',        titleRu: '\u041F\u0440\u043E \u0441\u043A\u0440\u0438\u043D\u0448\u043E\u0442\u043E\u0432',        desc: 'Attach screenshots to 10 reports',             descRu: '\u0421\u043A\u0440\u0438\u043D\u044B \u043A 10 \u0440\u0435\u043F\u043E\u0440\u0442\u0430\u043C',                   check: (s) => s.screenshotsAttached >= 10, tier: 'silver' },
  { id: 'verifier',          emoji: '\u{2705}',  title: 'Verifier',              titleRu: '\u0412\u0435\u0440\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440',              desc: 'Verify 5 bugs reported by others',             descRu: '\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438 5 \u0447\u0443\u0436\u0438\u0445 \u0431\u0430\u0433\u043E\u0432',          check: (s) => s.bugsVerified >= 5,         tier: 'silver' },

  // ── Agent creation ───────────────────────────────────────────────────────
  { id: 'creator',           emoji: '\u{1F916}', title: 'Creator',               titleRu: '\u0421\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044C',                desc: 'Create first agent',                           descRu: '\u0421\u043E\u0437\u0434\u0430\u0439 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0430\u0433\u0435\u043D\u0442\u0430',           check: (s) => s.totalAgents >= 1,          tier: 'bronze' },
  { id: 'architect',         emoji: '\u{1F3D7}', title: 'Architect',             titleRu: '\u0410\u0440\u0445\u0438\u0442\u0435\u043A\u0442\u043E\u0440',              desc: 'Create 5 agents',                              descRu: '\u0421\u043E\u0437\u0434\u0430\u0439 5 \u0430\u0433\u0435\u043D\u0442\u043E\u0432',                    check: (s) => s.totalAgents >= 5,          tier: 'silver' },
  { id: 'factory',           emoji: '\u{1F3ED}', title: 'Agent Factory',         titleRu: '\u0424\u0430\u0431\u0440\u0438\u043A\u0430 \u0430\u0433\u0435\u043D\u0442\u043E\u0432',      desc: 'Create 15 agents',                             descRu: '\u0421\u043E\u0437\u0434\u0430\u0439 15 \u0430\u0433\u0435\u043D\u0442\u043E\u0432',                   check: (s) => s.totalAgents >= 15,         tier: 'gold' },
  { id: 'army_builder',      emoji: '\u{2694}',  title: 'Army Builder',          titleRu: '\u0410\u0440\u043C\u0438\u044F \u0430\u0433\u0435\u043D\u0442\u043E\u0432',         desc: 'Create 30 agents',                             descRu: '\u0421\u043E\u0437\u0434\u0430\u0439 30 \u0430\u0433\u0435\u043D\u0442\u043E\u0432',                   check: (s) => s.totalAgents >= 30,         tier: 'platinum' },
  { id: 'polyglot',          emoji: '\u{1F310}', title: 'Polyglot',              titleRu: '\u041F\u043E\u043B\u0438\u0433\u043B\u043E\u0442',               desc: 'Use 3 different agent types',                  descRu: '3 \u0440\u0430\u0437\u043D\u044B\u0445 \u0442\u0438\u043F\u0430 \u0430\u0433\u0435\u043D\u0442\u043E\u0432',           check: (s) => s.agentTypes >= 3,           tier: 'silver' },
  { id: 'publisher',         emoji: '\u{1F4E6}', title: 'Publisher',             titleRu: '\u0418\u0437\u0434\u0430\u0442\u0435\u043B\u044C',                desc: 'Publish a template to marketplace',            descRu: '\u041E\u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0439 \u0448\u0430\u0431\u043B\u043E\u043D',                    check: (s) => s.templatesPublished >= 1,   tier: 'gold' },

  // ── Feedback & Quality ───────────────────────────────────────────────────
  { id: 'voice_heard',       emoji: '\u{1F4AC}', title: 'Voice Heard',           titleRu: '\u0413\u043E\u043B\u043E\u0441 \u0443\u0441\u043B\u044B\u0448\u0430\u043D',         desc: 'Send first feedback',                          descRu: '\u041F\u0435\u0440\u0432\u044B\u0439 \u0444\u0438\u0434\u0431\u044D\u043A',                       check: (s) => s.totalFeedback >= 1,        tier: 'bronze' },
  { id: 'feedback_machine',  emoji: '\u{1F4DD}', title: 'Feedback Machine',      titleRu: '\u041C\u0430\u0448\u0438\u043D\u0430 \u0444\u0438\u0434\u0431\u044D\u043A\u0430',      desc: '10 feedback submissions',                      descRu: '10 \u0444\u0438\u0434\u0431\u044D\u043A\u043E\u0432',                              check: (s) => s.totalFeedback >= 10,       tier: 'silver' },
  { id: 'feedback_legend',   emoji: '\u{1F4E3}', title: 'Feedback Legend',       titleRu: '\u041B\u0435\u0433\u0435\u043D\u0434\u0430 \u0444\u0438\u0434\u0431\u044D\u043A\u0430',    desc: '30 feedback submissions',                      descRu: '30 \u0444\u0438\u0434\u0431\u044D\u043A\u043E\u0432',                              check: (s) => s.totalFeedback >= 30,       tier: 'gold' },
  { id: 'idea_generator',    emoji: '\u{1F4A1}', title: 'Idea Generator',        titleRu: '\u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0438\u0434\u0435\u0439',       desc: 'Submit 5 feature requests',                    descRu: '5 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432 \u043D\u0430 \u0444\u0438\u0447\u0438',                  check: (s) => s.featuresRequested >= 5,    tier: 'silver' },

  // ── Streaks ──────────────────────────────────────────────────────────────
  { id: 'consistent',        emoji: '\u{1F525}', title: 'Consistent',            titleRu: '\u0421\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u044B\u0439',              desc: '3-day streak',                                 descRu: '\u0421\u0442\u0440\u0438\u043A 3 \u0434\u043D\u044F',                              check: (s) => s.streakDays >= 3,           tier: 'bronze' },
  { id: 'dedicated',         emoji: '\u{1F525}', title: 'Dedicated',             titleRu: '\u041F\u0440\u0435\u0434\u0430\u043D\u043D\u044B\u0439',               desc: '7-day streak',                                 descRu: '\u0421\u0442\u0440\u0438\u043A 7 \u0434\u043D\u0435\u0439',                             check: (s) => s.streakDays >= 7,           tier: 'silver' },
  { id: 'unstoppable',       emoji: '\u{1F525}', title: 'Unstoppable',           titleRu: '\u041D\u0435\u0443\u0434\u0435\u0440\u0436\u0438\u043C\u044B\u0439',             desc: '14-day streak',                                descRu: '\u0421\u0442\u0440\u0438\u043A 14 \u0434\u043D\u0435\u0439',                            check: (s) => s.streakDays >= 14,          tier: 'gold' },
  { id: 'iron_will',         emoji: '\u{1F525}', title: 'Iron Will',             titleRu: '\u0416\u0435\u043B\u0435\u0437\u043D\u0430\u044F \u0432\u043E\u043B\u044F',          desc: '28-day streak',                                descRu: '\u0421\u0442\u0440\u0438\u043A 28 \u0434\u043D\u0435\u0439',                            check: (s) => s.streakDays >= 28,          tier: 'platinum' },

  // ── XP milestones ────────────────────────────────────────────────────────
  { id: 'xp_50',             emoji: '\u{2B50}',  title: 'Rising Star',           titleRu: '\u0412\u043E\u0441\u0445\u043E\u0434\u044F\u0449\u0430\u044F \u0437\u0432\u0435\u0437\u0434\u0430',     desc: 'Earn 50 XP',                                   descRu: '\u041D\u0430\u0431\u0435\u0440\u0438 50 XP',                              check: (s) => s.totalXP >= 50,             tier: 'bronze' },
  { id: 'xp_150',            emoji: '\u{2B50}',  title: 'Shining Star',          titleRu: '\u042F\u0440\u043A\u0430\u044F \u0437\u0432\u0435\u0437\u0434\u0430',           desc: 'Earn 150 XP',                                  descRu: '\u041D\u0430\u0431\u0435\u0440\u0438 150 XP',                             check: (s) => s.totalXP >= 150,            tier: 'silver' },
  { id: 'xp_500',            emoji: '\u{2B50}',  title: 'Superstar',             titleRu: '\u0421\u0443\u043F\u0435\u0440\u0437\u0432\u0435\u0437\u0434\u0430',            desc: 'Earn 500 XP',                                  descRu: '\u041D\u0430\u0431\u0435\u0440\u0438 500 XP',                             check: (s) => s.totalXP >= 500,            tier: 'gold' },
  { id: 'xp_1000',           emoji: '\u{1F48E}', title: 'Diamond Tester',        titleRu: '\u0411\u0440\u0438\u043B\u043B\u0438\u0430\u043D\u0442\u043E\u0432\u044B\u0439 \u0442\u0435\u0441\u0442\u0435\u0440', desc: 'Earn 1000 XP',                                 descRu: '\u041D\u0430\u0431\u0435\u0440\u0438 1000 XP',                            check: (s) => s.totalXP >= 1000,           tier: 'platinum' },
  { id: 'xp_2000',           emoji: '\u{1F451}', title: 'XP Overlord',           titleRu: '\u041F\u043E\u0432\u0435\u043B\u0438\u0442\u0435\u043B\u044C XP',          desc: 'Earn 2000 XP',                                 descRu: '\u041D\u0430\u0431\u0435\u0440\u0438 2000 XP',                            check: (s) => s.totalXP >= 2000,           tier: 'platinum' },

  // ── Tasks ────────────────────────────────────────────────────────────────
  { id: 'task_starter',      emoji: '\u{1F4CB}', title: 'Task Starter',          titleRu: '\u041D\u0430\u0447\u0438\u043D\u0430\u044E\u0449\u0438\u0439',              desc: 'Complete 5 zone tasks',                        descRu: '5 \u0437\u0430\u0434\u0430\u0447 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E',                   check: (s) => s.tasksCompleted >= 5,       tier: 'bronze' },
  { id: 'task_warrior',      emoji: '\u{1F4CB}', title: 'Task Warrior',          titleRu: '\u0412\u043E\u0438\u043D \u0437\u0430\u0434\u0430\u0447',              desc: 'Complete 20 zone tasks',                       descRu: '20 \u0437\u0430\u0434\u0430\u0447 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E',                  check: (s) => s.tasksCompleted >= 20,      tier: 'silver' },
  { id: 'task_master',       emoji: '\u{1F4CB}', title: 'Task Master',           titleRu: '\u041C\u0430\u0441\u0442\u0435\u0440 \u0437\u0430\u0434\u0430\u0447',           desc: 'Complete 40 zone tasks',                       descRu: '40 \u0437\u0430\u0434\u0430\u0447 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E',                  check: (s) => s.tasksCompleted >= 40,      tier: 'gold' },
  { id: 'completionist',     emoji: '\u{1F3C6}', title: 'Completionist',         titleRu: '\u041A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u043E\u0432\u0449\u0438\u043A',           desc: 'Complete all 60 zone tasks',                   descRu: '\u0412\u0441\u0435 60 \u0437\u0430\u0434\u0430\u0447 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E',               check: (s) => s.tasksCompleted >= 60,      tier: 'platinum' },
  { id: 'level5_elite',      emoji: '\u{1F396}', title: 'Level 5 Elite',         titleRu: '\u042D\u043B\u0438\u0442\u0430 5 \u0443\u0440\u043E\u0432\u043D\u044F',         desc: 'Complete 5 level-5 tasks',                     descRu: '5 \u0437\u0430\u0434\u0430\u0447 5 \u0443\u0440\u043E\u0432\u043D\u044F',                     check: (s) => s.level5Tasks >= 5,          tier: 'gold' },

  // ── Daily quests ─────────────────────────────────────────────────────────
  { id: 'daily_first',       emoji: '\u{1F305}', title: 'Early Bird',            titleRu: '\u0420\u0430\u043D\u043D\u044F\u044F \u043F\u0442\u0438\u0446\u0430',           desc: 'Complete first daily quest',                   descRu: '\u041F\u0435\u0440\u0432\u044B\u0439 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u043A\u0432\u0435\u0441\u0442',       check: (s) => s.dailyQuestsCompleted >= 1, tier: 'bronze' },
  { id: 'daily_week',        emoji: '\u{1F305}', title: 'Weekly Regular',        titleRu: '\u041D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0437\u0430\u0432\u0441\u0435\u0433\u0434\u0430\u0442\u0430\u0439',   desc: '7 daily quests completed',                     descRu: '7 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0445 \u043A\u0432\u0435\u0441\u0442\u043E\u0432',             check: (s) => s.dailyQuestsCompleted >= 7, tier: 'silver' },
  { id: 'daily_month',       emoji: '\u{1F305}', title: 'Monthly Champion',      titleRu: '\u041C\u0435\u0441\u044F\u0447\u043D\u044B\u0439 \u0447\u0435\u043C\u043F\u0438\u043E\u043D',      desc: '28 daily quests completed',                    descRu: '28 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0445 \u043A\u0432\u0435\u0441\u0442\u043E\u0432',            check: (s) => s.dailyQuestsCompleted >= 28, tier: 'gold' },
  { id: 'hardcore_fan',      emoji: '\u{1F4AA}', title: 'Hardcore Fan',          titleRu: '\u0425\u0430\u0440\u0434\u043A\u043E\u0440-\u0444\u0430\u043D',            desc: 'Complete 5 hardcore daily quests',              descRu: '5 \u0445\u0430\u0440\u0434\u043A\u043E\u0440-\u043A\u0432\u0435\u0441\u0442\u043E\u0432',                   check: (s) => s.hardcoreQuests >= 5,       tier: 'gold' },
  { id: 'perfect_week',      emoji: '\u{1F31F}', title: 'Perfect Week',          titleRu: '\u0418\u0434\u0435\u0430\u043B\u044C\u043D\u0430\u044F \u043D\u0435\u0434\u0435\u043B\u044F',      desc: '7 consecutive daily quests',                   descRu: '7 \u043A\u0432\u0435\u0441\u0442\u043E\u0432 \u043F\u043E\u0434\u0440\u044F\u0434',                     check: (s) => s.consecutiveDailyQuests >= 7, tier: 'gold' },

  // ── Referrals ────────────────────────────────────────────────────────────
  { id: 'recruiter',         emoji: '\u{1F465}', title: 'Recruiter',             titleRu: '\u0412\u0435\u0440\u0431\u043E\u0432\u0449\u0438\u043A',                desc: 'Invite 1 friend',                              descRu: '\u041F\u0440\u0438\u0433\u043B\u0430\u0441\u0438 1 \u0434\u0440\u0443\u0433\u0430',                    check: (s) => s.referralCount >= 1,        tier: 'bronze' },
  { id: 'networker',         emoji: '\u{1F465}', title: 'Networker',             titleRu: '\u041D\u0435\u0442\u0432\u043E\u0440\u043A\u0435\u0440',               desc: 'Invite 5 friends',                             descRu: '\u041F\u0440\u0438\u0433\u043B\u0430\u0441\u0438 5 \u0434\u0440\u0443\u0437\u0435\u0439',                   check: (s) => s.referralCount >= 5,        tier: 'silver' },
  { id: 'ambassador',        emoji: '\u{1F465}', title: 'Ambassador',            titleRu: '\u0410\u043C\u0431\u0430\u0441\u0441\u0430\u0434\u043E\u0440',              desc: 'Invite 15 friends',                            descRu: '\u041F\u0440\u0438\u0433\u043B\u0430\u0441\u0438 15 \u0434\u0440\u0443\u0437\u0435\u0439',                  check: (s) => s.referralCount >= 15,       tier: 'gold' },
  { id: 'viral_king',        emoji: '\u{1F451}', title: 'Viral King',            titleRu: '\u041A\u043E\u0440\u043E\u043B\u044C \u0432\u0438\u0440\u0443\u0441\u043D\u043E\u0441\u0442\u0438',     desc: 'Invite 30 friends',                            descRu: '\u041F\u0440\u0438\u0433\u043B\u0430\u0441\u0438 30 \u0434\u0440\u0443\u0437\u0435\u0439',                  check: (s) => s.referralCount >= 30,       tier: 'platinum' },

  // ── DeFi ─────────────────────────────────────────────────────────────────
  { id: 'defi_curious',      emoji: '\u{1FA99}', title: 'DeFi Curious',          titleRu: 'DeFi \u043D\u043E\u0432\u0438\u0447\u043E\u043A',            desc: 'First DeFi swap simulation',                   descRu: '\u041F\u0435\u0440\u0432\u044B\u0439 DeFi swap',                        check: (s) => s.defiSwaps >= 1,            tier: 'bronze' },
  { id: 'defi_trader',       emoji: '\u{1FA99}', title: 'DeFi Trader',           titleRu: 'DeFi \u0442\u0440\u0435\u0439\u0434\u0435\u0440',            desc: '10 DeFi swap simulations',                     descRu: '10 DeFi \u0441\u0432\u043E\u043F\u043E\u0432',                            check: (s) => s.defiSwaps >= 10,           tier: 'silver' },
  { id: 'defi_whale',        emoji: '\u{1F40B}', title: 'DeFi Whale',            titleRu: 'DeFi \u043A\u0438\u0442',                desc: '50 DeFi swap simulations',                     descRu: '50 DeFi \u0441\u0432\u043E\u043F\u043E\u0432',                            check: (s) => s.defiSwaps >= 50,           tier: 'gold' },

  // ── Gifts ────────────────────────────────────────────────────────────────
  { id: 'gift_explorer',     emoji: '\u{1F381}', title: 'Gift Explorer',         titleRu: '\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0434\u0430\u0440\u043A\u043E\u0432', desc: 'Trade 1 gift',                                 descRu: '1 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u0441 \u043F\u043E\u0434\u0430\u0440\u043A\u0430\u043C\u0438',           check: (s) => s.giftsTraded >= 1,          tier: 'bronze' },
  { id: 'gift_collector',    emoji: '\u{1F381}', title: 'Gift Collector',        titleRu: '\u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u043E\u043D\u0435\u0440 \u043F\u043E\u0434\u0430\u0440\u043A\u043E\u0432', desc: 'Trade 10 gifts',                               descRu: '10 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0439 \u0441 \u043F\u043E\u0434\u0430\u0440\u043A\u0430\u043C\u0438',          check: (s) => s.giftsTraded >= 10,         tier: 'silver' },
  { id: 'gift_mogul',        emoji: '\u{1F381}', title: 'Gift Mogul',            titleRu: '\u041C\u043E\u0433\u0443\u043B \u043F\u043E\u0434\u0430\u0440\u043A\u043E\u0432',        desc: 'Trade 50 gifts',                               descRu: '50 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0439 \u0441 \u043F\u043E\u0434\u0430\u0440\u043A\u0430\u043C\u0438',          check: (s) => s.giftsTraded >= 50,         tier: 'gold' },

  // ── Community ────────────────────────────────────────────────────────────
  { id: 'team_player',       emoji: '\u{1F91D}', title: 'Team Player',           titleRu: '\u041A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u0438\u0433\u0440\u043E\u043A',       desc: 'Help 1 person in chat',                        descRu: '\u041F\u043E\u043C\u043E\u0433\u0438 1 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0443',                    check: (s) => s.helpGiven >= 1,            tier: 'bronze' },
  { id: 'helper',            emoji: '\u{1F91D}', title: 'Helper',                titleRu: '\u041F\u043E\u043C\u043E\u0449\u043D\u0438\u043A',                desc: 'Help 5 people in chat',                        descRu: '\u041F\u043E\u043C\u043E\u0433\u0438 5 \u043B\u044E\u0434\u044F\u043C',                       check: (s) => s.helpGiven >= 5,            tier: 'silver' },
  { id: 'mentor',            emoji: '\u{1F9D1}', title: 'Mentor',                titleRu: '\u041C\u0435\u043D\u0442\u043E\u0440',                  desc: 'Help 15 people or mentor 3 sessions',          descRu: '\u041F\u043E\u043C\u043E\u0433\u0438 15 \u0438\u043B\u0438 3 \u0441\u0435\u0441\u0441\u0438\u0438 \u043C\u0435\u043D\u0442\u043E\u0440\u0441\u0442\u0432\u0430', check: (s) => s.helpGiven >= 15 || s.mentorSessions >= 3, tier: 'gold' },
  { id: 'community_pillar',  emoji: '\u{1F3DB}', title: 'Community Pillar',      titleRu: '\u041E\u043F\u043E\u0440\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u0441\u0442\u0432\u0430',     desc: 'Help 30 people and mentor 5 sessions',         descRu: '30 \u043F\u043E\u043C\u043E\u0449\u0435\u0439, 5 \u043C\u0435\u043D\u0442\u043E\u0440\u0441\u0442\u0432',              check: (s) => s.helpGiven >= 30 && s.mentorSessions >= 5, tier: 'platinum' },

  // ── Content ──────────────────────────────────────────────────────────────
  { id: 'content_creator',   emoji: '\u{1F4F1}', title: 'Content Creator',       titleRu: '\u041A\u043E\u043D\u0442\u0435\u043D\u0442-\u043C\u0435\u0439\u043A\u0435\u0440',       desc: 'Create 1 content piece',                       descRu: '1 \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u044F',                          check: (s) => s.contentPosts >= 1,         tier: 'bronze' },
  { id: 'influencer',        emoji: '\u{1F4F1}', title: 'Influencer',            titleRu: '\u0418\u043D\u0444\u043B\u044E\u0435\u043D\u0441\u0435\u0440',              desc: 'Create 5 content pieces',                      descRu: '5 \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u0439',                          check: (s) => s.contentPosts >= 5,         tier: 'silver' },
  { id: 'media_star',        emoji: '\u{1F31F}', title: 'Media Star',            titleRu: '\u041C\u0435\u0434\u0438\u0430-\u0437\u0432\u0435\u0437\u0434\u0430',           desc: 'Create 15 content pieces',                     descRu: '15 \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u0439',                         check: (s) => s.contentPosts >= 15,        tier: 'gold' },

  // ── Zones ────────────────────────────────────────────────────────────────
  { id: 'zone_explorer',     emoji: '\u{1F9ED}', title: 'Zone Explorer',         titleRu: '\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0437\u043E\u043D',    desc: 'Complete tasks in 3 zones',                    descRu: '\u0417\u0430\u0434\u0430\u0447\u0438 \u0432 3 \u0437\u043E\u043D\u0430\u0445',                       check: (s) => s.zonesCompleted >= 3,       tier: 'silver' },
  { id: 'zone_master',       emoji: '\u{1F9ED}', title: 'Zone Master',           titleRu: '\u041C\u0430\u0441\u0442\u0435\u0440 \u0432\u0441\u0435\u0445 \u0437\u043E\u043D',        desc: 'Complete tasks in all 6 zones',                descRu: '\u0417\u0430\u0434\u0430\u0447\u0438 \u0432\u043E \u0432\u0441\u0435\u0445 6 \u0437\u043E\u043D\u0430\u0445',                check: (s) => s.zonesCompleted >= 6,       tier: 'gold' },

  // ── Marketplace ──────────────────────────────────────────────────────────
  { id: 'shopper',           emoji: '\u{1F6D2}', title: 'Shopper',               titleRu: '\u041F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044C',              desc: 'Install 3 templates from marketplace',         descRu: '\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438 3 \u0448\u0430\u0431\u043B\u043E\u043D\u0430',                  check: (s) => s.templatesInstalled >= 3,   tier: 'bronze' },
  { id: 'template_addict',   emoji: '\u{1F6D2}', title: 'Template Addict',       titleRu: '\u0428\u0430\u0431\u043B\u043E\u043D\u043E\u043C\u0430\u043D',              desc: 'Install 10 templates from marketplace',        descRu: '\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438 10 \u0448\u0430\u0431\u043B\u043E\u043D\u043E\u0432',                 check: (s) => s.templatesInstalled >= 10,  tier: 'silver' },

  // ── Voice ────────────────────────────────────────────────────────────────
  { id: 'voice_user',        emoji: '\u{1F3A4}', title: 'Voice User',            titleRu: '\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0439 \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0449\u0438\u0439',  desc: 'Use voice commands 5 times',                   descRu: '5 \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u044B\u0445 \u043A\u043E\u043C\u0430\u043D\u0434',                  check: (s) => s.voiceCommands >= 5,        tier: 'bronze' },
  { id: 'voice_master',      emoji: '\u{1F3A4}', title: 'Voice Master',          titleRu: '\u041C\u0430\u0441\u0442\u0435\u0440 \u0433\u043E\u043B\u043E\u0441\u0430',          desc: 'Use voice commands 25 times',                  descRu: '25 \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u044B\u0445 \u043A\u043E\u043C\u0430\u043D\u0434',                 check: (s) => s.voiceCommands >= 25,       tier: 'silver' },

  // ── Chat ─────────────────────────────────────────────────────────────────
  { id: 'chatty',            emoji: '\u{1F4AC}', title: 'Chatty',                titleRu: '\u0411\u043E\u043B\u0442\u0443\u043D',                  desc: 'Send 50 messages to agents',                   descRu: '50 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0430\u0433\u0435\u043D\u0442\u0430\u043C',               check: (s) => s.chatMessages >= 50,        tier: 'bronze' },
  { id: 'conversation_king', emoji: '\u{1F4AC}', title: 'Conversation King',     titleRu: '\u041A\u043E\u0440\u043E\u043B\u044C \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432',       desc: 'Send 200 messages to agents',                  descRu: '200 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0430\u0433\u0435\u043D\u0442\u0430\u043C',              check: (s) => s.chatMessages >= 200,       tier: 'silver' },

  // ── Login ────────────────────────────────────────────────────────────────
  { id: 'regular',           emoji: '\u{1F4C5}', title: 'Regular',               titleRu: '\u0417\u0430\u0432\u0441\u0435\u0433\u0434\u0430\u0442\u0430\u0439',              desc: 'Log in for 7 days total',                      descRu: '7 \u0434\u043D\u0435\u0439 \u0432 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0435',                 check: (s) => s.loginDays >= 7,            tier: 'bronze' },
  { id: 'veteran',           emoji: '\u{1F4C5}', title: 'Veteran',               titleRu: '\u0412\u0435\u0442\u0435\u0440\u0430\u043D',                 desc: 'Log in for 21 days total',                     descRu: '21 \u0434\u0435\u043D\u044C \u0432 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0435',                check: (s) => s.loginDays >= 21,           tier: 'silver' },
  { id: 'old_guard',         emoji: '\u{1F4C5}', title: 'Old Guard',             titleRu: '\u0421\u0442\u0430\u0440\u0430\u044F \u0433\u0432\u0430\u0440\u0434\u0438\u044F',          desc: 'Log in for 28 days total',                     descRu: '28 \u0434\u043D\u0435\u0439 \u0432 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0435',                check: (s) => s.loginDays >= 28,           tier: 'gold' },

  // ── Tools ────────────────────────────────────────────────────────────────
  { id: 'toolsmith',         emoji: '\u{1F527}', title: 'Toolsmith',             titleRu: '\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u0449\u0438\u043A',       desc: 'Use 10 unique tools via agents',               descRu: '10 \u0440\u0430\u0437\u043D\u044B\u0445 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u0432',          check: (s) => s.uniqueToolsUsed >= 10,     tier: 'silver' },
  { id: 'tool_master',       emoji: '\u{1F527}', title: 'Tool Master',           titleRu: '\u041C\u0430\u0441\u0442\u0435\u0440 \u0442\u0443\u043B\u043E\u0432',            desc: 'Use 20 unique tools via agents',               descRu: '20 \u0440\u0430\u0437\u043D\u044B\u0445 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u0432',          check: (s) => s.uniqueToolsUsed >= 20,     tier: 'gold' },

  // ── API testing ──────────────────────────────────────────────────────────
  { id: 'api_tester',        emoji: '\u{1F9EA}', title: 'API Tester',            titleRu: 'API \u0442\u0435\u0441\u0442\u0435\u0440',               desc: 'Test 5 API endpoints',                         descRu: '5 API \u044D\u043D\u0434\u043F\u043E\u0438\u043D\u0442\u043E\u0432',                       check: (s) => s.apiEndpointsTested >= 5,   tier: 'silver' },
  { id: 'api_breaker',       emoji: '\u{1F9EA}', title: 'API Breaker',           titleRu: 'API \u0432\u0437\u043B\u043E\u043C\u0449\u0438\u043A',             desc: 'Test 15 API endpoints',                        descRu: '15 API \u044D\u043D\u0434\u043F\u043E\u0438\u043D\u0442\u043E\u0432',                      check: (s) => s.apiEndpointsTested >= 15,  tier: 'gold' },

  // ── Weekly events ────────────────────────────────────────────────────────
  { id: 'event_goer',        emoji: '\u{1F389}', title: 'Event Goer',            titleRu: '\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A \u0438\u0432\u0435\u043D\u0442\u043E\u0432',      desc: 'Participate in 1 weekly event',                descRu: '\u0423\u0447\u0430\u0441\u0442\u0432\u0443\u0439 \u0432 1 \u0438\u0432\u0435\u043D\u0442\u0435',                check: (s) => s.weeklyEventsParticipated >= 1, tier: 'bronze' },
  { id: 'event_veteran',     emoji: '\u{1F389}', title: 'Event Veteran',         titleRu: '\u0412\u0435\u0442\u0435\u0440\u0430\u043D \u0438\u0432\u0435\u043D\u0442\u043E\u0432',      desc: 'Participate in all 4 weekly events',           descRu: '\u0423\u0447\u0430\u0441\u0442\u0432\u0443\u0439 \u0432\u043E \u0432\u0441\u0435\u0445 4 \u0438\u0432\u0435\u043D\u0442\u0430\u0445',           check: (s) => s.weeklyEventsParticipated >= 4, tier: 'gold' },

  // ── SECRET achievements ──────────────────────────────────────────────────
  { id: 'night_owl',         emoji: '\u{1F989}', title: 'Night Owl',             titleRu: '\u041D\u043E\u0447\u043D\u0430\u044F \u0441\u043E\u0432\u0430',             desc: 'Active between 2am and 5am',                   descRu: '\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u0441 2 \u0434\u043E 5 \u0443\u0442\u0440\u0430',           check: (s) => s.nightActivity,             secret: true },
  { id: 'weekend_warrior',   emoji: '\u{1F3D6}', title: 'Weekend Warrior',       titleRu: '\u0412\u043E\u0438\u043D \u0432\u044B\u0445\u043E\u0434\u043D\u044B\u0445',          desc: 'Active both Saturday and Sunday',              descRu: '\u0410\u043A\u0442\u0438\u0432\u0435\u043D \u0432 \u0441\u0431 \u0438 \u0432\u0441',                      check: (s) => s.weekendActivity,           secret: true },
  { id: 'speed_runner',      emoji: '\u{26A1}',  title: 'Speed Runner',          titleRu: '\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u043D\u043E\u0439',               desc: 'Complete 3 tasks in 1 hour',                   descRu: '3 \u0437\u0430\u0434\u0430\u0447\u0438 \u0437\u0430 1 \u0447\u0430\u0441',                      check: (s) => s.tasksCompleted >= 3 && s.firstDayJoin, secret: true },
  { id: 'multitasker',       emoji: '\u{1F500}', title: 'Multitasker',           titleRu: '\u041C\u0443\u043B\u044C\u0442\u0438\u0442\u0430\u0441\u043A\u0435\u0440',            desc: 'Have 5 active agents simultaneously',          descRu: '5 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0430\u0433\u0435\u043D\u0442\u043E\u0432 \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E',   check: (s) => s.totalAgents >= 5,          secret: true },
  { id: 'silent_hero',       emoji: '\u{1F9B8}', title: 'Silent Hero',           titleRu: '\u0422\u0438\u0445\u0438\u0439 \u0433\u0435\u0440\u043E\u0439',             desc: 'Complete 10 tasks without asking for help',    descRu: '10 \u0437\u0430\u0434\u0430\u0447 \u0431\u0435\u0437 \u043F\u043E\u043C\u043E\u0449\u0438',                  check: (s) => s.tasksCompleted >= 10 && s.helpGiven === 0, secret: true },
  { id: 'comeback_kid',      emoji: '\u{1F504}', title: 'Comeback Kid',          titleRu: '\u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0435\u0446',               desc: 'Return after 7+ days away',                    descRu: '\u0412\u0435\u0440\u043D\u0443\u043B\u0441\u044F \u043F\u043E\u0441\u043B\u0435 7+ \u0434\u043D\u0435\u0439',            check: (s) => s.loginDays >= 2 && s.streakDays === 1, secret: true },
  { id: 'perfectionist',     emoji: '\u{1F48E}', title: 'Perfectionist',         titleRu: '\u041F\u0435\u0440\u0444\u0435\u043A\u0446\u0438\u043E\u043D\u0438\u0441\u0442',          desc: 'Complete a perfect week (all daily quests)',   descRu: '\u0418\u0434\u0435\u0430\u043B\u044C\u043D\u0430\u044F \u043D\u0435\u0434\u0435\u043B\u044F',                      check: (s) => s.perfectWeek,               secret: true },
  { id: 'democracy',         emoji: '\u{1F5F3}', title: 'Democracy',             titleRu: '\u0414\u0435\u043C\u043E\u043A\u0440\u0430\u0442\u0438\u044F',               desc: 'Vote in 5 community polls',                    descRu: '5 \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u043D\u0438\u0439',                           check: (s) => s.communityVotes >= 5,       secret: true },
  { id: 'the_one',           emoji: '\u{1F947}', title: 'The One',               titleRu: '\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u044B\u0439',                desc: 'Earn all non-secret achievements',             descRu: '\u0412\u0441\u0435 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0430\u0447\u0438\u0432\u043A\u0438',                  check: (s) => s.totalXP >= 2000 && s.questCompleted && s.tasksCompleted >= 60, secret: true, tier: 'platinum' },
];

export async function checkAchievements(userId: number, stats: AchievementStats): Promise<string[]> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'achievements'`,
    [userId],
  );
  const earned: string[] = (res.rows[0]?.value as any)?.ids ?? [];
  const newlyEarned: string[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (earned.includes(ach.id)) continue;
    try {
      if (ach.check(stats)) {
        newlyEarned.push(ach.id);
        earned.push(ach.id);
      }
    } catch { /* ignore check errors */ }
  }

  if (newlyEarned.length > 0) {
    await pool.query(
      `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
       VALUES ($1, 'achievements', $2::jsonb, NOW())
       ON CONFLICT (user_id, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [userId, JSON.stringify({ ids: earned })],
    );
  }

  return newlyEarned;
}

export function formatAchievementsMessage(earnedIds: string[], allAchievements: Achievement[], ru: boolean): string {
  let msg = `${ce('trophy', '\u{1F3C6}')} <b>${ru ? '\u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F' : 'Achievements'}</b>\n`;
  msg += `${ru ? '\u041E\u0442\u043A\u0440\u044B\u0442\u043E' : 'Earned'}: ${earnedIds.length}/${allAchievements.filter(a => !a.secret).length}\n\n`;

  const tierOrder: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  const tierEmoji: Record<string, string> = { platinum: ce('diamond','\u{1F48E}'), gold: ce('trophy','\u{1F947}'), silver: ce('coin','\u{1F948}'), bronze: ce('star','\u{1F949}') };

  // Show earned first, then locked
  const earned = allAchievements.filter(a => earnedIds.includes(a.id));
  const locked = allAchievements.filter(a => !earnedIds.includes(a.id) && !a.secret);
  const secretEarned = allAchievements.filter(a => earnedIds.includes(a.id) && a.secret);
  const secretCount = allAchievements.filter(a => a.secret).length;

  // Sort earned by tier
  earned.sort((a, b) => (tierOrder[a.tier || 'bronze'] ?? 3) - (tierOrder[b.tier || 'bronze'] ?? 3));

  if (earned.length > 0) {
    msg += `<b>${ru ? '\u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E' : 'Earned'}:</b>\n`;
    for (const a of earned) {
      const tIcon = a.tier ? (tierEmoji[a.tier] || '') + ' ' : '';
      msg += `${a.emoji} ${tIcon}<b>${ru ? a.titleRu : a.title}</b> — ${ru ? a.descRu : a.desc}\n`;
    }
    msg += '\n';
  }

  if (locked.length > 0) {
    msg += `<b>${ru ? '\u0417\u0430\u043A\u0440\u044B\u0442\u043E' : 'Locked'}:</b>\n`;
    for (const a of locked.slice(0, 15)) {
      const tIcon = a.tier ? (tierEmoji[a.tier] || '') + ' ' : '';
      msg += `${ce('lock','\u{1F512}')} ${tIcon}${ru ? a.titleRu : a.title} — ${ru ? a.descRu : a.desc}\n`;
    }
    if (locked.length > 15) {
      msg += `<i>...${ru ? '\u0438 \u0435\u0449\u0451' : 'and'} ${locked.length - 15} ${ru ? '\u0435\u0449\u0451' : 'more'}</i>\n`;
    }
    msg += '\n';
  }

  // Secrets
  const secretLocked = secretCount - secretEarned.length;
  if (secretEarned.length > 0) {
    msg += `<b>${ru ? '\u0421\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0435' : 'Secret'}:</b>\n`;
    for (const a of secretEarned) {
      msg += `${a.emoji} <b>${ru ? a.titleRu : a.title}</b> — ${ru ? a.descRu : a.desc}\n`;
    }
  }
  if (secretLocked > 0) {
    msg += `\u{2753} ${secretLocked} ${ru ? '\u0441\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0445 \u0430\u0447\u0438\u0432\u043E\u043A \u0441\u043A\u0440\u044B\u0442\u043E' : 'secret achievements hidden'}\n`;
  }

  return msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. DAILY DIGEST
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateDailyDigest(pool: Pool, ru: boolean): Promise<string> {
  // Yesterday's date range
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const ydStr = yesterday.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Stats from yesterday
  let newAgents = 0;
  let newUsers = 0;
  let bugsReported = 0;
  let feedbackCount = 0;

  try {
    const agentsRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM builder_bot.agents WHERE created_at::date = $1`,
      [ydStr],
    );
    newAgents = parseInt(agentsRes.rows[0]?.cnt || '0', 10);
  } catch { /* table might not have date column */ }

  try {
    const usersRes = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as cnt FROM builder_bot.user_settings
       WHERE key = 'last_checkin' AND (value->>'date')::date = $1`,
      [ydStr],
    );
    newUsers = parseInt(usersRes.rows[0]?.cnt || '0', 10);
  } catch { /* ignore */ }

  try {
    const bugsRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM builder_bot.user_settings
       WHERE key = 'bug_reports' AND updated_at::date = $1`,
      [ydStr],
    );
    bugsReported = parseInt(bugsRes.rows[0]?.cnt || '0', 10);
  } catch { /* ignore */ }

  try {
    const fbRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM builder_bot.user_settings
       WHERE key = 'feedback_count' AND updated_at::date = $1`,
      [ydStr],
    );
    feedbackCount = parseInt(fbRes.rows[0]?.cnt || '0', 10);
  } catch { /* ignore */ }

  // Streak leaders
  let streakLeaders: { userId: number; streak: number }[] = [];
  try {
    const streakRes = await pool.query(
      `SELECT user_id, (value->>'streak')::int as streak FROM builder_bot.user_settings
       WHERE key = 'streak' ORDER BY (value->>'streak')::int DESC LIMIT 5`,
    );
    streakLeaders = streakRes.rows.map((r: any) => ({ userId: r.user_id, streak: r.streak || 0 }));
  } catch { /* ignore */ }

  // Today's daily quest
  const dailyQuest = getDailyQuest();
  const evt = getCurrentEvent();

  let msg = `${ce('star', '\u2B50')} <b>${ru ? '\u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u0434\u0430\u0439\u0434\u0436\u0435\u0441\u0442' : 'Daily Digest'}</b> ${todayStr}\n\n`;

  msg += `<b>${ru ? '\u0412\u0447\u0435\u0440\u0430' : 'Yesterday'} (${ydStr}):</b>\n`;
  msg += `  ${ce('rocket', '\u{1F680}')} ${ru ? '\u041D\u043E\u0432\u044B\u0445 \u0430\u0433\u0435\u043D\u0442\u043E\u0432' : 'New agents'}: ${newAgents}\n`;
  msg += `  ${ce('bug', '\u{1F41B}')} ${ru ? '\u0411\u0430\u0433\u043E\u0432' : 'Bugs'}: ${bugsReported}\n`;
  msg += `  ${ce('bulb', '\u{1F4A1}')} ${ru ? '\u0424\u0438\u0434\u0431\u044D\u043A\u043E\u0432' : 'Feedbacks'}: ${feedbackCount}\n`;
  msg += `  ${ru ? '\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0442\u0435\u0441\u0442\u0435\u0440\u043E\u0432' : 'Active testers'}: ${newUsers}\n\n`;

  msg += `<b>${ru ? '\u0421\u0435\u0433\u043E\u0434\u043D\u044F' : 'Today'}:</b>\n`;
  msg += `${ce('target', '\u{1F3AF}')} ${ru ? '\u041A\u0432\u0435\u0441\u0442' : 'Quest'}: ${ru ? dailyQuest.standard.title : dailyQuest.standard.titleEn} (+${dailyQuest.standard.xp} XP)\n`;

  if (evt) {
    msg += `${ce('fire', '\u{1F525}')} ${ru ? '\u0418\u0432\u0435\u043D\u0442' : 'Event'}: ${ru ? evt.titleRu : evt.title}\n`;
  }

  if (streakLeaders.length > 0) {
    msg += `\n${ce('fire', '\u{1F525}')} <b>${ru ? '\u041B\u0438\u0434\u0435\u0440\u044B \u0441\u0442\u0440\u0438\u043A\u043E\u0432' : 'Streak Leaders'}:</b>\n`;
    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}', '4\uFE0F\u20E3', '5\uFE0F\u20E3'];
    for (let i = 0; i < streakLeaders.length; i++) {
      msg += `  ${medals[i] || ''} ID:${streakLeaders[i].userId} — ${streakLeaders[i].streak} ${ru ? '\u0434\u043D\u0435\u0439' : 'days'}\n`;
    }
  }

  return msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PING INACTIVE
// ═══════════════════════════════════════════════════════════════════════════════

export interface InactiveTester {
  userId: number;
  daysSinceActive: number;
  streak: number;
}

export async function getInactiveTesters(pool: Pool, days: number): Promise<InactiveTester[]> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    const res = await pool.query(
      `SELECT us1.user_id,
              us1.value->>'date' as last_date,
              COALESCE((us2.value->>'streak')::int, 0) as streak
       FROM builder_bot.user_settings us1
       LEFT JOIN builder_bot.user_settings us2
         ON us1.user_id = us2.user_id AND us2.key = 'streak'
       WHERE us1.key = 'last_checkin'
         AND us1.updated_at < $1`,
      [cutoffStr],
    );

    return res.rows.map((r: any) => {
      const lastDate = r.last_date ? new Date(r.last_date) : new Date(0);
      const diffMs = Date.now() - lastDate.getTime();
      const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return {
        userId: parseInt(r.user_id, 10),
        daysSinceActive: daysSince,
        streak: r.streak || 0,
      };
    });
  } catch {
    return [];
  }
}

export function formatInactivePing(days: number, ru: boolean): string {
  if (days <= 3) {
    return ru
      ? `${ce('fire', '\u{1F525}')} \u041D\u0435 \u0442\u0435\u0440\u044F\u0439 \u0441\u0432\u043E\u0439 \u0441\u0442\u0440\u0438\u043A! \u0422\u044B \u043D\u0435 \u0437\u0430\u0445\u043E\u0434\u0438\u043B(a) ${days} \u0434\u043D\u044F.\n\n\u0421\u0434\u0435\u043B\u0430\u0439 /checkin \u0447\u0442\u043E\u0431\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441!`
      : `${ce('fire', '\u{1F525}')} Don't lose your streak! You haven't checked in for ${days} days.\n\nDo /checkin to keep your progress!`;
  }
  if (days <= 7) {
    return ru
      ? `${ce('star', '\u2B50')} \u041C\u044B \u0441\u043A\u0443\u0447\u0430\u0435\u043C! \u0422\u044B \u043D\u0435 \u0437\u0430\u0445\u043E\u0434\u0438\u043B(a) ${days} \u0434\u043D\u0435\u0439.\n\n\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u043D\u043E\u0432\u044B\u0439 \u043A\u0432\u0435\u0441\u0442 \u0436\u0434\u0451\u0442 \u0442\u0435\u0431\u044F. \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0439\u0441\u044F!`
      : `${ce('star', '\u2B50')} We miss you! You haven't been active for ${days} days.\n\nA new quest awaits you today. Come back!`;
  }
  return ru
    ? `${ce('rocket', '\u{1F680}')} \u041F\u0440\u0438\u0432\u0435\u0442! \u0422\u044B \u043D\u0435 \u0437\u0430\u0445\u043E\u0434\u0438\u043B(a) ${days} \u0434\u043D\u0435\u0439.\n\n\u041C\u043D\u043E\u0433\u043E \u043D\u043E\u0432\u043E\u0433\u043E \u043F\u043E\u044F\u0432\u0438\u043B\u043E\u0441\u044C. \u041D\u0430\u043F\u0438\u0448\u0438 /start \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C \u0437\u0430\u043D\u043E\u0432\u043E!`
    : `${ce('rocket', '\u{1F680}')} Hey! You haven't been around for ${days} days.\n\nLots of new stuff has been added. Type /start to check it out!`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. HALL OF FAME
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateHallOfFame(pool: Pool, ru: boolean): Promise<string> {
  let msg = `${ce('crown', '\u{1F451}')} <b>${ru ? '\u0417\u0430\u043B \u0441\u043B\u0430\u0432\u044B' : 'Hall of Fame'}</b>\n\n`;

  // Top XP
  try {
    const xpRes = await pool.query(
      `SELECT user_id, (value->>'totalXP')::int as xp FROM builder_bot.user_settings
       WHERE key = 'quest_progress' ORDER BY (value->>'totalXP')::int DESC LIMIT 10`,
    );
    if (xpRes.rows.length > 0) {
      msg += `${ce('star', '\u2B50')} <b>${ru ? '\u0422\u043E\u043F XP' : 'Top XP'}:</b>\n`;
      const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
      for (let i = 0; i < xpRes.rows.length; i++) {
        const r = xpRes.rows[i] as any;
        const medal = medals[i] || `${i + 1}.`;
        msg += `  ${medal} ID:${r.user_id} — ${r.xp || 0} XP\n`;
      }
      msg += '\n';
    }
  } catch { /* ignore */ }

  // Top streaks
  try {
    const streakRes = await pool.query(
      `SELECT user_id, (value->>'streak')::int as streak FROM builder_bot.user_settings
       WHERE key = 'streak' ORDER BY (value->>'streak')::int DESC LIMIT 5`,
    );
    if (streakRes.rows.length > 0) {
      msg += `${ce('fire', '\u{1F525}')} <b>${ru ? '\u041B\u0443\u0447\u0448\u0438\u0435 \u0441\u0442\u0440\u0438\u043A\u0438' : 'Best Streaks'}:</b>\n`;
      for (let i = 0; i < streakRes.rows.length; i++) {
        const r = streakRes.rows[i] as any;
        msg += `  ${i + 1}. ID:${r.user_id} — ${r.streak || 0} ${ru ? '\u0434\u043D\u0435\u0439' : 'days'}\n`;
      }
      msg += '\n';
    }
  } catch { /* ignore */ }

  // Top bug hunters
  try {
    const bugRes = await pool.query(
      `SELECT user_id, (value->>'count')::int as cnt FROM builder_bot.user_settings
       WHERE key = 'bug_count' ORDER BY (value->>'count')::int DESC LIMIT 5`,
    );
    if (bugRes.rows.length > 0) {
      msg += `${ce('bug', '\u{1F41B}')} <b>${ru ? '\u041E\u0445\u043E\u0442\u043D\u0438\u043A\u0438 \u043D\u0430 \u0431\u0430\u0433\u0438' : 'Bug Hunters'}:</b>\n`;
      for (let i = 0; i < bugRes.rows.length; i++) {
        const r = bugRes.rows[i] as any;
        msg += `  ${i + 1}. ID:${r.user_id} — ${r.cnt || 0} ${ru ? '\u0431\u0430\u0433\u043E\u0432' : 'bugs'}\n`;
      }
      msg += '\n';
    }
  } catch { /* ignore */ }

  // Top agent creators
  try {
    const agentRes = await pool.query(
      `SELECT user_id, COUNT(*) as cnt FROM builder_bot.agents GROUP BY user_id ORDER BY cnt DESC LIMIT 5`,
    );
    if (agentRes.rows.length > 0) {
      msg += `${ce('rocket', '\u{1F680}')} <b>${ru ? '\u0422\u043E\u043F \u0441\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u0438 \u0430\u0433\u0435\u043D\u0442\u043E\u0432' : 'Top Agent Creators'}:</b>\n`;
      for (let i = 0; i < agentRes.rows.length; i++) {
        const r = agentRes.rows[i] as any;
        msg += `  ${i + 1}. ID:${r.user_id} — ${r.cnt} ${ru ? '\u0430\u0433\u0435\u043D\u0442\u043E\u0432' : 'agents'}\n`;
      }
      msg += '\n';
    }
  } catch { /* ignore */ }

  // Most achievements
  try {
    const achRes = await pool.query(
      `SELECT user_id, jsonb_array_length(value->'ids') as cnt FROM builder_bot.user_settings
       WHERE key = 'achievements' ORDER BY jsonb_array_length(value->'ids') DESC LIMIT 5`,
    );
    if (achRes.rows.length > 0) {
      msg += `${ce('trophy', '\u{1F3C6}')} <b>${ru ? '\u0411\u043E\u043B\u044C\u0448\u0435 \u0432\u0441\u0435\u0445 \u0430\u0447\u0438\u0432\u043E\u043A' : 'Most Achievements'}:</b>\n`;
      for (let i = 0; i < achRes.rows.length; i++) {
        const r = achRes.rows[i] as any;
        msg += `  ${i + 1}. ID:${r.user_id} — ${r.cnt || 0}\n`;
      }
    }
  } catch { /* ignore */ }

  return msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. QUALITY SCORE
// ═══════════════════════════════════════════════════════════════════════════════

export interface QualityResult {
  bonusXP: number;
  penalties: string[];
  tips: string[];
}

export function calculateQualityScore(message: string, hasScreenshot: boolean): QualityResult {
  const result: QualityResult = { bonusXP: 0, penalties: [], tips: [] };

  // Length bonus
  const len = message.length;
  if (len >= 500) {
    result.bonusXP += 10;
  } else if (len >= 200) {
    result.bonusXP += 5;
  } else if (len >= 100) {
    result.bonusXP += 2;
  }

  // Too short penalty
  if (len < 30) {
    result.penalties.push('Message too short (< 30 chars)');
    result.bonusXP -= 5;
  }

  // Screenshot bonus
  if (hasScreenshot) {
    result.bonusXP += 5;
  } else {
    result.tips.push('Add a screenshot for +5 XP');
  }

  // Steps to reproduce
  const hasSteps = /(\d+\.|step|шаг|затем|then)/i.test(message);
  if (hasSteps) {
    result.bonusXP += 5;
  } else {
    result.tips.push('Include steps to reproduce for +5 XP');
  }

  // Expected vs actual
  const hasExpected = /(ожидал|expected|should|должен)/i.test(message);
  const hasActual = /(получил|actual|instead|вместо)/i.test(message);
  if (hasExpected && hasActual) {
    result.bonusXP += 5;
  } else {
    result.tips.push('Add expected vs actual behavior for +5 XP');
  }

  // Device/version info
  const hasVersion = /(version|версия|browser|браузер|ios|android|chrome|safari|telegram)/i.test(message);
  if (hasVersion) {
    result.bonusXP += 3;
  }

  // Error logs or code snippets
  const hasCode = /(```|error|exception|stacktrace|console)/i.test(message);
  if (hasCode) {
    result.bonusXP += 3;
  }

  // Spam-like patterns penalty
  const hasRepeat = /(.)\1{10,}/.test(message);
  if (hasRepeat) {
    result.penalties.push('Detected repetitive characters');
    result.bonusXP -= 10;
  }

  // All caps penalty
  const uppercaseRatio = (message.replace(/[^A-ZА-Я]/g, '').length) / (message.replace(/\s/g, '').length || 1);
  if (uppercaseRatio > 0.7 && len > 20) {
    result.penalties.push('Too many uppercase characters');
    result.bonusXP -= 3;
  }

  // Ensure non-negative
  result.bonusXP = Math.max(0, result.bonusXP);

  return result;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarity: number;
  existingId?: number;
  confident: boolean;
}

export async function checkDuplicate(pool: Pool, message: string, zone: string): Promise<DuplicateCheckResult> {
  try {
    // Simple approach: check for similar recent reports in same zone
    const res = await pool.query(
      `SELECT id, value->>'message' as msg FROM builder_bot.user_settings
       WHERE key = 'bug_report' AND value->>'zone' = $1
       AND updated_at > NOW() - INTERVAL '7 days'
       LIMIT 50`,
      [zone],
    );

    const msgWords = new Set(message.toLowerCase().split(/\s+/).filter(w => w.length > 3));

    for (const row of res.rows) {
      const existingMsg = ((row as any).msg || '').toLowerCase();
      const existingWords = new Set(existingMsg.split(/\s+/).filter((w: string) => w.length > 3));

      if (msgWords.size === 0 || existingWords.size === 0) continue;

      // Jaccard similarity
      let intersection = 0;
      for (const w of msgWords) {
        if (existingWords.has(w)) intersection++;
      }
      const union = new Set([...msgWords, ...existingWords]).size;
      const similarity = union > 0 ? intersection / union : 0;

      if (similarity >= 0.7) {
        return {
          isDuplicate: true,
          similarity: Math.round(similarity * 100),
          existingId: (row as any).id,
          confident: similarity >= 0.85,
        };
      }
    }

    return { isDuplicate: false, similarity: 0, confident: true };
  } catch {
    return { isDuplicate: false, similarity: 0, confident: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. INTERNSHIP
// ═══════════════════════════════════════════════════════════════════════════════

export function formatInternshipInfo(ru: boolean): string {
  if (ru) {
    return `${ce('crown', '\u{1F451}')} <b>\u0421\u0442\u0430\u0436\u0438\u0440\u043E\u0432\u043A\u0430 \u0432 TON Agent Platform</b>

${ce('diamond', '\u{1F48E}')} <b>\u0427\u0442\u043E \u044D\u0442\u043E?</b>
\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u0430\u044F \u0441\u0442\u0430\u0436\u0438\u0440\u043E\u0432\u043A\u0430 \u0432 \u043A\u043E\u043C\u0430\u043D\u0434\u0435 TON Agent Platform. \u0422\u044B \u0431\u0443\u0434\u0435\u0448\u044C \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u043D\u0430\u0434 \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u043C \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u043E\u043C \u0432 Web3/AI \u0441\u0444\u0435\u0440\u0435. \u041E\u043F\u044B\u0442, \u043C\u0435\u043D\u0442\u043E\u0440\u0441\u0442\u0432\u043E, \u0440\u0435\u0437\u044E\u043C\u0435 \u0438 \u0448\u0430\u043D\u0441 \u043E\u0441\u0442\u0430\u0442\u044C\u0441\u044F \u0432 \u043A\u043E\u043C\u0430\u043D\u0434\u0435.

${ce('rocket', '\u{1F680}')} <b>\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F:</b>
  \u2022 QA Engineer \u2014 \u0442\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435, \u0430\u0432\u0442\u043E\u0442\u0435\u0441\u0442\u044B, CI/CD
  \u2022 Full-stack Dev \u2014 TypeScript, Node.js, TON, Telegram
  \u2022 AI/ML \u2014 \u0430\u0433\u0435\u043D\u0442\u043D\u044B\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u044B, LLM \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044F
  \u2022 Community \u2014 \u043A\u043E\u043D\u0442\u0435\u043D\u0442, \u043C\u043E\u0434\u0435\u0440\u0430\u0446\u0438\u044F, \u0433\u0440\u043E\u0443\u0441

${ce('target', '\u{1F3AF}')} <b>\u0422\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F:</b>
  \u2022 \u041C\u0438\u043D\u0438\u043C\u0443\u043C 500 XP \u0437\u0430 \u0432\u0440\u0435\u043C\u044F \u0431\u0435\u0442\u0430-\u0442\u0435\u0441\u0442\u0430
  \u2022 \u0423\u0447\u0430\u0441\u0442\u0438\u0435 \u0432\u043E \u0432\u0441\u0435\u0445 4 \u043D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0445 \u0438\u0432\u0435\u043D\u0442\u0430\u0445
  \u2022 \u041C\u0438\u043D\u0438\u043C\u0443\u043C 3 \u0437\u043E\u043D\u044B \u043F\u0440\u043E\u0442\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u044B
  \u2022 \u0421\u0442\u0440\u0438\u043A \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 14 \u0434\u043D\u0435\u0439
  \u2022 \u041F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0440\u0438\u0431\u044C\u044E\u0448\u043D \u0432 \u043A\u043E\u043C\u044C\u044E\u043D\u0438\u0442\u0438

${ce('trophy', '\u{1F3C6}')} <b>\u0427\u0442\u043E \u0434\u0430\u0451\u0442:</b>
  \u2022 \u0421\u0442\u0430\u0436\u0438\u0440\u043E\u0432\u043A\u0430 2-3 \u043C\u0435\u0441\u044F\u0446\u0430 (\u0443\u0434\u0430\u043B\u0451\u043D\u043D\u043E, 5-10 \u0447/\u043D\u0435\u0434)
  \u2022 \u041E\u043F\u044B\u0442 \u0432 Web3 + AI + Telegram
  \u2022 \u041C\u0435\u043D\u0442\u043E\u0440\u0441\u0442\u0432\u043E \u043E\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B
  \u2022 \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u043F\u0438\u0441\u044C\u043C\u043E
  \u2022 \u041B\u0443\u0447\u0448\u0438\u0439 \u043C\u043E\u0436\u0435\u0442 \u043E\u0441\u0442\u0430\u0442\u044C\u0441\u044F \u0432 \u043A\u043E\u043C\u0430\u043D\u0434\u0435

${ce('coin', '\u{1FA99}')} <b>\u041E\u0442\u0431\u043E\u0440:</b>
\u0422\u043E\u043F-5 \u0442\u0435\u0441\u0442\u0435\u0440\u043E\u0432 \u043F\u043E XP \u043F\u043E\u043B\u0443\u0447\u0430\u0442 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u043D\u0430 \u0441\u043E\u0431\u0435\u0441\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u0441\u043B\u0435 \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0439 \u043D\u0435\u0434\u0435\u043B\u0438 (\u{1F3C6} Finals).`;
  }

  return `${ce('crown', '\u{1F451}')} <b>TON Agent Platform Internship</b>

${ce('diamond', '\u{1F48E}')} <b>What is it?</b>
An unpaid internship with the TON Agent Platform team. You will work on a real product in the Web3/AI space. Experience, mentorship, resume, and a chance to join the team.

${ce('rocket', '\u{1F680}')} <b>Tracks:</b>
  \u2022 QA Engineer \u2014 testing, automated tests, CI/CD
  \u2022 Full-stack Dev \u2014 TypeScript, Node.js, TON, Telegram
  \u2022 AI/ML \u2014 agentic systems, LLM integration
  \u2022 Community \u2014 content, moderation, growth

${ce('target', '\u{1F3AF}')} <b>Requirements:</b>
  \u2022 Minimum 500 XP during beta testing
  \u2022 Participate in all 4 weekly events
  \u2022 At least 3 zones tested
  \u2022 Streak of at least 14 days
  \u2022 Positive community contribution

${ce('trophy', '\u{1F3C6}')} <b>What you get:</b>
  \u2022 Internship 2-3 months (remote, 5-10h/week)
  \u2022 Experience in Web3 + AI + Telegram
  \u2022 Mentorship from the team
  \u2022 Recommendation letter
  \u2022 Best performer may join the team

${ce('coin', '\u{1FA99}')} <b>Selection:</b>
Top 5 testers by XP will receive an interview invitation after the Finals week (\u{1F3C6} Finals).`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. STREAK MULTIPLIER
// ═══════════════════════════════════════════════════════════════════════════════

export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 21) return 3;
  if (streakDays >= 14) return 2;
  if (streakDays >= 7) return 1.5;
  return 1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. WEEKLY DECAY
// ═══════════════════════════════════════════════════════════════════════════════

export async function applyWeeklyDecay(pool: Pool): Promise<number> {
  try {
    // Find users who haven't checked in for 7+ days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const res = await pool.query(
      `SELECT user_id, (value->>'totalXP')::int as xp FROM builder_bot.user_settings
       WHERE key = 'quest_progress'
       AND user_id IN (
         SELECT user_id FROM builder_bot.user_settings
         WHERE key = 'last_checkin'
         AND updated_at < $1
       )
       AND (value->>'totalXP')::int > 0`,
      [cutoff.toISOString()],
    );

    let affected = 0;
    for (const row of res.rows) {
      const r = row as any;
      const currentXP = r.xp || 0;
      const decayAmount = Math.ceil(currentXP * 0.05); // 5% decay per week
      if (decayAmount <= 0) continue;

      const newXP = Math.max(0, currentXP - decayAmount);
      await pool.query(
        `UPDATE builder_bot.user_settings
         SET value = jsonb_set(value, '{totalXP}', to_jsonb($1::int)), updated_at = NOW()
         WHERE user_id = $2 AND key = 'quest_progress'`,
        [newXP, r.user_id],
      );
      affected++;
    }

    return affected;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Load user stats for achievement checking
// ═══════════════════════════════════════════════════════════════════════════════

export async function loadUserStats(userId: number): Promise<AchievementStats> {
  const pool = getPool();
  const defaults: AchievementStats = {
    questCompleted: false,
    totalBugs: 0,
    totalFeedback: 0,
    totalAgents: 0,
    totalXP: 0,
    streakDays: 0,
    referralCount: 0,
    tasksCompleted: 0,
    dailyQuestsCompleted: 0,
    weeklyEventsParticipated: 0,
    zonesCompleted: 0,
    chatMessages: 0,
    voiceCommands: 0,
    defiSwaps: 0,
    giftsTraded: 0,
    templatesPublished: 0,
    templatesInstalled: 0,
    contentPosts: 0,
    helpGiven: 0,
    loginDays: 0,
    agentTypes: 0,
    level5Tasks: 0,
    hardcoreQuests: 0,
    criticalBugs: 0,
    screenshotsAttached: 0,
    nightActivity: false,
    weekendActivity: false,
    firstDayJoin: false,
    perfectWeek: false,
    communityVotes: 0,
    apiEndpointsTested: 0,
    uniqueToolsUsed: 0,
    consecutiveDailyQuests: 0,
    mentorSessions: 0,
    bugsVerified: 0,
    featuresRequested: 0,
  };

  try {
    // Batch load settings
    const settingsRes = await pool.query(
      `SELECT key, value FROM builder_bot.user_settings WHERE user_id = $1`,
      [userId],
    );
    const settings: Record<string, any> = {};
    for (const row of settingsRes.rows) {
      settings[(row as any).key] = (row as any).value;
    }

    // Quest progress
    if (settings.quest_progress) {
      const qp = settings.quest_progress;
      defaults.totalXP = qp.totalXP || 0;
      const completed = qp.completed || [];
      const requiredSteps = ONBOARDING_STEPS.filter(s => !s.optional);
      defaults.questCompleted = requiredSteps.every(s => completed.includes(s.id));
    }

    // Streak
    if (settings.streak) {
      defaults.streakDays = settings.streak.streak || 0;
    }

    // Counts
    defaults.totalBugs = settings.bug_count?.count || 0;
    defaults.totalFeedback = settings.feedback_count?.count || 0;
    defaults.referralCount = settings.referral_count?.count || 0;
    defaults.chatMessages = settings.agent_chat_count?.count || 0;
    defaults.voiceCommands = settings.voice_command_count?.count || 0;
    defaults.defiSwaps = settings.defi_swap_count?.count || 0;
    defaults.giftsTraded = settings.gifts_traded_count?.count || 0;
    defaults.templatesPublished = settings.templates_published?.count || 0;
    defaults.templatesInstalled = settings.templates_installed?.count || 0;
    defaults.contentPosts = settings.content_posts?.count || 0;
    defaults.helpGiven = settings.help_given?.count || 0;
    defaults.loginDays = settings.login_days?.count || 0;
    defaults.dailyQuestsCompleted = settings.daily_quests_completed?.count || 0;
    defaults.hardcoreQuests = settings.hardcore_quests?.count || 0;
    defaults.criticalBugs = settings.critical_bugs?.count || 0;
    defaults.screenshotsAttached = settings.screenshots_attached?.count || 0;
    defaults.communityVotes = settings.community_votes?.count || 0;
    defaults.apiEndpointsTested = settings.api_endpoints_tested?.count || 0;
    defaults.uniqueToolsUsed = settings.unique_tools_used?.count || 0;
    defaults.consecutiveDailyQuests = settings.consecutive_daily_quests?.count || 0;
    defaults.mentorSessions = settings.mentor_sessions?.count || 0;
    defaults.bugsVerified = settings.bugs_verified?.count || 0;
    defaults.featuresRequested = settings.features_requested?.count || 0;
    defaults.weeklyEventsParticipated = settings.weekly_events_participated?.count || 0;
    defaults.nightActivity = settings.night_activity?.active || false;
    defaults.weekendActivity = settings.weekend_activity?.active || false;
    defaults.firstDayJoin = settings.first_day_join?.active || false;
    defaults.perfectWeek = settings.perfect_week?.active || false;

    // Zones completed
    const completedTasks = settings.completed_tasks?.ids || [];
    const zonesWithCompleted = new Set(
      ZONE_TASKS.filter(t => completedTasks.includes(t.id)).map(t => t.zone),
    );
    defaults.zonesCompleted = zonesWithCompleted.size;
    defaults.tasksCompleted = completedTasks.length;
    defaults.level5Tasks = ZONE_TASKS.filter(t => t.level === 5 && completedTasks.includes(t.id)).length;

    // Agents count
    try {
      const agentRes = await pool.query(
        `SELECT COUNT(*) as cnt FROM builder_bot.agents WHERE user_id = $1`,
        [userId],
      );
      defaults.totalAgents = parseInt(agentRes.rows[0]?.cnt || '0', 10);
    } catch { /* ignore */ }

    // Agent types
    try {
      const typeRes = await pool.query(
        `SELECT COUNT(DISTINCT trigger_type) as cnt FROM builder_bot.agents WHERE user_id = $1`,
        [userId],
      );
      defaults.agentTypes = parseInt(typeRes.rows[0]?.cnt || '0', 10);
    } catch { /* ignore */ }

  } catch { /* return defaults on any error */ }

  return defaults;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Increment a counter in user_settings
// ═══════════════════════════════════════════════════════════════════════════════

export async function incrementUserStat(userId: number, key: string, amount: number = 1): Promise<number> {
  const pool = getPool();
  try {
    const res = await pool.query(
      `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = jsonb_set(
         builder_bot.user_settings.value,
         '{count}',
         to_jsonb(COALESCE((builder_bot.user_settings.value->>'count')::int, 0) + $4)
       ), updated_at = NOW()
       RETURNING (value->>'count')::int as cnt`,
      [userId, key, JSON.stringify({ count: amount }), amount],
    );
    return res.rows[0]?.cnt || amount;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Set a boolean flag in user_settings
// ═══════════════════════════════════════════════════════════════════════════════

export async function setUserFlag(userId: number, key: string, active: boolean = true): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (user_id, key) DO UPDATE SET value = $3::jsonb, updated_at = NOW()`,
      [userId, key, JSON.stringify({ active })],
    );
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Record completed task
// ═══════════════════════════════════════════════════════════════════════════════

export async function markTaskCompleted(userId: number, taskId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'completed_tasks'`,
      [userId],
    );
    const ids: string[] = res.rows[0] ? ((res.rows[0] as any).value?.ids || []) : [];
    if (ids.includes(taskId)) return false;

    ids.push(taskId);
    await pool.query(
      `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
       VALUES ($1, 'completed_tasks', $2::jsonb, NOW())
       ON CONFLICT (user_id, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [userId, JSON.stringify({ ids })],
    );
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Get user's completed task IDs
// ═══════════════════════════════════════════════════════════════════════════════

export async function getCompletedTasks(userId: number): Promise<string[]> {
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'completed_tasks'`,
      [userId],
    );
    return res.rows[0] ? ((res.rows[0] as any).value?.ids || []) : [];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Update streak
// ═══════════════════════════════════════════════════════════════════════════════

export async function updateStreak(userId: number): Promise<{ streak: number; isNew: boolean }> {
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'streak'`,
      [userId],
    );

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (res.rows.length > 0) {
      const val = (res.rows[0] as any).value;
      const lastDate = val.lastDate || '';
      const currentStreak = val.streak || 0;

      if (lastDate === todayStr) {
        return { streak: currentStreak, isNew: false };
      }

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);

      const newStreak = lastDate === yStr ? currentStreak + 1 : 1;

      await pool.query(
        `UPDATE builder_bot.user_settings
         SET value = $1::jsonb, updated_at = NOW()
         WHERE user_id = $2 AND key = 'streak'`,
        [JSON.stringify({ streak: newStreak, lastDate: todayStr, maxStreak: Math.max(newStreak, val.maxStreak || 0) }), userId],
      );

      return { streak: newStreak, isNew: true };
    }

    // First ever checkin
    await pool.query(
      `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
       VALUES ($1, 'streak', $2::jsonb, NOW())`,
      [userId, JSON.stringify({ streak: 1, lastDate: todayStr, maxStreak: 1 })],
    );
    return { streak: 1, isNew: true };
  } catch {
    return { streak: 0, isNew: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Record checkin
// ═══════════════════════════════════════════════════════════════════════════════

export async function recordCheckin(userId: number): Promise<{ streak: number; xpEarned: number; multiplier: number; newAchievements: string[] }> {
  const pool = getPool();

  // Update streak
  const { streak, isNew } = await updateStreak(userId);
  if (!isNew) {
    return { streak, xpEarned: 0, multiplier: getStreakMultiplier(streak), newAchievements: [] };
  }

  // Record last checkin
  await pool.query(
    `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
     VALUES ($1, 'last_checkin', $2::jsonb, NOW())
     ON CONFLICT (user_id, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [userId, JSON.stringify({ date: new Date().toISOString().slice(0, 10) })],
  );

  // Increment login days
  await incrementUserStat(userId, 'login_days', 1);

  // Check time of day for night owl
  const hour = new Date().getHours();
  if (hour >= 2 && hour < 5) {
    await setUserFlag(userId, 'night_activity', true);
  }

  // Check weekend
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6) {
    const prev = await pool.query(
      `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'weekend_days'`,
      [userId],
    );
    const weekendDays = new Set<number>((prev.rows[0] as any)?.value?.days || []);
    weekendDays.add(dow);
    await pool.query(
      `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
       VALUES ($1, 'weekend_days', $2::jsonb, NOW())
       ON CONFLICT (user_id, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [userId, JSON.stringify({ days: [...weekendDays] })],
    );
    if (weekendDays.has(0) && weekendDays.has(6)) {
      await setUserFlag(userId, 'weekend_activity', true);
    }
  }

  // Calculate XP: base 3 + streak multiplier
  const multiplier = getStreakMultiplier(streak);
  const baseXP = 3;
  const xpEarned = Math.round(baseXP * multiplier);

  // Add XP to quest progress
  const progress = await getQuestProgress(userId);
  progress.totalXP += xpEarned;
  await saveQuestProgress(userId, progress);

  // Try to advance quest
  await advanceQuest(userId);

  // Check achievements
  const stats = await loadUserStats(userId);
  const newAchievements = await checkAchievements(userId, stats);

  return { streak, xpEarned, multiplier, newAchievements };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Format checkin result
// ═══════════════════════════════════════════════════════════════════════════════

export function formatCheckinMessage(result: { streak: number; xpEarned: number; multiplier: number; newAchievements: string[] }, ru: boolean): string {
  const { streak, xpEarned, multiplier, newAchievements } = result;

  let msg = `${ce('check', '\u2705')} <b>${ru ? '\u0427\u0435\u043A-\u0438\u043D \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D!' : 'Check-in complete!'}</b>\n\n`;
  msg += `${ce('fire', '\u{1F525}')} ${ru ? '\u0421\u0442\u0440\u0438\u043A' : 'Streak'}: <b>${streak}</b> ${ru ? '\u0434\u043D\u0435\u0439' : 'days'}\n`;
  msg += `${ce('coin', '\u{1FA99}')} +${xpEarned} XP`;
  if (multiplier > 1) {
    msg += ` (x${multiplier} ${ce('sparkle', '\u2728')})`;
  }
  msg += '\n';

  // Streak tier info
  if (streak < 7) {
    msg += `\n${ru ? '\u0414\u043E x1.5 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044F' : 'Until x1.5 multiplier'}: ${7 - streak} ${ru ? '\u0434\u043D\u0435\u0439' : 'days'}`;
  } else if (streak < 14) {
    msg += `\n${ru ? '\u0414\u043E x2 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044F' : 'Until x2 multiplier'}: ${14 - streak} ${ru ? '\u0434\u043D\u0435\u0439' : 'days'}`;
  } else if (streak < 21) {
    msg += `\n${ru ? '\u0414\u043E x3 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044F' : 'Until x3 multiplier'}: ${21 - streak} ${ru ? '\u0434\u043D\u0435\u0439' : 'days'}`;
  } else {
    msg += `\n${ce('crown', '\u{1F451}')} ${ru ? '\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C x3!' : 'Maximum x3 multiplier!'}`;
  }

  // New achievements
  if (newAchievements.length > 0) {
    msg += '\n\n';
    for (const achId of newAchievements) {
      const ach = ACHIEVEMENTS.find(a => a.id === achId);
      if (ach) {
        msg += `${ce('trophy', '\u{1F3C6}')} ${ru ? '\u041D\u043E\u0432\u0430\u044F \u0430\u0447\u0438\u0432\u043A\u0430' : 'New achievement'}: ${ach.emoji} <b>${ru ? ach.titleRu : ach.title}</b>\n`;
      }
    }
  }

  return msg;
}
