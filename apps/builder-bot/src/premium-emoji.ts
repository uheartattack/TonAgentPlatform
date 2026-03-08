/**
 * Premium Emoji — кастомные анимированные эмодзи для TON Agent Platform
 *
 * Использование в сообщениях (HTML parse mode):
 *   pe('robot')  →  <tg-emoji emoji-id="6030400221232501136">🤖</tg-emoji>
 *
 * Использование в тексте кнопок:
 *   peb('rocket') → "🚀" (обычный эмодзи, т.к. кнопки не поддерживают HTML)
 *
 * Документация: https://core.telegram.org/bots/api#formatting-options
 */

// ── Карта ID премиум эмодзи ────────────────────────────────────────────────
export const PREMIUM_EMOJI_IDS: Record<string, { id: string; fallback: string }> = {
  // Специальный разделитель (премиум анимированный)
  divider:  { id: '5217516491540305835', fallback: '〰️' },
  robot:    { id: '6030400221232501136', fallback: '🤖' },
  plus:     { id: '5882207227997066107', fallback: '➕' },
  store:    { id: '5920332557466997677', fallback: '🏪' },
  plugin:   { id: '6019346268197759615', fallback: '🔌' },
  bolt:     { id: '5920515922505765329', fallback: '⚡️' },
  diamond:  { id: '5776023601941582822', fallback: '💎' },
  card:     { id: '6030602393933060595', fallback: '💳' },
  chart:    { id: '5936143551854285132', fallback: '📊' },
  question: { id: '6030848053177486888', fallback: '❓' },
  globe:    { id: '5776233299424843260', fallback: '🌐' },
  green:    { id: '5810051751654460532', fallback: '🟢' },
  trending: { id: '5938539885907415367', fallback: '📈' },
  money:    { id: '6030352469786105758', fallback: '💵' },
  sparkles: { id: '5890925363067886150', fallback: '✨' },
  finger:   { id: '6023566962624306038', fallback: '👇' },
  coin:     { id: '5778421276024509124', fallback: '💰' },
  wrench:   { id: '5962952497197748583', fallback: '🔧' },
  megaphone:{ id: '6039422865189638057', fallback: '📣' },
  clipboard:{ id: '6021435576513730578', fallback: '📋' },
  outbox:   { id: '6039573425268201570', fallback: '📤' },
  bell:     { id: '6039486778597970865', fallback: '🔔' },
  calendar: { id: '5890937706803894250', fallback: '📅' },
  frame:    { id: '6030466823290360017', fallback: '🖼' },
  tonCoin:  { id: '5904462880941545555', fallback: '🪙' },
  back:     { id: '5807792908094413296', fallback: '⬅️' },
  refresh:  { id: '5769248574499983619', fallback: '🔄' },
  cloud:    { id: '6021401951214770773', fallback: '☁️' },
  link:     { id: '6028171274939797252', fallback: '🔗' },
  theater:  { id: '6032625495328165724', fallback: '🎭' },
  inbox:    { id: '6021777395780950709', fallback: '📨' },
  square:   { id: '5884089033558070257', fallback: '⬜️' },
  check:    { id: '5774022692642492953', fallback: '✅' },
  wallet:   { id: '5769126056262898415', fallback: '👛' },
  rocket:   { id: '5258332798409783582', fallback: '🚀' },
  hourglass:{ id: '5363826996314912469', fallback: '⏳' },
  brain:    { id: '5864019342873598613', fallback: '🧠' },
  person:      { id: '6024039683904772353', fallback: '👤' },
  boltFast:    { id: '6023761060786346622', fallback: '⚡️' },
  star:        { id: '5886685105065300941', fallback: '⭐️' },
  diamondBlue: { id: '5981120393543423472', fallback: '💎' },
  group:       { id: '6021690418398239007', fallback: '👥' },
  mailbox:  { id: '6019263620142078168', fallback: '📬' },
  bubble:   { id: '6030863729808120196', fallback: '💬' },
  warning:  { id: '6019102674832595118', fallback: '⚠️' },
};

/**
 * Генерирует HTML-тег премиум эмодзи для использования в сообщениях (parse_mode: HTML)
 * @param name  ключ из PREMIUM_EMOJI_IDS
 */
export function pe(name: keyof typeof PREMIUM_EMOJI_IDS): string {
  const e = PREMIUM_EMOJI_IDS[name];
  if (!e) return '';
  return `<tg-emoji emoji-id="${e.id}">${e.fallback}</tg-emoji>`;
}

/**
 * Возвращает обычный (fallback) эмодзи для использования в тексте кнопок
 * (кнопки не поддерживают HTML-теги)
 */
export function peb(name: keyof typeof PREMIUM_EMOJI_IDS): string {
  return PREMIUM_EMOJI_IDS[name]?.fallback ?? '';
}

/**
 * Вспомогательная функция: экранирует HTML-спецсимволы для parse_mode: HTML
 */
export function escHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Генерирует строку-разделитель с премиум эмодзи (для HTML parse mode)
 * Использование: div() → <tg-emoji>〰️</tg-emoji> × count
 */
export function div(count = 5): string {
  return Array(count).fill(pe('divider')).join('');
}

/**
 * Генерирует строку-разделитель для MarkdownV2 (обычные символы)
 * Использование: divMd() → ━━━━━━━━━━━━━━━━━━━━
 */
export function divMd(): string {
  return '━━━━━━━━━━━━━━━━━━━━';
}
