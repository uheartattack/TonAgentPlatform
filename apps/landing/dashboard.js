// ===== LANGUAGE SYSTEM =====
let currentLang = localStorage.getItem('lang') || 'en';

// ===== SVG ICON CONSTANTS =====
const IC = {
  wrench: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  brain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/></svg>',
  bolt: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  robot: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  rocket: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  clipboard: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  warn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  hourglass: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>',
  dollar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  send: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  fire: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3.5-7.5-2 3.5-1 5.5 0 7.5 1 1 2 2.5 2 5a2.5 2.5 0 0 1-2.5 2.5"/><path d="M12 22c4 0 7-3 7-7 0-2-.5-3.5-1.5-5C16 8 12 6 12 2c-2 4-6 6-7.5 8.5C3.5 12.5 3 14 3 15c0 4 3 7 7 7z"/></svg>',
  gem: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="M12 22L6 9"/><path d="M12 22l6-13"/><path d="M9 3l3 6 3-6"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  creditcard: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  star: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  party: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3L2 22l10.7-3.8"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="M22 2l-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="M22 13l-1.34-.45a2.9 2.9 0 0 0-3.12 1.96v0a1.62 1.62 0 0 1-1.63 1.45h-.01a1.65 1.65 0 0 1-1.44-1.76L14.5 13"/></svg>',
  phone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  store: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  box: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  chat: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  globe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  mail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  bell: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  shuffle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
  gift: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  chart: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  trending: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  thumbsup: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
  arrowup: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  http: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  forward: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>',
  loop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  inbox: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  outbox: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  dot_green: '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e"></span>',
  dot_pause: '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b"></span>',
  shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  crown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7z"/><path d="M3 20h18"/></svg>',
  zap: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  infinity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/></svg>',
};

// Map server-side plan emoji icons to SVG
function planIcon(serverIcon) {
  if (!serverIcon) return '';
  var map = {
    '\uD83C\uDD93': IC.shield, '\uD83D\uDE80': IC.rocket, '\u26A1': IC.zap,
    '\uD83D\uDC51': IC.crown, '\u267E': IC.infinity,
    '\uD83D\uDD25': IC.fire, '\u2B50': IC.star,
    '\uD83D\uDC8E': IC.gem, '\u2728': IC.star,
  };
  return map[serverIcon] !== undefined ? map[serverIcon] : serverIcon;
}

// ===== TOAST NOTIFICATION SYSTEM =====
var _toastIcons = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

function toast(message, type, title, duration) {
  type = type || 'info';
  duration = duration || 5000;
  var container = document.getElementById('toast-container');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.style.setProperty('--toast-duration', duration + 'ms');
  el.innerHTML = '<div class="toast-icon">' + (_toastIcons[type] || _toastIcons.info) + '</div>'
    + '<div class="toast-content">'
    + (title ? '<div class="toast-title">' + escHtml(title) + '</div>' : '')
    + '<div class="toast-msg">' + escHtml(message) + '</div>'
    + '</div>'
    + '<button class="toast-close" onclick="dismissToast(this.parentElement)">&times;</button>'
    + '<div class="toast-progress"></div>';
  container.appendChild(el);
  var timer = setTimeout(function() { dismissToast(el); }, duration);
  el._timer = timer;
  el.addEventListener('mouseenter', function() { clearTimeout(el._timer); });
  el.addEventListener('mouseleave', function() {
    el._timer = setTimeout(function() { dismissToast(el); }, 2000);
  });
}

function dismissToast(el) {
  if (!el || el.classList.contains('removing')) return;
  el.classList.add('removing');
  setTimeout(function() { el.remove(); }, 250);
}

// ===== STUDIO DIALOG SYSTEM =====
// Replaces all browser confirm(), alert(), prompt() with custom modals
var _dialogResolve = null;

function studioConfirm(opts) {
  // opts: { title, message, confirmText, cancelText, type: 'danger'|'warning'|'info'|'success', icon? }
  return new Promise(function(resolve) {
    _dialogResolve = resolve;
    var type = opts.type || 'warning';
    var icon = opts.icon || _toastIcons[type] || _toastIcons.info;
    var confirmClass = type === 'danger' ? 'btn-danger' : 'btn-primary';
    var backdrop = document.getElementById('studio-dialog');
    backdrop.innerHTML = '<div class="studio-dialog">'
      + '<div class="studio-dialog-header">'
      + '<div class="studio-dialog-icon icon-' + escHtml(type) + '">' + icon + '</div>'
      + '<span class="studio-dialog-title">' + escHtml(opts.title || '') + '</span>'
      + '</div>'
      + '<div class="studio-dialog-body"><p>' + escHtml(opts.message || '') + '</p></div>'
      + '<div class="studio-dialog-footer">'
      + '<button class="btn btn-ghost" onclick="_resolveDialog(false)">' + escHtml(opts.cancelText || (currentLang === 'ru' ? 'Отмена' : 'Cancel')) + '</button>'
      + '<button class="btn ' + confirmClass + '" onclick="_resolveDialog(true)">' + escHtml(opts.confirmText || 'OK') + '</button>'
      + '</div></div>';
    backdrop.style.display = 'flex';
    backdrop.classList.remove('closing');
    backdrop.onclick = function(e) { if (e.target === backdrop) _resolveDialog(false); };
    // ESC key
    backdrop._esc = function(e) { if (e.key === 'Escape') _resolveDialog(false); };
    document.addEventListener('keydown', backdrop._esc);
    // Focus confirm button
    setTimeout(function() {
      var btn = backdrop.querySelector('.btn-primary, .btn-danger');
      if (btn) btn.focus();
    }, 50);
  });
}

function studioAlert(opts) {
  // opts: { title, message, type }
  return new Promise(function(resolve) {
    _dialogResolve = resolve;
    var type = opts.type || 'error';
    var icon = opts.icon || _toastIcons[type] || _toastIcons.info;
    var backdrop = document.getElementById('studio-dialog');
    backdrop.innerHTML = '<div class="studio-dialog">'
      + '<div class="studio-dialog-header">'
      + '<div class="studio-dialog-icon icon-' + escHtml(type) + '">' + icon + '</div>'
      + '<span class="studio-dialog-title">' + escHtml(opts.title || '') + '</span>'
      + '</div>'
      + '<div class="studio-dialog-body"><p>' + escHtml(opts.message || '') + '</p></div>'
      + '<div class="studio-dialog-footer">'
      + '<button class="btn btn-primary" onclick="_resolveDialog(true)">OK</button>'
      + '</div></div>';
    backdrop.style.display = 'flex';
    backdrop.classList.remove('closing');
    backdrop.onclick = function(e) { if (e.target === backdrop) _resolveDialog(true); };
    backdrop._esc = function(e) { if (e.key === 'Escape') _resolveDialog(true); };
    document.addEventListener('keydown', backdrop._esc);
    setTimeout(function() {
      var btn = backdrop.querySelector('.btn-primary');
      if (btn) btn.focus();
    }, 50);
  });
}

function _resolveDialog(val) {
  var backdrop = document.getElementById('studio-dialog');
  if (backdrop._esc) document.removeEventListener('keydown', backdrop._esc);
  backdrop.classList.add('closing');
  setTimeout(function() {
    backdrop.style.display = 'none';
    backdrop.classList.remove('closing');
  }, 180);
  if (_dialogResolve) { _dialogResolve(val); _dialogResolve = null; }
}

function switchLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);

  // Update buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // Update all elements with data-en and data-ru
  document.querySelectorAll('[data-en][data-ru]').forEach(el => {
    el.textContent = el.dataset[lang];
  });

  // Update placeholders
  document.querySelectorAll('[data-placeholder-' + lang + ']').forEach(el => {
    el.placeholder = el.dataset['placeholder' + lang.charAt(0).toUpperCase() + lang.slice(1)];
  });

  // Re-render dynamic content that uses t()
  try {
    if (authToken && currentUser) loadAgents();
    // Re-render auth screen if visible
    const authScreen = document.getElementById('auth-screen');
    if (authScreen && !authScreen.classList.contains('hidden')) {
      const h2 = authScreen.querySelector('.auth-box h2');
      if (h2) h2.textContent = t('welcome_back');
      const desc = authScreen.querySelector('.auth-desc');
      if (desc) desc.textContent = t('sign_in_desc');
      const loginBtn = document.getElementById('tg-login-btn');
      if (loginBtn) {
        const svg = loginBtn.querySelector('svg');
        if (svg) loginBtn.innerHTML = svg.outerHTML + t('sign_in_tg');
      }
    }
    // Update page title
    document.title = lang === 'ru' ? 'TON Agent Platform \u2014 \u041F\u0430\u043D\u0435\u043B\u044C \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F' : 'TON Agent Platform \u2014 Control Center';
    // Re-render flow palette with new language
    if (typeof buildFlowPalette === 'function') buildFlowPalette();
  } catch (_) {}
}

// Initialize language
switchLang(currentLang);

// ===== TRANSLATION DICTIONARY =====
const _tr = {
  // Agent status
  active: { en: 'Active', ru: 'Активен' },
  paused: { en: 'Paused', ru: 'На паузе' },
  run: { en: 'Run', ru: 'Запуск' },
  stop: { en: 'Stop', ru: 'Стоп' },
  logs: { en: 'Logs', ru: 'Логи' },
  unnamed: { en: 'Unnamed', ru: 'Без имени' },
  // Triggers
  trigger_scheduled: { en: 'Scheduled', ru: 'По расписанию' },
  trigger_webhook: { en: 'Webhook', ru: 'Вебхук' },
  trigger_manual: { en: 'Manual', ru: 'Ручной' },
  trigger_ai_agent: { en: 'AI Agent', ru: 'AI Агент' },
  // Empty states
  no_agents_yet: { en: 'No agents yet.', ru: 'Агентов пока нет.' },
  create_first: { en: 'Create your first agent \u2192', ru: 'Создать первого агента \u2192' },
  create_in_bot: { en: 'Create in Bot', ru: 'Создать в боте' },
  or_word: { en: 'or', ru: 'или' },
  failed_load: { en: 'Failed to load agents.', ru: 'Не удалось загрузить агентов.' },
  no_logs: { en: 'No logs yet.', ru: 'Логов пока нет.' },
  no_executions: { en: 'No executions yet.', ru: 'Выполнений пока нет.' },
  no_entries: { en: 'No entries yet. Click "Add Entry" to begin.', ru: 'Записей пока нет. Нажмите "Добавить" чтобы начать.' },
  no_variables: { en: 'No variables yet.', ru: 'Переменных пока нет.' },
  role: { en: 'Role', ru: 'Роль' },
  lv: { en: 'Lv.', ru: 'Ур.' },
  // Auth
  welcome_back: { en: 'Welcome Back', ru: 'Добро пожаловать' },
  sign_in_desc: { en: 'Sign in with Telegram to access your agents', ru: 'Войдите через Telegram для доступа к агентам' },
  sign_in_tg: { en: 'Sign in with Telegram', ru: 'Войти через Telegram' },
  sign_in_bot: { en: 'Sign in via bot', ru: 'Войти через бота' },
  auth_failed: { en: 'Auth failed', ru: 'Ошибка авторизации' },
  session_expired: { en: 'Session expired after server restart — please sign in again', ru: 'Сессия истекла после перезапуска сервера — войдите снова' },
  connecting: { en: 'Connecting to server...', ru: 'Подключаюсь к серверу...' },
  secure_auth: { en: 'Secure auth via Telegram', ru: 'Безопасная авторизация через Telegram' },
  // UI actions
  show: { en: 'Show', ru: 'Показать' },
  hide: { en: 'Hide', ru: 'Скрыть' },
  save: { en: 'Save', ru: 'Сохранить' },
  cancel: { en: 'Cancel', ru: 'Отмена' },
  delete: { en: 'Delete', ru: 'Удалить' },
  loading: { en: 'Loading...', ru: 'Загрузка...' },
  connected: { en: 'Connected', ru: 'Подключено' },
  disconnected: { en: 'Disconnected', ru: 'Не подключено' },
  // Notifications
  config_saved: { en: 'Configuration saved', ru: 'Конфигурация сохранена' },
  settings_saved: { en: 'Settings saved', ru: 'Настройки сохранены' },
  persona_saved: { en: 'Persona saved', ru: 'Персона сохранена' },
  var_saved: { en: 'Variable saved', ru: 'Переменная сохранена' },
  var_deleted: { en: 'Variable deleted', ru: 'Переменная удалена' },
  entry_added: { en: 'Entry added', ru: 'Запись добавлена' },
  entry_deleted: { en: 'Entry deleted', ru: 'Запись удалена' },
  connector_saved: { en: 'Connector saved', ru: 'Коннектор сохранён' },
  connector_deleted: { en: 'Connector removed', ru: 'Коннектор удалён' },
  login_first: { en: 'Log in first', ru: 'Сначала войдите' },
  install_failed: { en: 'Install failed', ru: 'Ошибка установки' },
  uninstall_failed: { en: 'Uninstall failed', ru: 'Ошибка удаления' },
  save_failed: { en: 'Save failed', ru: 'Ошибка сохранения' },
  test_ok: { en: 'Test succeeded!', ru: 'Тест успешен!' },
  save_connector_first: { en: 'Save the connector first', ru: 'Сначала сохраните коннектор' },
  fill_fields: { en: 'Fill title and content', ru: 'Заполните название и содержимое' },
  var_name_required: { en: 'Variable name required', ru: 'Укажите имя переменной' },
  // Wallet
  addr_copied: { en: 'Address copied', ru: 'Адрес скопирован' },
  comment_copied: { en: 'Comment copied', ru: 'Комментарий скопирован' },
  checking: { en: 'Checking...', ru: 'Проверяю...' },
  sending: { en: 'Sending...', ru: 'Отправка...' },
  withdraw: { en: 'Withdraw', ru: 'Вывести' },
  invalid_addr: { en: 'Enter a valid TON address (EQ.../UQ...)', ru: 'Введите корректный TON адрес (EQ.../UQ...)' },
  min_amount: { en: 'Minimum amount: 0.1 TON', ru: 'Минимальная сумма: 0.1 TON' },
  verify_sent: { en: 'I sent it \u2014 verify', ru: 'Я отправил \u2014 проверить' },
  // Extensions
  installed: { en: 'installed', ru: 'установлен' },
  uninstalled: { en: 'uninstalled', ru: 'удалён' },
  // Flow builder
  flow_builder: { en: 'Flow Builder', ru: 'Конструктор' },
  deploy: { en: 'Deploy', ru: 'Запуск' },
  agent_name: { en: 'Agent name...', ru: 'Имя агента...' },
  triggers: { en: 'Triggers', ru: 'Триггеры' },
  actions: { en: 'Actions', ru: 'Действия' },
  logic: { en: 'Logic', ru: 'Логика' },
  output: { en: 'Output', ru: 'Вывод' },
  state: { en: 'State', ru: 'Состояние' },
  config: { en: 'Settings', ru: 'Настройки' },
  no_node_selected: { en: 'Click a node to configure', ru: 'Кликните на ноду для настройки' },
  delete_node: { en: 'Delete Node', ru: 'Удалить ноду' },
  deploying: { en: 'Deploying...', ru: 'Запускаю...' },
  deployed_ok: { en: 'Agent deployed!', ru: 'Агент запущен!' },
  deploy_fail: { en: 'Deploy failed', ru: 'Ошибка запуска' },
};
function t(k) { const e = _tr[k]; return e ? (e[currentLang] || e.en || k) : k; }

// ===== ANIMATED COUNTER =====
// Плавно считает число от 0 до target за duration мс (WOW-эффект для метрик)
function animateCount(el, target, duration = 800, suffix = '') {
  if (!el) return;
  const start = performance.now();
  const from = parseInt(el.textContent) || 0;
  const to = typeof target === 'number' ? target : parseInt(target) || 0;
  if (from === to) { el.textContent = to + suffix; return; }
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutQuart
    const eased = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.round(from + (to - from) * eased) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ===== API CONFIG =====
// API server runs alongside the bot on port 3001
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : window.location.origin;  // on production same origin

// Cached platform config from /api/config
window._appConfig = null;

let authToken = localStorage.getItem('tg_token') || null;

async function apiRequest(method, path, body) {
  const opts = {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };
  if (authToken) opts.headers['X-Auth-Token'] = authToken;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API_BASE + path, opts);
    return await res.json();
  } catch (e) {
    console.error('API error:', e);
    return { ok: false, error: e.message };
  }
}

// ===== AUTH SYSTEM =====
let currentUser = null;

// Called by new Telegram Login SDK (OIDC popup)
async function onTelegramAuth(result) {
  if (result.error) {
    console.error('Telegram Login error:', result.error);
    return;
  }
  // result has id_token (JWT) and user { id, name, preferred_username, picture }
  const data = await apiRequest('POST', '/api/auth/telegram-oidc', { id_token: result.id_token });
  if (!data.ok) {
    toast(data.error || 'Unknown error', 'error', currentLang === 'ru' ? 'Ошибка авторизации' : 'Auth Failed');
    return;
  }
  authToken = data.token;
  localStorage.setItem('tg_token', authToken);
  currentUser = { userId: data.userId, username: data.username, first_name: data.firstName, photo_url: data.photoUrl || null };
  showApp();
}

// Legacy: old widget callback (keep for backwards compat)
async function onTelegramAuthLegacy(user) {
  const data = await apiRequest('POST', '/api/auth/telegram', user);
  if (!data.ok) { toast(data.error || 'Unknown error', 'error', 'Auth Failed'); return; }
  authToken = data.token;
  localStorage.setItem('tg_token', authToken);
  currentUser = { ...user, userId: data.userId };
  showApp();
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Update user info in sidebar
  if (currentUser) {
    const name = currentUser.first_name || currentUser.username || 'User';
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = name;

    if (currentUser.photo_url) {
      const img = document.getElementById('user-avatar');
      if (img) {
        img.src = currentUser.photo_url;
        img.classList.remove('hidden');
        const fallback = document.getElementById('user-avatar-fallback');
        if (fallback) fallback.classList.add('hidden');
      }
    }
  }

  // Set plan badge from auth data immediately
  if (currentUser && currentUser._plan) {
    updateSidebarPlanBadge(currentUser._plan);
  }

  // Personalized greeting on overview
  if (currentUser) {
    var name = currentUser.first_name || currentUser.username || '';
    var hour = new Date().getHours();
    var greeting;
    if (currentLang === 'ru') {
      greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    } else {
      greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    }
    var greetEl = document.getElementById('overview-greeting-text');
    if (greetEl && name) {
      greetEl.textContent = greeting + ', ' + name;
      greetEl.removeAttribute('data-en');
      greetEl.removeAttribute('data-ru');
    }
  }

  // Load real data from API
  loadDashboard();
  loadSubscriptionGlobal();

  // Load persisted slider/config values
  loadAgentConfig().catch(console.error);
  loadSecuritySettings().catch(console.error);
  loadTelegramSettings().catch(console.error);

  // Initialize static/async components
  initCapabilities();
  initExtensions();
  initActivityStream().catch(console.error);   // async — DB-backed
  initOperations().catch(console.error);        // async — DB-backed

  // Start live updates
  startLiveUpdates();

  checkOnboarding();
}

// Load real stats + agents + plugins
async function loadDashboard() {
  await Promise.all([loadMyStats(), loadAgents(), loadPluginsReal()]);
}

async function loadMyStats() {
  const data = await apiRequest('GET', '/api/stats/me');
  if (!data.ok) return;
  // Active agents
  animateCount(document.getElementById('sessions-value'), data.agentsActive || 0);
  // Total runs
  var runsEl = document.getElementById('runs-value');
  if (runsEl) runsEl.textContent = data.totalRuns ?? '—';
  // Success rate
  var srEl = document.getElementById('success-rate-value');
  if (srEl) srEl.textContent = data.successRate != null ? data.successRate + '%' : '—';
  // Last 24h runs
  var l24El = document.getElementById('last24h-value');
  if (l24El) l24El.textContent = data.last24hRuns ?? '—';
  // Uptime
  if (data.uptimeSeconds) {
    var h = Math.floor(data.uptimeSeconds / 3600);
    var m = Math.floor((data.uptimeSeconds % 3600) / 60);
    var upEl = document.getElementById('uptime-value');
    if (upEl) upEl.textContent = h + 'h ' + m + 'm';
  }
  // Capabilities count (tools + plugins)
  var capCount = (data.pluginsTotal || 12) + (data.pluginsInstalled || 0) + 65;
  var toolsEl = document.getElementById('tools-value');
  if (toolsEl) toolsEl.textContent = capCount;
  var capBadge = document.getElementById('nav-capabilities-badge');
  if (capBadge) capBadge.textContent = capCount;
  // Model name from user settings
  var modelEl = document.querySelector('.model-name');
  if (modelEl && data.aiModel) modelEl.textContent = data.aiModel;
}

// ===== PINNED AGENTS =====
function getPinnedAgents() {
  try { return JSON.parse(localStorage.getItem('pinned_agents') || '[]'); } catch { return []; }
}
function setPinnedAgents(ids) {
  localStorage.setItem('pinned_agents', JSON.stringify(ids));
}
function togglePinAgent(agentId, event) {
  if (event) event.stopPropagation();
  var pinned = getPinnedAgents();
  var idx = pinned.indexOf(agentId);
  if (idx >= 0) pinned.splice(idx, 1);
  else pinned.push(agentId);
  setPinnedAgents(pinned);
  showNotification(idx >= 0
    ? (currentLang === 'ru' ? 'Агент откреплён' : 'Agent unpinned')
    : (currentLang === 'ru' ? 'Агент закреплён на обзоре' : 'Agent pinned to overview'), 'success');
  // Re-render if on agents or overview page
  if (typeof renderAgentsPage === 'function') renderAgentsPage();
  loadAgents();
}

async function loadAgents() {
  const agentsEl = document.getElementById('agents-list');
  if (!agentsEl) return;

  const data = await apiRequest('GET', '/api/agents');
  if (!data.ok) {
    agentsEl.innerHTML = '<div class="empty-state">' + t('failed_load') + '</div>';
    return;
  }
  const agents = data.agents || [];
  // Overview shows ONLY pinned agents
  var pinned = getPinnedAgents();
  var pinnedAgents = agents.filter(function(a) { return pinned.indexOf(a.id) >= 0; });
  if (!pinnedAgents.length) {
    agentsEl.innerHTML = '<div class="empty-state" style="padding:1.5rem;text-align:center"><p style="color:var(--text-muted);font-size:0.85rem;">' +
      (currentLang === 'ru' ? 'Закрепите агентов в «Мои агенты» чтобы они появились здесь' : 'Pin agents in "My Agents" to show them here') +
      '</p><button class="btn btn-secondary btn-sm" onclick="navigateTo(\'agents\')" style="margin-top:8px">' +
      (currentLang === 'ru' ? 'Перейти к агентам' : 'Go to agents') + '</button></div>';
    if (agents.length > 0) markGSStep('agent');
    updateNavBadges(agents);
    return;
  }

  const triggerLabel = (tt) => tt === 'scheduled' ? t('trigger_scheduled') : tt === 'webhook' ? t('trigger_webhook') : tt === 'ai_agent' ? t('trigger_ai_agent') : t('trigger_manual');
  agentsEl.innerHTML = pinnedAgents.map(a => {
    const role = a.role || 'worker';
    const lvl = a.level || 1;
    return `
    <div class="agent-card" data-id="${a.id}" onclick="openAgentDetail(${a.id})" style="cursor:pointer">
      <div class="agent-status ${a.isActive ? 'active' : 'paused'}">
        <span class="status-dot"></span>
        <span>${a.isActive ? t('active') : t('paused')}</span>
      </div>
      <div class="agent-info">
        <strong>#${a.id} ${escHtml(a.name || t('unnamed'))}</strong>
        <span class="agent-desc">${escHtml((a.description || '').slice(0, 80))}</span>
        <span class="agent-meta">
          <span class="agent-trigger">${triggerLabel(a.triggerType)}</span>
          <span class="agent-role-badge role-${role}">${role}</span>
          <span class="agent-level">${t('lv')}${lvl}</span>
        </span>
      </div>
      <div class="agent-actions">
        <button class="btn btn-sm ${a.isActive ? 'btn-warning' : 'btn-success'}" onclick="event.stopPropagation();toggleAgent(${a.id}, ${a.isActive})">
          ${a.isActive ? IC.pause + ' ' + t('stop') : IC.rocket + ' ' + t('run')}
        </button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();loadAgentLogs(${a.id})">${IC.clipboard} ${t('logs')}</button>
        <button class="btn btn-ghost btn-sm" title="${currentLang === 'ru' ? 'Открепить' : 'Unpin'}" onclick="togglePinAgent(${a.id}, event)" style="color:var(--primary)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  if (agents.length > 0) markGSStep('agent');
  updateNavBadges(agents);
}

// ===== REAL NOTIFICATION BADGES =====
function updateNavBadges(agents) {
  if (!agents) return;
  var activeCount = agents.filter(function(a) { return a.isActive; }).length;
  var totalCount = agents.length;
  // Update My Agents badge - show active count
  var agentsBadge = document.getElementById('nav-agents-badge');
  if (agentsBadge) {
    if (activeCount > 0) {
      agentsBadge.textContent = activeCount;
      agentsBadge.style.display = '';
      agentsBadge.className = 'nav-badge alert';
    } else if (totalCount > 0) {
      agentsBadge.textContent = totalCount;
      agentsBadge.style.display = '';
      agentsBadge.className = 'nav-badge';
    } else {
      agentsBadge.style.display = 'none';
    }
  }
}

async function toggleAgent(agentId, isActive) {
  const endpoint = isActive ? `/api/agents/${agentId}/stop` : `/api/agents/${agentId}/run`;
  const btn = document.querySelector(`[data-id="${agentId}"] .btn-success, [data-id="${agentId}"] .btn-warning`);
  if (btn) { btn.disabled = true; btn.innerHTML = IC.hourglass; }
  const data = await apiRequest('POST', endpoint);
  if (!data.ok) {
    toast(data.error || 'Unknown error', 'error');
  }
  // Reload agent list
  await loadAgents();
}

// ===== AGENT DETAIL PANEL =====
var _detailAgentId = null;
var _detailAgentData = null;

async function openAgentDetail(agentId) {
  _detailAgentId = agentId;
  var panel = document.getElementById('agent-detail-panel');
  if (!panel) return;
  panel.style.display = 'flex';
  panel.classList.remove('closing');
  // Load agent data
  var body = document.getElementById('agent-detail-body');
  if (body) body.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">' + IC.hourglass + ' Loading...</div>';
  try {
    var data = await apiRequest('GET', '/api/agents/' + agentId);
    if (!data.ok || !data.agent) { toast('Agent not found', 'error'); closeAgentDetail(); return; }
    _detailAgentData = data.agent;
    renderAgentDetail();
  } catch(e) {
    toast(e.message || 'Error', 'error');
    closeAgentDetail();
  }
}

function renderAgentDetail() {
  var a = _detailAgentData;
  if (!a) return;
  // Header
  var nameEl = document.getElementById('agent-detail-name');
  var descEl = document.getElementById('agent-detail-desc');
  var statusEl = document.getElementById('agent-detail-status');
  var toggleBtn = document.getElementById('agent-detail-toggle-btn');
  if (nameEl) { nameEl.textContent = '#' + a.id + ' ' + (a.name || 'Unnamed'); nameEl.contentEditable = 'false'; nameEl.classList.remove('editing'); }
  if (descEl) descEl.textContent = a.description || 'No description';
  if (statusEl) {
    statusEl.className = 'agent-status ' + (a.is_active ? 'active' : 'paused');
    statusEl.innerHTML = '<span class="status-dot"></span><span>' + (a.is_active ? 'Active' : 'Paused') + '</span>';
  }
  if (toggleBtn) {
    toggleBtn.className = 'btn btn-sm ' + (a.is_active ? 'btn-warning' : 'btn-success');
    toggleBtn.innerHTML = a.is_active ? IC.pause + ' Stop' : IC.rocket + ' Run';
  }

  // Body
  var body = document.getElementById('agent-detail-body');
  if (!body) return;
  var triggerType = a.trigger_type || a.triggerType || 'manual';
  var triggerLabel = triggerType === 'scheduled' ? 'Scheduled' : triggerType === 'webhook' ? 'Webhook' : triggerType === 'ai_agent' ? 'AI Agent' : 'Manual';
  var config = {};
  try { config = typeof a.trigger_config === 'string' ? JSON.parse(a.trigger_config) : (a.trigger_config || {}); } catch(e) {}

  var aiProvider = (config.config && config.config.AI_PROVIDER) || 'default';
  var aiModel = (config.config && config.config.AI_MODEL) || '—';
  var role = a.role || 'worker';
  var lvl = a.level || 1;
  var xp = a.xp || 0;

  var html = '';
  // Info section
  html += '<div class="agent-detail-section">';
  html += '<div class="agent-detail-section-title">Agent Info</div>';
  html += '<div class="agent-detail-row"><span class="label">Type</span><span class="value">' + triggerLabel + '</span></div>';
  html += '<div class="agent-detail-row"><span class="label">Role</span><span class="value" style="text-transform:capitalize">' + role + '</span></div>';
  html += '<div class="agent-detail-row"><span class="label">Level</span><span class="value">Lv.' + lvl + ' (' + xp + ' XP)</span></div>';
  html += '<div class="agent-detail-row"><span class="label">Created</span><span class="value">' + (a.created_at ? new Date(a.created_at).toLocaleDateString() : '—') + '</span></div>';
  if (triggerType === 'scheduled' && config.interval) {
    html += '<div class="agent-detail-row"><span class="label">Interval</span><span class="value">' + config.interval + '</span></div>';
  }
  if (triggerType === 'scheduled' && config.cronExpression) {
    html += '<div class="agent-detail-row"><span class="label">Cron</span><span class="value" style="font-family:JetBrains Mono,monospace;font-size:0.75rem">' + escHtml(config.cronExpression) + '</span></div>';
  }
  html += '</div>';

  // AI Config section
  if (triggerType === 'ai_agent') {
    html += '<div class="agent-detail-section">';
    html += '<div class="agent-detail-section-title">AI Configuration</div>';
    html += '<div class="agent-detail-row"><span class="label">Provider</span><span class="value">' + escHtml(aiProvider) + '</span></div>';
    if (aiModel !== '—') html += '<div class="agent-detail-row"><span class="label">Model</span><span class="value">' + escHtml(aiModel) + '</span></div>';
    html += '</div>';
  }

  // System Prompt section
  var code = a.code || '';
  if (code) {
    html += '<div class="agent-detail-section">';
    html += '<div class="agent-detail-section-title">System Prompt</div>';
    html += '<div class="agent-detail-prompt">' + escHtml(code.slice(0, 2000)) + (code.length > 2000 ? '\n...' : '') + '</div>';
    html += '</div>';
  }

  // Flow section
  if (triggerType !== 'ai_agent' && config.nodes && config.nodes.length) {
    html += '<div class="agent-detail-section">';
    html += '<div class="agent-detail-section-title">Flow (' + config.nodes.length + ' nodes)</div>';
    var flowDesc = config.nodes.map(function(n) { return n.type; }).join(' → ');
    html += '<div style="font-size:0.78rem;color:var(--text-secondary);word-break:break-all">' + escHtml(flowDesc) + '</div>';
    html += '</div>';
  }

  body.innerHTML = html;
}

function closeAgentDetail() {
  var panel = document.getElementById('agent-detail-panel');
  if (!panel) return;
  panel.classList.add('closing');
  setTimeout(function() { panel.style.display = 'none'; panel.classList.remove('closing'); }, 200);
}

function toggleAgentRename() {
  var nameEl = document.getElementById('agent-detail-name');
  if (!nameEl) return;
  if (nameEl.contentEditable === 'true') {
    // Save
    saveAgentRename();
  } else {
    // Enter edit mode
    nameEl.contentEditable = 'true';
    nameEl.classList.add('editing');
    // Remove #ID prefix for editing
    var a = _detailAgentData;
    nameEl.textContent = a ? (a.name || '') : nameEl.textContent;
    nameEl.focus();
    // Select all text
    var range = document.createRange();
    range.selectNodeContents(nameEl);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    // Enter key to save
    nameEl.onkeydown = function(e) {
      if (e.key === 'Enter') { e.preventDefault(); saveAgentRename(); }
      if (e.key === 'Escape') { renderAgentDetail(); }
    };
  }
}

async function saveAgentRename() {
  var nameEl = document.getElementById('agent-detail-name');
  if (!nameEl || !_detailAgentId) return;
  var newName = nameEl.textContent.trim();
  if (newName.length < 2 || newName.length > 60) {
    toast(currentLang === 'ru' ? 'Имя должно быть 2-60 символов' : 'Name must be 2-60 characters', 'error');
    return;
  }
  nameEl.contentEditable = 'false';
  nameEl.classList.remove('editing');
  try {
    var data = await apiRequest('POST', '/api/agents/' + _detailAgentId + '/rename', { name: newName });
    if (data.ok) {
      toast(currentLang === 'ru' ? 'Агент переименован' : 'Agent renamed', 'success');
      if (_detailAgentData) _detailAgentData.name = newName;
      renderAgentDetail();
      loadAgents();
      loadAgentsPage();
    } else {
      toast(data.error || 'Error', 'error');
    }
  } catch(e) {
    toast(e.message || 'Error', 'error');
  }
}

async function toggleAgentFromDetail() {
  if (!_detailAgentData) return;
  var isActive = _detailAgentData.is_active;
  var endpoint = isActive ? '/api/agents/' + _detailAgentId + '/stop' : '/api/agents/' + _detailAgentId + '/run';
  var btn = document.getElementById('agent-detail-toggle-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = IC.hourglass; }
  var data = await apiRequest('POST', endpoint);
  if (!data.ok) toast(data.error || 'Error', 'error');
  // Reload detail
  await openAgentDetail(_detailAgentId);
  loadAgents();
  loadAgentsPage();
}

function deleteAgentFromDetail() {
  if (!_detailAgentData) return;
  closeAgentDetail();
  deleteAgent(_detailAgentId, _detailAgentData.name || 'Agent');
}

// ===== AGENT CHAT =====
var _agentChatId = null;
var _agentChatHistory = [];

function openAgentChat(agentId) {
  _agentChatId = agentId;
  _agentChatHistory = [];
  var body = document.getElementById('agent-detail-body');
  if (!body) return;
  body.innerHTML =
    '<div class="agent-detail-section">' +
    '<div class="agent-detail-section-title">Chat with Agent #' + agentId + '</div>' +
    '<div id="agent-chat-messages" style="max-height:300px;overflow-y:auto;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:10px;min-height:100px">' +
    '<div style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:20px">' + (currentLang === 'ru' ? 'Отправьте сообщение агенту...' : 'Send a message to the agent...') + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
    '<input type="text" id="agent-chat-input" placeholder="' + (currentLang === 'ru' ? 'Сообщение агенту...' : 'Message to agent...') + '" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text-primary);font-size:.85rem" onkeydown="if(event.key===\'Enter\')sendAgentChatMsg()">' +
    '<button class="btn btn-primary btn-sm" onclick="sendAgentChatMsg()">' + (currentLang === 'ru' ? 'Отправить' : 'Send') + '</button>' +
    '</div>' +
    '<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="openAgentDetail(_detailAgentId)">' + (currentLang === 'ru' ? 'Назад' : 'Back') + '</button>' +
    '</div>';
  document.getElementById('agent-chat-input').focus();
}

async function sendAgentChatMsg() {
  var input = document.getElementById('agent-chat-input');
  var msgBox = document.getElementById('agent-chat-messages');
  if (!input || !msgBox || !_agentChatId) return;
  var msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  // Add user message
  _agentChatHistory.push({ role: 'user', text: msg });
  renderAgentChat(msgBox);
  // Send to API
  try {
    var data = await apiRequest('POST', '/api/agents/' + _agentChatId + '/chat', { message: msg });
    if (data.ok) {
      _agentChatHistory.push({ role: 'agent', text: data.response || data.message || (currentLang === 'ru' ? 'Сообщение отправлено агенту' : 'Message sent to agent') });
    } else {
      _agentChatHistory.push({ role: 'error', text: data.error || 'Error' });
    }
  } catch(e) {
    _agentChatHistory.push({ role: 'error', text: e.message || 'Network error' });
  }
  renderAgentChat(msgBox);
  msgBox.scrollTop = msgBox.scrollHeight;
}

function renderAgentChat(box) {
  box.innerHTML = _agentChatHistory.map(function(m) {
    var isUser = m.role === 'user';
    var isError = m.role === 'error';
    var bg = isUser ? 'rgba(33,150,243,0.15)' : isError ? 'rgba(239,68,68,0.15)' : 'rgba(0,255,136,0.1)';
    var align = isUser ? 'flex-end' : 'flex-start';
    return '<div style="display:flex;justify-content:' + align + ';margin:4px 0">' +
      '<div style="max-width:80%;padding:8px 12px;border-radius:8px;background:' + bg + ';font-size:.83rem;word-break:break-word">' +
      '<strong style="font-size:.7rem;color:var(--text-muted)">' + (isUser ? 'You' : isError ? 'Error' : 'Agent') + '</strong><br>' +
      escHtml(m.text) + '</div></div>';
  }).join('');
}

// ===== EDIT PROMPT =====
function showEditPrompt() {
  if (!_detailAgentData) return;
  var body = document.getElementById('agent-detail-body');
  if (!body) return;
  var code = _detailAgentData.code || '';
  body.innerHTML =
    '<div class="agent-detail-section">' +
    '<div class="agent-detail-section-title">' + (currentLang === 'ru' ? 'Системный промпт / Код' : 'System Prompt / Code') + '</div>' +
    '<textarea id="edit-prompt-textarea" style="width:100%;min-height:250px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:12px;color:var(--text-primary);font-family:JetBrains Mono,monospace;font-size:.8rem;resize:vertical">' + escHtml(code) + '</textarea>' +
    '<div style="display:flex;gap:8px;margin-top:10px">' +
    '<button class="btn btn-primary btn-sm" onclick="saveEditPrompt()">' + (currentLang === 'ru' ? 'Сохранить' : 'Save') + '</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="openAgentDetail(_detailAgentId)">' + (currentLang === 'ru' ? 'Отмена' : 'Cancel') + '</button>' +
    '</div></div>';
}

async function saveEditPrompt() {
  var ta = document.getElementById('edit-prompt-textarea');
  if (!ta || !_detailAgentId) return;
  var code = ta.value;
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/code', { code: code });
  if (data.ok) {
    toast(currentLang === 'ru' ? 'Промпт сохранён' : 'Prompt saved', 'success');
    if (_detailAgentData) _detailAgentData.code = code;
    renderAgentDetail();
  } else {
    toast(data.error || 'Error', 'error');
  }
}

// ===== EDIT DESCRIPTION =====
function showEditDescription() {
  if (!_detailAgentData) return;
  var body = document.getElementById('agent-detail-body');
  if (!body) return;
  body.innerHTML =
    '<div class="agent-detail-section">' +
    '<div class="agent-detail-section-title">' + (currentLang === 'ru' ? 'Описание агента' : 'Agent Description') + '</div>' +
    '<textarea id="edit-desc-textarea" style="width:100%;min-height:80px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:12px;color:var(--text-primary);font-size:.85rem;resize:vertical">' + escHtml(_detailAgentData.description || '') + '</textarea>' +
    '<div style="display:flex;gap:8px;margin-top:10px">' +
    '<button class="btn btn-primary btn-sm" onclick="saveEditDescription()">' + (currentLang === 'ru' ? 'Сохранить' : 'Save') + '</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="openAgentDetail(_detailAgentId)">' + (currentLang === 'ru' ? 'Отмена' : 'Cancel') + '</button>' +
    '</div></div>';
}

async function saveEditDescription() {
  var ta = document.getElementById('edit-desc-textarea');
  if (!ta || !_detailAgentId) return;
  var desc = ta.value.trim();
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/description', { description: desc });
  if (data.ok) {
    toast(currentLang === 'ru' ? 'Описание обновлено' : 'Description updated', 'success');
    if (_detailAgentData) _detailAgentData.description = desc;
    renderAgentDetail();
    loadAgents();
  } else {
    toast(data.error || 'Error', 'error');
  }
}

// ===== AI SETTINGS =====
function showAISettings() {
  if (!_detailAgentData) return;
  var body = document.getElementById('agent-detail-body');
  if (!body) return;
  var config = {};
  try { config = typeof _detailAgentData.trigger_config === 'string' ? JSON.parse(_detailAgentData.trigger_config) : (_detailAgentData.trigger_config || {}); } catch(e) {}
  var aiProvider = (config.config && config.config.AI_PROVIDER) || '';
  var aiModel = (config.config && config.config.AI_MODEL) || '';
  var hasKey = !!(config.config && config.config.AI_API_KEY);

  var providers = ['openai', 'anthropic', 'gemini', 'groq', 'deepseek', 'openrouter', 'together'];
  var provOpts = providers.map(function(p) {
    return '<option value="' + p + '"' + (p === aiProvider ? ' selected' : '') + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</option>';
  }).join('');

  body.innerHTML =
    '<div class="agent-detail-section">' +
    '<div class="agent-detail-section-title">' + (currentLang === 'ru' ? 'Настройки AI' : 'AI Settings') + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:12px">' +
    '<div><label style="font-size:.78rem;color:var(--text-muted);display:block;margin-bottom:4px">' + (currentLang === 'ru' ? 'Провайдер' : 'Provider') + '</label>' +
    '<select id="ai-provider-select" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text-primary);font-size:.85rem">' +
    '<option value="">' + (currentLang === 'ru' ? 'По умолчанию' : 'Default') + '</option>' + provOpts + '</select></div>' +
    '<div><label style="font-size:.78rem;color:var(--text-muted);display:block;margin-bottom:4px">' + (currentLang === 'ru' ? 'Модель (необязательно)' : 'Model (optional)') + '</label>' +
    '<input type="text" id="ai-model-input" value="' + escHtml(aiModel) + '" placeholder="auto" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text-primary);font-size:.85rem"></div>' +
    '<div><label style="font-size:.78rem;color:var(--text-muted);display:block;margin-bottom:4px">API Key</label>' +
    '<input type="password" id="ai-key-input" placeholder="' + (hasKey ? '••••••••' : (currentLang === 'ru' ? 'Введите API ключ' : 'Enter API key')) + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text-primary);font-size:.85rem">' +
    (hasKey ? '<small style="color:var(--text-muted);">' + (currentLang === 'ru' ? 'Ключ уже установлен. Оставьте пустым чтобы не менять.' : 'Key is set. Leave empty to keep.') + '</small>' : '') + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:12px">' +
    '<button class="btn btn-primary btn-sm" onclick="saveAISettings()">' + (currentLang === 'ru' ? 'Сохранить' : 'Save') + '</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="openAgentDetail(_detailAgentId)">' + (currentLang === 'ru' ? 'Назад' : 'Back') + '</button>' +
    '</div></div>';
}

async function saveAISettings() {
  if (!_detailAgentId) return;
  var provider = document.getElementById('ai-provider-select').value;
  var model = document.getElementById('ai-model-input').value.trim();
  var apiKey = document.getElementById('ai-key-input').value.trim();
  var body = { provider: provider || undefined, model: model || undefined };
  if (apiKey) body.apiKey = apiKey;
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/provider', body);
  if (data.ok) {
    toast(currentLang === 'ru' ? 'Настройки AI обновлены' : 'AI settings updated', 'success');
    openAgentDetail(_detailAgentId);
  } else {
    toast(data.error || 'Error', 'error');
  }
}

// ===== CAPABILITIES EDITOR =====
function showCapabilitiesEditor() {
  if (!_detailAgentData) return;
  var body = document.getElementById('agent-detail-body');
  if (!body) return;
  var config = {};
  try { config = typeof _detailAgentData.trigger_config === 'string' ? JSON.parse(_detailAgentData.trigger_config) : (_detailAgentData.trigger_config || {}); } catch(e) {}
  var enabled = (config.config && config.config.enabledCapabilities) || [];

  var allCaps = [
    { id: 'wallet', name: 'Wallet', icon: '💰', desc: 'TON balance, send/receive' },
    { id: 'nft', name: 'NFT', icon: '🖼', desc: 'NFT collections, floor prices' },
    { id: 'gifts', name: 'Gifts', icon: '🎁', desc: 'Telegram gifts catalog' },
    { id: 'gifts_market', name: 'Gifts Market', icon: '📊', desc: 'Gift trading, arbitrage' },
    { id: 'telegram', name: 'Telegram', icon: '📱', desc: 'Messages, channels, groups' },
    { id: 'web', name: 'Web', icon: '🌐', desc: 'Search, fetch URLs' },
    { id: 'state', name: 'State', icon: '💾', desc: 'Persistent memory' },
    { id: 'notify', name: 'Notifications', icon: '🔔', desc: 'User alerts' },
    { id: 'plugins', name: 'Plugins', icon: '🔌', desc: 'Custom plugins' },
    { id: 'inter_agent', name: 'Inter-Agent', icon: '🤝', desc: 'Agent cooperation' },
    { id: 'blockchain', name: 'Blockchain', icon: '⛓', desc: 'TON raw operations' },
    { id: 'defi', name: 'DeFi', icon: '💱', desc: 'DEX prices, swaps' },
    { id: 'ton_mcp', name: 'TON MCP', icon: '🔗', desc: 'Model Context Protocol' },
  ];

  body.innerHTML =
    '<div class="agent-detail-section">' +
    '<div class="agent-detail-section-title">' + (currentLang === 'ru' ? 'Возможности агента' : 'Agent Capabilities') + '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
    allCaps.map(function(c) {
      var checked = enabled.includes(c.id) ? ' checked' : '';
      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.03);cursor:pointer;font-size:.8rem">' +
        '<input type="checkbox" class="cap-check" value="' + c.id + '"' + checked + ' style="accent-color:var(--primary)">' +
        '<span>' + c.icon + ' ' + c.name + '</span></label>';
    }).join('') +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:12px">' +
    '<button class="btn btn-primary btn-sm" onclick="saveCapabilities()">' + (currentLang === 'ru' ? 'Сохранить' : 'Save') + '</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="openAgentDetail(_detailAgentId)">' + (currentLang === 'ru' ? 'Назад' : 'Back') + '</button>' +
    '</div></div>';
}

async function saveCapabilities() {
  if (!_detailAgentId) return;
  var checks = document.querySelectorAll('.cap-check:checked');
  var caps = Array.from(checks).map(function(c) { return c.value; });
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/capabilities', { capabilities: caps });
  if (data.ok) {
    toast(currentLang === 'ru' ? 'Возможности обновлены' : 'Capabilities updated', 'success');
    openAgentDetail(_detailAgentId);
  } else {
    toast(data.error || 'Error', 'error');
  }
}

// ===== AGENT AUDIT =====
async function runAgentAudit() {
  if (!_detailAgentId) return;
  var body = document.getElementById('agent-detail-body');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">' + IC.hourglass + ' ' + (currentLang === 'ru' ? 'Аудит...' : 'Auditing...') + '</div>';
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/audit');
    if (!data.ok) { toast(data.error || 'Error', 'error'); renderAgentDetail(); return; }
    var html = '<div class="agent-detail-section">';
    html += '<div class="agent-detail-section-title">' + (currentLang === 'ru' ? 'Результат аудита' : 'Audit Result') + ' — ' + data.score + '%</div>';
    html += '<div style="background:linear-gradient(90deg,rgba(0,255,136,0.2) ' + data.score + '%,rgba(255,255,255,0.05) ' + data.score + '%);border-radius:4px;height:8px;margin-bottom:12px"></div>';
    if (data.passed && data.passed.length) {
      html += '<div style="margin-bottom:8px">';
      data.passed.forEach(function(p) { html += '<div style="font-size:.8rem;color:#4ade80;padding:2px 0">✓ ' + escHtml(p) + '</div>'; });
      html += '</div>';
    }
    if (data.issues && data.issues.length) {
      data.issues.forEach(function(i) { html += '<div style="font-size:.8rem;color:#f59e0b;padding:2px 0">⚠ ' + escHtml(i) + '</div>'; });
    }
    html += '<button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="openAgentDetail(_detailAgentId)">' + (currentLang === 'ru' ? 'Назад' : 'Back') + '</button>';
    html += '</div>';
    body.innerHTML = html;
  } catch(e) {
    toast(e.message || 'Error', 'error');
    renderAgentDetail();
  }
}

// ===== CREATE AGENT WALLET =====
async function createAgentWallet() {
  if (!_detailAgentId) return;
  var confirmed = await studioConfirm({
    title: currentLang === 'ru' ? 'Создать кошелёк' : 'Create Wallet',
    message: currentLang === 'ru' ? 'Создать TON кошелёк для агента #' + _detailAgentId + '?' : 'Create TON wallet for agent #' + _detailAgentId + '?',
    confirmText: currentLang === 'ru' ? 'Создать' : 'Create',
    type: 'info'
  });
  if (!confirmed) return;
  try {
    var data = await apiRequest('POST', '/api/agents/' + _detailAgentId + '/wallet');
    if (data.ok) {
      if (data.exists) {
        toast(currentLang === 'ru' ? 'Кошелёк уже создан: ' + data.address : 'Wallet already exists: ' + data.address, 'info');
      } else {
        toast(currentLang === 'ru' ? 'Кошелёк создан: ' + data.address : 'Wallet created: ' + data.address, 'success');
      }
      openAgentDetail(_detailAgentId);
    } else {
      toast(data.error || 'Error', 'error');
    }
  } catch(e) {
    toast(e.message || 'Error', 'error');
  }
}

// ===== ROLE SELECTOR =====
function showRoleSelector() {
  if (!_detailAgentData) return;
  var body = document.getElementById('agent-detail-body');
  if (!body) return;
  var currentRole = _detailAgentData.role || 'worker';
  var roles = [
    { id: 'worker', name: 'Worker', icon: '⚙️', desc: currentLang === 'ru' ? 'Выполняет задачи автономно' : 'Executes tasks autonomously' },
    { id: 'manager', name: 'Manager', icon: '👔', desc: currentLang === 'ru' ? 'Координирует других агентов' : 'Coordinates other agents' },
    { id: 'specialist', name: 'Specialist', icon: '🎯', desc: currentLang === 'ru' ? 'Эксперт в конкретной области' : 'Expert in a specific domain' },
    { id: 'monitor', name: 'Monitor', icon: '📡', desc: currentLang === 'ru' ? 'Отслеживает данные и алерты' : 'Tracks data and alerts' },
  ];
  body.innerHTML =
    '<div class="agent-detail-section">' +
    '<div class="agent-detail-section-title">' + (currentLang === 'ru' ? 'Роль агента' : 'Agent Role') + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:6px">' +
    roles.map(function(r) {
      var sel = r.id === currentRole;
      return '<div onclick="setAgentRole(\'' + r.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;background:' + (sel ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)') + ';border:1px solid ' + (sel ? 'var(--primary)' : 'transparent') + '">' +
        '<span style="font-size:1.3rem">' + r.icon + '</span>' +
        '<div><strong style="font-size:.85rem">' + r.name + '</strong><br><small style="color:var(--text-muted);font-size:.75rem">' + r.desc + '</small></div>' +
        (sel ? '<span style="margin-left:auto;color:var(--primary)">✓</span>' : '') + '</div>';
    }).join('') +
    '</div>' +
    '<button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="openAgentDetail(_detailAgentId)">' + (currentLang === 'ru' ? 'Назад' : 'Back') + '</button>' +
    '</div>';
}

async function setAgentRole(role) {
  if (!_detailAgentId) return;
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/role', { role: role });
  if (data.ok) {
    toast(currentLang === 'ru' ? 'Роль обновлена: ' + role : 'Role updated: ' + role, 'success');
    if (_detailAgentData) _detailAgentData.role = role;
    openAgentDetail(_detailAgentId);
  } else {
    toast(data.error || 'Error', 'error');
  }
}

let _deleteAgentId = null;
let _deleteAgentName = '';

function deleteAgent(agentId, name) {
  _deleteAgentId = agentId;
  _deleteAgentName = name;
  const modal = document.getElementById('delete-agent-modal');
  const nameEl = document.getElementById('delete-agent-name');
  if (nameEl) nameEl.textContent = '#' + agentId + ' ' + name;
  if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-agent-modal');
  if (modal) modal.style.display = 'none';
  _deleteAgentId = null;
}

async function confirmDeleteAgent() {
  if (!_deleteAgentId) return;
  const btn = document.getElementById('delete-confirm-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = IC.hourglass; }
  const agentId = _deleteAgentId;
  const data = await apiRequest('DELETE', `/api/agents/${agentId}`);
  closeDeleteModal();
  if (btn) { btn.disabled = false; btn.innerHTML = IC.trash + ' ' + t('delete'); }
  if (data.ok) {
    // Dissolve animation on the card
    const card = document.querySelector(`[data-id="${agentId}"]`);
    if (card) {
      card.classList.add('agent-card-dissolving');
      setTimeout(() => { card.remove(); }, 600);
    }
    showNotification('Agent #' + agentId + ' deleted', 'success');
    setTimeout(() => { loadAgents(); loadAgentsPage(); }, 700);
  } else {
    showNotification((data.error || 'Failed to delete'), 'error');
  }
}

// ===== MY AGENTS PAGE (full page with filters) =====
let _agentsPageData = [];
let _agentsPageFilter = 'all';

async function loadAgentsPage() {
  const listEl = document.getElementById('agents-page-list');
  if (!listEl) return;

  const data = await apiRequest('GET', '/api/agents');
  if (!data.ok) {
    listEl.innerHTML = '<div class="empty-state">' + t('failed_load') + '</div>';
    return;
  }
  _agentsPageData = data.agents || [];

  // Update counters
  var all = _agentsPageData.length;
  var activeN = _agentsPageData.filter(a => a.isActive).length;
  var pausedN = all - activeN;
  var setEl = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('agents-filter-all', all);
  setEl('agents-filter-active', activeN);
  setEl('agents-filter-paused', pausedN);
  setEl('agents-page-count', all + (currentLang === 'ru' ? ' агентов' : ' agents'));

  renderAgentsPage();
}

function filterAgentsPage(filter) {
  _agentsPageFilter = filter;
  // Update active filter button
  document.querySelectorAll('#operations-page .op-filter').forEach(function(btn, i) {
    btn.classList.toggle('active', ['all','active','paused'][i] === filter);
  });
  renderAgentsPage();
}

function renderAgentsPage() {
  var listEl = document.getElementById('agents-page-list');
  if (!listEl) return;

  var agents = _agentsPageData;
  if (_agentsPageFilter === 'active') agents = agents.filter(function(a) { return a.isActive; });
  else if (_agentsPageFilter === 'paused') agents = agents.filter(function(a) { return !a.isActive; });

  if (!agents.length) {
    var msg = _agentsPageFilter === 'all'
      ? (currentLang === 'ru' ? 'Нет агентов. Создайте первого!' : 'No agents yet. Create your first!')
      : (currentLang === 'ru' ? 'Нет агентов с таким статусом' : 'No agents with this status');
    listEl.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center"><p>' + msg + '</p>' +
      (_agentsPageFilter === 'all' ? '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'builder\')">' + t('create_first') + '</button>' : '') +
      '</div>';
    return;
  }

  var triggerLabel = function(tt) { return tt === 'scheduled' ? t('trigger_scheduled') : tt === 'webhook' ? t('trigger_webhook') : tt === 'ai_agent' ? t('trigger_ai_agent') : t('trigger_manual'); };
  var triggerIcon = function(tt) {
    if (tt === 'scheduled') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    if (tt === 'webhook') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
    if (tt === 'ai_agent') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  };
  var timeAgo = function(dateStr) {
    if (!dateStr) return '';
    var ms = Date.now() - new Date(dateStr).getTime();
    if (ms < 60000) return currentLang === 'ru' ? 'только что' : 'just now';
    if (ms < 3600000) return Math.floor(ms / 60000) + (currentLang === 'ru' ? ' мин' : 'm ago');
    if (ms < 86400000) return Math.floor(ms / 3600000) + (currentLang === 'ru' ? ' ч' : 'h ago');
    return Math.floor(ms / 86400000) + (currentLang === 'ru' ? ' д' : 'd ago');
  };
  listEl.innerHTML = agents.map(function(a) {
    var role = a.role || 'worker';
    var lvl = a.level || 1;
    var created = timeAgo(a.createdAt);
    return '<div class="agent-card-enhanced" data-id="' + a.id + '" onclick="openAgentDetail(' + a.id + ')" style="cursor:pointer">' +
      '<div class="agent-card-top">' +
      '<div class="agent-status ' + (a.isActive ? 'active' : 'paused') + '"><span class="status-dot"></span><span>' + (a.isActive ? t('active') : t('paused')) + '</span></div>' +
      '<div class="agent-card-type">' + triggerIcon(a.triggerType) + ' ' + triggerLabel(a.triggerType) + '</div>' +
      '</div>' +
      '<div class="agent-card-main">' +
      '<strong class="agent-card-name">#' + a.id + ' ' + escHtml(a.name || t('unnamed')) + '</strong>' +
      '<span class="agent-desc">' + escHtml((a.description || '').slice(0, 120)) + '</span>' +
      '</div>' +
      '<div class="agent-card-meta">' +
      '<span class="agent-role-badge role-' + role + '">' + role + '</span>' +
      '<span class="agent-level">' + t('lv') + lvl + '</span>' +
      (created ? '<span class="agent-created">' + created + '</span>' : '') +
      '</div>' +
      '<div class="agent-card-actions">' +
      '<button class="btn btn-sm ' + (a.isActive ? 'btn-warning' : 'btn-success') + '" onclick="event.stopPropagation();toggleAgentFromPage(' + a.id + ',' + a.isActive + ')">' + (a.isActive ? IC.pause + ' ' + t('stop') : IC.rocket + ' ' + t('run')) + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openAgentDetail(' + a.id + ')">' + IC.wrench + ' ' + (currentLang === 'ru' ? 'Детали' : 'Details') + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();loadAgentLogs(' + a.id + ')">' + IC.clipboard + ' ' + t('logs') + '</button>' +
      '<button class="btn btn-ghost btn-sm" title="' + (getPinnedAgents().indexOf(a.id) >= 0 ? (currentLang === 'ru' ? 'Открепить' : 'Unpin') : (currentLang === 'ru' ? 'Закрепить на обзор' : 'Pin to overview')) + '" onclick="togglePinAgent(' + a.id + ', event)" style="color:' + (getPinnedAgents().indexOf(a.id) >= 0 ? 'var(--primary)' : 'var(--text-muted)') + '">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" ' + (getPinnedAgents().indexOf(a.id) >= 0 ? 'fill="currentColor"' : 'fill="none"') + ' stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></button>' +
      '<button class="btn btn-ghost btn-sm" style="color:var(--danger,#ef4444)" onclick="event.stopPropagation();deleteAgent(' + a.id + ',\'' + escHtml(a.name || 'Agent').replace(/'/g, "\\'") + '\')">' + IC.trash + '</button>' +
      '</div></div>';
  }).join('');
}

async function toggleAgentFromPage(agentId, isActive) {
  var endpoint = isActive ? '/api/agents/' + agentId + '/stop' : '/api/agents/' + agentId + '/run';
  var btn = document.querySelector('#agents-page-list [data-id="' + agentId + '"] .btn-success, #agents-page-list [data-id="' + agentId + '"] .btn-warning');
  if (btn) { btn.disabled = true; btn.innerHTML = IC.hourglass; }
  var data = await apiRequest('POST', endpoint);
  if (!data.ok) toast(data.error || 'Unknown error', 'error');
  await Promise.all([loadAgentsPage(), loadAgents()]);
}

async function loadExecutionHistory() {
  var statusParam = currentOperationFilter !== 'all' ? '?status=' + currentOperationFilter : '';
  var data = await apiRequest('GET', '/api/executions' + statusParam + (statusParam ? '&limit=20' : '?limit=20'));
  if (data.ok && data.executions) {
    operationsData = data.executions.map(function(ex) {
      var startedAt = ex.startedAt ? new Date(ex.startedAt) : new Date();
      var ageMs = Date.now() - startedAt.getTime();
      var ageStr = ageMs < 60000 ? 'Just now' : ageMs < 3600000 ? Math.floor(ageMs / 60000) + ' min ago' : Math.floor(ageMs / 3600000) + 'h ago';
      var STALE_MS = 30 * 60 * 1000;
      var isStaleRunning = ex.status === 'running' && ageMs > STALE_MS;
      return {
        id: ex.id,
        name: 'Agent #' + ex.agentId + ' run',
        nameRu: 'Запуск агента #' + ex.agentId,
        description: 'Trigger: ' + (ex.triggerType || 'manual'),
        descriptionRu: 'Триггер: ' + (ex.triggerType || 'manual'),
        status: isStaleRunning ? 'failed' : ex.status === 'running' ? 'running' : ex.status === 'success' ? 'completed' : ex.status === 'error' ? 'failed' : 'queued',
        createdAt: ageStr, createdAtRu: ageStr,
        duration: ex.durationMs ? (ex.durationMs / 1000).toFixed(1) + 's' : null,
        error: ex.errorMessage || null, errorRu: ex.errorMessage || null,
        progress: ex.status === 'running' ? 50 : null,
      };
    });
  }
  renderOperations();
}

let _logsAgentId = null;

async function loadAgentLogs(agentId) {
  _logsAgentId = agentId;
  const modal = document.getElementById('logs-modal');
  const body = document.getElementById('logs-modal-body');
  const title = document.getElementById('logs-modal-title');
  if (!modal || !body) return;
  title.textContent = t('logs') + ' — Agent #' + agentId;
  body.innerHTML = '<div style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">Loading...</div>';
  modal.style.display = 'flex';

  const data = await apiRequest('GET', `/api/agents/${agentId}/logs?limit=50`);
  if (!data.ok) {
    body.innerHTML = '<div style="padding:32px;text-align:center;color:#ef4444">Failed to load logs</div>';
    return;
  }
  const logs = data.logs || [];
  if (!logs.length) {
    body.innerHTML = '<div style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No logs yet.</div>';
    return;
  }
  body.innerHTML = logs.map(l => {
    const ts = l.timestamp || l.createdAt;
    const time = ts ? new Date(ts).toLocaleTimeString() : '--:--:--';
    const level = (l.level || 'info').toLowerCase();
    const lvlClass = ['error','warn','success'].includes(level) ? level : 'info';
    const msg = escHtml(l.message || '');
    return `<div class="log-entry ${lvlClass}">
      <span class="log-time">${time}</span>
      <span class="log-level ${lvlClass}">${level}</span>
      <span class="log-msg">${msg}</span>
    </div>`;
  }).join('');
  // Scroll to bottom (latest logs)
  body.scrollTop = body.scrollHeight;
}

function closeLogsModal() {
  const modal = document.getElementById('logs-modal');
  if (modal) modal.style.display = 'none';
  _logsAgentId = null;
}

function refreshLogs() {
  if (_logsAgentId) loadAgentLogs(_logsAgentId);
}

// Load real plugins from API (for Extensions page)
async function loadPluginsReal() {
  const data = await apiRequest('GET', '/api/plugins');
  if (!data.ok) return;
  window._realPlugins = data.plugins || [];
  // Update badge in nav
  const badge = document.querySelector('[data-page="extensions"] .nav-badge');
  if (badge) badge.textContent = window._realPlugins.length;
  // Update tab count
  const mktBadge = document.querySelector('[data-tab="marketplace"] .tab-count');
  if (mktBadge) mktBadge.textContent = window._realPlugins.length;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function refreshData() {
  const icon = document.querySelector('.refresh-icon');
  if (icon) icon.style.animation = 'spin 1s linear infinite';
  await loadDashboard();
  if (icon) icon.style.animation = '';
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('tg_token');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

// ── Auth initialization ──────────────────────────────────────────────────────
// Uses new Telegram Login SDK (OIDC popup) — works on any domain
let _tgLoginReady = false;

async function initAuth() {
  // 1. Fetch platform config
  try {
    const cfg = await fetch(API_BASE + '/api/config').then(r => r.json());
    if (cfg && cfg.ok) window._appConfig = cfg;
  } catch (_) {}

  const container = document.getElementById('telegram-login-container');
  if (!container) return;

  // Update auth screen text
  const welcomeEl = document.querySelector('.auth-card h2');
  if (welcomeEl) welcomeEl.textContent = t('welcome_back');
  const descEl = document.querySelector('.auth-card p');
  if (descEl) descEl.textContent = t('sign_in_desc');
  const secureEl = document.getElementById('https-hint');
  if (secureEl) secureEl.textContent = t('secure_auth');
  const expiredEl = document.getElementById('session-expired-hint');
  if (expiredEl) expiredEl.textContent = t('session_expired');

  const isHTTPS = location.protocol === 'https:';
  const botUsername = (window._appConfig && window._appConfig.botUsername) || 'TonAgentPlatformBot';

  if (isHTTPS) {
    // Primary: Telegram Login Widget (classic, reliable on HTTPS)
    showTelegramWidget(container, botUsername);
  } else {
    // Localhost/HTTP: only bot auth works
    showBotAuthButton();
  }
}

function showTelegramWidget(container, botUsername) {
  // Render widget container + fallback bot auth link
  container.innerHTML = '<div id="tg-widget-holder" style="display:flex;flex-direction:column;align-items:center;gap:14px"></div>';
  const holder = document.getElementById('tg-widget-holder');

  // Load Telegram Login Widget script
  const script = document.createElement('script');
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.async = true;
  script.setAttribute('data-telegram-login', botUsername);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-radius', '8');
  script.setAttribute('data-onauth', 'onTelegramAuthLegacy(user)');
  script.setAttribute('data-request-access', 'write');
  holder.appendChild(script);

  // Fallback: if widget doesn't load in 4s, show bot auth too
  const fallbackTimer = setTimeout(() => {
    if (!holder.querySelector('iframe')) {
      // Widget didn't render — show bot auth as primary
      showBotAuthButton();
    } else {
      // Widget loaded — add subtle bot auth alternative below
      const alt = document.createElement('div');
      alt.style.cssText = 'margin-top:8px;text-align:center';
      alt.innerHTML = '<span style="color:var(--text-muted);font-size:.75rem;cursor:pointer;text-decoration:underline" onclick="showBotAuthButton()">' +
        (currentLang === 'ru' ? 'Или войти через бота' : 'Or sign in via bot') + '</span>';
      holder.appendChild(alt);
    }
  }, 4000);
  container._fallbackTimer = fallbackTimer;
}

// Handle OAuth redirect: ?code=XXX&state=YYY
async function handleOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) return false;

  // Verify state
  const savedState = sessionStorage.getItem('tg_oauth_state');
  if (state && savedState && state !== savedState) {
    console.error('OAuth state mismatch');
    showAuthError(currentLang === 'ru' ? 'Ошибка безопасности (state mismatch). Попробуйте снова.' : 'Security error (state mismatch). Try again.');
    window.history.replaceState({}, '', window.location.pathname);
    return false;
  }
  sessionStorage.removeItem('tg_oauth_state');

  // Show loading state on auth screen
  showAuthLoading(true);

  // Exchange code for session via our backend (retry up to 3 times)
  let data = null;
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      data = await apiRequest('POST', '/api/auth/telegram-code', { code, redirect_uri: window.location.origin + '/studio' });
      if (data.ok) break;
      lastError = data.error || 'Unknown error';
    } catch (e) {
      lastError = e.message || 'Network error';
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
  }

  showAuthLoading(false);

  if (!data || !data.ok) {
    console.error('Code exchange failed:', lastError);
    showAuthError(currentLang === 'ru'
      ? 'Не удалось авторизоваться: ' + lastError + '. Попробуйте снова.'
      : 'Auth failed: ' + lastError + '. Please try again.');
    // Clean URL so stale code doesn't retry forever
    window.history.replaceState({}, '', window.location.pathname);
    return false;
  }

  // Success — clean URL and enter app
  window.history.replaceState({}, '', window.location.pathname);
  authToken = data.token;
  localStorage.setItem('tg_token', authToken);
  currentUser = { userId: data.userId, username: data.username, first_name: data.firstName, photo_url: data.photoUrl || null };
  showApp();
  return true;
}

function showAuthLoading(show) {
  const container = document.getElementById('telegram-login-container');
  if (!container) return;
  if (show) {
    container.innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text-secondary)">' +
      '<div class="auth-spinner"></div>' +
      '<p style="margin-top:12px;font-size:.9rem">' + (currentLang === 'ru' ? 'Авторизация...' : 'Signing in...') + '</p>' +
      '</div>';
  }
}

function showAuthError(msg) {
  const container = document.getElementById('telegram-login-container');
  if (!container) return;
  // Show error above login button
  let errEl = document.getElementById('auth-error-msg');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.id = 'auth-error-msg';
    errEl.style.cssText = 'background:rgba(231,76,60,0.12);border:1px solid rgba(231,76,60,0.3);border-radius:8px;padding:10px 14px;margin-bottom:12px;color:#e74c3c;font-size:.85rem;text-align:center';
    container.parentElement.insertBefore(errEl, container);
  }
  errEl.textContent = msg;
  errEl.style.display = 'block';
  // Auto-hide after 8 seconds
  setTimeout(() => { if (errEl) errEl.style.display = 'none'; }, 8000);
}

// Check if already logged in (token in localStorage)
async function checkExistingSession() {
  // First check if this is an OAuth redirect
  if (await handleOAuthRedirect()) return;

  if (!authToken) {
    await initAuth();
    return;
  }

  // Verify existing session with backend
  let data;
  try {
    data = await apiRequest('GET', '/api/me');
  } catch (e) {
    // Network error — server might be down, still show auth screen
    console.error('Session check failed:', e);
    authToken = null;
    localStorage.removeItem('tg_token');
    showAuthError(currentLang === 'ru' ? 'Сервер недоступен. Попробуйте позже.' : 'Server unavailable. Try again later.');
    await initAuth();
    return;
  }

  if (data.ok) {
    currentUser = { userId: data.userId, username: data.username, first_name: data.firstName, photo_url: data.photoUrl || null };
    if (data.planId) currentUser._plan = { id: data.planId, name: data.planName, icon: data.planIcon };
    showApp();
  } else {
    // Token expired (bot restarted / session wiped)
    authToken = null;
    localStorage.removeItem('tg_token');
    // Show friendly "session expired" hint in auth screen
    const hint = document.getElementById('session-expired-hint');
    if (hint) hint.style.display = 'block';
    await initAuth();
  }
}

// ===== BOT-AUTH (polling via deeplink — works on localhost without domain config) =====
let _botAuthToken = null;
let _botAuthPolling = null;

function showBotAuthButton() {
  const container = document.getElementById('telegram-login-container');
  if (container) {
    container.innerHTML = `
      <button
        onclick="startBotAuth()"
        style="display:flex;align-items:center;gap:10px;padding:12px 24px;background:#2196F3;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:500;cursor:pointer;width:100%;justify-content:center;transition:opacity .2s"
        onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        ${t('sign_in_tg')}
      </button>
    `;
  }
  // Hide the "Widget requires HTTPS" note — it's confusing for end users
  const note = document.getElementById('https-hint');
  if (note) note.style.display = 'none';
}

async function startBotAuth() {
  const container = document.getElementById('telegram-login-container');
  if (container) {
    container.innerHTML = '<div style="text-align:center;padding:16px 0;color:var(--text-secondary);font-size:.875rem;">' + t('connecting') + '</div>';
  }

  const data = await apiRequest('GET', '/api/auth/request');
  if (!data.ok) {
    if (container) container.innerHTML = `
      <div style="text-align:center;padding:12px 0">
        <p style="color:#f59e0b;font-size:.9rem;margin:0 0 8px;font-weight:500;">Не удалось подключиться</p>
        <p style="color:var(--text-muted);font-size:.75rem;margin:0 0 14px;">Убедитесь, что бот-сервер запущен</p>
        <button onclick="showBotAuthButton()"
          style="padding:8px 20px;background:#2196F3;color:#fff;border:none;border-radius:6px;font-size:.875rem;font-weight:500;cursor:pointer;">
          ${IC.refresh} Повторить
        </button>
      </div>`;
    return;
  }

  _botAuthToken = data.authToken;
  // Do NOT use window.open() — it gets blocked by popup blockers after async calls.
  // Instead show a prominent <a> link the user clicks directly (real user gesture).
  if (container) {
    var authCmd = '/start webauth_' + _botAuthToken;
    var openLabel = currentLang === 'ru' ? 'Открыть @TonAgentPlatformBot' : 'Open @TonAgentPlatformBot';
    var instrLabel = currentLang === 'ru' ? 'Откройте бота и отправьте команду' : 'Open the bot and send the command';
    var autoLabel = currentLang === 'ru' ? 'Страница обновится автоматически после авторизации' : 'Page will refresh automatically after auth';
    var cancelLabel = currentLang === 'ru' ? 'Отмена' : 'Cancel';
    container.innerHTML =
      '<div style="text-align:center;padding:8px 0 16px">' +
        '<div style="font-size:1.75rem;margin-bottom:10px">' + IC.phone + '</div>' +
        '<p style="color:var(--text-secondary);font-size:.9rem;margin-bottom:4px;font-weight:500">' + instrLabel + '</p>' +
        '<div style="display:flex;align-items:center;gap:8px;justify-content:center;margin:12px 0 16px">' +
          '<code id="auth-code-text" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px 14px;font-size:.85rem;font-family:JetBrains Mono,monospace;color:#7dd3fc;letter-spacing:.5px;user-select:all;cursor:pointer" onclick="copyAuthCode()" title="Click to copy">' + escHtml(authCmd) + '</code>' +
          '<button id="auth-copy-btn" onclick="copyAuthCode()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px;cursor:pointer;color:var(--text-secondary);display:flex;align-items:center" title="Copy">' + IC.clipboard + '</button>' +
        '</div>' +
        '<a href="' + escHtml(data.botLink) + '" target="_blank" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 28px;background:linear-gradient(135deg,#2AABEE,#229ED9);color:#fff;border-radius:8px;font-size:.9375rem;font-weight:600;text-decoration:none;margin-bottom:8px;min-width:200px;box-shadow:0 2px 12px rgba(42,171,238,.3)">' + openLabel + '</a>' +
        '<p style="color:var(--text-muted);font-size:.7rem;margin:8px 0 12px">' + autoLabel + '</p>' +
        '<button onclick="cancelBotAuth()" style="background:none;border:none;color:var(--text-muted);font-size:.8125rem;cursor:pointer;text-decoration:underline">' + cancelLabel + '</button>' +
      '</div>';
    // Store auth command for copy function
    window._pendingAuthCmd = authCmd;
  }

  _botAuthPolling = setInterval(async () => {
    const check = await apiRequest('GET', `/api/auth/check/${_botAuthToken}`);
    if (check.status === 'approved') {
      clearInterval(_botAuthPolling);
      _botAuthPolling = null;
      authToken = check.token;
      localStorage.setItem('tg_token', authToken);
      currentUser = {
        userId: check.userId,
        first_name: check.firstName || '',
        username: check.username || '',
      };
      showApp();
    } else if (!check.ok || check.status === 'not_found') {
      // Token expired or server error — reset
      clearInterval(_botAuthPolling);
      _botAuthPolling = null;
      showBotAuthButton();
    }
    // status === 'pending' — продолжаем ждать
  }, 2000);
}

function copyAuthCode() {
  var cmd = window._pendingAuthCmd || '';
  if (!cmd) return;
  navigator.clipboard.writeText(cmd).then(function() {
    var btn = document.getElementById('auth-copy-btn');
    if (btn) { btn.innerHTML = IC.check; setTimeout(function() { btn.innerHTML = IC.clipboard; }, 1500); }
    showToast(currentLang === 'ru' ? 'Скопировано!' : 'Copied!', 'success');
  }).catch(function() {
    // Fallback: select the text
    var code = document.getElementById('auth-code-text');
    if (code) { var range = document.createRange(); range.selectNodeContents(code); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
  });
}

function cancelBotAuth() {
  if (_botAuthPolling) { clearInterval(_botAuthPolling); _botAuthPolling = null; }
  _botAuthToken = null;
  window._pendingAuthCmd = null;
  showBotAuthButton();
}

// Auto-check session on load (also inits widget if no session)
checkExistingSession();

// ===== NAVIGATION =====
// Map page names to their lazy-load functions
const pageLoadFns = {
  overview:    () => loadOverview(),
  analytics:   () => loadAnalytics(),
  persona:     () => loadPersona(),
  knowledge:   () => loadKnowledge(),
  capabilities:() => initCapabilities(),
  connectors:  () => loadConnectors(),
  extensions:  () => loadExtensions(),
  activity:    () => initActivityStream(),
  operations:  () => loadOperations(),
  profile:     () => loadProfile(),
  wallet:      () => loadWallet(),
  settings:    () => loadSettings(),
  network:     () => loadNetworkMap(),
  builder:     () => initFlowBuilder(),
  marketplace: () => loadMarketplace(),
  assistant:   () => loadAssistantPage(),
  guide:       () => Promise.resolve(),
};

// Stub functions for pages that don't have dedicated load logic yet
function loadOverview() {
  loadMyStats();
  loadAgents();
  updateGSPanel();
  // Personalized greeting
  if (currentUser) {
    var name = currentUser.first_name || currentUser.username || '';
    var hour = new Date().getHours();
    var greeting;
    if (currentLang === 'ru') {
      greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    } else {
      greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    }
    var greetEl = document.getElementById('overview-greeting-text');
    if (greetEl && name) {
      greetEl.textContent = greeting + ', ' + name;
      greetEl.removeAttribute('data-en');
      greetEl.removeAttribute('data-ru');
    }
  }
}
async function loadOperations() { await Promise.all([loadAgentsPage(), loadExecutionHistory()]); }
async function loadSettings() {
  try {
    const data = await apiRequest('GET', '/api/settings');
    if (data.ok && data.settings) {
      // Populate existing settings fields if they exist
      const cfg = data.settings.agent_config || {};
      const fields = { 'ai-persona': cfg.persona, 'ai-model': cfg.model, 'response-delay': cfg.responseDelay };
      for (const [id, val] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el && val !== undefined) {
          if (el.tagName === 'INPUT' && el.type === 'range') { el.value = val; updateSliderDisplay(el); }
          else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') el.value = val;
        }
      }
    }
  } catch {}
  // Load AI API key
  loadAIKey().catch(() => {});
  console.log('[Dashboard] Settings page loaded');
}
function loadExtensions() { loadPluginsReal(); }

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    // Show corresponding page
    const pageName = item.dataset.page;
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const pageEl = document.getElementById(`${pageName}-page`);
    if (pageEl) pageEl.classList.add('active');

    // Lazy-load page data if authenticated
    if (authToken && pageLoadFns[pageName]) {
      var _r = pageLoadFns[pageName]();
      if (_r && typeof _r.catch === 'function') _r.catch(console.error);
    }
  });
});

// ===== CAPABILITIES DATA =====
const capabilitiesData = [
  { 
    id: 'deals', 
    name: 'Deals & Escrow', 
    nameRu: 'Сделки и эскроу',
    count: 5, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Create, manage and execute secure deals on TON blockchain',
    descriptionRu: 'Создавайте, управляйте и выполняйте безопасные сделки на блокчейне TON',
    tools: ['create_deal', 'get_deal_status', 'cancel_deal', 'list_deals', 'update_deal']
  },
  { 
    id: 'dedust', 
    name: 'DeDust DEX', 
    nameRu: 'DeDust DEX',
    count: 5, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Swap tokens and manage liquidity on DeDust decentralized exchange',
    descriptionRu: 'Обменивайте токены и управляйте ликвидностью на децентрализованной бирже DeDust',
    tools: ['swap_tokens', 'get_pool_info', 'add_liquidity', 'remove_liquidity', 'get_price']
  },
  { 
    id: 'aggregator', 
    name: 'DEX Aggregator', 
    nameRu: 'DEX Агрегатор',
    count: 3, 
    mode: 'All', 
    enabled: true,
    description: 'Get best rates across all TON DEXes with smart routing',
    descriptionRu: 'Получайте лучшие курсы на всех DEX TON со смарт-роутингом',
    tools: ['get_best_rate', 'aggregate_swap', 'compare_prices']
  },
  { 
    id: 'dns', 
    name: 'TON DNS', 
    nameRu: 'TON DNS',
    count: 7, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Resolve domains, register new names, manage DNS records',
    descriptionRu: 'Резолвите домены, регистрируйте новые имена, управляйте DNS записями',
    tools: ['resolve_dns', 'get_domain_info', 'check_availability', 'register_domain', 'renew_domain', 'transfer_domain', 'set_records']
  },
  { 
    id: 'jettons', 
    name: 'Jetton Tokens', 
    nameRu: 'Jetton токены',
    count: 6, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Transfer, mint, burn and manage fungible tokens on TON',
    descriptionRu: 'Переводите, минтите, сжигайте и управляйте фунгибельными токенами на TON',
    tools: ['get_jetton_info', 'transfer_jetton', 'get_balance', 'mint_jetton', 'burn_jetton', 'get_holders']
  },
  { 
    id: 'journal', 
    name: 'Activity Journal', 
    nameRu: 'Журнал активности',
    count: 3, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Log and track agent activities with searchable history',
    descriptionRu: 'Логируйте и отслеживайте активность агента с возможностью поиска',
    tools: ['write_entry', 'read_entries', 'search_entries']
  },
  { 
    id: 'memory', 
    name: 'Context Memory', 
    nameRu: 'Контекстная память',
    count: 4, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Store and recall conversation context and user preferences',
    descriptionRu: 'Храните и вспоминайте контекст разговоров и предпочтения пользователей',
    tools: ['store_memory', 'recall_memory', 'update_context', 'clear_context']
  },
  { 
    id: 'nft', 
    name: 'NFT Collections', 
    nameRu: 'NFT коллекции',
    count: 4, 
    mode: 'All', 
    enabled: true,
    description: 'Query NFT data, verify ownership, track collections',
    descriptionRu: 'Запрашивайте данные NFT, проверяйте владение, отслеживайте коллекции',
    tools: ['get_nft_info', 'verify_ownership', 'get_collection', 'transfer_nft']
  },
  { 
    id: 'stonfi', 
    name: 'STON.fi Farming', 
    nameRu: 'STON.fi Фарминг',
    count: 5, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Trade and farm on STON.fi DEX with yield optimization',
    descriptionRu: 'Торгуйте и фармите на STON.fi DEX с оптимизацией доходности',
    tools: ['swap_on_stonfi', 'get_farms', 'stake_tokens', 'unstake_tokens', 'claim_rewards']
  },
  { 
    id: 'telegram', 
    name: 'Telegram Messenger', 
    nameRu: 'Telegram мессенджер',
    count: 63, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Send messages, media, documents and interact with Telegram API',
    descriptionRu: 'Отправляйте сообщения, медиа, документы и взаимодействуйте с API Telegram',
    tools: ['send_message', 'send_photo', 'send_document', 'get_chat_info', 'pin_message', 'forward_message']
  },
  { 
    id: 'tonconnect', 
    name: 'TON Connect', 
    nameRu: 'TON Connect',
    count: 4, 
    mode: 'All', 
    enabled: true,
    description: 'Connect wallets and sign transactions securely',
    descriptionRu: 'Подключайте кошельки и подписывайте транзакции безопасно',
    tools: ['connect_wallet', 'disconnect_wallet', 'sign_transaction', 'get_connected_wallets']
  },
  { 
    id: 'wallet', 
    name: 'Wallet Manager', 
    nameRu: 'Менеджер кошельков',
    count: 5, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Manage multiple wallets, check balances, track transactions',
    descriptionRu: 'Управляйте несколькими кошельками, проверяйте балансы, отслеживайте транзакции',
    tools: ['get_balance', 'get_transactions', 'create_wallet', 'import_wallet', 'export_wallet']
  },
  { 
    id: 'web', 
    name: 'Web Scraping', 
    nameRu: 'Веб-скрапинг',
    count: 3, 
    mode: 'None', 
    enabled: false,
    description: 'Fetch and parse web content for data extraction',
    descriptionRu: 'Получайте и парсите веб-контент для извлечения данных',
    tools: ['fetch_page', 'parse_html', 'extract_data']
  },
  { 
    id: 'workspace', 
    name: 'File Workspace', 
    nameRu: 'Файловое хранилище',
    count: 6, 
    mode: 'All', 
    enabled: true,
    description: 'Store, organize and manage files for agent operations',
    descriptionRu: 'Храните, организуйте и управляйте файлами для операций агента',
    tools: ['upload_file', 'download_file', 'list_files', 'create_folder', 'delete_file', 'move_file']
  },
  { 
    id: 'analytics', 
    name: 'Analytics Engine', 
    nameRu: 'Аналитический движок',
    count: 8, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Process data, generate reports and visualize metrics',
    descriptionRu: 'Обрабатывайте данные, генерируйте отчёты и визуализируйте метрики',
    tools: ['process_data', 'generate_report', 'create_chart', 'export_csv', 'calculate_metrics', 'detect_anomalies']
  },
  { 
    id: 'notifications', 
    name: 'Notification Hub', 
    nameRu: 'Центр уведомлений',
    count: 4, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Send alerts and notifications across multiple channels',
    descriptionRu: 'Отправляйте оповещения и уведомления через несколько каналов',
    tools: ['send_alert', 'schedule_notification', 'manage_subscriptions', 'get_delivery_status']
  },
];

let currentCapabilityFilter = 'all';
let capabilitySearchQuery = '';

async function initCapabilities() {
  // Load saved capabilities settings
  try {
    const saved = await apiRequest('GET', '/api/settings?key=default_capabilities');
    if (saved && saved.value) {
      const settings = typeof saved.value === 'string' ? JSON.parse(saved.value) : saved.value;
      if (settings && typeof settings === 'object') {
        for (const cap of capabilitiesData) {
          if (settings[cap.id] !== undefined) {
            cap.enabled = settings[cap.id].enabled !== false;
            if (settings[cap.id].mode) cap.mode = settings[cap.id].mode;
          }
        }
      }
    }
  } catch {}
  renderCapabilities();
}

function renderCapabilities() {
  const container = document.getElementById('capabilities-list');
  if (!container) return;
  
  let filtered = capabilitiesData;
  
  // Apply filter
  if (currentCapabilityFilter === 'active') {
    filtered = filtered.filter(c => c.enabled);
  } else if (currentCapabilityFilter === 'inactive') {
    filtered = filtered.filter(c => !c.enabled);
  }
  
  // Apply search
  if (capabilitySearchQuery) {
    const query = capabilitySearchQuery.toLowerCase();
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(query) ||
      c.nameRu.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query) ||
      c.descriptionRu.toLowerCase().includes(query)
    );
  }
  
  container.innerHTML = filtered.map(cap => `
    <div class="capability-item" data-id="${cap.id}">
      <div class="capability-header" onclick="toggleCapability('${cap.id}')">
        <div class="capability-info">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capability-chevron">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span class="capability-name">${currentLang === 'ru' ? cap.nameRu : cap.name}</span>
          <span class="capability-count">${cap.count} tools</span>
        </div>
        <div class="capability-actions">
          <select class="capability-mode" onchange="changeCapabilityMode('${cap.id}', this.value)" onclick="event.stopPropagation()">
            <option value="Mixed" ${cap.mode === 'Mixed' ? 'selected' : ''}>Mixed</option>
            <option value="All" ${cap.mode === 'All' ? 'selected' : ''}>All</option>
            <option value="None" ${cap.mode === 'None' ? 'selected' : ''}>None</option>
          </select>
          <label class="toggle-switch" onclick="event.stopPropagation()">
            <input type="checkbox" ${cap.enabled ? 'checked' : ''} onchange="toggleCapabilityEnabled('${cap.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="capability-details" id="cap-details-${cap.id}" style="display:none;padding:0 20px 20px;">
        <p style="color:var(--text-secondary);margin-bottom:12px;font-size:0.875rem;">${currentLang === 'ru' ? cap.descriptionRu : cap.description}</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${cap.tools.map(t => `<span style="padding:4px 10px;background:rgba(255,255,255,0.05);border-radius:4px;font-size:0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">${t}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

function toggleCapability(id) {
  const details = document.getElementById(`cap-details-${id}`);
  const item = document.querySelector(`.capability-item[data-id="${id}"]`);
  if (details && item) {
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';
    item.classList.toggle('expanded', !isVisible);
  }
}

function changeCapabilityMode(id, mode) {
  const cap = capabilitiesData.find(c => c.id === id);
  if (cap) {
    cap.mode = mode;
    saveCapabilitiesSettings();
  }
}

function toggleCapabilityEnabled(id, enabled) {
  const cap = capabilitiesData.find(c => c.id === id);
  if (cap) {
    cap.enabled = enabled;
    renderCapabilities();
    saveCapabilitiesSettings();
  }
}

function saveCapabilitiesSettings() {
  const settings = {};
  for (const cap of capabilitiesData) {
    settings[cap.id] = { enabled: cap.enabled, mode: cap.mode };
  }
  apiRequest('POST', '/api/settings', { key: 'default_capabilities', value: settings }).catch(() => {});
}

function filterCapabilities(filter) {
  currentCapabilityFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });
  renderCapabilities();
}

function searchCapabilities(query) {
  capabilitySearchQuery = query;
  renderCapabilities();
}

// ===== EXTENSIONS DATA (Real plugins) =====
const extensionsData = [
  {
    id: 'giftstat',
    name: 'GiftStat Analytics',
    nameRu: 'GiftStat Аналитика',
    description: 'Real-time analytics for Telegram Gifts marketplace. Track floor prices, collection stats, trading volume, and historical trends across all gift categories.',
    descriptionRu: 'Аналитика в реальном времени для маркетплейса Telegram Gifts. Отслеживайте цены, статистику коллекций, объём торгов и исторические тренды.',
    tags: ['market-data', 'telegram', 'analytics', 'gifts'],
    author: 'TON Agent Team',
    version: '2.1.0',
    tools: 12,
    installed: true,
    hasUpdate: false,
  },
  {
    id: 'gas111',
    name: 'Gas111 Launcher',
    nameRu: 'Gas111 Launcher',
    description: 'Launch and manage meme tokens on Gas111 protocol. Create token sales, configure vesting schedules, and track performance metrics.',
    descriptionRu: 'Запускайте и управляйте меме-токенами на протоколе Gas111. Создавайте токенсейлы, настраивайте вестинг и отслеживайте метрики.',
    tags: ['token-launch', 'ton', 'defi', 'meme'],
    author: 'Gas111 Labs',
    version: '4.2.1',
    tools: 15,
    installed: true,
    hasUpdate: true,
    updateVersion: '4.3.0',
  },
  {
    id: 'stormtrade',
    name: 'Storm Trade Pro',
    nameRu: 'Storm Trade Pro',
    description: 'Advanced perpetual futures trading on TON. Access leverage up to 50x, portfolio margin, and automated risk management.',
    descriptionRu: 'Продвинутая торговля фьючерсами на TON. Доступ к плечу до 50x, портфельной марже и автоматическому управлению рисками.',
    tags: ['trading', 'futures', 'derivatives', 'storm'],
    author: 'Storm Team',
    version: '1.5.0',
    tools: 18,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'swapcoffee',
    name: 'Swap.Coffee Aggregator',
    nameRu: 'Swap.Coffee Агрегатор',
    description: 'DEX aggregator finding best swap routes across all TON exchanges. Save up to 15% on slippage with smart routing.',
    descriptionRu: 'DEX агрегатор, находящий лучшие маршруты обмена на всех биржах TON. Экономьте до 15% на проскальзывании со смарт-роутингом.',
    tags: ['dex', 'aggregator', 'swap', 'defi'],
    author: 'Swap.Coffee',
    version: '1.8.2',
    tools: 8,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'dedustpro',
    name: 'DeDust Pro Tools',
    nameRu: 'DeDust Pro Tools',
    description: 'Enhanced liquidity management for DeDust DEX. Advanced pool analytics, impermanent loss calculator, and yield optimizer.',
    descriptionRu: 'Расширенное управление ликвидностью для DeDust DEX. Продвинутая аналитика пулов, калькулятор непостоянных потерь и оптимизатор доходности.',
    tags: ['dedust', 'liquidity', 'yield', 'analytics'],
    author: 'DeDust Finance',
    version: '2.0.0',
    tools: 10,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'tontools',
    name: 'TON Developer Kit',
    nameRu: 'TON Developer Kit',
    description: 'Essential tools for TON developers. Contract deployment, transaction debugging, and network analytics in one package.',
    descriptionRu: 'Необходимые инструменты для разработчиков TON. Деплой контрактов, отладка транзакций и аналитика сети в одном пакете.',
    tags: ['developer', 'tools', 'debugging', 'deployment'],
    author: 'TON Foundation',
    version: '3.1.0',
    tools: 22,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'nftmaster',
    name: 'NFT Master Suite',
    nameRu: 'NFT Master Suite',
    description: 'Complete NFT management solution. Mint, transfer, analyze collections, and track royalty payments on TON.',
    descriptionRu: 'Полное решение для управления NFT. Минтите, передавайте, анализируйте коллекции и отслеживайте роялти на TON.',
    tags: ['nft', 'collections', 'minting', 'royalties'],
    author: 'NFT Masters',
    version: '1.9.0',
    tools: 14,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'walletguard',
    name: 'Wallet Guard',
    nameRu: 'Wallet Guard',
    description: 'Security monitoring for TON wallets. Detect suspicious transactions, set spending limits, and receive instant alerts.',
    descriptionRu: 'Мониторинг безопасности для кошельков TON. Обнаруживайте подозрительные транзакции, устанавливайте лимиты и получайте мгновенные оповещения.',
    tags: ['security', 'monitoring', 'alerts', 'wallet'],
    author: 'Security First',
    version: '1.2.0',
    tools: 9,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'chartpro',
    name: 'ChartPro Analytics',
    nameRu: 'ChartPro Аналитика',
    description: 'Professional charting and technical analysis for TON tokens. 50+ indicators, pattern recognition, and price alerts.',
    descriptionRu: 'Профессиональные графики и технический анализ для токенов TON. 50+ индикаторов, распознавание паттернов и ценовые алерты.',
    tags: ['charts', 'analytics', 'trading', 'indicators'],
    author: 'ChartPro',
    version: '2.3.0',
    tools: 11,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'socialbot',
    name: 'Social Bot Engine',
    nameRu: 'Social Bot Engine',
    description: 'Automated social media management for crypto projects. Schedule posts, track engagement, and manage communities.',
    descriptionRu: 'Автоматизированное управление соцсетями для крипто-проектов. Планируйте посты, отслеживайте вовлечённость и управляйте комьюнити.',
    tags: ['social', 'automation', 'marketing', 'community'],
    author: 'Social Labs',
    version: '1.0.5',
    tools: 16,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'airdropper',
    name: 'Airdrop Manager',
    nameRu: 'Airdrop Manager',
    description: 'Distribute tokens to thousands of addresses efficiently. Whitelist management, vesting schedules, and claim tracking.',
    descriptionRu: 'Распределяйте токены тысячам адресов эффективно. Управление вайтлистом, вестинг и отслеживание клеймов.',
    tags: ['airdrop', 'distribution', 'tokens', 'marketing'],
    author: 'DropMaster',
    version: '1.4.0',
    tools: 8,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'multisig',
    name: 'Multi-Sig Vault',
    nameRu: 'Multi-Sig Vault',
    description: 'Secure multi-signature wallet management. Configure signers, set thresholds, and execute transactions with team approval.',
    descriptionRu: 'Безопасное управление мультиподписными кошельками. Настраивайте подписантов, устанавливайте пороги и выполняйте транзакции с одобрением команды.',
    tags: ['security', 'multisig', 'wallet', 'team'],
    author: 'Vault Security',
    version: '2.0.0',
    tools: 12,
    installed: false,
    hasUpdate: false,
  },
];

let currentExtensionsTab = 'installed';
let extensionsSearchQuery = '';

function initExtensions() {
  renderExtensions();
}

function renderExtensions() {
  const container = document.getElementById('extensions-content');
  if (!container) return;

  // Merge real plugins into extensionsData if available
  const realPlugins = window._realPlugins || [];
  let baseData = extensionsData;
  if (realPlugins.length) {
    // Map real API plugins to the extension card format
    baseData = realPlugins.map(p => ({
      id: p.id,
      name: p.name,
      nameRu: p.name,
      description: p.description,
      descriptionRu: p.description,
      tags: p.tags || [],
      author: 'TON Agent Platform',
      version: '1.0.0',
      tools: p.tags ? p.tags.length : 1,
      installed: p.isInstalled,
      hasUpdate: false,
      updateVersion: '1.0.0',
    }));
  }

  // Update counts
  const installed = baseData.filter(e => e.installed);
  const updates = baseData.filter(e => e.installed && e.hasUpdate);
  const instCount = document.getElementById('installed-count');
  if (instCount) instCount.textContent = installed.length;

  let filtered = baseData;

  // Apply tab filter
  if (currentExtensionsTab === 'installed') {
    filtered = baseData.filter(e => e.installed);
  } else if (currentExtensionsTab === 'updates') {
    filtered = baseData.filter(e => e.installed && e.hasUpdate);
  }

  // Apply search
  if (extensionsSearchQuery) {
    const query = extensionsSearchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(query) ||
      e.nameRu.toLowerCase().includes(query) ||
      e.description.toLowerCase().includes(query) ||
      e.descriptionRu.toLowerCase().includes(query) ||
      e.tags.some(t => t.toLowerCase().includes(query))
    );
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2l9 4.9V17L12 22l-9-4.9V7z"/>
          </svg>
        </div>
        <h3>${currentLang === 'ru' ? 'Ничего не найдено' : 'Nothing found'}</h3>
        <p>${currentLang === 'ru' ? 'Попробуйте изменить параметры поиска' : 'Try adjusting your search criteria'}</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filtered.map(ext => `
    <div class="extension-card ${ext.installed ? 'installed' : ''}">
      <div class="extension-main">
        <div>
          <div class="extension-header">
            <div class="extension-title-row">
              <span class="extension-name">${currentLang === 'ru' ? ext.nameRu : ext.name}</span>
              ${ext.installed ? `<span class="badge badge-success">${currentLang === 'ru' ? 'Установлено' : 'Installed'}</span>` : ''}
              ${ext.hasUpdate ? `<span class="badge" style="background:rgba(245,158,11,0.2);color:var(--warning);">${currentLang === 'ru' ? 'Обновление' : 'Update'} v${ext.updateVersion}</span>` : ''}
            </div>
          </div>
          <p class="extension-desc">${currentLang === 'ru' ? ext.descriptionRu : ext.description}</p>
          <div class="extension-tags">
            ${ext.tags.map(tag => `<span class="extension-tag">${tag}</span>`).join('')}
          </div>
          <div class="extension-footer">
            <span class="extension-meta">by ${ext.author} · v${ext.version} · ${ext.tools} tools</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${ext.installed ? `
            ${ext.hasUpdate ? `
              <button class="btn btn-primary btn-sm" onclick="updateExtension('${ext.id}')">
                ${currentLang === 'ru' ? 'Обновить' : 'Update'}
              </button>
            ` : ''}
            <button class="btn btn-danger btn-sm" onclick="uninstallExtension('${ext.id}')">
              ${currentLang === 'ru' ? 'Удалить' : 'Uninstall'}
            </button>
          ` : `
            <button class="btn btn-primary btn-sm" onclick="installExtension('${ext.id}')">
              ${currentLang === 'ru' ? 'Установить' : 'Install'}
            </button>
          `}
        </div>
      </div>
    </div>
  `).join('');
}

function switchExtensionsTab(tab) {
  currentExtensionsTab = tab;
  document.querySelectorAll('.extensions-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  renderExtensions();
}

async function installExtension(id) {
  const ext = (window._realPlugins || extensionsData).find(e => e.id === id) || extensionsData.find(e => e.id === id);
  if (!ext) return;

  if (authToken) {
    const data = await apiRequest('POST', `/api/plugins/${id}/install`, { config: {} });
    if (!data.ok) {
      showNotification(data.error || t('install_failed'), 'error');
      return;
    }
  }
  // Update local data (both arrays to stay in sync)
  [extensionsData, window._realPlugins || []].forEach(arr => {
    const item = arr.find(e => e.id === id);
    if (item) item.installed = true;
  });
  renderExtensions();
  showNotification(currentLang === 'ru' ? `${ext.nameRu || ext.name} установлен` : `${ext.name} installed`, 'success');
}

async function uninstallExtension(id) {
  const ext = (window._realPlugins || extensionsData).find(e => e.id === id) || extensionsData.find(e => e.id === id);
  if (!ext) return;

  if (authToken) {
    const data = await apiRequest('DELETE', `/api/plugins/${id}`);
    if (!data.ok) {
      showNotification(data.error || t('uninstall_failed'), 'error');
      return;
    }
  }
  [extensionsData, window._realPlugins || []].forEach(arr => {
    const item = arr.find(e => e.id === id);
    if (item) { item.installed = false; item.hasUpdate = false; }
  });
  renderExtensions();
  showNotification(currentLang === 'ru' ? `${ext.nameRu || ext.name} удалён` : `${ext.name} uninstalled`, 'info');
}

function updateExtension(id) {
  const ext = extensionsData.find(e => e.id === id);
  if (ext) {
    ext.version = ext.updateVersion;
    ext.hasUpdate = false;
    renderExtensions();
    showNotification(currentLang === 'ru' ? `${ext.nameRu} обновлён до v${ext.version}` : `${ext.name} updated to v${ext.version}`, 'success');
  }
}

function searchExtensions(query) {
  extensionsSearchQuery = query;
  renderExtensions();
}

// ===== ACTIVITY STREAM =====
// DB-backed: populated from /api/activity, live updates appended in memory
const activityLog = [];

async function initActivityStream() {
  // Load recent activity from DB
  const data = await apiRequest('GET', '/api/activity?limit=30');
  if (data.ok && data.activity && data.activity.length) {
    activityLog.length = 0;
    data.activity.reverse().forEach(entry => {
      const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();
      activityLog.push({
        time: `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}`,
        message: `[Agent #${entry.agentId}] ${entry.message}`,
        messageRu: `[Агент #${entry.agentId}] ${entry.message}`,
        type: entry.level === 'error' ? 'error' : entry.level === 'success' ? 'success' : 'info',
      });
    });
  } else if (!activityLog.length) {
    // Fallback starter entries if no DB data yet
    activityLog.push(
      { time: '--:--:--', message: 'Platform started — no activity yet', messageRu: 'Платформа запущена — активность отсутствует', type: 'info' }
    );
  }
  renderActivityStream();
}

function renderActivityStream() {
  const container = document.getElementById('activity-stream');
  if (!container) return;

  container.innerHTML = activityLog.map(log => `
    <div class="activity-item ${log.type}">
      <span class="activity-type">${log.type.toUpperCase()}</span>
      <span class="activity-time">${log.time}</span>
      <span class="activity-message">${currentLang === 'ru' ? log.messageRu : log.message}</span>
    </div>
  `).join('') || '<div class="activity-item info"><span class="activity-message" style="color:var(--text-muted)">No activity yet.</span></div>';

  container.scrollTop = container.scrollHeight;
}

function clearActivity() {
  activityLog.length = 0;
  renderActivityStream();
}

function addActivity(message, messageRu, type = 'info') {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  activityLog.push({ time, message, messageRu, type });

  if (activityLog.length > 100) {
    activityLog.shift();
  }

  renderActivityStream();
}

// ===== AGENT CONFIG SLIDERS =====
function updateSliderDisplay(el) {
  const span = el.parentElement.querySelector('.slider-value');
  if (!span) return;
  const val = parseFloat(el.value);
  span.textContent = (parseInt(el.max) > 100) ? val + 'ms' : val;
}

async function saveAgentConfig() {
  if (!authToken) {
    showNotification(t('login_first'), 'error');
    return;
  }
  const creativityEl  = document.getElementById('slider-creativity');
  const delayEl       = document.getElementById('slider-response-delay');
  const config = {
    creativity:    creativityEl  ? parseFloat(creativityEl.value)  : 0.7,
    responseDelay: delayEl       ? parseInt(delayEl.value)          : 1500,
  };
  const data = await apiRequest('POST', '/api/settings', { settings: { agent_config: config } });
  if (data.ok) {
    showNotification(t('config_saved'), 'success');
  } else {
    showNotification(data.error || t('save_failed'), 'error');
  }
}

async function loadAgentConfig() {
  const data = await apiRequest('GET', '/api/settings');
  if (!data.ok) return;
  const config = (data.settings && data.settings.agent_config) || {};

  const creativityEl = document.getElementById('slider-creativity');
  if (creativityEl && config.creativity != null) {
    creativityEl.value = config.creativity;
    updateSliderDisplay(creativityEl);
  }
  const delayEl = document.getElementById('slider-response-delay');
  if (delayEl && config.responseDelay != null) {
    delayEl.value = config.responseDelay;
    updateSliderDisplay(delayEl);
  }
}

// ===== SECURITY SETTINGS =====
async function saveSecuritySettings() {
  var sec = {
    logging: document.getElementById('sec-logging')?.checked ?? true,
    confirmActions: document.getElementById('sec-confirm')?.checked ?? true,
    rateLimiting: document.getElementById('sec-rate-limit')?.checked ?? true,
  };
  await apiRequest('POST', '/api/settings', { key: 'security_settings', value: sec });
  showNotification(currentLang === 'ru' ? 'Настройки безопасности сохранены' : 'Security settings saved', 'success');
}
async function loadSecuritySettings() {
  try {
    var data = await apiRequest('GET', '/api/settings?key=security_settings');
    if (data && data.value) {
      var sec = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      var el1 = document.getElementById('sec-logging'); if (el1) el1.checked = sec.logging !== false;
      var el2 = document.getElementById('sec-confirm'); if (el2) el2.checked = sec.confirmActions !== false;
      var el3 = document.getElementById('sec-rate-limit'); if (el3) el3.checked = sec.rateLimiting !== false;
    }
  } catch {}
}

// ===== TELEGRAM SETTINGS =====
async function saveTelegramSettings() {
  var tg = {
    dmMode: document.getElementById('tg-dm-mode')?.value || 'open',
    groupMode: document.getElementById('tg-group-mode')?.value || 'allowlist',
    requireMention: document.getElementById('tg-require-mention')?.checked ?? true,
    typingIndicator: document.getElementById('tg-typing')?.checked ?? true,
    autoReply: document.getElementById('tg-auto-reply')?.checked ?? false,
    responseDelay: parseInt(document.getElementById('slider-response-delay')?.value || '1500'),
  };
  await apiRequest('POST', '/api/settings', { key: 'telegram_settings', value: tg });
  showNotification(currentLang === 'ru' ? 'Настройки Telegram сохранены' : 'Telegram settings saved', 'success');
}
async function loadTelegramSettings() {
  try {
    var data = await apiRequest('GET', '/api/settings?key=telegram_settings');
    if (data && data.value) {
      var tg = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      var dm = document.getElementById('tg-dm-mode'); if (dm && tg.dmMode) dm.value = tg.dmMode;
      var gm = document.getElementById('tg-group-mode'); if (gm && tg.groupMode) gm.value = tg.groupMode;
      var rm = document.getElementById('tg-require-mention'); if (rm) rm.checked = tg.requireMention !== false;
      var ti = document.getElementById('tg-typing'); if (ti) ti.checked = tg.typingIndicator !== false;
      var ar = document.getElementById('tg-auto-reply'); if (ar) ar.checked = tg.autoReply === true;
      if (tg.responseDelay != null) {
        var del = document.getElementById('slider-response-delay');
        if (del) { del.value = tg.responseDelay; updateSliderDisplay(del); }
      }
    }
  } catch {}
}

// ===== OPERATIONS =====
// DB-backed: populated from /api/executions (execution_history table)
let operationsData = [];
let currentOperationFilter = 'all';

async function initOperations() {
  await loadOldOperationsView();
}

async function loadOldOperationsView() {
  const statusParam = currentOperationFilter !== 'all' ? `?status=${currentOperationFilter}` : '';
  const data = await apiRequest('GET', '/api/executions' + statusParam + (statusParam ? '&limit=20' : '?limit=20'));

  if (data.ok && data.executions) {
    operationsData = data.executions.map(ex => {
      const startedAt = ex.startedAt ? new Date(ex.startedAt) : new Date();
      const ageMs = Date.now() - startedAt.getTime();
      const ageStr = ageMs < 60000
        ? 'Just now'
        : ageMs < 3600000
          ? Math.floor(ageMs / 60000) + ' min ago'
          : Math.floor(ageMs / 3600000) + 'h ago';
      // Treat "running" entries older than 30 min as stale (crashed without cleanup)
      const STALE_MS = 30 * 60 * 1000;
      const isStaleRunning = ex.status === 'running' && ageMs > STALE_MS;
      return {
        id: ex.id,
        name: `Agent #${ex.agentId} run`,
        nameRu: `Запуск агента #${ex.agentId}`,
        description: `Trigger: ${ex.triggerType || 'manual'}`,
        descriptionRu: `Триггер: ${ex.triggerType || 'manual'}`,
        status: isStaleRunning      ? 'failed'
          : ex.status === 'running' ? 'running'
          : ex.status === 'success'  ? 'completed'
          : ex.status === 'error'    ? 'failed'
          : 'queued',
        createdAt: ageStr,
        createdAtRu: ageStr,
        duration: ex.durationMs ? (ex.durationMs / 1000).toFixed(1) + 's' : null,
        error: ex.errorMessage || null,
        errorRu: ex.errorMessage || null,
        progress: ex.status === 'running' ? 50 : null,
      };
    });
  }

  renderOperations();
}

function renderOperations() {
  const container = document.getElementById('operations-list');
  if (!container) return;

  let filtered = operationsData;

  if (currentOperationFilter !== 'all') {
    // Map UI filter name to DB status
    const statusMap = { completed: 'completed', running: 'running', failed: 'failed', queued: 'queued' };
    filtered = operationsData.filter(o => o.status === (statusMap[currentOperationFilter] || currentOperationFilter));
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:32px;text-align:center;color:var(--text-muted)">
        ${currentLang === 'ru' ? 'Нет выполнений. Запустите агента чтобы увидеть историю.' : 'No executions yet. Run an agent to see history here.'}
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(op => `
    <div class="operation-item">
      <div class="operation-header">
        <div class="operation-info">
          <span class="operation-id">#${op.id}</span>
          <span class="operation-name">${currentLang === 'ru' ? op.nameRu : op.name}</span>
        </div>
        <span class="operation-status ${op.status}">${op.status}</span>
      </div>
      <p class="operation-desc">${currentLang === 'ru' ? op.descriptionRu : op.description}</p>
      <div class="operation-meta">
        <span>${currentLang === 'ru' ? 'Создано: ' : 'Created: '}${currentLang === 'ru' ? op.createdAtRu : op.createdAt}</span>
        ${op.duration ? `<span>${currentLang === 'ru' ? 'Длительность: ' : 'Duration: '}${op.duration}</span>` : ''}
      </div>
      ${op.status === 'running' && op.progress != null ? `
        <div class="operation-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${op.progress}%"></div>
          </div>
        </div>
      ` : ''}
      ${op.error ? `
        <div style="margin-top:12px;padding:10px 12px;background:rgba(239,68,68,0.1);border-radius:8px;font-size:0.8125rem;color:var(--danger);">
          ${currentLang === 'ru' ? op.errorRu : op.error}
        </div>
      ` : ''}
    </div>
  `).join('');
}

function filterOperations(status) {
  currentOperationFilter = status;
  document.querySelectorAll('.op-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  loadOperations();  // reload from API with new filter
}

// ===== LIVE UPDATES =====
function startLiveUpdates() {
  // Uptime counter — initialised from server (process.uptime()) via loadMyStats
  // Falls back to 0 if stats not loaded yet
  window._serverUptimeBase = window._serverUptimeBase || 0;
  const uptimeStart = Date.now();
  setInterval(() => {
    const elapsed = Math.floor((Date.now() - uptimeStart) / 1000);
    const uptimeSeconds = (window._serverUptimeBase || 0) + elapsed;
    const hours = Math.floor(uptimeSeconds / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const el = document.getElementById('uptime-value');
    if (el) el.textContent = `${hours}h ${mins}m`;
  }, 60000);
  
  // Poll for new real activity every 30 seconds
  setInterval(async () => {
    try {
      const data = await apiRequest('GET', '/api/activity?limit=5');
      if (data.ok && data.activity && data.activity.length) {
        const newEntries = data.activity.filter(e => {
          const entryTime = new Date(e.timestamp).getTime();
          return entryTime > (window._lastActivityPoll || 0);
        });
        newEntries.reverse().forEach(entry => {
          addActivity(
            `[Agent #${entry.agentId}] ${entry.message}`,
            `[Агент #${entry.agentId}] ${entry.message}`,
            entry.level === 'error' ? 'error' : entry.level === 'success' ? 'success' : 'info'
          );
        });
        if (newEntries.length > 0) {
          window._lastActivityPoll = Math.max(...newEntries.map(e => new Date(e.timestamp).getTime()));
        }
      }
    } catch {}
  }, 30000);
  window._lastActivityPoll = Date.now();
}

// ===== REFRESH DATA =====
// (real refreshData is defined above — calls API; this block removed to avoid duplicate)

// ===== NOTIFICATIONS =====
function showNotification(message, type) {
  // Redirects to new toast system
  toast(message, type || 'info');
}

// ===== SETTINGS =====
function togglePassword(btn) {
  const input = btn.previousElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = t('hide');
  } else {
    input.type = 'password';
    btn.textContent = t('show');
  }
}

async function saveSettings() {
  if (!authToken) {
    showNotification(t('login_first'), 'error');
    return;
  }

  // Collect settings form values if present
  const settingsObj = {};
  const aiPersona = document.getElementById('ai-persona');
  if (aiPersona && aiPersona.value) settingsObj.aiPersona = aiPersona.value;
  const aiModel = document.getElementById('ai-model');
  if (aiModel && aiModel.value) settingsObj.aiModel = aiModel.value;
  const notifyEl = document.getElementById('notify-enabled');
  if (notifyEl) settingsObj.notificationsEnabled = notifyEl.checked;

  const data = await apiRequest('POST', '/api/settings', { settings: settingsObj });
  if (data.ok) {
    showNotification(t('settings_saved'), 'success');
  } else {
    showNotification(data.error || t('save_failed'), 'error');
  }
}

// ===== AI API KEY MANAGEMENT =====
const _aiProviderPlaceholders = {
  gemini: 'AIzaSy...',
  openai: 'sk-proj-...',
  anthropic: 'sk-ant-...',
  groq: 'gsk_...',
  deepseek: 'sk-...',
  openrouter: 'sk-or-...',
  together: 'sk-...',
};

function onAIProviderChange() {
  const sel = document.getElementById('ai-provider-select');
  const input = document.getElementById('ai-api-key-input');
  if (sel && input) {
    input.placeholder = _aiProviderPlaceholders[sel.value] || 'API Key...';
  }
}

async function loadAIKey() {
  try {
    const data = await apiRequest('GET', '/api/settings');
    if (!data.ok || !data.settings) return;
    const uv = data.settings.user_variables;
    if (!uv) return;
    const vars = typeof uv === 'string' ? JSON.parse(uv) : uv;
    const provider = vars.AI_PROVIDER || 'gemini';
    const hasKey = !!vars.AI_API_KEY;

    const sel = document.getElementById('ai-provider-select');
    if (sel) sel.value = provider;
    onAIProviderChange();

    const statusEl = document.getElementById('ai-key-status');
    if (statusEl) {
      statusEl.style.display = hasKey ? 'inline' : 'none';
      statusEl.textContent = hasKey ? (currentLang === 'ru' ? 'Сохранён' : 'Saved') : '';
    }
    const input = document.getElementById('ai-api-key-input');
    if (input && hasKey) {
      input.value = '';
      input.placeholder = vars.AI_API_KEY.slice(0, 6) + '...' + vars.AI_API_KEY.slice(-4);
    }
  } catch {}
}

async function saveAIKey() {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const sel = document.getElementById('ai-provider-select');
  const input = document.getElementById('ai-api-key-input');
  const msgEl = document.getElementById('ai-key-msg');
  const provider = sel ? sel.value : 'gemini';
  const key = input ? input.value.trim() : '';

  if (!key) {
    if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = 'var(--danger)'; msgEl.textContent = currentLang === 'ru' ? 'Введите ключ' : 'Enter a key'; }
    return;
  }

  // Get existing user_variables and merge
  let existingVars = {};
  try {
    const cur = await apiRequest('GET', '/api/settings');
    if (cur.ok && cur.settings && cur.settings.user_variables) {
      existingVars = typeof cur.settings.user_variables === 'string' ? JSON.parse(cur.settings.user_variables) : cur.settings.user_variables;
    }
  } catch {}

  existingVars.AI_PROVIDER = provider;
  existingVars.AI_API_KEY = key;

  const data = await apiRequest('POST', '/api/settings', { key: 'user_variables', value: existingVars });
  if (data.ok) {
    if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = 'var(--success)'; msgEl.textContent = currentLang === 'ru' ? 'Ключ сохранён!' : 'Key saved!'; }
    const statusEl = document.getElementById('ai-key-status');
    if (statusEl) { statusEl.style.display = 'inline'; statusEl.textContent = currentLang === 'ru' ? 'Сохранён' : 'Saved'; }
    input.value = '';
    input.placeholder = key.slice(0, 6) + '...' + key.slice(-4);
    setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3000);
  } else {
    if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = 'var(--danger)'; msgEl.textContent = data.error || t('save_failed'); }
  }
}

async function clearAIKey() {
  if (!authToken) return;
  let existingVars = {};
  try {
    const cur = await apiRequest('GET', '/api/settings');
    if (cur.ok && cur.settings && cur.settings.user_variables) {
      existingVars = typeof cur.settings.user_variables === 'string' ? JSON.parse(cur.settings.user_variables) : cur.settings.user_variables;
    }
  } catch {}

  delete existingVars.AI_API_KEY;
  delete existingVars.AI_PROVIDER;

  const data = await apiRequest('POST', '/api/settings', { key: 'user_variables', value: existingVars });
  if (data.ok) {
    const statusEl = document.getElementById('ai-key-status');
    if (statusEl) statusEl.style.display = 'none';
    const input = document.getElementById('ai-api-key-input');
    if (input) { input.value = ''; input.placeholder = 'sk-... / AIza... / gsk_...'; }
    const msgEl = document.getElementById('ai-key-msg');
    if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = 'var(--text-secondary)'; msgEl.textContent = currentLang === 'ru' ? 'Ключ удалён' : 'Key cleared'; setTimeout(() => { msgEl.style.display = 'none'; }, 3000); }
  }
}

// ===== MODALS =====
function showAddServerModal() {
  document.getElementById('add-server-modal').style.display = 'flex';
}

function hideAddServerModal() {
  document.getElementById('add-server-modal').style.display = 'none';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
});

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in (for demo)
  // simulateLogin();
});

// ===== NAVIGATION HELPER =====
function navigateTo(pageName) {
  closePlansModal();
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  const pageEl = document.getElementById(`${pageName}-page`);
  if (pageEl) pageEl.classList.add('active');

  if (authToken && pageLoadFns[pageName]) {
    var _result = pageLoadFns[pageName]();
    if (_result && typeof _result.catch === 'function') _result.catch(console.error);
  }

  // Track getting-started steps
  if (pageName === 'settings') markGSStep('ai');
  if (pageName === 'marketplace') markGSStep('marketplace');
  if (pageName === 'guide') markGSStep('guide');
}

// ===== ANALYTICS PAGE =====
async function loadAnalytics() {
  const [statsData, exData] = await Promise.all([
    apiRequest('GET', '/api/stats/me'),
    apiRequest('GET', '/api/executions'),
  ]);

  // Fill stat cards
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  if (statsData.ok) {
    setEl('an-total-runs', statsData.totalRuns ?? '—');
    setEl('an-success-rate', (statsData.successRate != null ? statsData.successRate + '%' : '—'));
    setEl('an-last24h', statsData.last24hRuns ?? '—');
    setEl('an-active-agents', statsData.agentsActive ?? '—');
  }

  // Execution history table
  const tableEl = document.getElementById('analytics-executions-table');
  if (!tableEl) return;
  const execs = (exData.ok && exData.executions) || [];
  if (!execs.length) {
    tableEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">' + t('no_executions') + '</div>';
    return;
  }

  const statusIcon = s => s === 'success' ? IC.check : s === 'running' ? IC.refresh : s === 'failed' ? IC.x : IC.hourglass;
  tableEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead>
        <tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">
          <th style="text-align:left;padding:.6rem 1rem">Agent</th>
          <th style="text-align:left;padding:.6rem .5rem">Status</th>
          <th style="text-align:left;padding:.6rem .5rem">Duration</th>
          <th style="text-align:left;padding:.6rem .5rem">Time</th>
        </tr>
      </thead>
      <tbody>
        ${execs.slice(0, 50).map(ex => `
          <tr style="border-bottom:1px solid var(--border-subtle)">
            <td style="padding:.5rem 1rem;font-weight:500">#${ex.agentId}</td>
            <td style="padding:.5rem .5rem">${statusIcon(ex.status)} ${ex.status}</td>
            <td style="padding:.5rem .5rem">${ex.durationMs ? (ex.durationMs / 1000).toFixed(1) + 's' : '—'}</td>
            <td style="padding:.5rem .5rem;color:var(--text-muted)">${new Date(ex.startedAt || ex.createdAt).toLocaleString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ===== PERSONA PAGE =====
async function loadPersona() {
  const data = await apiRequest('GET', '/api/settings');
  if (!data.ok) return;
  const s = data.settings || {};
  const persona = s.persona || {};

  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  setVal('persona-model', persona.model);
  setVal('persona-language', persona.language);
  setVal('persona-tone', persona.tone);
  setVal('persona-name', persona.name);
  setVal('persona-instructions', persona.instructions);
}

async function savePersona() {
  if (!authToken) {
    showNotification(t('login_first'), 'error');
    return;
  }
  const getVal = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const persona = {
    model: getVal('persona-model'),
    language: getVal('persona-language'),
    tone: getVal('persona-tone'),
    name: getVal('persona-name'),
    instructions: getVal('persona-instructions'),
  };
  const data = await apiRequest('POST', '/api/settings', { settings: { persona } });
  if (data.ok) {
    showNotification(t('persona_saved'), 'success');
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

// ===== KNOWLEDGE BASE PAGE =====
let _knowledgeEntries = [];

async function loadKnowledge() {
  const data = await apiRequest('GET', '/api/settings');
  _knowledgeEntries = (data.ok && data.settings && data.settings.knowledge_base) || [];
  renderKnowledge();
}

function renderKnowledge() {
  const el = document.getElementById('knowledge-entries');
  if (!el) return;
  if (!_knowledgeEntries.length) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">' + t('no_entries') + '</div>';
    return;
  }
  el.innerHTML = _knowledgeEntries.map((entry, i) => `
    <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border-subtle);display:flex;gap:.75rem;align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;margin-bottom:.25rem">${escHtml(entry.title || 'Entry ' + (i+1))}</div>
        <div style="color:var(--text-muted);font-size:.83rem;white-space:pre-wrap;max-height:60px;overflow:hidden">${escHtml((entry.content || '').slice(0, 200))}</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="flex-shrink:0;color:#dc3545" onclick="deleteKnowledgeEntry(${i})">✕</button>
    </div>`).join('');
}

function showAddKnowledge() {
  const form = document.getElementById('knowledge-add-form');
  if (form) {
    form.style.display = 'block';
    const titleEl = document.getElementById('kb-title');
    if (titleEl) titleEl.focus();
  }
}

async function saveKnowledgeEntry() {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const title = (document.getElementById('kb-title') || {}).value?.trim();
  const content = (document.getElementById('kb-content') || {}).value?.trim();
  if (!title || !content) {
    showNotification(t('fill_fields'), 'error');
    return;
  }

  _knowledgeEntries.push({ title, content, createdAt: new Date().toISOString() });
  const data = await apiRequest('POST', '/api/settings', { settings: { knowledge_base: _knowledgeEntries } });
  if (data.ok) {
    document.getElementById('kb-title').value = '';
    document.getElementById('kb-content').value = '';
    document.getElementById('knowledge-add-form').style.display = 'none';
    renderKnowledge();
    showNotification(t('entry_added'), 'success');
  } else {
    _knowledgeEntries.pop();
    showNotification(data.error || 'Error', 'error');
  }
}

async function deleteKnowledgeEntry(idx) {
  if (!authToken) return;
  _knowledgeEntries.splice(idx, 1);
  const data = await apiRequest('POST', '/api/settings', { settings: { knowledge_base: _knowledgeEntries } });
  if (data.ok) {
    renderKnowledge();
    showNotification(t('entry_deleted'), 'success');
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

// ===== CONNECTORS PAGE =====
let _connectors = {};
let _userVars = {};

async function loadConnectors() {
  const data = await apiRequest('GET', '/api/settings');
  if (!data.ok) return;
  const s = data.settings || {};
  _connectors = s.connectors || {};
  _userVars = s.user_variables || {};

  // Fill connector inputs
  const setConn = (service, field, elId) => {
    const val = (_connectors[service] || {})[field];
    const el = document.getElementById(elId);
    if (el && val) el.value = val;
  };
  setConn('discord', 'webhookUrl', 'discord-webhook');
  setConn('slack', 'webhookUrl', 'slack-webhook');
  setConn('custom_webhook', 'url', 'custom-webhook-url');

  // Update status badges
  const setStatus = (id, connected) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = connected ? t('connected') : t('disconnected');
    el.className = 'credential-status ' + (connected ? 'active' : '');
  };
  setStatus('discord-status', !!(_connectors.discord && _connectors.discord.webhookUrl));
  setStatus('slack-status', !!(_connectors.slack && _connectors.slack.webhookUrl));
  setStatus('custom-webhook-status', !!(_connectors.custom_webhook && _connectors.custom_webhook.url));

  renderVariables();
}

async function saveConnector(service, config) {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const data = await apiRequest('POST', `/api/connectors/${service}`, { config });
  if (data.ok) {
    _connectors[service] = config;
    showNotification(t('connector_saved'), 'success');
    loadConnectors(); // refresh statuses
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

async function removeConnector(service) {
  if (!authToken) return;
  const data = await apiRequest('DELETE', `/api/connectors/${service}`);
  if (data.ok) {
    delete _connectors[service];
    showNotification(t('connector_deleted'), 'success');
    loadConnectors();
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

async function testConnector(service) {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const cfg = _connectors[service] || {};
  const url = cfg.webhookUrl || cfg.url;
  if (!url) { showNotification(t('save_connector_first'), 'error'); return; }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'TON Agent Platform: test connection', username: 'TonAgent' }) });
    if (res.ok) {
      showNotification(t('test_ok'), 'success');
    } else {
      showNotification(`HTTP ${res.status}`, 'error');
    }
  } catch(e) {
    showNotification(e.message, 'error');
  }
}

// ===== MY VARIABLES =====
function renderVariables() {
  const el = document.getElementById('variables-list');
  if (!el) return;
  const entries = Object.entries(_userVars);
  if (!entries.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">' + t('no_variables') + '</div>';
    return;
  }
  el.innerHTML = entries.map(([k, v]) => `
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap">
      <code style="background:var(--bg-tertiary);padding:.2rem .5rem;border-radius:4px;font-size:.83rem;flex-shrink:0">${escHtml(k)}</code>
      <span style="color:var(--text-muted);font-size:.83rem">=</span>
      <span style="flex:1;font-size:.83rem;word-break:break-all">${escHtml(String(v))}</span>
      <button class="btn btn-ghost btn-sm" style="color:#dc3545;flex-shrink:0" onclick="deleteVariable('${escHtml(k)}')">✕</button>
    </div>`).join('');
}

function showAddVariable() {
  const form = document.getElementById('add-variable-form');
  if (form) { form.style.display = 'flex'; document.getElementById('var-key')?.focus(); }
}

async function saveVariable() {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const key = (document.getElementById('var-key')?.value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const val = (document.getElementById('var-value')?.value || '').trim();
  if (!key) { showNotification(t('var_name_required'), 'error'); return; }

  _userVars[key] = val;
  const data = await apiRequest('POST', '/api/settings', { settings: { user_variables: _userVars } });
  if (data.ok) {
    document.getElementById('var-key').value = '';
    document.getElementById('var-value').value = '';
    document.getElementById('add-variable-form').style.display = 'none';
    renderVariables();
    showNotification(t('var_saved'), 'success');
  } else {
    delete _userVars[key];
    showNotification(data.error || 'Error', 'error');
  }
}

async function deleteVariable(key) {
  if (!authToken) return;
  delete _userVars[key];
  const data = await apiRequest('POST', '/api/settings', { settings: { user_variables: _userVars } });
  if (data.ok) {
    renderVariables();
    showNotification(t('var_deleted'), 'success');
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

// ===== PROFILE PAGE =====
async function loadProfile() {
  if (!currentUser) return;
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // User info from auth
  setEl('profile-name', [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.first_name || '—');
  setEl('profile-username', currentUser.username ? '@' + currentUser.username : '—');
  setEl('profile-id', currentUser.userId || currentUser.id || '—');

  // Avatar
  if (currentUser.photo_url) {
    const img = document.getElementById('profile-avatar');
    if (img) { img.src = currentUser.photo_url; img.style.display = 'block'; }
    const fb = document.getElementById('profile-avatar-fallback');
    if (fb) fb.style.display = 'none';
  }

  // Balance + subscription in parallel
  const [balance, sub, stats] = await Promise.all([
    apiRequest('GET', '/api/balance'),
    apiRequest('GET', '/api/subscription'),
    apiRequest('GET', '/api/stats/me'),
  ]);

  // Balance
  if (balance && !balance.error) {
    setEl('profile-balance', (balance.balance_ton ?? 0).toFixed(2) + ' TON');
    setEl('profile-earned', (balance.total_earned ?? 0).toFixed(2) + ' TON');
    setEl('profile-wallet', balance.wallet_address ? balance.wallet_address.slice(0, 8) + '...' + balance.wallet_address.slice(-6) : (currentLang === 'ru' ? 'Не привязан' : 'Not linked'));
  }

  // Subscription
  if (sub && sub.ok) {
    updateSubscriptionUI(sub);
  }

  // Stats
  if (stats && stats.ok) {
    setEl('profile-total-agents', stats.agentsTotal ?? '—');
    setEl('profile-active-agents', stats.agentsActive ?? '—');
    setEl('profile-total-runs', stats.totalRuns ?? '—');
    setEl('profile-success-rate', stats.successRate != null ? stats.successRate + '%' : '—');
  }
}

// ===== SUBSCRIPTION SYNC =====
let _currentSub = null;
let _planPeriod = 'month';

async function loadSubscriptionGlobal() {
  try {
    const sub = await apiRequest('GET', '/api/subscription');
    if (sub && sub.ok) {
      _currentSub = sub;
      updateSidebarPlanBadge(sub);
      updateOverviewUsage(sub);
      updateSubscriptionUI(sub);
    }
  } catch {}
}

function updateOverviewUsage(sub) {
  function setBar(labelId, barId, used, max) {
    var el = document.getElementById(labelId);
    var bar = document.getElementById(barId);
    if (el) el.textContent = used + ' / ' + (max === -1 ? '∞' : max);
    if (bar) {
      if (max === -1) { bar.style.width = '100%'; bar.style.background = 'linear-gradient(90deg,#4ade80,#22d3ee)'; }
      else if (max === 0) bar.style.width = '0%';
      else bar.style.width = Math.min(100, (used / max) * 100) + '%';
    }
  }
  setBar('ov-agents-usage', 'ov-agents-bar', sub.agentsUsed || 0, sub.maxAgents);
  setBar('ov-active-usage', 'ov-active-bar', sub.activeAgentsUsed || 0, sub.maxActiveAgents);
  setBar('ov-gen-usage', 'ov-gen-bar', sub.generationsUsed || 0, sub.generationsPerMonth);
  var badge = document.getElementById('overview-plan-badge');
  if (badge) badge.innerHTML = planIcon(sub.planIcon) + ' ' + (sub.planName || 'Free');
}

function updateSubscriptionUI(sub) {
  _currentSub = sub;
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Plan banner
  var iconEl = document.getElementById('profile-plan-icon');
  if (iconEl) iconEl.innerHTML = planIcon(sub.planIcon);
  setEl('profile-plan-name', sub.planName || 'Free');

  // Expiry
  var expiresEl = document.getElementById('profile-plan-expires');
  if (expiresEl) {
    if (!sub.expiresAt) {
      expiresEl.textContent = sub.planId === 'free' ? '' : (currentLang === 'ru' ? 'Бессрочно' : 'Lifetime');
    } else {
      var days = sub.daysRemaining;
      if (days != null) {
        expiresEl.textContent = (currentLang === 'ru' ? 'Осталось ' + days + ' дн.' : days + ' days left');
        if (days <= 3) expiresEl.style.color = '#ef4444';
        else if (days <= 7) expiresEl.style.color = '#f59e0b';
      }
    }
  }

  // Upgrade button visibility
  var upgradeBtn = document.querySelector('.sub-plan-banner .btn-accent');
  if (upgradeBtn) {
    upgradeBtn.style.display = sub.planId === 'unlimited' ? 'none' : '';
  }

  // Usage bars
  function setUsageBar(labelId, barId, used, max) {
    var labelEl = document.getElementById(labelId);
    var barEl = document.getElementById(barId);
    if (labelEl) {
      var maxStr = max === -1 ? '∞' : max;
      labelEl.textContent = used + ' / ' + maxStr;
    }
    if (barEl) {
      if (max === -1) {
        barEl.style.width = '100%';
        barEl.classList.remove('warning');
      } else if (max === 0) {
        barEl.style.width = '0%';
      } else {
        var pct = Math.min(100, (used / max) * 100);
        barEl.style.width = pct + '%';
        if (pct >= 90) barEl.classList.add('warning');
        else barEl.classList.remove('warning');
      }
    }
  }
  setUsageBar('profile-agents-usage', 'profile-agents-bar', sub.agentsUsed || 0, sub.maxAgents);
  setUsageBar('profile-active-usage', 'profile-active-bar', sub.activeAgentsUsed || 0, sub.maxActiveAgents);
  setUsageBar('profile-gen-usage', 'profile-gen-bar', sub.generationsUsed || 0, sub.generationsPerMonth);

  // Sidebar badge
  updateSidebarPlanBadge(sub);
}

function updateSidebarPlanBadge(sub) {
  var badge = document.getElementById('user-plan-badge');
  if (!badge) return;
  badge.innerHTML = planIcon(sub.planIcon) + ' ' + (sub.planName || 'Free');
  badge.className = 'user-tier plan-badge-' + (sub.planId || 'free');
}

// Plans modal
async function openPlansModal() {
  var modal = document.getElementById('plans-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await renderPlansGrid();
}

function closePlansModal() {
  var modal = document.getElementById('plans-modal');
  if (modal) modal.style.display = 'none';
}

function switchPlanPeriod(period) {
  _planPeriod = period;
  document.getElementById('period-month-btn').classList.toggle('active', period === 'month');
  document.getElementById('period-year-btn').classList.toggle('active', period === 'year');
  renderPlansGrid();
}

async function renderPlansGrid() {
  var grid = document.getElementById('plans-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">Loading...</div>';

  try {
    var data = await apiRequest('GET', '/api/plans');
    if (!data.ok) { grid.innerHTML = '<div style="color:#ef4444">Error loading plans</div>'; return; }

    var html = '';
    data.plans.forEach(function(p) {
      var price = _planPeriod === 'year' ? p.priceYearTon : p.priceMonthTon;
      var periodLabel = _planPeriod === 'year' ? (currentLang === 'ru' ? '/год' : '/year') : (currentLang === 'ru' ? '/мес' : '/mo');
      var isCurrent = p.isCurrent;
      var isPopular = p.id === 'pro';
      var isDowngrade = false;

      // Determine if upgrade/downgrade
      var planOrder = { free: 0, starter: 1, pro: 2, unlimited: 3 };
      var currentOrder = planOrder[data.currentPlanId] || 0;
      var thisOrder = planOrder[p.id] || 0;
      if (thisOrder < currentOrder) isDowngrade = true;

      html += '<div class="plan-card' + (isCurrent ? ' current' : '') + (isPopular ? ' popular' : '') + '">';
      html += '<div class="plan-card-icon">' + planIcon(p.icon) + '</div>';
      html += '<div class="plan-card-name">' + escHtml(p.name) + '</div>';
      html += '<div class="plan-card-price">';
      if (price === 0) {
        html += (currentLang === 'ru' ? 'Бесплатно' : 'Free');
      } else {
        html += price + ' TON <span class="period">' + periodLabel + '</span>';
      }
      html += '</div>';
      html += '<ul class="plan-card-features">';
      p.features.forEach(function(f) { html += '<li>' + escHtml(f) + '</li>'; });
      html += '</ul>';

      if (isCurrent) {
        html += '<button class="plan-card-btn btn-current" disabled>' + (currentLang === 'ru' ? 'Текущий план' : 'Current Plan') + '</button>';
      } else if (p.id === 'free') {
        html += '<button class="plan-card-btn btn-downgrade" disabled>' + (currentLang === 'ru' ? 'Базовый' : 'Basic') + '</button>';
      } else {
        html += '<button class="plan-card-btn btn-upgrade" onclick="buyPlan(\'' + p.id + '\')">' + (currentLang === 'ru' ? 'Выбрать ' : 'Select ') + p.name + '</button>';
      }
      html += '</div>';
    });
    grid.innerHTML = html;
  } catch (e) {
    grid.innerHTML = '<div style="color:#ef4444">Failed to load plans</div>';
  }
}

async function buyPlan(planId) {
  var confirmed = await studioConfirm({
    title: currentLang === 'ru' ? 'Подтвердите оплату' : 'Confirm Payment',
    message: currentLang === 'ru'
      ? 'Оплата будет списана с вашего баланса. Продолжить?'
      : 'Payment will be deducted from your balance. Continue?',
    confirmText: currentLang === 'ru' ? 'Оплатить' : 'Pay Now',
    cancelText: currentLang === 'ru' ? 'Отмена' : 'Cancel',
    type: 'warning',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
  });
  if (!confirmed) return;

  try {
    var data = await apiRequest('POST', '/api/subscription/buy', { planId: planId, period: _planPeriod });
    if (data.ok) {
      showNotification(
        planIcon(data.planIcon) + ' ' + (currentLang === 'ru' ? 'Подписка ' + data.planName + ' активирована!' : data.planName + ' plan activated!'),
        'success'
      );
      closePlansModal();
      // Refresh subscription everywhere
      await loadSubscriptionGlobal();
      // Refresh profile if on that page
      if (document.getElementById('profile-page')?.classList.contains('active')) loadProfile();
      if (document.getElementById('wallet-page')?.classList.contains('active')) loadWalletBalance();
    } else {
      if (data.needTopup) {
        showNotification(
          (currentLang === 'ru' ? 'Недостаточно средств. Нужно ещё ' : 'Insufficient balance. Need ') + data.needTopup.toFixed(2) + ' TON',
          'error'
        );
        closePlansModal();
        navigateTo('wallet');
      } else {
        showNotification(data.error || 'Error', 'error');
      }
    }
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ===== WALLET PAGE =====
let walletData = null;
let walletTxPage = 0;
const WALLET_TX_PER_PAGE = 20;
let walletTxFilter = 'all';
let _tonConnectUI = null;

async function loadWallet() {
  initTonConnect();
  await Promise.all([loadWalletBalance(), loadTransactions()]);
}

async function loadWalletBalance() {
  const data = await apiRequest('GET', '/api/balance');
  if (!data.ok && !data.balance_ton && data.balance_ton !== 0) return;
  walletData = data;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Balance
  const bal = parseFloat(data.balance_ton || 0);
  const balEl = document.getElementById('wallet-balance');
  if (balEl) balEl.innerHTML = bal.toFixed(2) + ' <span class="wallet-currency">TON</span>';

  // Total earned
  const earned = parseFloat(data.total_earned || 0);
  const earnedEl = document.getElementById('wallet-earned');
  if (earnedEl) earnedEl.innerHTML = earned.toFixed(2) + ' <span class="wallet-currency">TON</span>';

  // Platform wallet address (where users send TON for topup)
  const platformAddr = data.platform_wallet || '';
  setEl('wallet-platform-addr', platformAddr || '—');

  // User's linked personal wallet — 2-state UI
  if (data.wallet_address) {
    showConnectedWallet(data.wallet_address, data.wallet_name || '', data.connected_via || 'manual');
  } else {
    showDisconnectedWallet();
  }

  // Setup topup modal
  setupTopupModal(platformAddr);

  // Setup withdraw modal available balance
  const withdrawAvail = document.getElementById('withdraw-available');
  if (withdrawAvail) withdrawAvail.textContent = bal.toFixed(2) + ' TON';
}

async function loadTransactions() {
  const params = new URLSearchParams({
    limit: WALLET_TX_PER_PAGE.toString(),
    offset: (walletTxPage * WALLET_TX_PER_PAGE).toString(),
  });
  if (walletTxFilter !== 'all') params.set('type', walletTxFilter);

  const data = await apiRequest('GET', '/api/transactions?' + params.toString());
  const listEl = document.getElementById('wallet-transactions-list');
  if (!listEl) return;

  const txs = data.transactions || [];
  const total = data.total || 0;

  if (!txs.length) {
    const emptyMsg = currentLang === 'ru' ? 'Нет транзакций' : 'No transactions yet';
    listEl.innerHTML = '<div class="empty-state" style="padding:40px 20px"><p>' + emptyMsg + '</p></div>';
    const pgEl = document.getElementById('wallet-pagination');
    if (pgEl) pgEl.style.display = 'none';
    return;
  }

  const txIcons = { topup: IC.dollar, withdraw: IC.send, spend: IC.fire, earn: IC.gem, refund: IC.refresh };
  const txLabels = {
    en: { topup: 'Top Up', withdraw: 'Withdraw', spend: 'Spend', earn: 'Earned', refund: 'Refund' },
    ru: { topup: 'Пополнение', withdraw: 'Вывод', spend: 'Расход', earn: 'Заработок', refund: 'Возврат' }
  };

  listEl.innerHTML = txs.map(tx => {
    const type = tx.type || 'spend';
    const amount = parseFloat(tx.amount_ton || 0);
    const isPositive = amount > 0;
    const sign = isPositive ? '+' : '';
    const amountClass = isPositive ? 'positive' : 'negative';
    const date = new Date(tx.created_at);
    const dateStr = date.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const label = (txLabels[currentLang] || txLabels.en)[type] || type;
    const desc = tx.description || '';
    const status = tx.status || 'completed';

    return '<div class="wallet-tx-row">' +
      '<div class="wallet-tx-icon ' + type + '">' + (txIcons[type] || IC.clipboard) + '</div>' +
      '<div class="wallet-tx-info">' +
        '<div class="wallet-tx-type">' + label + '</div>' +
        (desc ? '<div class="wallet-tx-desc" title="' + desc.replace(/"/g, '&quot;') + '">' + desc + '</div>' : '') +
      '</div>' +
      '<div class="wallet-tx-amount ' + amountClass + '">' + sign + Math.abs(amount).toFixed(2) + ' TON</div>' +
      '<div class="wallet-tx-meta">' +
        '<span class="wallet-tx-date">' + dateStr + ' ' + timeStr + '</span>' +
        '<span class="wallet-tx-status ' + status + '">' + (status === 'completed' ? IC.check : status === 'pending' ? IC.hourglass : IC.x) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  // Pagination
  const totalPages = Math.ceil(total / WALLET_TX_PER_PAGE);
  const pgEl = document.getElementById('wallet-pagination');
  if (pgEl) {
    pgEl.style.display = totalPages > 1 ? 'flex' : 'none';
    const infoEl = document.getElementById('wallet-page-info');
    if (infoEl) infoEl.textContent = (walletTxPage + 1) + ' / ' + totalPages;
    const prevBtn = document.getElementById('wallet-prev-btn');
    const nextBtn = document.getElementById('wallet-next-btn');
    if (prevBtn) prevBtn.disabled = walletTxPage === 0;
    if (nextBtn) nextBtn.disabled = walletTxPage >= totalPages - 1;
  }
}

function filterTransactions(type) {
  walletTxFilter = type;
  walletTxPage = 0;
  document.querySelectorAll('.wallet-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  loadTransactions().catch(console.error);
}

function walletPrevPage() {
  if (walletTxPage > 0) { walletTxPage--; loadTransactions().catch(console.error); }
}

function walletNextPage() {
  walletTxPage++;
  loadTransactions().catch(console.error);
}

// ===== TOP UP MODAL =====
function setupTopupModal(platformAddr) {
  if (!platformAddr) return;
  const userId = currentUser ? (currentUser.userId || currentUser.id) : '';
  const comment = 'topup:' + userId;

  const addrEl = document.getElementById('topup-address');
  if (addrEl) addrEl.textContent = platformAddr;

  const commentEl = document.getElementById('topup-comment');
  if (commentEl) commentEl.textContent = comment;

  // Deep links (ton:// protocol)
  const amounts = [1, 5, 10];
  amounts.forEach(amt => {
    const linkEl = document.getElementById('topup-deeplink-' + amt);
    if (linkEl) {
      const nanoAmount = BigInt(amt) * BigInt(1e9);
      linkEl.href = 'ton://transfer/' + platformAddr + '?amount=' + nanoAmount.toString() + '&text=' + encodeURIComponent(comment);
    }
  });

  // QR Code
  const qrImg = document.getElementById('topup-qr-img');
  if (qrImg) {
    const qrData = 'ton://transfer/' + platformAddr + '?text=' + encodeURIComponent(comment);
    qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(qrData) + '&bgcolor=ffffff&color=000000';
    qrImg.style.display = 'block';
  }
}

function openTopupModal() {
  const modal = document.getElementById('topup-modal');
  if (modal) modal.style.display = 'flex';
  // Reset result
  const res = document.getElementById('topup-result');
  if (res) { res.style.display = 'none'; res.className = 'topup-result'; }
}

function closeTopupModal() {
  const modal = document.getElementById('topup-modal');
  if (modal) modal.style.display = 'none';
}

function copyTopupAddress() {
  const el = document.getElementById('topup-address');
  if (el) navigator.clipboard.writeText(el.textContent).then(() => showNotification(t('addr_copied'), 'success'));
}

function copyTopupComment() {
  const el = document.getElementById('topup-comment');
  if (el) navigator.clipboard.writeText(el.textContent).then(() => showNotification(t('comment_copied'), 'success'));
}

function copyWalletAddress() {
  const el = document.getElementById('wallet-platform-addr');
  if (el && el.textContent !== '—') {
    navigator.clipboard.writeText(el.textContent).then(() => showNotification(t('addr_copied'), 'success'));
  }
}

function linkWalletPrompt() {
  var current = walletData && walletData.wallet_address ? walletData.wallet_address : '';
  var modal = document.getElementById('wallet-link-modal');
  var input = document.getElementById('wallet-link-input');
  if (input) input.value = current;
  if (modal) modal.style.display = 'flex';
  setTimeout(function() { if (input) input.focus(); }, 100);
}

function closeWalletLinkModal() {
  var modal = document.getElementById('wallet-link-modal');
  if (modal) { modal.classList.add('closing'); setTimeout(function() { modal.style.display = 'none'; modal.classList.remove('closing'); }, 180); }
}

async function submitWalletLink() {
  var input = document.getElementById('wallet-link-input');
  var addr = input ? input.value.trim() : '';
  if (!addr) return;
  if (!addr.startsWith('EQ') && !addr.startsWith('UQ') && !addr.startsWith('0:')) {
    toast(currentLang === 'ru' ? 'Неверный формат адреса' : 'Invalid address format', 'error');
    return;
  }
  closeWalletLinkModal();
  await saveWalletAddress(addr, null, 'manual');
}

async function saveWalletAddress(address, walletName, connectedVia) {
  try {
    const body = { address };
    if (walletName) body.wallet_name = walletName;
    if (connectedVia) body.connected_via = connectedVia;
    const data = await apiRequest('POST', '/api/wallet/link', body);
    if (data.ok) {
      showNotification(currentLang === 'ru' ? 'Кошелёк привязан' : 'Wallet linked', 'success');
      if (walletData) {
        walletData.wallet_address = address;
        walletData.wallet_name = walletName || null;
        walletData.connected_via = connectedVia || 'manual';
      }
      showConnectedWallet(address, walletName || '', connectedVia || 'manual');
    } else {
      showNotification(data.error || t('save_failed'), 'error');
    }
  } catch (e) {
    showNotification(e.message || t('save_failed'), 'error');
  }
}

function showConnectedWallet(address, walletName, connectedVia) {
  const disc = document.getElementById('wallet-disconnected');
  const conn = document.getElementById('wallet-connected');
  if (disc) disc.style.display = 'none';
  if (conn) conn.style.display = 'flex';
  const nameEl = document.getElementById('wallet-connected-name');
  if (nameEl) nameEl.textContent = walletName || (connectedVia === 'tonconnect' ? 'TON Connect' : (currentLang === 'ru' ? 'Кошелёк' : 'Wallet'));
  const addrEl = document.getElementById('wallet-connected-addr');
  if (addrEl) addrEl.textContent = address.slice(0, 6) + '...' + address.slice(-4);
  addrEl && (addrEl.title = address);
}

function showDisconnectedWallet() {
  const disc = document.getElementById('wallet-disconnected');
  const conn = document.getElementById('wallet-connected');
  if (disc) disc.style.display = 'flex';
  if (conn) conn.style.display = 'none';
}

function _rawToFriendly(raw) {
  if (!raw.includes(':')) return raw; // already friendly
  const [wc, hex] = raw.split(':');
  const hash = new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const payload = new Uint8Array(34);
  payload[0] = 0x51; // non-bounceable (UQ)
  payload[1] = parseInt(wc) & 0xff;
  payload.set(hash, 2);
  let crc = 0;
  for (let i = 0; i < 34; i++) { crc ^= payload[i] << 8; for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1; crc &= 0xffff; }
  const full = new Uint8Array(36);
  full.set(payload);
  full[34] = (crc >> 8) & 0xff;
  full[35] = crc & 0xff;
  return btoa(String.fromCharCode(...full)).replace(/\+/g, '-').replace(/\//g, '_');
}

function initTonConnect() {
  if (_tonConnectUI || typeof TON_CONNECT_UI === 'undefined') return;
  try {
    _tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
      manifestUrl: window.location.origin + '/tonconnect-manifest.json',
    });
    _tonConnectUI.onStatusChange(wallet => {
      if (wallet) {
        const addr = wallet.account.address;
        const friendly = _rawToFriendly(addr);
        const appName = wallet.device && wallet.device.appName ? wallet.device.appName : 'TON Connect';
        saveWalletAddress(friendly, appName, 'tonconnect');
      }
    });
  } catch (e) {
    console.warn('TON Connect init failed:', e);
  }
}

async function connectTonWallet() {
  if (!_tonConnectUI) initTonConnect();
  if (!_tonConnectUI) {
    showNotification('TON Connect not available', 'error');
    return;
  }
  try {
    await _tonConnectUI.openModal();
  } catch (e) {
    console.warn('TON Connect modal error:', e);
  }
}

async function disconnectTonWallet() {
  try {
    if (_tonConnectUI && _tonConnectUI.connected) {
      await _tonConnectUI.disconnect();
    }
    await apiRequest('POST', '/api/wallet/disconnect', {});
    if (walletData) {
      walletData.wallet_address = null;
      walletData.wallet_name = null;
      walletData.connected_via = null;
    }
    showDisconnectedWallet();
    showNotification(currentLang === 'ru' ? 'Кошелёк отключён' : 'Wallet disconnected', 'success');
  } catch (e) {
    showNotification(e.message || 'Disconnect failed', 'error');
  }
}

async function checkTopup() {
  const btn = document.getElementById('btn-check-topup');
  const res = document.getElementById('topup-result');
  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = t('checking'); }

  try {
    const data = await apiRequest('POST', '/api/topup/check', {});
    if (res) {
      res.style.display = 'block';
      if (data.credited) {
        res.className = 'topup-result success';
        const creditedAmt = parseFloat(data.credited || data.amount || 0).toFixed(2);
        const newBal = parseFloat(data.balance || data.newBalance || 0).toFixed(2);
        res.textContent = (currentLang === 'ru'
          ? 'Зачислено ' + creditedAmt + ' TON! Баланс: ' + newBal + ' TON'
          : 'Credited ' + creditedAmt + ' TON! Balance: ' + newBal + ' TON');
        // Refresh wallet data
        await loadWalletBalance();
        await loadTransactions();
      } else {
        res.className = 'topup-result error';
        res.textContent = (currentLang === 'ru'
          ? 'Транзакция не найдена. Убедитесь, что отправили TON с правильным комментарием.'
          : 'Transaction not found. Make sure you sent TON with the correct comment.');
      }
    }
  } catch (e) {
    if (res) {
      res.style.display = 'block';
      res.className = 'topup-result error';
      res.textContent = (e.message || 'Error checking transaction');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.querySelector('span').textContent = t('verify_sent');
    }
  }
}

// ===== WITHDRAW MODAL =====
function openWithdrawModal() {
  const modal = document.getElementById('withdraw-modal');
  if (modal) modal.style.display = 'flex';
  // Reset
  const res = document.getElementById('withdraw-result');
  if (res) { res.style.display = 'none'; }
  const err = document.getElementById('withdraw-error');
  if (err) err.style.display = 'none';
  const addrInput = document.getElementById('withdraw-address');
  const amtInput = document.getElementById('withdraw-amount');
  // Pre-fill saved wallet address
  if (addrInput) {
    const savedAddr = walletData && walletData.wallet_address ? walletData.wallet_address : '';
    addrInput.value = savedAddr;
  }
  if (amtInput) amtInput.value = '';
  updateWithdrawReceive();

  // Update available
  if (walletData) {
    const avail = document.getElementById('withdraw-available');
    if (avail) avail.textContent = parseFloat(walletData.balance_ton || 0).toFixed(2) + ' TON';
  }
}

function closeWithdrawModal() {
  const modal = document.getElementById('withdraw-modal');
  if (modal) modal.style.display = 'none';
}

function setMaxWithdraw() {
  if (!walletData) return;
  const bal = parseFloat(walletData.balance_ton || 0);
  const maxAmount = Math.max(0, bal * 0.8 - 0.05); // 80% cap minus fee
  const amtInput = document.getElementById('withdraw-amount');
  if (amtInput) amtInput.value = maxAmount.toFixed(2);
  updateWithdrawReceive();
}

function updateWithdrawReceive() {
  const amtInput = document.getElementById('withdraw-amount');
  const receiveEl = document.getElementById('withdraw-receive');
  if (!amtInput || !receiveEl) return;
  const amount = parseFloat(amtInput.value) || 0;
  const receive = Math.max(0, amount - 0.05);
  receiveEl.textContent = receive.toFixed(2) + ' TON';
}

// Listen for amount changes
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'withdraw-amount') updateWithdrawReceive();
});

async function submitWithdraw() {
  const addrInput = document.getElementById('withdraw-address');
  const amtInput = document.getElementById('withdraw-amount');
  const errEl = document.getElementById('withdraw-error');
  const resEl = document.getElementById('withdraw-result');
  const btn = document.getElementById('btn-withdraw-submit');

  const address = (addrInput ? addrInput.value : '').trim();
  const amount = parseFloat(amtInput ? amtInput.value : '0');

  // Validate
  if (!address || (!address.startsWith('EQ') && !address.startsWith('UQ') && !address.startsWith('0:'))) {
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = t('invalid_addr'); }
    return;
  }
  if (!amount || amount < 0.1) {
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = t('min_amount'); }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (resEl) resEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = t('sending'); }

  try {
    const data = await apiRequest('POST', '/api/withdraw', { address, amount });
    if (data.ok || data.txHash) {
      if (resEl) {
        resEl.style.display = 'block';
        resEl.className = 'withdraw-result success';
        resEl.textContent = (currentLang === 'ru'
          ? 'Отправлено! TX: ' + (data.txHash || '—').substring(0, 16) + '...'
          : 'Sent! TX: ' + (data.txHash || '—').substring(0, 16) + '...');
      }
      // Save wallet address for future use (syncs with bot)
      saveWalletAddress(address, null, 'manual').catch(() => {});
      // Refresh
      await loadWalletBalance();
      await loadTransactions();
      // Clear form
      if (addrInput) addrInput.value = '';
      if (amtInput) amtInput.value = '';
    } else {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = data.error || (currentLang === 'ru' ? 'Ошибка вывода' : 'Withdraw failed');
      }
    }
  } catch (e) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = (e.message || 'Error');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.querySelector('span').textContent = t('withdraw');
    }
  }
}

// ===== MOBILE SIDEBAR TOGGLE =====
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

// Close sidebar when navigating on mobile
const origNavigateTo = navigateTo;
navigateTo = function(pageName) {
  origNavigateTo(pageName);
  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }
};

// ===== FLOW BUILDER (Visual Agent Constructor) =====
const FLOW_NODE_DEFS = {
  // ── Triggers ──
  timer:          { cat: 'triggers', color: '#f59e0b', icon: '\u25F7',  label: 'Timer',          labelRu: '\u0422\u0430\u0439\u043C\u0435\u0440',        desc: 'Run on interval',             descRu: '\u0417\u0430\u043F\u0443\u0441\u043A \u043F\u043E \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0443',         fields: [
    { key: 'intervalMs', label: 'Interval', labelRu: '\u0418\u043D\u0442\u0435\u0440\u0432\u0430\u043B', type: 'select', options: [{ v: '60000', l: '1 min' }, { v: '300000', l: '5 min' }, { v: '600000', l: '10 min' }, { v: '1800000', l: '30 min' }, { v: '3600000', l: '1 hour' }] },
    { key: 'cron', label: 'Cron', type: 'text', placeholder: '0 9 * * 1-5' }
  ] },
  manual:         { cat: 'triggers', color: '#f59e0b', icon: '\u25B7', label: 'Manual',     labelRu: '\u0412\u0440\u0443\u0447\u043D\u0443\u044E',       desc: 'Start manually',              descRu: '\u0417\u0430\u043F\u0443\u0441\u043A \u0432\u0440\u0443\u0447\u043D\u0443\u044E',          fields: [] },
  webhook:        { cat: 'triggers', color: '#f59e0b', icon: '\u21E5', label: 'Webhook',    labelRu: 'Webhook',         desc: 'Trigger via HTTP',            descRu: '\u0417\u0430\u043F\u0443\u0441\u043A \u0447\u0435\u0440\u0435\u0437 HTTP',          fields: [{ key: 'path', label: 'Path', type: 'text', placeholder: '/my-hook' }] },
  // ── TON ──
  get_balance:    { cat: 'ton',      color: '#3b82f6', icon: '$', label: 'Get Balance', labelRu: '\u0411\u0430\u043B\u0430\u043D\u0441',          desc: 'Check TON balance',           descRu: '\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0431\u0430\u043B\u0430\u043D\u0441 TON',       fields: [{ key: 'address', label: 'Address', type: 'text', placeholder: 'EQ...' }] },
  nft_floor:      { cat: 'ton',      color: '#3b82f6', icon: '\u25C8', label: 'NFT Floor', labelRu: '\u0426\u0435\u043D\u0430 NFT', desc: 'NFT floor price',             descRu: 'Floor \u0446\u0435\u043D\u0430 NFT',            fields: [{ key: 'collection', label: 'Collection', type: 'text', placeholder: 'TON Punks' }] },
  send_ton:       { cat: 'ton',      color: '#3b82f6', icon: '\u2197', label: 'Send TON',   labelRu: '\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C TON',   desc: 'Send TON transaction',        descRu: '\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C TON',           fields: [
    { key: 'address', label: 'To address', labelRu: '\u0410\u0434\u0440\u0435\u0441', type: 'text', placeholder: 'EQ...' },
    { key: 'amount', label: 'Amount', labelRu: '\u0421\u0443\u043C\u043C\u0430', type: 'number', placeholder: '1.0' },
    { key: 'memo', label: 'Memo', type: 'text', placeholder: 'Payment for...' }
  ] },
  // ── Gifts ──
  gift_prices:    { cat: 'gifts',    color: '#a855f7', icon: '\u274B', label: 'Gift Prices', labelRu: '\u0426\u0435\u043D\u044B \u043F\u043E\u0434\u0430\u0440\u043A\u043E\u0432',   desc: 'Gift floor price',            descRu: 'Floor \u0446\u0435\u043D\u0430 \u043F\u043E\u0434\u0430\u0440\u043A\u0430',        fields: [{ key: 'slug', label: 'Gift slug', type: 'text', placeholder: 'gift-name' }] },
  scan_arbitrage: { cat: 'gifts',    color: '#a855f7', icon: '\u2195', label: 'Scan Arbitrage', labelRu: '\u0410\u0440\u0431\u0438\u0442\u0440\u0430\u0436', desc: 'Find arbitrage deals',       descRu: '\u041F\u043E\u0438\u0441\u043A \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436\u0430',          fields: [{ key: 'min_profit_pct', label: 'Min profit %', type: 'number', placeholder: '5' }] },
  gift_floor:     { cat: 'gifts',    color: '#a855f7', icon: '\u25A5', label: 'Gift Floor', labelRu: '\u0426\u0435\u043D\u0430 \u043F\u043E\u0434\u0430\u0440\u043A\u0430',   desc: 'Real-time gift floor',        descRu: '\u0420\u0435\u0430\u043B\u044C\u043D\u0430\u044F \u0446\u0435\u043D\u0430 \u043F\u043E\u0434\u0430\u0440\u043A\u0430',     fields: [{ key: 'gift_name', label: 'Gift name', type: 'text', placeholder: 'Plush Pepe' }] },
  market_overview:{ cat: 'gifts',    color: '#a855f7', icon: '\u25A3', label: 'Market Overview', labelRu: '\u041E\u0431\u0437\u043E\u0440 \u0440\u044B\u043D\u043A\u0430', desc: 'Gift market overview',       descRu: '\u041E\u0431\u0437\u043E\u0440 \u0440\u044B\u043D\u043A\u0430 \u043F\u043E\u0434\u0430\u0440\u043A\u043E\u0432',   fields: [] },
  // ── Web ──
  web_search:     { cat: 'web',      color: '#06b6d4', icon: '\u25CE', label: 'Web Search', labelRu: '\u041F\u043E\u0438\u0441\u043A',            desc: 'Search the web',              descRu: '\u041F\u043E\u0438\u0441\u043A \u0432 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442\u0435',        fields: [
    { key: 'query', label: 'Query', labelRu: '\u0417\u0430\u043F\u0440\u043E\u0441', type: 'text', placeholder: 'Search...' },
    { key: 'save_to', label: 'Save to variable', labelRu: '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432', type: 'text', placeholder: 'search_result' }
  ] },
  fetch_url:      { cat: 'web',      color: '#06b6d4', icon: '\u25C9', label: 'Fetch URL',  labelRu: '\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C URL',    desc: 'HTTP GET request',            descRu: 'HTTP GET \u0437\u0430\u043F\u0440\u043E\u0441',            fields: [{ key: 'url', label: 'URL', type: 'text', placeholder: 'https://...' }] },
  http_request:   { cat: 'web',      color: '#06b6d4', icon: '\u21C4', label: 'HTTP Request', labelRu: 'HTTP \u0437\u0430\u043F\u0440\u043E\u0441',   desc: 'Custom HTTP request',         descRu: '\u041F\u0440\u043E\u0438\u0437\u0432\u043E\u043B\u044C\u043D\u044B\u0439 HTTP \u0437\u0430\u043F\u0440\u043E\u0441',   fields: [
    { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...' },
    { key: 'method', label: 'Method', labelRu: '\u041C\u0435\u0442\u043E\u0434', type: 'select', options: [{ v: 'GET', l: 'GET' }, { v: 'POST', l: 'POST' }, { v: 'PUT', l: 'PUT' }, { v: 'DELETE', l: 'DELETE' }] },
    { key: 'headers', label: 'Headers', labelRu: '\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0438', type: 'textarea', placeholder: '{"Authorization":"Bearer ..."}' },
    { key: 'body', label: 'Body', labelRu: '\u0422\u0435\u043B\u043E', type: 'textarea', placeholder: '{"key":"value"}', showWhen: { key: 'method', value: 'POST' } },
    { key: 'save_to', label: 'Save to variable', labelRu: '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432', type: 'text', placeholder: 'response_data' }
  ] },
  // ── Telegram ──
  send_message:   { cat: 'telegram', color: '#0ea5e9', icon: '\u2709', label: 'TG Message', labelRu: '\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 TG',    desc: 'Send Telegram message',       descRu: '\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435',      fields: [{ key: 'peer', label: 'Chat/User', type: 'text', placeholder: '@username' }, { key: 'text', label: 'Text', type: 'textarea', placeholder: '{{result}} \u2014 use for prev step data' }] },
  tg_read:        { cat: 'telegram', color: '#0ea5e9', icon: '\u2199', label: 'Read Messages', labelRu: '\u0427\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F', desc: 'Read chat messages', descRu: '\u0427\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0447\u0430\u0442\u0430', fields: [{ key: 'peer', label: 'Chat', type: 'text', placeholder: '@channel' }, { key: 'limit', label: 'Limit', type: 'number', placeholder: '10' }] },
  tg_react:       { cat: 'telegram', color: '#0ea5e9', icon: '\u2661', label: 'Reaction',   labelRu: '\u0420\u0435\u0430\u043A\u0446\u0438\u044F',         desc: 'Add reaction to message',     descRu: '\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0440\u0435\u0430\u043A\u0446\u0438\u044E',         fields: [{ key: 'peer', label: 'Chat', type: 'text', placeholder: '@channel' }, { key: 'emoji', label: 'Emoji', type: 'text', placeholder: '+1' }] },
  tg_forward:     { cat: 'telegram', color: '#0ea5e9', icon: '\u2934', label: 'Forward',    labelRu: '\u041F\u0435\u0440\u0435\u0441\u043B\u0430\u0442\u044C',       desc: 'Forward message',             descRu: '\u041F\u0435\u0440\u0435\u0441\u043B\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435',       fields: [{ key: 'from_peer', label: 'From chat', type: 'text', placeholder: '@source' }, { key: 'to_peer', label: 'To chat', type: 'text', placeholder: '@target' }] },
  // ── Output ──
  notify:         { cat: 'output',   color: '#10b981', icon: '\u266A', label: 'Notify',     labelRu: '\u0423\u0432\u0435\u0434\u043E\u043C\u0438\u0442\u044C',       desc: 'Send notification',           descRu: '\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435',     fields: [
    { key: 'message', label: 'Message', labelRu: '\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435', type: 'textarea', placeholder: '{{result}} \u2014 use for prev step data' },
    { key: 'format', label: 'Format', labelRu: '\u0424\u043E\u0440\u043C\u0430\u0442', type: 'select', options: [{v:'text',l:'Text'},{v:'html',l:'HTML'}] }
  ] },
  notify_rich:    { cat: 'output',   color: '#10b981', icon: '\u25A4', label: 'Rich Notify', labelRu: 'HTML \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435', desc: 'HTML notification',  descRu: 'HTML \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435',     fields: [{ key: 'message', label: 'HTML Message', type: 'textarea', placeholder: '<b>Alert</b>' }] },
  // ── Logic ──
  condition:      { cat: 'logic',    color: '#f43f5e', icon: '\u25C7', label: 'Condition',  labelRu: '\u0423\u0441\u043B\u043E\u0432\u0438\u0435',        desc: 'If/else branch',              descRu: '\u0412\u0435\u0442\u0432\u043B\u0435\u043D\u0438\u0435 \u0435\u0441\u043B\u0438/\u0438\u043D\u0430\u0447\u0435',       fields: [
    { type: 'row', children: [
      { key: 'left', label: 'A', type: 'text', placeholder: 'minFloor / balance' },
      { key: 'operator', label: 'Op', type: 'select', options: [{v:'==',l:'=='},{v:'!=',l:'!='},{v:'>',l:'>'},{v:'<',l:'<'},{v:'>=',l:'>='},{v:'<=',l:'<='},{v:'contains',l:'\u2283'},{v:'is_empty',l:'\u2205'}] },
      { key: 'right', label: 'B', type: 'text', placeholder: '10' }
    ]},
    { key: 'expression', label: 'Free expression', labelRu: '\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435', type: 'text', placeholder: '{{result.minFloor}} > 0' }
  ], extraPorts: ['true', 'false'] },
  delay:          { cat: 'logic',    color: '#f43f5e', icon: '\u25F4',  label: 'Delay',          labelRu: '\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430',        desc: 'Wait before next step',       descRu: '\u041F\u0430\u0443\u0437\u0430 \u043F\u0435\u0440\u0435\u0434 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u043C \u0448\u0430\u0433\u043E\u043C',   fields: [
    { type: 'row', children: [
      { key: 'delay_amount', label: 'Wait', labelRu: '\u0416\u0434\u0430\u0442\u044C', type: 'number', placeholder: '5' },
      { key: 'delay_unit', label: 'Unit', labelRu: '\u0415\u0434.', type: 'select', options: [{v:'ms',l:'ms'},{v:'s',l:'sec'},{v:'min',l:'min'},{v:'h',l:'hour'}] }
    ]}
  ] },
  list_agents:    { cat: 'logic',    color: '#f43f5e', icon: '\u25CF', label: 'List Agents', labelRu: '\u0421\u043F\u0438\u0441\u043E\u043A \u0430\u0433\u0435\u043D\u0442\u043E\u0432', desc: 'List your agents', descRu: '\u0421\u043F\u0438\u0441\u043E\u043A \u0432\u0430\u0448\u0438\u0445 \u0430\u0433\u0435\u043D\u0442\u043E\u0432', fields: [] },
  ask_agent:      { cat: 'logic',    color: '#f43f5e', icon: '\u25C8', label: 'Ask Agent',  labelRu: '\u0421\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0430\u0433\u0435\u043D\u0442\u0430', desc: 'Ask another agent',  descRu: '\u0421\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0430\u0433\u0435\u043D\u0442\u0430', fields: [{ key: 'agent_id', label: 'Agent ID', type: 'number', placeholder: '123' }, { key: 'message', label: 'Message', type: 'textarea', placeholder: 'What is...' }] },
  loop:           { cat: 'logic',    color: '#f43f5e', icon: '\u21BB', label: 'Loop',       labelRu: '\u0426\u0438\u043A\u043B',            desc: 'Repeat actions',              descRu: '\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F',       fields: [
    { key: 'mode', label: 'Mode', labelRu: '\u0420\u0435\u0436\u0438\u043C', type: 'select', options: [{v:'repeat_n',l:'Repeat N'},{v:'while',l:'While'},{v:'for_each',l:'For Each'}] },
    { key: 'count', label: 'Count', labelRu: '\u041A\u043E\u043B-\u0432\u043E', type: 'number', placeholder: '5', showWhen: {key:'mode',value:'repeat_n'} },
    { key: 'while_cond', label: 'While condition', labelRu: '\u041F\u043E\u043A\u0430 \u0443\u0441\u043B\u043E\u0432\u0438\u0435', type: 'text', placeholder: 'balance > 0', showWhen: {key:'mode',value:'while'} },
    { key: 'list_var', label: 'List variable', labelRu: '\u041F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u0441\u043F\u0438\u0441\u043A\u0430', type: 'text', placeholder: 'items', showWhen: {key:'mode',value:'for_each'} },
    { key: 'item_var', label: 'Item variable', labelRu: '\u041F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430', type: 'text', placeholder: 'item', showWhen: {key:'mode',value:'for_each'} },
    { key: 'max_iter', label: 'Max iterations', labelRu: '\u041C\u0430\u043A\u0441. \u0438\u0442\u0435\u0440\u0430\u0446\u0438\u0439', type: 'number', placeholder: '100' }
  ], extraPorts: ['loop', 'done'] },
  group_ref:      { cat: 'logic',    color: '#64748b', icon: '\u25A1', label: 'Function',   labelRu: '\u0424\u0443\u043D\u043A\u0446\u0438\u044F',        desc: 'Call function group',         descRu: '\u0412\u044B\u0437\u0432\u0430\u0442\u044C \u0444\u0443\u043D\u043A\u0446\u0438\u044E',       fields: [
    { key: 'group_id', label: 'Function', labelRu: '\u0424\u0443\u043D\u043A\u0446\u0438\u044F', type: 'select', options: [] }
  ] },
  // ── State ──
  get_state:      { cat: 'state',    color: '#8b5cf6', icon: '\u2193', label: 'Get State',  labelRu: '\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C',       desc: 'Read saved value',            descRu: '\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435',        fields: [{ key: 'key', label: 'Key', type: 'text', placeholder: 'my_key' }] },
  set_state:      { cat: 'state',    color: '#8b5cf6', icon: '\u2191', label: 'Set State',  labelRu: '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C',      desc: 'Save value',                  descRu: '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435',       fields: [{ key: 'key', label: 'Key', type: 'text', placeholder: 'my_key' }, { key: 'value', label: 'Value', type: 'text', placeholder: '...' }] },
};

const NODE_W = 180, NODE_H = 56, PORT_R = 6;
let _flowNodes = [], _flowEdges = [], _flowSelectedId = null;
let _flowDragNode = null, _flowDragOffset = { dx: 0, dy: 0 };
let _flowConnecting = null; // { fromId, fromPort, mx, my }
let _flowMouse = { x: 0, y: 0 };
let _flowAnimId = null;
let _flowCanvas = null, _flowCtx = null;
let _flowNextId = 1;
let _flowParticles = [];
let _flowMultiSelected = new Set();
let _flowSelectedEdge = null; // index in _flowEdges or null
let _flowGroups = []; // [{id, name, nodeIds[], collapsed}]
let _flowGroupNextId = 1;

// Zoom & Pan
let _flowZoom = 1;
let _flowPanX = 0, _flowPanY = 0;
let _flowPanning = false, _flowPanStart = { x: 0, y: 0 };
let _flowSpaceHeld = false;

// Undo/Redo history
let _flowHistory = [];     // [{nodes, edges}]
let _flowHistoryIdx = -1;
const _flowHistoryMax = 50;

function flowPushState() {
  // Trim future entries when we branch off
  _flowHistory = _flowHistory.slice(0, _flowHistoryIdx + 1);
  _flowHistory.push({
    nodes: JSON.parse(JSON.stringify(_flowNodes)),
    edges: JSON.parse(JSON.stringify(_flowEdges)),
  });
  if (_flowHistory.length > _flowHistoryMax) _flowHistory.shift();
  _flowHistoryIdx = _flowHistory.length - 1;
  updateUndoRedoButtons();
}

function flowUndo() {
  if (_flowHistoryIdx <= 0) return;
  _flowHistoryIdx--;
  const snap = _flowHistory[_flowHistoryIdx];
  _flowNodes = JSON.parse(JSON.stringify(snap.nodes));
  _flowEdges = JSON.parse(JSON.stringify(snap.edges));
  // Restore defs
  _flowNodes.forEach(n => { n.def = FLOW_NODE_DEFS[n.type]; });
  _flowSelectedId = null;
  _flowParticles = [];
  renderFlowConfig();
  updateUndoRedoButtons();
}

function flowRedo() {
  if (_flowHistoryIdx >= _flowHistory.length - 1) return;
  _flowHistoryIdx++;
  const snap = _flowHistory[_flowHistoryIdx];
  _flowNodes = JSON.parse(JSON.stringify(snap.nodes));
  _flowEdges = JSON.parse(JSON.stringify(snap.edges));
  _flowNodes.forEach(n => { n.def = FLOW_NODE_DEFS[n.type]; });
  _flowSelectedId = null;
  _flowParticles = [];
  renderFlowConfig();
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('flow-undo-btn');
  const redoBtn = document.getElementById('flow-redo-btn');
  if (undoBtn) undoBtn.disabled = _flowHistoryIdx <= 0;
  if (redoBtn) redoBtn.disabled = _flowHistoryIdx >= _flowHistory.length - 1;
}

function togglePaletteCat(headerEl) {
  headerEl.parentElement.classList.toggle('collapsed');
}

const PALETTE_CAT_META = {
  triggers: { color: '#f59e0b', en: 'Triggers',       ru: '\u0422\u0440\u0438\u0433\u0433\u0435\u0440\u044B' },
  ton:      { color: '#3b82f6', en: 'TON Blockchain',  ru: 'TON \u0411\u043B\u043E\u043A\u0447\u0435\u0439\u043D' },
  gifts:    { color: '#a855f7', en: 'Gifts',           ru: '\u041F\u043E\u0434\u0430\u0440\u043A\u0438' },
  web:      { color: '#06b6d4', en: 'Web',             ru: '\u0412\u0435\u0431' },
  telegram: { color: '#0ea5e9', en: 'Telegram',        ru: 'Telegram' },
  output:   { color: '#10b981', en: 'Output',          ru: '\u0412\u044B\u0432\u043E\u0434' },
  logic:    { color: '#f43f5e', en: 'Logic',           ru: '\u041B\u043E\u0433\u0438\u043A\u0430' },
  state:    { color: '#8b5cf6', en: 'State',           ru: '\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435' },
};

function buildFlowPalette() {
  const container = document.getElementById('flow-palette-content');
  if (!container) return;
  const ru = currentLang === 'ru';

  // Group nodes by category
  const groups = {};
  for (const [type, def] of Object.entries(FLOW_NODE_DEFS)) {
    const cat = def.cat;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ type, def });
  }

  let html = '';

  // Builder instructions panel
  html += '<div class="palette-help palette-category collapsed">';
  html += '<div class="palette-cat-header" onclick="togglePaletteCat(this)" style="border-bottom:1px solid rgba(255,255,255,0.06)">';
  html += '<span class="cat-dot" style="background:#60a5fa"></span>';
  html += '<span>' + (ru ? '📖 Инструкция' : '📖 Guide') + '</span>';
  html += '<svg class="cat-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  html += '</div>';
  html += '<div class="palette-nodes" style="padding:8px 12px;font-size:0.72rem;color:var(--text-secondary);line-height:1.5">';
  html += ru
    ? '<p style="margin:0 0 6px"><b>Как создать агента:</b></p>' +
      '<p style="margin:0 0 4px">1. Перетащите <b>Триггер</b> (Таймер/Webhook) на канвас</p>' +
      '<p style="margin:0 0 4px">2. Добавьте <b>действия</b> (TON, Подарки, Веб)</p>' +
      '<p style="margin:0 0 4px">3. Используйте <b>Условие</b> для ветвления логики</p>' +
      '<p style="margin:0 0 4px">4. Завершите <b>Уведомлением</b> для отправки результатов</p>' +
      '<p style="margin:0 0 4px">5. Нажмите <b>Запуск</b> для деплоя</p>' +
      '<p style="margin:6px 0 0;color:var(--text-muted)">💡 <b>Подсказки:</b> Наведите на ноду чтобы увидеть описание. Используйте <code>{{result}}</code> для передачи данных между шагами. <a href="https://tonagentplatform.com" style="color:var(--primary)" target="_blank">Документация</a></p>'
    : '<p style="margin:0 0 6px"><b>How to build an agent:</b></p>' +
      '<p style="margin:0 0 4px">1. Drag a <b>Trigger</b> (Timer/Webhook) onto canvas</p>' +
      '<p style="margin:0 0 4px">2. Add <b>actions</b> (TON, Gifts, Web)</p>' +
      '<p style="margin:0 0 4px">3. Use <b>Condition</b> for logic branching</p>' +
      '<p style="margin:0 0 4px">4. End with <b>Notify</b> to send results</p>' +
      '<p style="margin:0 0 4px">5. Click <b>Deploy</b> to launch</p>' +
      '<p style="margin:6px 0 0;color:var(--text-muted)">💡 <b>Tips:</b> Hover nodes for descriptions. Use <code>{{result}}</code> to pass data between steps. <a href="https://tonagentplatform.com" style="color:var(--primary)" target="_blank">Docs</a></p>';
  html += '</div></div>';

  const catOrder = ['triggers', 'ton', 'gifts', 'web', 'telegram', 'output', 'logic', 'state'];
  for (const cat of catOrder) {
    const nodes = groups[cat];
    if (!nodes || !nodes.length) continue;
    const meta = PALETTE_CAT_META[cat] || { color: '#888', en: cat, ru: cat };
    html += '<div class="palette-category" data-cat="' + cat + '">';
    html += '<div class="palette-cat-header" onclick="togglePaletteCat(this)">';
    html += '<span class="cat-dot" style="background:' + meta.color + '"></span>';
    html += '<span>' + (ru ? meta.ru : meta.en) + '</span>';
    html += '<svg class="cat-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    html += '</div>';
    html += '<div class="palette-nodes">';
    for (const { type, def } of nodes) {
      const label = (ru && def.labelRu) ? def.labelRu : def.label;
      const desc = (ru && def.descRu) ? def.descRu : (def.desc || '');
      html += '<div class="palette-node" data-type="' + type + '" onclick="addFlowNode(\'' + type + '\')" title="' + desc + '">';
      html += '<span class="pn-icon">' + def.icon + '</span>';
      html += '<span class="pn-label">' + label + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
  // Attach drag handlers to palette nodes
  initPaletteDrag();
}

// ── Palette drag-and-drop to canvas ─────────────────────────────────────────
let _paletteDragGhost = null;
let _paletteDragType = null;
let _paletteDragSource = null;

function initPaletteDrag() {
  const nodes = document.querySelectorAll('.palette-node[data-type]');
  nodes.forEach(el => {
    el.addEventListener('mousedown', onPaletteDragStart);
    el.addEventListener('touchstart', onPaletteDragStart, { passive: false });
  });
}

function onPaletteDragStart(e) {
  if (e.button && e.button !== 0) return; // only left click
  e.preventDefault();
  const el = e.currentTarget;
  _paletteDragType = el.getAttribute('data-type');
  _paletteDragSource = el;
  el.classList.add('dragging-source');

  const def = FLOW_NODE_DEFS[_paletteDragType];
  if (!def) return;

  // Create ghost
  const ghost = document.createElement('div');
  ghost.className = 'palette-drag-ghost';
  ghost.innerHTML = '<span class="pn-icon">' + def.icon + '</span><span>' + ((currentLang === 'ru' && def.labelRu) ? def.labelRu : def.label) + '</span>';
  document.body.appendChild(ghost);
  _paletteDragGhost = ghost;

  const pos = e.touches ? e.touches[0] : e;
  ghost.style.left = pos.clientX + 'px';
  ghost.style.top = pos.clientY + 'px';

  document.addEventListener('mousemove', onPaletteDragMove);
  document.addEventListener('touchmove', onPaletteDragMove, { passive: false });
  document.addEventListener('mouseup', onPaletteDragEnd);
  document.addEventListener('touchend', onPaletteDragEnd);

  const canvas = document.getElementById('flow-canvas');
  if (canvas) canvas.classList.add('drop-active');
}

function onPaletteDragMove(e) {
  if (!_paletteDragGhost) return;
  e.preventDefault();
  const pos = e.touches ? e.touches[0] : e;
  _paletteDragGhost.style.left = pos.clientX + 'px';
  _paletteDragGhost.style.top = pos.clientY + 'px';
}

function onPaletteDragEnd(e) {
  document.removeEventListener('mousemove', onPaletteDragMove);
  document.removeEventListener('touchmove', onPaletteDragMove);
  document.removeEventListener('mouseup', onPaletteDragEnd);
  document.removeEventListener('touchend', onPaletteDragEnd);

  const canvas = document.getElementById('flow-canvas');
  if (canvas) canvas.classList.remove('drop-active');

  if (_paletteDragSource) {
    _paletteDragSource.classList.remove('dragging-source');
    _paletteDragSource = null;
  }

  if (_paletteDragGhost && _paletteDragType) {
    const pos = e.changedTouches ? e.changedTouches[0] : e;
    const canvasRect = canvas ? canvas.getBoundingClientRect() : null;

    // Check if dropped on canvas
    if (canvasRect && pos.clientX >= canvasRect.left && pos.clientX <= canvasRect.right &&
        pos.clientY >= canvasRect.top && pos.clientY <= canvasRect.bottom) {
      // Convert screen coords to world coords
      const wx = (pos.clientX - canvasRect.left - _flowPanX) / _flowZoom;
      const wy = (pos.clientY - canvasRect.top - _flowPanY) / _flowZoom;
      addFlowNodeAt(_paletteDragType, Math.round(wx / 30) * 30, Math.round(wy / 30) * 30);
    }

    // Animate ghost out
    _paletteDragGhost.style.transition = 'opacity 0.2s, transform 0.2s';
    _paletteDragGhost.style.opacity = '0';
    _paletteDragGhost.style.transform = 'translate(-50%, -50%) scale(0.5)';
    setTimeout(() => { if (_paletteDragGhost) { _paletteDragGhost.remove(); _paletteDragGhost = null; } }, 200);
  }
  _paletteDragType = null;
}

function addFlowNodeAt(type, wx, wy) {
  const def = FLOW_NODE_DEFS[type];
  if (!def) return;
  const id = 'n' + (_flowNextId++);
  const newNode = { id, type, x: wx, y: wy, config: {}, def };
  _flowNodes.push(newNode);
  _flowSelectedId = id;
  renderFlowConfig();
  flowPushState();
}

function addFlowNode(type) {
  const def = FLOW_NODE_DEFS[type];
  if (!def) return;
  const id = 'n' + (_flowNextId++);

  // EV3-style: if a node is selected, place new node to its right and auto-connect
  let wx, wy;
  const prevNode = _flowSelectedId ? getFlowNode(_flowSelectedId) : null;
  if (prevNode && def.cat !== 'triggers') {
    wx = prevNode.x + NODE_W + 40;
    wy = prevNode.y;
    // Snap to grid
    wx = Math.round(wx / 30) * 30;
    wy = Math.round(wy / 30) * 30;
  } else {
    // Place in center of visible area (world coords)
    const cx = _flowCanvas ? _flowCanvas.parentElement.clientWidth : 800;
    const cy = _flowCanvas ? _flowCanvas.parentElement.clientHeight : 500;
    wx = (cx / 2 - _flowPanX) / _flowZoom + (Math.random() - 0.5) * 60;
    wy = (cy / 2 - _flowPanY) / _flowZoom + (Math.random() - 0.5) * 40;
    wx = Math.round(wx / 30) * 30;
    wy = Math.round(wy / 30) * 30;
  }

  const newNode = { id, type, x: wx, y: wy, config: {}, def };
  _flowNodes.push(newNode);

  // Auto-connect from previous selected node
  if (prevNode && def.cat !== 'triggers') {
    const prevDef = prevNode.def;
    const fromPort = (prevDef.extraPorts && prevDef.extraPorts.length) ? prevDef.extraPorts[0] : 'out';
    const exists = _flowEdges.some(e => e.from === prevNode.id && e.fromPort === fromPort && e.to === id);
    if (!exists) {
      _flowEdges.push({ from: prevNode.id, fromPort: fromPort, to: id, toPort: 'in' });
      _flowParticles.push({ from: prevNode.id, fromPort: fromPort, to: id, t: 0, speed: 0.004 + Math.random() * 0.004 });
    }
  }

  _flowSelectedId = id;
  flowPushState();
  renderFlowConfig();
}

function deleteFlowNode(id) {
  _flowNodes = _flowNodes.filter(n => n.id !== id);
  _flowEdges = _flowEdges.filter(e => e.from !== id && e.to !== id);
  _flowParticles = _flowParticles.filter(p => p.from !== id && p.to !== id);
  flowPushState();
  if (_flowSelectedId === id) { _flowSelectedId = null; renderFlowConfig(); }
}

function deleteFlowEdge(idx) {
  if (idx < 0 || idx >= _flowEdges.length) return;
  const edge = _flowEdges[idx];
  _flowEdges.splice(idx, 1);
  _flowParticles = _flowParticles.filter(p =>
    !(p.from === edge.from && p.to === edge.to && p.fromPort === edge.fromPort)
  );
  _flowSelectedEdge = null;
  flowPushState();
  showFlowToast(currentLang === 'ru' ? 'Связь удалена' : 'Connection removed', 'success');
}

function hitTestEdge(mx, my, threshold) {
  threshold = threshold || 8;
  for (let idx = 0; idx < _flowEdges.length; idx++) {
    const edge = _flowEdges[idx];
    const fromNode = getFlowNode(edge.from);
    const toNode = getFlowNode(edge.to);
    if (!fromNode || !toNode) continue;
    const from = getPortPos(fromNode, edge.fromPort);
    const to = getPortPos(toNode, edge.toPort || 'in');
    const isBackward = to.x < from.x - 20;
    let cp1x, cp1y, cp2x, cp2y;
    if (isBackward) {
      const midY = Math.max(from.y, to.y) + 80;
      cp1x = from.x + 40; cp1y = midY;
      cp2x = to.x - 40;   cp2y = midY;
    } else {
      const cpOff = Math.max(60, Math.abs(to.x - from.x) * 0.4);
      cp1x = from.x + cpOff; cp1y = from.y;
      cp2x = to.x - cpOff;   cp2y = to.y;
    }
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const it = 1 - t;
      const px = it*it*it*from.x + 3*it*it*t*cp1x + 3*it*t*t*cp2x + t*t*t*to.x;
      const py = it*it*it*from.y + 3*it*it*t*cp1y + 3*it*t*t*cp2y + t*t*t*to.y;
      const dx = mx - px, dy = my - py;
      if (dx*dx + dy*dy < threshold*threshold) return idx;
    }
  }
  return -1;
}

function getFlowNode(id) { return _flowNodes.find(n => n.id === id); }

// Port positions
function getPortPos(node, port) {
  const x = node.x, y = node.y;
  if (port === 'in') return { x: x, y: y + NODE_H / 2 };
  if (port === 'out') return { x: x + NODE_W, y: y + NODE_H / 2 };
  if (port === 'true') return { x: x + NODE_W, y: y + NODE_H / 3 };
  if (port === 'false') return { x: x + NODE_W, y: y + NODE_H * 2 / 3 };
  if (port === 'loop') return { x: x + NODE_W, y: y + NODE_H / 3 };
  if (port === 'done') return { x: x + NODE_W, y: y + NODE_H * 2 / 3 };
  return { x: x + NODE_W, y: y + NODE_H / 2 };
}

function hitTestPort(node, mx, my) {
  const ports = ['in', 'out'];
  if (node.def.extraPorts) ports.push(...node.def.extraPorts);
  for (const p of ports) {
    const pos = getPortPos(node, p);
    const dx = mx - pos.x, dy = my - pos.y;
    if (dx * dx + dy * dy < (PORT_R + 4) * (PORT_R + 4)) return p;
  }
  return null;
}

function hitTestNode(mx, my) {
  for (let i = _flowNodes.length - 1; i >= 0; i--) {
    const n = _flowNodes[i];
    if (mx >= n.x && mx <= n.x + NODE_W && my >= n.y && my <= n.y + NODE_H) return n;
  }
  return null;
}

// Render config panel
function renderFlowConfig() {
  const body = document.getElementById('flow-config-body');
  if (!body) return;
  if (!_flowSelectedId) {
    body.innerHTML = '<p class="flow-config-empty">' + t('no_node_selected') + '</p>';
    return;
  }
  const node = getFlowNode(_flowSelectedId);
  if (!node) { body.innerHTML = ''; return; }
  const def = node.def;
  const cfgLabel = (currentLang === 'ru' && def.labelRu) ? def.labelRu : def.label;
  const cfgDesc = (currentLang === 'ru' && def.descRu) ? def.descRu : (def.desc || '');
  let html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
  html += '<span style="font-size:1.4rem">' + def.icon + '</span>';
  html += '<strong style="font-size:0.95rem">' + cfgLabel + '</strong>';
  html += '<span style="width:10px;height:10px;border-radius:50%;background:' + def.color + ';box-shadow:0 0 6px ' + def.color + '"></span>';
  html += '</div>';
  if (cfgDesc) {
    html += '<div style="font-size:0.8rem;color:rgba(255,255,255,0.4);margin-bottom:16px;">' + cfgDesc + '</div>';
  }

  function renderField(f, nodeId, config) {
    const flabel = (currentLang === 'ru' && f.labelRu) ? f.labelRu : f.label;
    let h = '';
    if (f.type === 'textarea') {
      h += '<textarea data-cfg-key="' + f.key + '" placeholder="' + (f.placeholder || '') + '" oninput="updateFlowNodeConfig(\'' + nodeId + '\',\'' + f.key + '\',this.value)">' + (config[f.key] || '') + '</textarea>';
    } else if (f.type === 'select') {
      h += '<select data-cfg-key="' + f.key + '" onchange="updateFlowNodeConfig(\'' + nodeId + '\',\'' + f.key + '\',this.value)">';
      for (const opt of (f.options || [])) {
        const sel = config[f.key] == opt.v ? ' selected' : '';
        h += '<option value="' + opt.v + '"' + sel + '>' + opt.l + '</option>';
      }
      h += '</select>';
    } else {
      h += '<input type="' + (f.type || 'text') + '" data-cfg-key="' + f.key + '" placeholder="' + (f.placeholder || '') + '" value="' + (config[f.key] || '') + '" oninput="updateFlowNodeConfig(\'' + nodeId + '\',\'' + f.key + '\',this.value)">';
    }
    return h;
  }

  for (const f of def.fields) {
    // showWhen: hide field if condition not met
    if (f.showWhen) {
      const curVal = node.config[f.showWhen.key] || '';
      if (curVal !== f.showWhen.value) continue;
    }
    if (f.type === 'row') {
      html += '<div class="form-group flow-row">';
      for (const child of (f.children || [])) {
        const clabel = (currentLang === 'ru' && child.labelRu) ? child.labelRu : child.label;
        html += '<div class="flow-row-item"><label>' + (clabel || '') + '</label>' + renderField(child, _flowSelectedId, node.config) + '</div>';
      }
      html += '</div>';
    } else {
      const flabel = (currentLang === 'ru' && f.labelRu) ? f.labelRu : f.label;
      html += '<div class="form-group">';
      html += '<label>' + flabel + '</label>';
      html += renderField(f, _flowSelectedId, node.config);
      html += '</div>';
    }
  }
  html += '<button class="btn-delete-node" onclick="deleteFlowNode(\'' + _flowSelectedId + '\')">\u2715 ' + t('delete_node') + '</button>';
  // Multi-select: show "Create Function" button
  if (_flowMultiSelected.size >= 2) {
    const lbl = currentLang === 'ru' ? '\u25A1 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0444\u0443\u043D\u043A\u0446\u0438\u044E' : '\u25A1 Create Function';
    html += '<button class="btn-create-group" onclick="createFlowGroup()" style="width:100%;margin-top:8px;padding:8px;border-radius:8px;background:rgba(100,116,139,0.15);border:1px solid rgba(100,116,139,0.4);color:#94a3b8;cursor:pointer;font-size:0.8rem;font-weight:500;">' + lbl + '</button>';
  }
  body.innerHTML = html;
}

function updateFlowNodeConfig(nodeId, key, value) {
  const node = getFlowNode(nodeId);
  if (!node) return;
  node.config[key] = value;
  // Re-render if this key is referenced by a showWhen
  const def = node.def;
  const hasShowWhen = def.fields.some(f => f.showWhen && f.showWhen.key === key);
  if (hasShowWhen) renderFlowConfig();
}

function createFlowGroup() {
  if (_flowMultiSelected.size < 2) return;
  var modal = document.getElementById('flow-group-modal');
  var input = document.getElementById('flow-group-name-input');
  if (input) input.value = 'Function ' + _flowGroupNextId;
  if (modal) modal.style.display = 'flex';
  setTimeout(function() { if (input) { input.focus(); input.select(); } }, 100);
}

function closeFlowGroupModal() {
  var modal = document.getElementById('flow-group-modal');
  if (modal) modal.style.display = 'none';
}

function submitFlowGroupName() {
  var input = document.getElementById('flow-group-name-input');
  var name = input ? input.value.trim() : '';
  if (!name) return;
  closeFlowGroupModal();
  var nodeIds = [..._flowMultiSelected];
  var group = { id: 'g' + (_flowGroupNextId++), name: name, nodeIds: nodeIds, collapsed: false };
  _flowGroups.push(group);
  _flowMultiSelected.clear();
  updateGroupRefOptions();
  renderFlowConfig();
}

function updateGroupRefOptions() {
  const def = FLOW_NODE_DEFS.group_ref;
  if (def) def.fields[0].options = _flowGroups.map(g => ({ v: g.id, l: g.name }));
}

function toggleFlowGroup(groupId) {
  const g = _flowGroups.find(gr => gr.id === groupId);
  if (g) g.collapsed = !g.collapsed;
}

// Deploy flow with brain convergence animation
let _deployAnimating = false;

async function deployFlow() {
  if (!_flowNodes.length) { showFlowToast(t('deploy_fail') + ': add nodes first', 'error'); return; }
  if (_deployAnimating) return;

  const name = document.getElementById('flow-agent-name')?.value?.trim() || 'Flow Agent';
  const description = document.getElementById('flow-agent-desc')?.value?.trim() || '';
  const flow = { nodes: _flowNodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y, config: n.config })), edges: _flowEdges.map(e => ({ from: e.from, fromPort: e.fromPort, to: e.to, toPort: e.toPort })), groups: _flowGroups };
  const btn = document.getElementById('flow-deploy-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '... ' + t('deploying'); }

  // Run deploy animation
  _deployAnimating = true;
  await runDeployAnimation();

  try {
    const data = await apiRequest('POST', '/api/agents/flow', { name, description, flow });
    if (data.ok) {
      showFlowToast(t('deployed_ok') + ' #' + data.agentId, 'success');
      loadAgents();
    } else {
      showFlowToast((data.error || t('deploy_fail')), 'error');
    }
  } catch (e) {
    showFlowToast(e.message, 'error');
  } finally {
    _deployAnimating = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg> ' + t('deploy'); }
  }
}

function runDeployAnimation() {
  return new Promise(resolve => {
    if (!_flowCanvas || !_flowCtx || !_flowNodes.length) { resolve(); return; }
    const ctx = _flowCtx;
    const wrap = _flowCanvas.parentElement;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const centerX = W / 2, centerY = H / 2;

    // Save original positions
    const origPositions = _flowNodes.map(n => ({ id: n.id, x: n.x, y: n.y }));

    // Compute world-space center accounting for zoom/pan
    const worldCX = (centerX - _flowPanX) / _flowZoom;
    const worldCY = (centerY - _flowPanY) / _flowZoom;

    const duration = 2200; // ms total
    const convergeEnd = 1200; // blocks converge
    const glowStart = 800;
    const textStart = 1400;
    const startTime = performance.now();

    // Particles for sparkle effect
    const sparkles = [];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      sparkles.push({ x: worldCX, y: worldCY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5 + Math.random() * 0.5, born: convergeEnd + Math.random() * 400, r: 2 + Math.random() * 3 });
    }

    // Temporarily stop normal draw
    if (_flowAnimId) { cancelAnimationFrame(_flowAnimId); _flowAnimId = null; }

    function animDeploy() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const convergeT = Math.min(elapsed / convergeEnd, 1);
      const easeConverge = 1 - Math.pow(1 - convergeT, 3); // ease-out cubic

      // Clear
      ctx.clearRect(0, 0, W, H);

      // Background darkens
      const darkFactor = Math.min(t * 1.5, 1);
      ctx.fillStyle = `rgba(5,8,18,${0.85 + darkFactor * 0.15})`;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(_flowPanX, _flowPanY);
      ctx.scale(_flowZoom, _flowZoom);

      // Move nodes toward center
      _flowNodes.forEach((n, i) => {
        const orig = origPositions[i];
        n.x = orig.x + (worldCX - NODE_W / 2 - orig.x) * easeConverge;
        n.y = orig.y + (worldCY - NODE_H / 2 - orig.y) * easeConverge;
      });

      // Draw edges fading
      const edgeAlpha = Math.max(0, 1 - convergeT * 2);
      if (edgeAlpha > 0) {
        _flowEdges.forEach(edge => {
          const fromNode = getFlowNode(edge.from);
          const toNode = getFlowNode(edge.to);
          if (!fromNode || !toNode) return;
          const from = getPortPos(fromNode, edge.fromPort);
          const to = getPortPos(toNode, edge.toPort || 'in');
          ctx.strokeStyle = `rgba(100,180,255,${edgeAlpha * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          const cpOff = Math.max(40, Math.abs(to.x - from.x) * 0.3);
          ctx.bezierCurveTo(from.x + cpOff, from.y, to.x - cpOff, to.y, to.x, to.y);
          ctx.stroke();
        });
      }

      // Draw nodes shrinking & fading
      const nodeAlpha = Math.max(0, 1 - Math.pow(convergeT, 2));
      const nodeScale = 1 - convergeT * 0.7;
      if (nodeAlpha > 0.01) {
        _flowNodes.forEach(n => {
          ctx.save();
          ctx.globalAlpha = nodeAlpha;
          ctx.translate(n.x + NODE_W / 2, n.y + NODE_H / 2);
          ctx.scale(nodeScale, nodeScale);
          ctx.fillStyle = n.def.color + '40';
          ctx.beginPath();
          ctx.roundRect(-NODE_W / 2, -NODE_H / 2, NODE_W, NODE_H, 12);
          ctx.fill();
          ctx.strokeStyle = n.def.color + '88';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Icon
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.fillText(n.def.icon, 0, 0);
          ctx.restore();
        });
      }

      // Central brain glow
      if (elapsed > glowStart) {
        const glowT = Math.min((elapsed - glowStart) / 800, 1);
        const glowEase = 1 - Math.pow(1 - glowT, 2);
        const glowR = 20 + glowEase * 50;
        const pulse = Math.sin(elapsed / 150) * 5;

        // Outer glow rings
        for (let ring = 3; ring > 0; ring--) {
          ctx.beginPath();
          ctx.arc(worldCX, worldCY, glowR + ring * 15 + pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,136,204,${0.03 * glowEase * ring})`;
          ctx.fill();
        }

        // Core glow
        const coreGrad = ctx.createRadialGradient(worldCX, worldCY, 0, worldCX, worldCY, glowR);
        coreGrad.addColorStop(0, `rgba(0,200,255,${0.8 * glowEase})`);
        coreGrad.addColorStop(0.5, `rgba(0,136,204,${0.4 * glowEase})`);
        coreGrad.addColorStop(1, `rgba(0,68,136,0)`);
        ctx.beginPath();
        ctx.arc(worldCX, worldCY, glowR, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Brain emoji
        ctx.font = `${28 + glowEase * 16}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = glowEase;
        ctx.fillText('AI', worldCX, worldCY);
        ctx.globalAlpha = 1;
      }

      // Sparkle particles
      sparkles.forEach(s => {
        if (elapsed < s.born) return;
        const age = (elapsed - s.born) / 1000;
        if (age > s.life) return;
        const alpha = 1 - age / s.life;
        s.x += s.vx; s.y += s.vy;
        s.vx *= 0.97; s.vy *= 0.97;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,200,255,${alpha * 0.8})`;
        ctx.shadowColor = '#00aaff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.restore();

      // Text overlay (screen coords)
      if (elapsed > textStart) {
        const textT = Math.min((elapsed - textStart) / 600, 1);
        const textEase = 1 - Math.pow(1 - textT, 3);
        ctx.save();
        ctx.globalAlpha = textEase;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 24px Inter, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#00aaff';
        ctx.shadowBlur = 20;
        const text = currentLang === 'ru' ? '\u0410\u0433\u0435\u043D\u0442 \u0441\u043E\u0437\u0434\u0430\u043D!' : 'Agent Created!';
        ctx.fillText(text, centerX, centerY + 55);
        ctx.shadowBlur = 0;
        ctx.font = '13px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const sub = currentLang === 'ru' ? _flowNodes.length + ' \u0431\u043B\u043E\u043A\u043E\u0432 \u2192 1 \u0430\u0433\u0435\u043D\u0442' : _flowNodes.length + ' blocks \u2192 1 agent';
        ctx.fillText(sub, centerX, centerY + 80);
        ctx.restore();
      }

      if (t < 1) {
        requestAnimationFrame(animDeploy);
      } else {
        // Restore original positions
        _flowNodes.forEach((n, i) => {
          n.x = origPositions[i].x;
          n.y = origPositions[i].y;
        });
        // Restart normal drawing loop
        const _s = performance.now();
        function resumeDraw() {
          const time = (performance.now() - _s) / 1000;
          const ctx2 = _flowCtx;
          ctx2.clearRect(0, 0, W, H);
          // Will be drawn by normal drawFlowBuilder via initFlowBuilder reinit
          _flowAnimId = null;
        }
        // Re-init builder to restart draw loop
        initFlowBuilder();
        resolve();
      }
    }

    animDeploy();
  });
}

function showFlowToast(msg, type) {
  const el = document.createElement('div');
  el.className = 'flow-toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function updateZoomLabel() {
  const el = document.getElementById('flow-zoom-label');
  if (el) el.textContent = Math.round(_flowZoom * 100) + '%';
}

function flowZoomIn() {
  const newZoom = Math.min(3, _flowZoom * 1.2);
  const cx = (_flowCanvas ? _flowCanvas.parentElement.clientWidth : 800) / 2;
  const cy = (_flowCanvas ? _flowCanvas.parentElement.clientHeight : 500) / 2;
  _flowPanX = cx - (cx - _flowPanX) * (newZoom / _flowZoom);
  _flowPanY = cy - (cy - _flowPanY) * (newZoom / _flowZoom);
  _flowZoom = newZoom;
  updateZoomLabel();
}

function flowZoomOut() {
  const newZoom = Math.max(0.2, _flowZoom / 1.2);
  const cx = (_flowCanvas ? _flowCanvas.parentElement.clientWidth : 800) / 2;
  const cy = (_flowCanvas ? _flowCanvas.parentElement.clientHeight : 500) / 2;
  _flowPanX = cx - (cx - _flowPanX) * (newZoom / _flowZoom);
  _flowPanY = cy - (cy - _flowPanY) * (newZoom / _flowZoom);
  _flowZoom = newZoom;
  updateZoomLabel();
}

function flowZoomFit() {
  if (!_flowNodes.length) {
    _flowZoom = 1; _flowPanX = 0; _flowPanY = 0;
    updateZoomLabel();
    return;
  }
  const W = _flowCanvas ? _flowCanvas.parentElement.clientWidth : 800;
  const H = _flowCanvas ? _flowCanvas.parentElement.clientHeight : 500;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  _flowNodes.forEach(n => {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + NODE_H);
  });
  const pad = 60;
  const bw = maxX - minX + pad * 2;
  const bh = maxY - minY + pad * 2;
  _flowZoom = Math.min(1.5, Math.min(W / bw, H / bh));
  _flowPanX = (W - bw * _flowZoom) / 2 - minX * _flowZoom + pad * _flowZoom;
  _flowPanY = (H - bh * _flowZoom) / 2 - minY * _flowZoom + pad * _flowZoom;
  updateZoomLabel();
}

function flowZoomReset() {
  _flowZoom = 1; _flowPanX = 0; _flowPanY = 0;
  updateZoomLabel();
}

// Canvas rendering & interaction
function initFlowBuilder() {
  buildFlowPalette();
  // Push initial empty state for undo
  if (!_flowHistory.length) flowPushState();
  const canvas = document.getElementById('flow-canvas');
  if (!canvas) return;
  _flowCanvas = canvas;
  _flowCtx = canvas.getContext('2d');

  // Size canvas
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = wrap.clientWidth * dpr;
  canvas.height = wrap.clientHeight * dpr;
  canvas.style.width = wrap.clientWidth + 'px';
  canvas.style.height = wrap.clientHeight + 'px';
  _flowCtx.scale(dpr, dpr);

  const W = wrap.clientWidth, H = wrap.clientHeight;

  // Helper: screen coords → world coords (accounting for zoom/pan)
  function screenToWorld(sx, sy) {
    return { x: (sx - _flowPanX) / _flowZoom, y: (sy - _flowPanY) / _flowZoom };
  }

  // Mouse events
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const { x: mx, y: my } = screenToWorld(sx, sy);
    _flowMouse.x = mx; _flowMouse.y = my;

    // Middle-click or space+click → pan
    if (e.button === 1 || _flowSpaceHeld) {
      _flowPanning = true;
      _flowPanStart = { x: e.clientX - _flowPanX, y: e.clientY - _flowPanY };
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // Check port click first
    for (const n of _flowNodes) {
      const port = hitTestPort(n, mx, my);
      if (port && port !== 'in') {
        _flowConnecting = { fromId: n.id, fromPort: port, mx, my };
        return;
      }
    }

    // Check node click
    const node = hitTestNode(mx, my);
    if (node) {
      if (e.shiftKey) {
        // Multi-select toggle
        if (_flowMultiSelected.has(node.id)) _flowMultiSelected.delete(node.id);
        else _flowMultiSelected.add(node.id);
      } else {
        _flowMultiSelected.clear();
      }
      _flowSelectedId = node.id;
      _flowDragNode = node;
      _flowDragOffset.dx = mx - node.x;
      _flowDragOffset.dy = my - node.y;
      renderFlowConfig();
      canvas.classList.add('dragging');
    } else {
      // Check edge click → disconnect + grab to mouse
      const edgeIdx = hitTestEdge(mx, my);
      if (edgeIdx >= 0) {
        const edge = _flowEdges[edgeIdx];
        // Remove edge and start reconnecting from its source port
        _flowEdges.splice(edgeIdx, 1);
        _flowParticles = _flowParticles.filter(p => !(p.from === edge.from && p.fromPort === edge.fromPort && p.to === edge.to));
        _flowConnecting = { fromId: edge.from, fromPort: edge.fromPort, mx, my };
        _flowSelectedEdge = null;
        _flowSelectedId = null;
        _flowMultiSelected.clear();
        flowPushState();
        return;
      }
      // Empty space → deselect all + start LMB pan
      _flowSelectedId = null;
      _flowSelectedEdge = null;
      _flowMultiSelected.clear();
      renderFlowConfig();
      _flowPanning = true;
      _flowPanStart = { x: e.clientX - _flowPanX, y: e.clientY - _flowPanY };
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    // Pan mode
    if (_flowPanning) {
      _flowPanX = e.clientX - _flowPanStart.x;
      _flowPanY = e.clientY - _flowPanStart.y;
      return;
    }

    const { x: mx, y: my } = screenToWorld(sx, sy);
    _flowMouse.x = mx; _flowMouse.y = my;

    if (_flowDragNode) {
      _flowDragNode.x = mx - _flowDragOffset.dx;
      _flowDragNode.y = my - _flowDragOffset.dy;
    }
    if (_flowConnecting) {
      _flowConnecting.mx = mx;
      _flowConnecting.my = my;
      // Magnetic snap — find nearest input port within 25px
      _flowConnecting.snapTarget = null;
      let minDist = 25;
      for (const n of _flowNodes) {
        if (n.id === _flowConnecting.fromId) continue;
        const inPos = getPortPos(n, 'in');
        const dx = mx - inPos.x, dy = my - inPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          _flowConnecting.snapTarget = { nodeId: n.id, port: 'in', x: inPos.x, y: inPos.y };
        }
      }
      // Snap cursor to target port
      if (_flowConnecting.snapTarget) {
        _flowConnecting.mx = _flowConnecting.snapTarget.x;
        _flowConnecting.my = _flowConnecting.snapTarget.y;
      }
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    // End pan
    if (_flowPanning) {
      _flowPanning = false;
      canvas.style.cursor = _flowSpaceHeld ? 'grab' : 'default';
      return;
    }

    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const { x: mx, y: my } = screenToWorld(sx, sy);

    if (_flowConnecting) {
      let connected = false;
      // Use snap target if available
      if (_flowConnecting.snapTarget) {
        const targetId = _flowConnecting.snapTarget.nodeId;
        const exists = _flowEdges.some(e => e.from === _flowConnecting.fromId && e.fromPort === _flowConnecting.fromPort && e.to === targetId);
        if (!exists) {
          _flowEdges.push({ from: _flowConnecting.fromId, fromPort: _flowConnecting.fromPort, to: targetId, toPort: 'in' });
          _flowParticles.push({ from: _flowConnecting.fromId, fromPort: _flowConnecting.fromPort, to: targetId, t: 0, speed: 0.004 + Math.random() * 0.004 });
        }
        connected = true;
      }
      // Fallback: hitTest (using world coords)
      if (!connected) {
        for (const n of _flowNodes) {
          if (n.id === _flowConnecting.fromId) continue;
          const port = hitTestPort(n, mx, my);
          if (port === 'in') {
            const exists = _flowEdges.some(e => e.from === _flowConnecting.fromId && e.fromPort === _flowConnecting.fromPort && e.to === n.id);
            if (!exists) {
              _flowEdges.push({ from: _flowConnecting.fromId, fromPort: _flowConnecting.fromPort, to: n.id, toPort: 'in' });
              _flowParticles.push({ from: _flowConnecting.fromId, fromPort: _flowConnecting.fromPort, to: n.id, t: 0, speed: 0.004 + Math.random() * 0.004 });
              connected = true;
            }
            break;
          }
        }
      }
      if (connected) flowPushState();
      _flowConnecting = null;
    }
    if (_flowDragNode) {
      // Snap to grid (30px)
      _flowDragNode.x = Math.round(_flowDragNode.x / 30) * 30;
      _flowDragNode.y = Math.round(_flowDragNode.y / 30) * 30;
      flowPushState();
    }
    _flowDragNode = null;
    canvas.classList.remove('dragging');
  });

  canvas.addEventListener('mouseleave', () => {
    _flowDragNode = null;
    _flowConnecting = null;
    _flowPanning = false;
    canvas.classList.remove('dragging');
  });

  // Right-click → delete edge
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const { x: mx, y: my } = screenToWorld(sx, sy);
    const edgeIdx = hitTestEdge(mx, my);
    if (edgeIdx >= 0) {
      deleteFlowEdge(edgeIdx);
    }
  });

  // Wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(3, Math.max(0.2, _flowZoom * zoomFactor));
    // Zoom toward mouse position
    _flowPanX = sx - (sx - _flowPanX) * (newZoom / _flowZoom);
    _flowPanY = sy - (sy - _flowPanY) * (newZoom / _flowZoom);
    _flowZoom = newZoom;
    updateZoomLabel();
  }, { passive: false });

  // Delete / Undo / Redo / Space keys
  window.addEventListener('keydown', (e) => {
    // Only respond when flow tab is active
    const flowPage = document.querySelector('[data-page="builder"]');
    const isFlowActive = flowPage && !flowPage.classList.contains('hidden');
    if (!isFlowActive) return;

    // Space key for pan mode
    if (e.code === 'Space' && document.activeElement === document.body) {
      e.preventDefault();
      _flowSpaceHeld = true;
      canvas.style.cursor = 'grab';
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      flowUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
      e.preventDefault();
      flowRedo();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) {
      if (_flowSelectedId) deleteFlowNode(_flowSelectedId);
      else if (_flowSelectedEdge !== null) deleteFlowEdge(_flowSelectedEdge);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      _flowSpaceHeld = false;
      if (!_flowPanning) canvas.style.cursor = 'default';
    }
  });

  // Start animation
  if (_flowAnimId) cancelAnimationFrame(_flowAnimId);
  let _flowStartTime = performance.now();

  function drawFlowBuilder() {
    const time = (performance.now() - _flowStartTime) / 1000;
    const ctx = _flowCtx;
    ctx.clearRect(0, 0, W, H);

    // Background (no transform — fills entire canvas)
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    bg.addColorStop(0, '#0d1526');
    bg.addColorStop(1, '#070b14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Apply zoom & pan transform
    ctx.save();
    ctx.translate(_flowPanX, _flowPanY);
    ctx.scale(_flowZoom, _flowZoom);

    // Grid (infinite feel: compute visible area in world coords)
    const gridStep = 30;
    const visMinX = -_flowPanX / _flowZoom;
    const visMinY = -_flowPanY / _flowZoom;
    const visMaxX = (W - _flowPanX) / _flowZoom;
    const visMaxY = (H - _flowPanY) / _flowZoom;
    const gx0 = Math.floor(visMinX / gridStep) * gridStep;
    const gy0 = Math.floor(visMinY / gridStep) * gridStep;

    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1 / _flowZoom;
    for (let x = gx0; x < visMaxX; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, visMinY); ctx.lineTo(x, visMaxY); ctx.stroke(); }
    for (let y = gy0; y < visMaxY; y += gridStep) { ctx.beginPath(); ctx.moveTo(visMinX, y); ctx.lineTo(visMaxX, y); ctx.stroke(); }

    // Grid dots at intersections
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = gx0; x < visMaxX; x += gridStep) {
      for (let y = gy0; y < visMaxY; y += gridStep) {
        ctx.beginPath(); ctx.arc(x, y, 1 / _flowZoom, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Draw edges (bezier curves)
    _flowEdges.forEach((edge, idx) => {
      const fromNode = getFlowNode(edge.from);
      const toNode = getFlowNode(edge.to);
      if (!fromNode || !toNode) return;
      const from = getPortPos(fromNode, edge.fromPort);
      const to = getPortPos(toNode, edge.toPort);
      const isBackward = to.x < from.x - 20;

      // Edge glow (selected edge is brighter + wider)
      const isEdgeSelected = (idx === _flowSelectedEdge);
      ctx.save();
      ctx.shadowColor = isEdgeSelected ? '#fff' : fromNode.def.color;
      ctx.shadowBlur = isEdgeSelected ? 12 : 4;
      if (isEdgeSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3.5;
      } else {
        // Port-colored edges
        const portColors = { true: '#10b981', false: '#ef4444', loop: '#f59e0b', done: '#10b981' };
        const srcColor = portColors[edge.fromPort] || fromNode.def.color;
        const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
        grad.addColorStop(0, srcColor + 'aa');
        grad.addColorStop(1, toNode.def.color + 'aa');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
      }
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      if (isBackward) {
        // Backward edge: curve below nodes
        const midY = Math.max(from.y, to.y) + 80;
        ctx.bezierCurveTo(from.x + 40, midY, to.x - 40, midY, to.x, to.y);
      } else {
        const cpOff = Math.max(60, Math.abs(to.x - from.x) * 0.4);
        ctx.bezierCurveTo(from.x + cpOff, from.y, to.x - cpOff, to.y, to.x, to.y);
      }
      ctx.stroke();
      ctx.restore();

      // Arrow head
      const ah_cpOff = isBackward ? -40 : Math.max(60, Math.abs(to.x - from.x) * 0.4);
      const angle = Math.atan2(to.y - (to.y - 1), to.x - (to.x - ah_cpOff * 0.2));
      ctx.fillStyle = toNode.def.color + 'cc';
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - 8 * Math.cos(angle - 0.4), to.y - 8 * Math.sin(angle - 0.4));
      ctx.lineTo(to.x - 8 * Math.cos(angle + 0.4), to.y - 8 * Math.sin(angle + 0.4));
      ctx.fill();
    });

    // Clean up orphaned particles
    _flowParticles = _flowParticles.filter(p =>
      _flowEdges.some(e => e.from === p.from && e.to === p.to && e.fromPort === p.fromPort)
    );

    // Edge particles — follow EXACT same bezier as drawn edge
    _flowParticles.forEach(p => {
      const fromNode = getFlowNode(p.from);
      const toNode = getFlowNode(p.to);
      if (!fromNode || !toNode) return;
      const from = getPortPos(fromNode, p.fromPort);
      const to = getPortPos(toNode, 'in');
      p.t = (p.t + p.speed) % 1;
      const tt = p.t;
      const it = 1 - tt;

      // Use SAME control points as edge drawing
      const isBackward = to.x < from.x - 20;
      let cp1x, cp1y, cp2x, cp2y;
      if (isBackward) {
        const midY = Math.max(from.y, to.y) + 80;
        cp1x = from.x + 40;  cp1y = midY;
        cp2x = to.x - 40;    cp2y = midY;
      } else {
        const cpOff = Math.max(60, Math.abs(to.x - from.x) * 0.4);
        cp1x = from.x + cpOff;  cp1y = from.y;
        cp2x = to.x - cpOff;    cp2y = to.y;
      }

      const px = it*it*it*from.x + 3*it*it*tt*cp1x + 3*it*tt*tt*cp2x + tt*tt*tt*to.x;
      const py = it*it*it*from.y + 3*it*it*tt*cp1y + 3*it*tt*tt*cp2y + tt*tt*tt*to.y;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = fromNode.def.color;
      ctx.shadowColor = fromNode.def.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Connecting line (while dragging from port)
    if (_flowConnecting) {
      const fromNode = getFlowNode(_flowConnecting.fromId);
      if (fromNode) {
        const from = getPortPos(fromNode, _flowConnecting.fromPort);
        const targetX = _flowConnecting.mx, targetY = _flowConnecting.my;
        const cpOff = Math.max(40, Math.abs(targetX - from.x) * 0.4);
        const isSnapped = !!_flowConnecting.snapTarget;

        // Line style changes when snapped
        if (isSnapped) {
          ctx.setLineDash([]);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5;
        } else {
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = fromNode.def.color + '99';
          ctx.lineWidth = 2;
        }
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(from.x + cpOff, from.y, targetX - cpOff, targetY, targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Green glow on snap target port
        if (isSnapped) {
          const snap = _flowConnecting.snapTarget;
          const pulse = Math.sin(time * 6) * 3 + 10;
          ctx.save();
          ctx.beginPath();
          ctx.arc(snap.x, snap.y, PORT_R + pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(16,185,129,' + (0.15 + Math.sin(time * 6) * 0.1) + ')';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(snap.x, snap.y, PORT_R + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Draw groups (dashed rectangles around grouped nodes)
    _flowGroups.forEach(g => {
      const gNodes = g.nodeIds.map(id => getFlowNode(id)).filter(Boolean);
      if (!gNodes.length) return;
      if (g.collapsed) {
        // Collapsed: single large block
        const avgX = gNodes.reduce((s, n) => s + n.x, 0) / gNodes.length;
        const avgY = gNodes.reduce((s, n) => s + n.y, 0) / gNodes.length;
        ctx.save();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = '#64748b88';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(100,116,139,0.08)';
        const gw = 200, gh = 70;
        ctx.beginPath();
        ctx.roundRect(avgX - 10, avgY - 7, gw, gh, 12);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 13px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText('\u25A1 ' + g.name, avgX - 10 + gw / 2, avgY - 7 + gh / 2 + 4);
        ctx.textAlign = 'left';
        ctx.restore();
      } else {
        // Expanded: dashed rect around all nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        gNodes.forEach(n => {
          minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + NODE_H);
        });
        const pad = 12;
        ctx.save();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = '#64748b66';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(100,116,139,0.04)';
        ctx.beginPath();
        ctx.roundRect(minX - pad, minY - pad - 18, maxX - minX + pad * 2, maxY - minY + pad * 2 + 18, 10);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('\u25A1 ' + g.name, minX - pad + 6, minY - pad - 4);
        ctx.restore();
      }
    });

    // Draw nodes
    _flowNodes.forEach(n => {
      const selected = n.id === _flowSelectedId;
      const def = n.def;

      // Node shadow & glow
      if (selected) {
        ctx.save();
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 20;
      }

      // Node body
      const r = 12;
      ctx.beginPath();
      ctx.moveTo(n.x + r, n.y);
      ctx.lineTo(n.x + NODE_W - r, n.y);
      ctx.quadraticCurveTo(n.x + NODE_W, n.y, n.x + NODE_W, n.y + r);
      ctx.lineTo(n.x + NODE_W, n.y + NODE_H - r);
      ctx.quadraticCurveTo(n.x + NODE_W, n.y + NODE_H, n.x + NODE_W - r, n.y + NODE_H);
      ctx.lineTo(n.x + r, n.y + NODE_H);
      ctx.quadraticCurveTo(n.x, n.y + NODE_H, n.x, n.y + NODE_H - r);
      ctx.lineTo(n.x, n.y + r);
      ctx.quadraticCurveTo(n.x, n.y, n.x + r, n.y);
      ctx.closePath();

      // Fill
      ctx.fillStyle = selected ? 'rgba(20,30,50,0.95)' : 'rgba(15,22,40,0.9)';
      ctx.fill();

      // Border
      const isMulti = _flowMultiSelected.has(n.id);
      if (isMulti) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = selected ? def.color : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = selected ? 2 : 1;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      if (selected) ctx.restore();

      // Left color bar
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(n.x + r, n.y);
      ctx.lineTo(n.x + 4, n.y);
      ctx.quadraticCurveTo(n.x, n.y, n.x, n.y + r);
      ctx.lineTo(n.x, n.y + NODE_H - r);
      ctx.quadraticCurveTo(n.x, n.y + NODE_H, n.x + 4, n.y + NODE_H);
      ctx.lineTo(n.x + r, n.y + NODE_H);
      ctx.lineTo(n.x + r, n.y);
      ctx.closePath();
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Icon
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, n.x + 18, n.y + NODE_H / 2 - 6);

      // Label (localized)
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillStyle = '#fff';
      const nodeLabel = (currentLang === 'ru' && def.labelRu) ? def.labelRu : def.label;
      ctx.fillText(nodeLabel, n.x + 40, n.y + NODE_H / 2 - 6);

      // Subtitle (config summary or description)
      const cfgKeys = Object.keys(n.config).filter(k => n.config[k]);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      if (cfgKeys.length) {
        const summary = cfgKeys.map(k => n.config[k]).join(', ').slice(0, 22);
        ctx.fillText(summary, n.x + 40, n.y + NODE_H / 2 + 8);
      } else {
        const nodeDesc = (currentLang === 'ru' && def.descRu) ? def.descRu : (def.desc || '');
        if (nodeDesc) ctx.fillText(nodeDesc.slice(0, 24), n.x + 40, n.y + NODE_H / 2 + 8);
      }

      // Input port with hover glow
      const inP = getPortPos(n, 'in');
      const inDx = _flowMouse.x - inP.x, inDy = _flowMouse.y - inP.y;
      const inDist = Math.sqrt(inDx * inDx + inDy * inDy);
      if (inDist < 30) {
        const glow = (1 - inDist / 30) * 0.3;
        ctx.beginPath();
        ctx.arc(inP.x, inP.y, PORT_R + 6, 0, Math.PI * 2);
        ctx.fillStyle = def.color.slice(0, 7) + Math.round(glow * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(inP.x, inP.y, PORT_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15,22,40,0.9)';
      ctx.fill();
      ctx.strokeStyle = def.color + '88';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Output ports
      const outPorts = def.extraPorts || ['out'];
      outPorts.forEach((p, pi) => {
        const pos = getPortPos(n, p);
        const pulse = Math.sin(time * 3 + pi) * 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, PORT_R + pulse, 0, Math.PI * 2);
        ctx.fillStyle = def.color + '40';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, PORT_R, 0, Math.PI * 2);
        ctx.fillStyle = def.color;
        ctx.fill();
        // Port labels for condition and loop
        if (p === 'true' || p === 'false' || p === 'loop' || p === 'done') {
          ctx.font = '9px Inter, sans-serif';
          const portColors = { 'true': '#10b981', 'false': '#ef4444', 'loop': '#f59e0b', 'done': '#10b981' };
          ctx.fillStyle = portColors[p] || '#fff';
          ctx.textAlign = 'right';
          ctx.fillText(p, pos.x - 10, pos.y + 3);
          ctx.textAlign = 'left';
        }
      });
    });

    // End zoom/pan transform
    ctx.restore();

    // Empty state (drawn in screen coords, centered)
    if (!_flowNodes.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText(currentLang === 'ru' ? '\u2190 \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043D\u043E\u0434\u044B \u0438\u0437 \u043F\u0430\u043B\u0438\u0442\u0440\u044B' : '\u2190 Add nodes from the palette', W / 2, H / 2 - 10);
      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillText(currentLang === 'ru' ? '\u0421\u043E\u0435\u0434\u0438\u043D\u044F\u0439\u0442\u0435 \u043F\u043E\u0440\u0442\u044B \u0434\u043B\u044F \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F flow' : 'Connect ports to build your flow', W / 2, H / 2 + 16);
    }

    // Zoom badge (screen coords, bottom-right)
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(Math.round(_flowZoom * 100) + '%', W - 12, H - 10);
    ctx.textAlign = 'left';

    _flowAnimId = requestAnimationFrame(drawFlowBuilder);
  }

  drawFlowBuilder();
  switchLang(currentLang);
}

// ===== AGENT NETWORK MAP (Neural Canvas) =====
let _networkAnimId = null;
let _networkNodes = [];
let _networkDragNode = null;
let _networkDragOffset = { dx: 0, dy: 0 };
let _networkMouse = { x: 0, y: 0 };
let _networkSearchQuery = '';
let _networkTrashHover = false;

async function loadNetworkMap() {
  const canvas = document.getElementById('agent-network-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Set canvas size (with DPR for crisp rendering)
  const rect = canvas.parentElement.getBoundingClientRect();
  const _netDpr = window.devicePixelRatio || 1;
  const _netW = rect.width || 900, _netH = 500;
  canvas.width = _netW * _netDpr;
  canvas.height = _netH * _netDpr;
  canvas.style.width = _netW + 'px';
  canvas.style.height = _netH + 'px';
  ctx.scale(_netDpr, _netDpr);

  const data = await apiRequest('GET', '/api/agents');
  const agents = (data.ok ? data.agents : []) || [];

  if (!agents.length) {
    ctx.fillStyle = '#555';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No agents yet. Create one in the bot!', _netW / 2, _netH / 2);
    return;
  }

  // Build nodes
  _networkNodes = agents.map((a, i) => {
    const role = a.role || 'worker';
    const level = a.level || 1;
    const radius = role === 'director' ? 28 + level : role === 'manager' ? 22 + level : 16 + Math.min(level, 5);
    const color = role === 'director' ? '#ffd700' : a.isActive ? '#0098EA' : '#555';
    const emoji = role === 'director' ? '\u{1F9E0}' : role === 'manager' ? '\u{1F4CA}' : '\u{1F916}';
    return {
      id: a.id, name: a.name || 'Agent #' + a.id,
      role, level, xp: a.xp || 0,
      isActive: a.isActive,
      x: _netW / 2 + (Math.cos(i * 2.4) * 150) + (Math.random() - 0.5) * 80,
      y: _netH / 2 + (Math.sin(i * 2.4) * 120) + (Math.random() - 0.5) * 60,
      vx: 0, vy: 0,
      radius, color, emoji,
    };
  });

  // Build edges: director → all workers, managers → nearby workers
  const edges = [];
  const directors = _networkNodes.filter(n => n.role === 'director');
  const managers = _networkNodes.filter(n => n.role === 'manager');
  const workers = _networkNodes.filter(n => n.role === 'worker');

  directors.forEach(d => {
    _networkNodes.forEach(n => {
      if (n.id !== d.id) edges.push({ from: d, to: n });
    });
  });
  managers.forEach(m => {
    workers.forEach(w => edges.push({ from: m, to: w }));
  });
  // If no directors/managers, connect all agents in chain
  if (!directors.length && !managers.length && _networkNodes.length > 1) {
    for (let i = 0; i < _networkNodes.length - 1; i++) {
      edges.push({ from: _networkNodes[i], to: _networkNodes[i + 1] });
    }
  }

  // Stars background
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * _netW,
    y: Math.random() * _netH,
    r: Math.random() * 1.2,
    a: Math.random() * 0.5 + 0.1,
  }));

  // Particles on edges
  const particles = edges.map(() => ({ t: Math.random(), speed: 0.003 + Math.random() * 0.005 }));

  // Tooltip
  const tooltip = document.getElementById('network-tooltip');

  // Mouse interaction
  const trashZone = document.getElementById('network-trash-zone');

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    _networkMouse.x = e.clientX - r.left;
    _networkMouse.y = e.clientY - r.top;

    if (_networkDragNode) {
      _networkDragNode.x = _networkMouse.x - _networkDragOffset.dx;
      _networkDragNode.y = _networkMouse.y - _networkDragOffset.dy;
      _networkDragNode.vx = 0;
      _networkDragNode.vy = 0;
      // Show trash zone while dragging
      if (trashZone) trashZone.classList.add('visible');
      // Check if hovering over trash zone
      if (trashZone) {
        const tz = trashZone.getBoundingClientRect();
        const inTrash = e.clientX >= tz.left && e.clientX <= tz.right && e.clientY >= tz.top && e.clientY <= tz.bottom;
        _networkTrashHover = inTrash;
        trashZone.classList.toggle('hover', inTrash);
      }
    }

    // Tooltip hover
    let hovered = null;
    for (const n of _networkNodes) {
      const dx = _networkMouse.x - n.x, dy = _networkMouse.y - n.y;
      if (dx * dx + dy * dy < n.radius * n.radius) { hovered = n; break; }
    }
    if (hovered && tooltip && !_networkDragNode) {
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
      tooltip.innerHTML = `<b>${escHtml(hovered.name)}</b><br>` +
        `Role: ${hovered.role} | Lv.${hovered.level}<br>` +
        'XP: ' + hovered.xp + ' | ' + (hovered.isActive ? IC.dot_green + ' Active' : IC.dot_pause + ' Paused');
    } else if (tooltip) {
      tooltip.style.display = 'none';
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    _networkMouse.x = e.clientX - r.left;
    _networkMouse.y = e.clientY - r.top;
    _networkClickStart = { x: _networkMouse.x, y: _networkMouse.y, time: Date.now(), node: null };
    for (const n of _networkNodes) {
      const dx = _networkMouse.x - n.x, dy = _networkMouse.y - n.y;
      if (dx * dx + dy * dy < n.radius * n.radius) {
        _networkDragNode = n;
        _networkDragOffset.dx = dx;
        _networkDragOffset.dy = dy;
        _networkClickStart.node = n;
        break;
      }
    }
  });
  canvas.addEventListener('mouseup', (e) => {
    // Hide trash zone
    if (trashZone) { trashZone.classList.remove('visible', 'hover'); }

    if (_networkDragNode && _networkTrashHover) {
      // Dropped on trash zone → confirm deletion
      const nodeToDelete = _networkDragNode;
      _networkDragNode = null;
      _networkDragOffset.dx = 0;
      _networkDragOffset.dy = 0;
      _networkClickStart = null;
      _networkTrashHover = false;
      showNetworkDeleteConfirm(nodeToDelete);
      return;
    }

    if (_networkClickStart && _networkClickStart.node) {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const movedX = mx - _networkClickStart.x, movedY = my - _networkClickStart.y;
      const dist = Math.sqrt(movedX * movedX + movedY * movedY);
      const elapsed = Date.now() - _networkClickStart.time;
      if (dist < 5 && elapsed < 300) {
        showNetworkAgentPanel(_networkClickStart.node);
      }
    }
    _networkDragNode = null;
    _networkDragOffset.dx = 0;
    _networkDragOffset.dy = 0;
    _networkClickStart = null;
    _networkTrashHover = false;
  });
  canvas.addEventListener('mouseleave', () => {
    _networkDragNode = null;
    _networkDragOffset.dx = 0; _networkDragOffset.dy = 0;
    _networkTrashHover = false;
    if (tooltip) tooltip.style.display = 'none';
    if (trashZone) { trashZone.classList.remove('visible', 'hover'); }
  });

  // Animation loop
  let time = 0;
  if (_networkAnimId) cancelAnimationFrame(_networkAnimId);

  function animate() {
    time += 0.016;
    const W = _netW, H = _netH;
    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W/2);
    bg.addColorStop(0, '#0d1526');
    bg.addColorStop(1, '#070b14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Stars
    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a + Math.sin(time * 2 + s.x) * 0.1})`;
      ctx.fill();
    });

    // Force-directed physics
    const k = 8000;
    for (let i = 0; i < _networkNodes.length; i++) {
      for (let j = i + 1; j < _networkNodes.length; j++) {
        const a = _networkNodes[i], b = _networkNodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = k / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
    edges.forEach(e => {
      const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const spring = 0.005;
      const target = 120;
      const force = (dist - target) * spring;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      e.from.vx += fx; e.from.vy += fy;
      e.to.vx -= fx; e.to.vy -= fy;
    });
    _networkNodes.forEach(n => {
      if (n === _networkDragNode) return;
      n.vx *= 0.92; n.vy *= 0.92;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(n.radius, Math.min(_netW - n.radius, n.x));
      n.y = Math.max(n.radius, Math.min(_netH - n.radius, n.y));
    });

    // Draw edges
    edges.forEach((e, idx) => {
      const grad = ctx.createLinearGradient(e.from.x, e.from.y, e.to.x, e.to.y);
      grad.addColorStop(0, e.from.color + '60');
      grad.addColorStop(1, e.to.color + '60');
      ctx.beginPath();
      ctx.moveTo(e.from.x, e.from.y);
      ctx.lineTo(e.to.x, e.to.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Particle
      const p = particles[idx];
      p.t = (p.t + p.speed) % 1;
      const px = e.from.x + (e.to.x - e.from.x) * p.t;
      const py = e.from.y + (e.to.y - e.from.y) * p.t;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = e.from.color;
      ctx.fill();
    });

    // Draw nodes
    _networkNodes.forEach(n => {
      const pulse = n.isActive ? Math.sin(time * 3 + n.id) * 3 : 0;
      const r = n.radius + pulse;

      // Search filter: dim non-matching nodes
      const matchesSearch = !_networkSearchQuery || n.name.toLowerCase().includes(_networkSearchQuery.toLowerCase());
      const alpha = matchesSearch ? 1.0 : 0.15;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Glow
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2);
      glow.addColorStop(0, n.color + '40');
      glow.addColorStop(1, n.color + '00');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 2, 0, Math.PI * 2);
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color + '30';
      ctx.fill();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = matchesSearch && _networkSearchQuery ? 3 : 2;
      ctx.stroke();

      // Highlight ring for search match
      if (matchesSearch && _networkSearchQuery) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = n.color + '60';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Emoji
      ctx.font = `${Math.max(12, r * 0.7)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.emoji, n.x, n.y);

      // Name below
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(n.name.slice(0, 15), n.x, n.y + r + 12);

      // Level badge
      if (n.level > 1) {
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = n.color;
        ctx.fillText('Lv.' + n.level, n.x, n.y - r - 6);
      }

      ctx.restore();
    });

    _networkAnimId = requestAnimationFrame(animate);
  }

  animate();
}

// ===== CREATE AGENT DROPDOWN =====
function showCreateAgentMenu(event) {
  event.stopPropagation();
  const dd = document.getElementById('create-agent-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
function hideCreateMenu() {
  const dd = document.getElementById('create-agent-dropdown');
  if (dd) dd.style.display = 'none';
}
document.addEventListener('click', function(e) {
  const dd = document.getElementById('create-agent-dropdown');
  if (dd && dd.style.display !== 'none' && !dd.contains(e.target) && !e.target.closest('[onclick*="showCreateAgentMenu"]')) {
    dd.style.display = 'none';
  }
});

// ===== AI CHAT WIDGET (floating) =====
let _chatLoaded = false;

function toggleChatWidget() {
  // Redirect to the full assistant page instead of floating widget
  navigateTo('assistant');
}

function openDashboardChat() {
  navigateTo('assistant');
}

function closeChatWidget() {
  const w = document.getElementById('chat-widget');
  if (w) w.style.display = 'none';
}

// ===== AI ASSISTANT PAGE =====
let _assistantLoaded = false;

async function loadAssistantPage() {
  if (!_assistantLoaded) {
    _assistantLoaded = true;
    await loadAssistantHistory();
  }
  setTimeout(function() {
    var input = document.getElementById('assistant-input');
    if (input) input.focus();
  }, 100);
}

async function loadAssistantHistory() {
  try {
    var data = await apiRequest('GET', '/api/chat/history');
    if (data.ok && data.messages && data.messages.length) {
      var container = document.getElementById('assistant-messages');
      if (!container) return;
      // Hide welcome message
      var welcome = container.querySelector('.assistant-welcome');
      if (welcome) welcome.style.display = 'none';
      // Hide suggestions
      var sugg = document.getElementById('assistant-suggestions');
      if (sugg) sugg.style.display = 'none';
      data.messages.forEach(function(m) {
        appendAssistantMsg(m.role === 'user' ? 'user' : 'assistant', m.content);
      });
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) { /* silent */ }
}

function appendAssistantMsg(role, content, buttons) {
  var container = document.getElementById('assistant-messages');
  if (!container) return;
  // Hide welcome on first message
  var welcome = container.querySelector('.assistant-welcome');
  if (welcome) welcome.style.display = 'none';
  var sugg = document.getElementById('assistant-suggestions');
  if (sugg) sugg.style.display = 'none';

  var div = document.createElement('div');
  div.className = 'assistant-msg ' + role;
  // Parse markdown + navigation links
  var html = escHtml(content)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Navigation links: [[page:pageName|Label]] → clickable links that navigate within studio
    .replace(/\[\[page:(\w+)\|([^\]]+)\]\]/g, '<a href="#" class="assistant-nav-link" onclick="navigateTo(\'$1\');return false" style="color:#7dd3fc;text-decoration:underline;cursor:pointer">$2</a>')
    // Standard markdown links: [text](url) → external links
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#7dd3fc;text-decoration:underline">$1</a>')
    .replace(/\n/g, '<br>');
  if (role === 'assistant') {
    html = '<div class="assistant-msg-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="assistant-msg-content">' + html;
  } else {
    html = '<div class="assistant-msg-content">' + html;
  }
  if (buttons && buttons.length) {
    html += '<div class="assistant-msg-buttons">';
    buttons.forEach(function(b) {
      html += '<button class="btn btn-ghost btn-sm" onclick="sendAssistantCallback(\'' + escHtml(b.callbackData || b.text) + '\',\'' + escHtml(b.text) + '\')">' + escHtml(b.text) + '</button>';
    });
    html += '</div>';
  }
  html += '</div>';
  div.innerHTML = html;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Also keep the old appendChatMsg for backwards compat with floating widget
function appendChatMsg(role, content, buttons) {
  // Redirect to assistant page messages
  appendAssistantMsg(role, content, buttons);
}

async function loadChatHistory() {
  await loadAssistantHistory();
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getStudioContext() {
  var activeNav = document.querySelector('.nav-item.active');
  var page = activeNav ? activeNav.getAttribute('data-page') : 'unknown';
  var ctx = { page: page, source: 'studio' };
  // If agent detail is open, include agent info
  if (typeof _detailAgentId !== 'undefined' && _detailAgentId && typeof _detailAgentData !== 'undefined' && _detailAgentData) {
    ctx.agentId = _detailAgentId;
    ctx.agentName = _detailAgentData.name;
    ctx.agentStatus = _detailAgentData.is_active ? 'active' : 'paused';
    ctx.agentType = _detailAgentData.trigger_type;
  }
  return ctx;
}

async function sendChatMessage() {
  sendAssistantMessage();
}

async function sendAssistantMessage() {
  var input = document.getElementById('assistant-input');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';

  appendAssistantMsg('user', text);

  // Typing indicator
  var container = document.getElementById('assistant-messages');
  var typing = document.createElement('div');
  typing.className = 'assistant-msg assistant assistant-typing';
  typing.id = 'assistant-typing';
  typing.innerHTML = '<div class="assistant-msg-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="assistant-msg-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  var sendBtn = document.getElementById('assistant-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    var data = await apiRequest('POST', '/api/chat', { message: text, context: getStudioContext() });
    var typingEl = document.getElementById('assistant-typing');
    if (typingEl) typingEl.remove();

    if (data.ok && data.result) {
      var r = data.result;
      appendAssistantMsg('assistant', r.content, r.buttons);
      if (r.type === 'agent_created') {
        loadAgents();
        toast(currentLang === 'ru' ? 'Агент создан!' : 'Agent created!', 'success');
      }
    } else {
      appendAssistantMsg('assistant', data.error || 'Error');
    }
  } catch (e) {
    var typingEl2 = document.getElementById('assistant-typing');
    if (typingEl2) typingEl2.remove();
    appendAssistantMsg('assistant', e.message);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

function sendAssistantSuggestion(btn) {
  var text = btn.textContent.trim();
  var input = document.getElementById('assistant-input');
  if (input) { input.value = text; }
  sendAssistantMessage();
}

async function sendAssistantCallback(callbackData, label) {
  appendAssistantMsg('user', label || callbackData);
  // Disable buttons
  document.querySelectorAll('.assistant-msg-buttons button').forEach(function(b) { b.disabled = true; b.style.opacity = '.5'; });

  var container = document.getElementById('assistant-messages');
  var typing = document.createElement('div');
  typing.className = 'assistant-msg assistant assistant-typing';
  typing.id = 'assistant-typing';
  typing.innerHTML = '<div class="assistant-msg-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="assistant-msg-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  try {
    var data = await apiRequest('POST', '/api/chat', { message: callbackData, context: getStudioContext() });
    var typingEl = document.getElementById('assistant-typing');
    if (typingEl) typingEl.remove();
    if (data.ok && data.result) {
      appendAssistantMsg('assistant', data.result.content, data.result.buttons);
      if (data.result.type === 'agent_created') {
        loadAgents();
        toast(currentLang === 'ru' ? 'Агент создан!' : 'Agent created!', 'success');
      }
    } else {
      appendAssistantMsg('assistant', data.error || 'Error');
    }
  } catch (e) {
    var typingEl2 = document.getElementById('assistant-typing');
    if (typingEl2) typingEl2.remove();
    appendAssistantMsg('assistant', e.message);
  }
}

// Alias for backwards compat
async function sendChatCallback(callbackData, label) {
  return sendAssistantCallback(callbackData, label);
}

function clearAssistantChat() {
  var container = document.getElementById('assistant-messages');
  if (!container) return;
  container.innerHTML = '<div class="assistant-welcome"><div class="assistant-welcome-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h3>' + (currentLang === 'ru' ? 'Чем могу помочь?' : 'How can I help you?') + '</h3><p>' + (currentLang === 'ru' ? 'Могу создать AI-агента, объяснить функции, помочь с настройками и многое другое.' : 'I can create AI agents, explain features, help with settings, and more.') + '</p></div>';
  var sugg = document.getElementById('assistant-suggestions');
  if (sugg) sugg.style.display = 'flex';
  _assistantLoaded = false;
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

// ===== MARKETPLACE =====
let _marketplaceListings = [];
let _marketplaceFilter = 'all';

async function loadMarketplace() {
  var endpoint = _marketplaceFilter === 'my'
    ? '/api/marketplace/my'
    : '/api/marketplace' + (_marketplaceFilter !== 'all' ? '?category=' + _marketplaceFilter : '');
  try {
    var data = await apiRequest('GET', endpoint);
    _marketplaceListings = (data.ok ? data.listings : []) || [];
  } catch (e) {
    _marketplaceListings = [];
  }
  renderMarketplaceGrid();
}

function filterMarketplace(cat) {
  _marketplaceFilter = cat;
  document.querySelectorAll('.mkt-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-cat') === cat);
  });
  if (cat === 'purchased') {
    loadMyPurchases();
  } else {
    loadMarketplace();
  }
}

async function loadMyPurchases() {
  try {
    var data = await apiRequest('GET', '/api/marketplace/purchases');
    _marketplaceListings = (data.ok ? data.purchases : []) || [];
  } catch(e) {
    _marketplaceListings = [];
  }
  renderPurchasedGrid();
}

function renderPurchasedGrid() {
  var grid = document.getElementById('marketplace-grid');
  if (!grid) return;
  if (!_marketplaceListings.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px 20px">' +
      '<p style="font-size:2rem;margin-bottom:12px">' + IC.box + '</p>' +
      '<p style="color:var(--text-muted)">' + (currentLang === 'ru' ? 'Нет покупок' : 'No purchases yet') + '</p></div>';
    return;
  }
  grid.innerHTML = _marketplaceListings.map(function(p) {
    return '<div class="marketplace-card">' +
      '<div class="mkt-card-header">' +
        '<span class="mkt-card-category">' + (currentLang === 'ru' ? 'Куплено' : 'Purchased') + '</span>' +
        '<span class="mkt-card-price">' + (p.type === 'free' ? 'Free' : ((p.pricePaid / 1e9).toFixed(2) + ' TON')) + '</span>' +
      '</div>' +
      '<h4>' + (currentLang === 'ru' ? 'Агент #' : 'Agent #') + p.agentId + '</h4>' +
      '<p style="font-size:.75rem;color:var(--text-muted)">' + new Date(p.createdAt).toLocaleDateString() + '</p>' +
    '</div>';
  }).join('');
}

function renderMarketplaceGrid() {
  var grid = document.getElementById('marketplace-grid');
  if (!grid) return;
  if (!_marketplaceListings.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px 20px">' +
      '<p style="font-size:2rem;margin-bottom:12px">' + IC.store + '</p>' +
      '<p style="color:var(--text-muted)">' + (currentLang === 'ru' ? 'Пока ничего нет' : 'Nothing here yet') + '</p></div>';
    return;
  }
  grid.innerHTML = _marketplaceListings.map(function(l) {
    var priceText = l.isFree ? (currentLang === 'ru' ? 'Бесплатно' : 'Free') : ((Number(l.price || 0) / 1e9).toFixed(2) + ' TON');
    return '<div class="marketplace-card" onclick="openMarketplaceDetail(' + l.id + ')" style="cursor:pointer">' +
      '<div class="mkt-card-header">' +
        '<span class="mkt-card-category">' + escHtml(l.category || 'other') + '</span>' +
        '<span class="mkt-card-price">' + priceText + '</span>' +
      '</div>' +
      '<h4>' + escHtml(l.name) + '</h4>' +
      '<p>' + escHtml((l.description || '').slice(0, 140)) + '</p>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();buyFromMarketplace(' + l.id + ')" style="flex:1">' +
          (l.isFree ? (currentLang === 'ru' ? IC.download + ' Установить' : IC.download + ' Install') : (currentLang === 'ru' ? IC.creditcard + ' Купить' : IC.creditcard + ' Buy')) +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function installFromMarketplace(listingId) {
  try {
    var data = await apiRequest('POST', '/api/marketplace/' + listingId + '/install');
    if (data.ok) {
      showNotification((currentLang === 'ru' ? 'Агент установлен!' : 'Agent installed!'), 'success');
      loadAgents();
    } else {
      showNotification((data.error || 'Failed'), 'error');
    }
  } catch (e) {
    showNotification(e.message, 'error');
  }
}

async function openPublishModal() {
  var modal = document.getElementById('publish-modal');
  if (!modal) return;
  // Load user's agents for the select
  try {
    var data = await apiRequest('GET', '/api/agents');
    var agents = (data.ok ? data.agents : []) || [];
    var select = document.getElementById('publish-agent-select');
    if (select) {
      select.innerHTML = agents.map(function(a) {
        return '<option value="' + a.id + '">' + escHtml(a.name || 'Agent #' + a.id) + '</option>';
      }).join('');
    }
  } catch(e) {}
  modal.style.display = 'flex';
}

async function submitPublish() {
  var agentId = document.getElementById('publish-agent-select').value;
  var name = document.getElementById('publish-name').value.trim();
  var desc = document.getElementById('publish-desc').value.trim();
  var category = document.getElementById('publish-category').value;
  var price = parseFloat(document.getElementById('publish-price').value) || 0;
  if (!name) { showNotification(currentLang === 'ru' ? 'Введите название' : 'Enter a name', 'error'); return; }
  if (!desc) { showNotification(currentLang === 'ru' ? 'Введите описание' : 'Enter a description', 'error'); return; }
  try {
    var data = await apiRequest('POST', '/api/marketplace', {
      agentId: parseInt(agentId),
      name: name,
      description: desc,
      category: category,
      price: price,
      isFree: price <= 0
    });
    if (data.ok) {
      showNotification(currentLang === 'ru' ? 'Агент опубликован!' : 'Agent published!', 'success');
      document.getElementById('publish-modal').style.display = 'none';
      loadMarketplace();
    } else {
      showNotification(data.error || 'Error', 'error');
    }
  } catch(e) {
    showNotification(e.message || 'Error', 'error');
  }
}

async function openMarketplaceDetail(listingId) {
  var modal = document.getElementById('mkt-detail-modal');
  var content = document.getElementById('mkt-detail-content');
  if (!modal || !content) return;
  content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="auth-spinner" style="margin:0 auto 12px"></div>Loading...</div>';
  modal.style.display = 'flex';
  try {
    var data = await apiRequest('GET', '/api/marketplace/' + listingId);
    if (!data.ok || !data.listing) { content.innerHTML = '<p style="color:var(--danger)">Not found</p>'; return; }
    var l = data.listing;
    var priceText = l.isFree ? (currentLang === 'ru' ? 'Бесплатно' : 'Free') : ((Number(l.price || 0) / 1e9).toFixed(2) + ' TON');
    var buyBtnText = l.isFree ? (currentLang === 'ru' ? IC.download + ' Установить бесплатно' : IC.download + ' Install Free') : (currentLang === 'ru' ? IC.creditcard + ' Купить за ' + priceText : IC.creditcard + ' Buy for ' + priceText);
    content.innerHTML = '<h3 class="mkt-detail-name">' + escHtml(l.name) + '</h3>' +
      '<p class="mkt-detail-desc">' + escHtml(l.description || '') + '</p>' +
      '<div class="mkt-detail-meta">' +
        '<div class="mkt-detail-meta-item"><small>' + (currentLang === 'ru' ? 'Категория' : 'Category') + '</small><strong>' + escHtml(l.category || 'other') + '</strong></div>' +
        '<div class="mkt-detail-meta-item"><small>' + (currentLang === 'ru' ? 'Цена' : 'Price') + '</small><strong>' + priceText + '</strong></div>' +
        '<div class="mkt-detail-meta-item"><small>' + (currentLang === 'ru' ? 'Продажи' : 'Sales') + '</small><strong>' + (l.salesCount || 0) + '</strong></div>' +
        '<div class="mkt-detail-meta-item"><small>' + (currentLang === 'ru' ? 'Рейтинг' : 'Rating') + '</small><strong>' + (l.rating ? l.rating.toFixed(1) + ' ' + IC.star : '—') + '</strong></div>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="buyFromMarketplace(' + l.id + ')" style="width:100%">' + buyBtnText + '</button>';
  } catch(e) {
    content.innerHTML = '<p style="color:var(--danger)">' + escHtml(e.message || 'Error') + '</p>';
  }
}

async function buyFromMarketplace(listingId) {
  var confirmed = await studioConfirm({
    title: currentLang === 'ru' ? 'Подтвердите покупку' : 'Confirm Purchase',
    message: currentLang === 'ru' ? 'Агент будет добавлен в вашу коллекцию. Стоимость будет списана с баланса.' : 'The agent will be added to your collection. Cost will be deducted from your balance.',
    confirmText: currentLang === 'ru' ? 'Купить' : 'Buy Now',
    cancelText: currentLang === 'ru' ? 'Отмена' : 'Cancel',
    type: 'info',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'
  });
  if (!confirmed) return;
  try {
    var data = await apiRequest('POST', '/api/marketplace/' + listingId + '/buy');
    if (data.ok) {
      showNotification(data.message || (currentLang === 'ru' ? 'Успешно!' : 'Success!'), 'success');
      document.getElementById('mkt-detail-modal').style.display = 'none';
      loadAgents();
      loadMarketplace();
    } else {
      if (data.error === 'Insufficient balance') {
        showNotification(currentLang === 'ru' ? 'Недостаточно средств. Нужно ' + data.required + ' TON' : 'Insufficient balance. Need ' + data.required + ' TON', 'error');
      } else if (data.error === 'Already purchased') {
        showNotification(currentLang === 'ru' ? 'Уже куплено!' : 'Already purchased!', 'info');
      } else {
        showNotification(data.error || 'Error', 'error');
      }
    }
  } catch(e) {
    showNotification(e.message || 'Error', 'error');
  }
}

// ===== COLLAPSIBLE NAV =====
function toggleNavSection(sectionId) {
  var section = document.getElementById(sectionId);
  if (section) section.classList.toggle('collapsed');
  try {
    var collapsed = document.querySelectorAll('.nav-section-collapsible.collapsed');
    var ids = [];
    collapsed.forEach(function(el) { ids.push(el.id); });
    localStorage.setItem('nav_collapsed', JSON.stringify(ids));
  } catch(e) {}
}
// Restore collapsed state
try {
  var savedNav = JSON.parse(localStorage.getItem('nav_collapsed') || '[]');
  savedNav.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('collapsed');
  });
} catch(e) {}

// ===== GUIDE =====
function toggleGuideSection(headerEl) {
  var section = headerEl.closest('.guide-section');
  if (section) section.classList.toggle('expanded');
}

// ===== ONBOARDING SYSTEM =====
function checkOnboarding() {
  if (localStorage.getItem('onboarding_completed')) return;
  if (!currentUser) return;
  var modal = document.getElementById('onboarding-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  var subtitle = document.getElementById('onboarding-subtitle');
  if (subtitle) {
    var name = currentUser.first_name || currentUser.username || '';
    subtitle.textContent = currentLang === 'ru'
      ? name + ', вы присоединились к самой мощной платформе AI-агентов на TON.'
      : name + ', you\'ve joined the most powerful AI agent platform on TON blockchain.';
  }
}

function startOnboarding() {
  dismissOnboarding();
  navigateTo('settings');
  setTimeout(function() { startTour(); }, 800);
}

function dismissOnboarding() {
  var modal = document.getElementById('onboarding-modal');
  if (modal) modal.style.display = 'none';
  localStorage.setItem('onboarding_completed', '1');
}

// ===== GETTING STARTED TRACKER =====
var GS_STEPS = ['ai', 'agent', 'marketplace', 'guide'];

function getGSProgress() {
  try { return JSON.parse(localStorage.getItem('gs_completed') || '{}'); }
  catch(e) { return {}; }
}
function saveGSProgress(progress) {
  localStorage.setItem('gs_completed', JSON.stringify(progress));
}
function markGSStep(step) {
  var progress = getGSProgress();
  if (progress[step]) return;
  progress[step] = true;
  saveGSProgress(progress);
  updateGSPanel();
}
function updateGSPanel() {
  var panel = document.getElementById('getting-started-panel');
  if (!panel) return;
  if (localStorage.getItem('gs_dismissed')) { panel.style.display = 'none'; return; }
  var progress = getGSProgress();
  var completed = GS_STEPS.filter(function(s) { return progress[s]; }).length;
  if (completed === GS_STEPS.length) {
    panel.style.display = 'none';
    localStorage.setItem('gs_dismissed', '1');
    showNotification(currentLang === 'ru' ? 'Все шаги выполнены! Отличное начало!' : 'All steps completed! Great start!', 'success');
    return;
  }
  panel.style.display = 'block';
  GS_STEPS.forEach(function(s) {
    var stepEl = document.getElementById('gs-step-' + s);
    if (stepEl) stepEl.classList.toggle('completed', !!progress[s]);
  });
  var pct = (completed / GS_STEPS.length) * 100;
  var bar = document.getElementById('gs-progress-bar');
  if (bar) bar.style.width = pct + '%';
  var text = document.getElementById('gs-progress-text');
  if (text) text.textContent = completed + '/' + GS_STEPS.length;
}
function dismissGettingStarted() {
  localStorage.setItem('gs_dismissed', '1');
  var panel = document.getElementById('getting-started-panel');
  if (panel) { panel.style.opacity = '0'; panel.style.transform = 'translateY(-10px)'; setTimeout(function(){ panel.style.display = 'none'; }, 300); }
}

// ===== INTERACTIVE TOUR =====
var TOUR_STEPS = [
  { target: '[data-page="overview"]', title: { en: 'Overview', ru: 'Обзор' }, desc: { en: 'Your dashboard with real-time stats, active agents, and quick actions. Everything at a glance.', ru: 'Ваша панель управления с метриками в реальном времени, активными агентами и быстрыми действиями.' }, position: 'right' },
  { target: '[data-page="builder"]', title: { en: 'Visual Constructor', ru: 'Конструктор' }, desc: { en: 'Build agents visually with drag-and-drop blocks. Connect triggers, actions, and logic — no coding needed.', ru: 'Создавайте агентов визуально. Соединяйте триггеры, действия и логику — без кода.' }, position: 'right' },
  { target: '[data-page="marketplace"]', title: { en: 'Marketplace', ru: 'Маркетплейс' }, desc: { en: 'Browse and install ready-made agent templates. DeFi monitoring, NFT tracking, gift arbitrage and more.', ru: 'Смотрите и устанавливайте готовые шаблоны. DeFi мониторинг, NFT трекинг, арбитраж подарков.' }, position: 'right' },
  { target: '[data-page="assistant"]', title: { en: 'AI Assistant', ru: 'AI Ассистент' }, desc: { en: 'Describe what agent you need in natural language. AI will create and configure it for you. Synced with Telegram!', ru: 'Опишите нужного агента словами. AI создаст и настроит его за вас. Синхронизация с Telegram!' }, position: 'right' },
  { target: '[data-page="operations"]', title: { en: 'My Agents', ru: 'Мои агенты' }, desc: { en: 'All created agents appear here. Start, stop, view logs, and manage them in real-time.', ru: 'Все агенты здесь. Запускайте, останавливайте, смотрите логи в реальном времени.' }, position: 'right' },
  { target: '[data-page="wallet"]', title: { en: 'TON Wallet', ru: 'Кошелёк' }, desc: { en: 'Manage your TON wallet, check balance, and fund your agents for marketplace purchases.', ru: 'Управляйте кошельком TON, проверяйте баланс, пополняйте агентов для покупок.' }, position: 'right' },
  { target: '[data-page="settings"]', title: { en: 'Settings', ru: 'Настройки' }, desc: { en: 'Set up your AI API key, choose a provider, and configure the platform to your needs.', ru: 'Настройте AI API ключ, выберите провайдера, адаптируйте платформу под себя.' }, position: 'right' },
];
var _tourStep = 0;
var _tourActive = false;
var _tourResizeHandler = null;

function startTour() {
  _tourStep = 0;
  _tourActive = true;
  var overlay = document.getElementById('tour-overlay');
  if (overlay) { overlay.style.display = 'block'; overlay.classList.add('active'); }
  // Listen for window resize to reposition
  _tourResizeHandler = function() { if (_tourActive) showTourStep(); };
  window.addEventListener('resize', _tourResizeHandler);
  showTourStep();
}
function showTourStep() {
  if (_tourStep >= TOUR_STEPS.length) { endTour(); return; }
  var step = TOUR_STEPS[_tourStep];
  // Navigate to overview first to ensure sidebar targets are visible
  if (_tourStep === 0) navigateTo('overview');
  var target = document.querySelector(step.target);
  if (!target) { _tourStep++; showTourStep(); return; }
  // Ensure target is visible (open sidebar on mobile)
  if (window.innerWidth < 768) {
    var sb = document.querySelector('.sidebar');
    if (sb && !sb.classList.contains('open')) toggleSidebar();
  }
  // Expand collapsed sections if target is inside one
  var parentSection = target.closest('.nav-section-collapsible.collapsed');
  if (parentSection) parentSection.classList.remove('collapsed');
  // Scroll target into view in sidebar (not page-level scroll)
  var sidebarNav = target.closest('.sidebar-nav, .sidebar');
  if (sidebarNav) sidebarNav.scrollTop = Math.max(0, target.offsetTop - sidebarNav.offsetHeight / 2);
  target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Wait for scroll + layout
  setTimeout(function() {
    requestAnimationFrame(function() {
      positionTourElements(step, target);
    });
  }, 250);
}
function positionTourElements(step, target) {
  var rect = target.getBoundingClientRect();
  var spotlight = document.getElementById('tour-spotlight');
  var tooltip = document.getElementById('tour-tooltip');
  var content = document.getElementById('tour-tooltip-content');
  var counter = document.getElementById('tour-step-counter');
  if (!spotlight || !tooltip || !content || !counter) return;
  var pad = 6;
  // Position spotlight exactly on the element
  spotlight.style.top = (rect.top - pad) + 'px';
  spotlight.style.left = (rect.left - pad) + 'px';
  spotlight.style.width = (rect.width + pad * 2) + 'px';
  spotlight.style.height = (rect.height + pad * 2) + 'px';
  // Build tooltip content with step number
  content.innerHTML = '<div class="tour-step-badge">' + (_tourStep + 1) + '</div><h4>' + step.title[currentLang] + '</h4><p>' + step.desc[currentLang] + '</p>';
  counter.textContent = (_tourStep + 1) + ' / ' + TOUR_STEPS.length;
  // Reset tooltip classes
  tooltip.className = 'tour-tooltip';
  tooltip.style.cssText = '';
  var tipW = 320;
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  // Position tooltip to the right of target element (sidebar items)
  if (step.position === 'right') {
    var tipLeft = rect.right + 14;
    if (tipLeft + tipW > vw) tipLeft = Math.max(10, rect.left - tipW - 14);
    var tipTop = Math.max(10, Math.min(vh - 220, rect.top + rect.height / 2 - 50));
    tooltip.style.top = tipTop + 'px';
    tooltip.style.left = tipLeft + 'px';
    tooltip.classList.add(tipLeft > rect.right ? 'arrow-left' : 'arrow-right');
  } else if (step.position === 'top') {
    tooltip.style.top = Math.max(10, rect.top - 180) + 'px';
    tooltip.style.left = Math.max(10, Math.min(vw - tipW - 10, rect.left)) + 'px';
    tooltip.classList.add('arrow-bottom');
  } else if (step.position === 'bottom') {
    tooltip.style.top = (rect.bottom + 14) + 'px';
    tooltip.style.left = Math.max(10, Math.min(vw - tipW - 10, rect.left)) + 'px';
    tooltip.classList.add('arrow-top');
  }
  // Add highlight class to target element
  document.querySelectorAll('.tour-highlight').forEach(function(el) { el.classList.remove('tour-highlight'); });
  target.classList.add('tour-highlight');
  var nextBtn = document.getElementById('tour-next-btn');
  if (nextBtn) nextBtn.textContent = _tourStep === TOUR_STEPS.length - 1 ? (currentLang === 'ru' ? 'Готово!' : 'Done!') : (currentLang === 'ru' ? 'Далее' : 'Next');
}
function nextTourStep() { _tourStep++; showTourStep(); }
function endTour() {
  _tourActive = false;
  var overlay = document.getElementById('tour-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.classList.remove('active'); }
  // Remove highlight from all elements
  document.querySelectorAll('.tour-highlight').forEach(function(el) { el.classList.remove('tour-highlight'); });
  // Remove resize listener
  if (_tourResizeHandler) { window.removeEventListener('resize', _tourResizeHandler); _tourResizeHandler = null; }
  localStorage.setItem('tour_completed', '1');
}

// ===== NETWORK MAP CLICK =====
let _networkClickStart = null;

function showNetworkAgentPanel(node) {
  var container = document.getElementById('network-page');
  if (!container) return;
  var existing = document.getElementById('network-agent-panel');
  if (existing) existing.remove();
  // Remove delete dialog if present
  var existingDialog = document.getElementById('network-delete-dialog');
  if (existingDialog) existingDialog.remove();

  var panel = document.createElement('div');
  panel.id = 'network-agent-panel';
  panel.className = 'network-agent-panel';
  var statusText = node.isActive ? IC.dot_green + ' Active' : IC.dot_pause + ' Paused';
  var toggleText = node.isActive ? (currentLang === 'ru' ? IC.pause + ' Стоп' : IC.pause + ' Stop') : (currentLang === 'ru' ? IC.rocket + ' Запустить' : IC.rocket + ' Start');
  var toggleClass = node.isActive ? 'btn-warning' : 'btn-success';
  panel.innerHTML = '<div class="nap-header">' +
    '<span>' + node.emoji + ' ' + escHtml(node.name) + '</span>' +
    '<button class="modal-close" onclick="this.closest(\'.network-agent-panel\').remove()" style="background:none;border:none;color:#999;font-size:1.2rem;cursor:pointer">&times;</button>' +
  '</div>' +
  '<div class="nap-body">' +
    '<p>' + (currentLang === 'ru' ? 'Роль' : 'Role') + ': <strong>' + node.role + '</strong></p>' +
    '<p>Lv.' + (node.level || 1) + ' | XP: ' + (node.xp || 0) + '</p>' +
    '<p>' + statusText + '</p>' +
    '<div class="nap-actions">' +
      '<button class="btn btn-sm ' + toggleClass + '" onclick="toggleAgent(' + node.id + ',' + node.isActive + ');this.closest(\'.network-agent-panel\').remove()">' + toggleText + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="loadAgentLogs(' + node.id + ')">' + IC.clipboard + ' Logs</button>' +
    '</div>' +
  '</div>';
  container.querySelector('.page-content').appendChild(panel);
}

// ===== NETWORK MAP SEARCH =====
function filterNetworkNodes(query) {
  _networkSearchQuery = (query || '').trim();
}

// ===== NETWORK MAP DELETE =====
function showNetworkDeleteConfirm(node) {
  var container = document.getElementById('network-page');
  if (!container) return;
  // Remove any existing panels/dialogs
  var existing = document.getElementById('network-agent-panel');
  if (existing) existing.remove();
  var existingDialog = document.getElementById('network-delete-dialog');
  if (existingDialog) existingDialog.remove();

  var dialog = document.createElement('div');
  dialog.id = 'network-delete-dialog';
  dialog.className = 'network-delete-dialog';
  var title = currentLang === 'ru' ? 'Удалить агента?' : 'Delete agent?';
  var msg = currentLang === 'ru'
    ? 'Вы уверены, что хотите удалить <strong>' + escHtml(node.name) + '</strong>? Это действие нельзя отменить.'
    : 'Are you sure you want to delete <strong>' + escHtml(node.name) + '</strong>? This cannot be undone.';
  var cancelText = currentLang === 'ru' ? 'Отмена' : 'Cancel';
  var deleteText = currentLang === 'ru' ? 'Удалить' : 'Delete';

  dialog.innerHTML = '<h3>' + node.emoji + ' ' + title + '</h3>' +
    '<p>' + msg + '</p>' +
    '<div class="dialog-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="this.closest(\'.network-delete-dialog\').remove()">' + cancelText + '</button>' +
      '<button class="btn btn-sm" style="background:#e74c3c;color:#fff;border:none" onclick="confirmNetworkDelete(' + node.id + ')">' + deleteText + '</button>' +
    '</div>';
  container.querySelector('.page-content').appendChild(dialog);
}

async function confirmNetworkDelete(agentId) {
  var dialog = document.getElementById('network-delete-dialog');
  try {
    await apiRequest('DELETE', '/api/agents/' + agentId);
    showNotification(currentLang === 'ru' ? 'Агент удалён' : 'Agent deleted', 'success');
    // Reload network map
    loadNetworkMap();
  } catch (e) {
    showNotification(currentLang === 'ru' ? 'Ошибка удаления' : 'Delete failed', 'error');
  }
  if (dialog) dialog.remove();
}

console.log('TON Agent Platform Dashboard v2.0 loaded successfully!');
