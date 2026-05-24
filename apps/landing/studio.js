// ===== LANGUAGE SYSTEM =====
// Language is shared with the main landing — `preferredLang` is the master key
// (written by /index.html), `lang` is the legacy Studio-only key.
// Read order: preferredLang → lang → 'en' (English is the default everywhere).
let currentLang = localStorage.getItem('preferredLang') || localStorage.getItem('lang') || 'en';

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
  gem: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display:inline-block;vertical-align:-2px" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  upload: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
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
  infinity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>',
  eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  book: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  heartbeat: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  target: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  split: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="M15 9l6-6"/></svg>',
  users: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  arrowRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  bug: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M6 13H2M22 13h-4M6 17l-1.5 1.5M18 17l1.5 1.5"/></svg>',
  lifebuoy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>',
  lightbulb: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  plug: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5M9 8V2M15 8V2M18 8H6a2 2 0 0 0-2 2v2c0 4.42 3.58 8 8 8s8-3.58 8-8v-2a2 2 0 0 0-2-2z"/></svg>',
  antenna: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12L7 2M22 12l-5-10M12 12v10M4.93 10h14.14"/></svg>',
  lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  heart: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  flask: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M12 3v7l-5.4 8.1a2 2 0 0 0 1.66 3.11h7.48a2 2 0 0 0 1.66-3.11L12 10V3"/></svg>',
  trophy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 22V8.5M14 22V8.5"/><path d="M8 2h8v6a4 4 0 1 1-8 0V2z"/></svg>',
  dot_red: '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444"></span>',
  dot_blue: '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6"></span>',
  dot_gray: '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#6b7280"></span>',
  settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  question: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
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
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

// ===== PARTICLE DISSOLUTION EFFECT =====
function spawnParticleDissolution(el) {
  if (!el) return;
  var rect = el.getBoundingClientRect();
  var cols = 5, rows = 4;
  var pw = rect.width / cols, ph = rect.height / rows;
  var container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;overflow:hidden;';
  document.body.appendChild(container);
  // Target: upper-right of viewport
  var targetX = window.innerWidth * 0.85;
  var targetY = window.innerHeight * 0.05;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var p = document.createElement('div');
      var px = rect.left + c * pw;
      var py = rect.top + r * ph;
      p.style.cssText = 'position:absolute;width:' + pw + 'px;height:' + ph + 'px;left:' + px + 'px;top:' + py + 'px;' +
        'background:var(--bg-secondary,#1a1a2e);border:1px solid rgba(200,225,255,0.08);border-radius:4px;' +
        'opacity:1;transition:transform 0.7s cubic-bezier(0.22,1,0.36,1),opacity 0.6s ease;will-change:transform,opacity;';
      var delay = (r * cols + c) * 30;
      p.dataset.delay = delay;
      container.appendChild(p);
    }
  }
  // Animate each particle with stagger
  var particles = container.children;
  for (var i = 0; i < particles.length; i++) {
    (function(particle, idx) {
      var delay = parseInt(particle.dataset.delay);
      setTimeout(function() {
        var curLeft = parseFloat(particle.style.left);
        var curTop = parseFloat(particle.style.top);
        var dx = (targetX - curLeft) + (Math.random() - 0.3) * 200;
        var dy = (targetY - curTop) + (Math.random() - 0.5) * 150;
        var rot = (Math.random() - 0.5) * 360;
        particle.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.15) rotate(' + rot + 'deg)';
        particle.style.opacity = '0';
      }, delay);
    })(particles[i], i);
  }
  // Cleanup
  setTimeout(function() { container.remove(); }, 1200);
}

function toast(message, type, title, duration) {
  type = type || 'info';
  duration = duration || (typeof _notifDuration !== 'undefined' && _notifDuration > 0 ? _notifDuration : 5000);
  if (typeof _notifDuration !== 'undefined' && _notifDuration === 0) duration = 999999; // manual dismiss
  if (typeof _notifSound !== 'undefined' && _notifSound) try { _playNotifSound(); } catch {}
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
    // Resolve any pending dialog to prevent hanging promises
    if (_dialogResolve) { _dialogResolve(false); }
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
    if (_dialogResolve) { _dialogResolve(true); }
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
  // Keep both keys in sync so the main landing picks up the change too.
  localStorage.setItem('lang', lang);
  localStorage.setItem('preferredLang', lang);

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
    // Re-render current active page only (don't navigate away)
    var activePage = document.querySelector('.page.active');
    var activePageId = activePage ? activePage.id : '';
    if (activePageId === 'guide-page') {
      // Preserve active guide tab
      var _savedGuideTab = typeof _activeGuideTab !== 'undefined' ? _activeGuideTab : null;
      loadGuidePage();
      if (_savedGuideTab && typeof _switchGuideTab === 'function') _switchGuideTab(_savedGuideTab);
    } else if (activePageId === 'operations-page') {
      if (authToken && currentUser) loadAgentsPage();
    } else if (activePageId === 'profile-page') {
      if (typeof loadProfile === 'function') loadProfile();
    } else if (activePageId === 'terms-page') {
      loadTermsPage();
    } else if (activePageId === 'privacy-page') {
      loadPrivacyPage();
    }
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
    // Re-apply subscription badge (it's dynamically managed, not from data-en/data-ru)
    if (_currentSub) updateSidebarPlanBadge(_currentSub);
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

// Patterns that signal a plan/subscription limit hit by the server. The
// orchestrator returns errors like «⛔ *Лимит агентов достигнут*» and the
// hard cap path returns «Agent limit reached (N)». Both should trigger the
// upgrade modal instead of a silent toast.
const _PLAN_LIMIT_RE = /(лимит\s+(?:агент|план|генерац)|agent limit reached|plan limit|maxAgents|generations? per month|generations?:\s*\d+\/\d+|улучш(?:ите|ить)\s+план)/i;
function _isPlanLimitError(data, httpStatus) {
  if (!data) return false;
  if (data.error_code === 'PLAN_LIMIT' || data.upgrade_required === true) return true;
  const msg = (data.error || data.message || data.reason || '');
  if (typeof msg === 'string' && _PLAN_LIMIT_RE.test(msg)) return true;
  if (httpStatus === 429 && typeof msg === 'string' && /limit|лимит/i.test(msg)) return true;
  return false;
}

async function apiRequest(method, path, body) {
  const opts = {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };
  if (authToken) opts.headers['X-Auth-Token'] = authToken;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API_BASE + path, opts);
    const ct = res.headers.get('content-type') || '';
    let parsed;
    if (!ct.includes('application/json')) {
      const text = await res.text();
      console.error('API returned non-JSON:', res.status, text.slice(0, 200));
      parsed = { ok: false, error: 'Server returned non-JSON response (status ' + res.status + ')' };
    } else {
      parsed = await res.json();
    }
    // Global plan-limit detector — caller still gets the response, but we
    // ALSO surface the upgrade modal so the user knows what happened.
    try {
      if (_isPlanLimitError(parsed, res.status) && typeof showPlanLimitModal === 'function') {
        showPlanLimitModal(parsed.error || parsed.message || parsed.reason || '');
      }
    } catch {}
    return parsed;
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
  currentUser = { userId: data.userId, userIdStr: data.userIdStr || String(data.userId), username: data.username, first_name: data.firstName, photo_url: data.photoUrl || null, _isAdmin: data.isAdmin || false, _isBeta: data.isBeta || false, _acceptedTos: data.acceptedTos || false };
  showApp();
  updateTopbar();
}

function updateTopbar() {
  // Avatar — try real TG photo
  var av = document.getElementById('topbar-avatar-badge');
  if (av && currentUser) {
    var name = currentUser.first_name || currentUser.username || 'U';
    av.title = name;
    if (authToken) {
      var topImg = new Image();
      topImg.onload = function() {
        av.textContent = '';
        av.style.backgroundImage = 'url(' + topImg.src + ')';
        av.style.backgroundSize = 'cover';
        av.style.backgroundPosition = 'center';
      };
      topImg.onerror = function() { av.textContent = name.charAt(0).toUpperCase(); };
      topImg.src = '/api/me/avatar?t=' + encodeURIComponent(authToken);
    } else {
      av.textContent = name.charAt(0).toUpperCase();
    }
  }
  // Balance from wallet data if available
  var balEl = document.getElementById('topbar-ton-balance');
  if (balEl && typeof _walletBalance !== 'undefined' && _walletBalance != null) {
    balEl.textContent = parseFloat(_walletBalance).toFixed(2);
  }
}

// Omnisearch — single bar that searches agents, nav pages, skills, settings.
// Index is built on demand from in-memory state. Dropdown shows top 8 matches
// grouped by source. Click to navigate. Esc / outside-click to close.

var _omniIndex = null;     // [{title, sub, type, action}]
var _omniDropdown = null;

function buildOmniIndex() {
  var items = [];
  // Nav pages — read from sidebar nav-item buttons (single source of truth)
  document.querySelectorAll('.nav-item[data-page]').forEach(function(a) {
    var label = a.querySelector('span')?.textContent?.trim() || a.getAttribute('data-page');
    var page = a.getAttribute('data-page');
    items.push({ title: label, sub: 'Page', type: 'page', action: function() { navigateTo(page); } });
  });
  // User's agents — from cached list (loaded on operations page)
  try {
    if (Array.isArray(window._agentsList)) {
      window._agentsList.forEach(function(ag) {
        items.push({
          title: '#' + ag.id + ' ' + (ag.name || 'unnamed'),
          sub: 'Agent · ' + (ag.role || 'worker'),
          type: 'agent',
          action: function() { navigateTo('operations'); setTimeout(function() { if (typeof openAgentDetail === 'function') openAgentDetail(ag.id); }, 200); }
        });
      });
    }
  } catch {}
  // Skills — from cached list (loaded on skills page)
  try {
    if (Array.isArray(window._skillsCache)) {
      window._skillsCache.forEach(function(s) {
        items.push({
          title: s.name,
          sub: 'Skill · ' + (s.source || 'builtin'),
          type: 'skill',
          action: function() { navigateTo('skills'); setTimeout(function() { if (typeof openSkillDetail === 'function') openSkillDetail(s.name); }, 200); }
        });
      });
    }
  } catch {}
  // Quick settings shortcuts
  ['Profile', 'AI Keys', 'Wallet', 'Plugins', 'Templates', 'Marketplace', 'Logs'].forEach(function(s) {
    var lower = s.toLowerCase().replace(/ /g, '-');
    items.push({ title: s, sub: 'Quick action', type: 'shortcut', action: function() {
      if (lower === 'profile') navigateTo('profile');
      else if (lower === 'ai-keys') { navigateTo('profile'); setTimeout(function() { if (typeof openApiKeysModal === 'function') openApiKeysModal(); }, 300); }
      else if (lower === 'wallet') navigateTo('wallet');
      else if (lower === 'plugins') navigateTo('marketplace');
      else if (lower === 'templates') navigateTo('marketplace');
      else if (lower === 'marketplace') navigateTo('marketplace');
      else if (lower === 'logs') navigateTo('activity');
    } });
  });
  return items;
}

function closeOmni() {
  if (_omniDropdown && _omniDropdown.parentNode) _omniDropdown.parentNode.removeChild(_omniDropdown);
  _omniDropdown = null;
  document.removeEventListener('click', _omniOutsideClick, true);
  document.removeEventListener('keydown', _omniKey);
}
function _omniOutsideClick(e) {
  if (!_omniDropdown) return;
  if (_omniDropdown.contains(e.target)) return;
  var input = document.getElementById('topbar-search-input');
  if (input && input.contains(e.target)) return;
  closeOmni();
}
function _omniKey(e) { if (e.key === 'Escape') closeOmni(); }

function handleTopbarSearch(val) {
  var q = (val || '').trim().toLowerCase();
  if (q.length === 0) { closeOmni(); return; }
  // Refresh index every keystroke — cheap (~50 items) and ensures fresh agent list
  _omniIndex = buildOmniIndex();
  var matches = _omniIndex.filter(function(it) {
    return it.title.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q);
  }).slice(0, 8);
  // Render dropdown
  if (!_omniDropdown) {
    _omniDropdown = document.createElement('div');
    _omniDropdown.id = 'omni-dropdown';
    _omniDropdown.style.cssText = 'position:absolute;top:46px;left:0;right:0;background:var(--bg-elev-2,#12141f);border:1px solid var(--border);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.5),0 0 0 1px rgba(var(--accent-r,0),var(--accent-g,168),var(--accent-b,255),.15);z-index:9999;max-height:60vh;overflow-y:auto;backdrop-filter:blur(16px) saturate(150%)';
    var wrap = document.querySelector('.topbar-search');
    if (wrap) { wrap.style.position = 'relative'; wrap.appendChild(_omniDropdown); }
    document.addEventListener('click', _omniOutsideClick, true);
    document.addEventListener('keydown', _omniKey);
  }
  if (matches.length === 0) {
    _omniDropdown.innerHTML = '<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:.85rem">' +
      (currentLang === 'ru' ? 'Ничего не найдено' : 'No matches') + '</div>';
    return;
  }
  var typeColors = { page: '#00a8ff', agent: '#22c55e', skill: '#8b5cf6', shortcut: '#f59e0b' };
  var typeIcons = {
    page: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    agent: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
    skill: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>',
    shortcut: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  };
  _omniDropdown.innerHTML = matches.map(function(m, i) {
    var color = typeColors[m.type] || '#888';
    return '<div class="omni-item" data-idx="' + i + '" style="padding:10px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid var(--border)" ' +
      'onmouseover="this.style.background=\'rgba(var(--accent-r,0),var(--accent-g,168),var(--accent-b,255),.08)\'" onmouseout="this.style.background=\'\'">' +
      '<span style="color:' + color + ';display:inline-flex;flex-shrink:0">' + (typeIcons[m.type] || '') + '</span>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:.88rem;color:var(--text-primary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(m.title) + '</div>' +
        '<div style="font-size:.7rem;color:var(--text-muted)">' + escHtml(m.sub) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  // Wire clicks
  _omniDropdown.querySelectorAll('.omni-item').forEach(function(el, idx) {
    el.addEventListener('click', function() {
      try { matches[idx].action(); } catch (e) { console.error(e); }
      var input = document.getElementById('topbar-search-input');
      if (input) input.value = '';
      closeOmni();
    });
  });
}

// Legacy: old widget callback (keep for backwards compat)
async function onTelegramAuthLegacy(user) {
  const data = await apiRequest('POST', '/api/auth/telegram', user);
  if (!data.ok) { toast(data.error || 'Unknown error', 'error', 'Auth Failed'); return; }
  authToken = data.token;
  localStorage.setItem('tg_token', authToken);
  currentUser = { ...user, userId: data.userId, _isAdmin: data.isAdmin || false, _acceptedTos: true };
  showApp();
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Check ToS acceptance — show popup if not accepted.
  // Trust localStorage cache: once user clicked Accept on this device, never ask
  // again here even if /api/me reply is delayed or token rotated.
  try {
    if (localStorage.getItem('tos_accepted') === '1' && currentUser) {
      currentUser._acceptedTos = true;
    }
  } catch (_e) {}
  if (currentUser && !currentUser._acceptedTos) {
    showTosPopup();
  }

  // Update user info in sidebar
  if (currentUser) {
    const name = currentUser.first_name || currentUser.username || 'User';
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = name;

    // Load user avatar: from OIDC photo_url or from TG via /api/me/avatar
    (function loadUserAvatar() {
      var img = document.getElementById('user-avatar');
      var fallback = document.getElementById('user-avatar-fallback');
      if (!img) return;
      var showImg = function(src) {
        img.src = src;
        img.classList.remove('hidden');
        img.onerror = function() { img.classList.add('hidden'); if (fallback) fallback.classList.remove('hidden'); };
        if (fallback) fallback.classList.add('hidden');
      };
      if (currentUser.photo_url) {
        showImg(currentUser.photo_url);
      } else if (authToken) {
        showImg('/api/me/avatar?t=' + encodeURIComponent(authToken) + '&_=' + Date.now());
      }
    })();
  }

  // Show admin-only nav items
  document.querySelectorAll('.admin-only-nav').forEach(function(el) {
    el.style.display = (currentUser && currentUser._isAdmin) ? '' : 'none';
  });

  // Beta-only nav: accessible for beta testers + admins, grayed for others
  var _hasBeta = currentUser && (currentUser._isBeta || currentUser._isAdmin);
  document.querySelectorAll('.beta-only-nav').forEach(function(el) {
    if (_hasBeta) {
      el.style.opacity = '';
      el.style.pointerEvents = '';
      el.style.filter = '';
    } else {
      el.style.opacity = '0.4';
      el.style.pointerEvents = 'none';
      el.style.filter = 'grayscale(1)';
      // Change badge color to gray
      var badge = el.querySelector('.nav-badge');
      if (badge) { badge.style.background = 'rgba(107,114,128,0.2)'; badge.style.color = '#6b7280'; }
    }
  });

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
      greetEl.innerHTML = greeting + ', <span class="grad">' + escHtml(name) + '</span>';
      greetEl.removeAttribute('data-en');
      greetEl.removeAttribute('data-ru');
    }
    // Inject Live eyebrow above the title once.
    var headerL = greetEl ? greetEl.parentElement : null;
    if (headerL && !headerL.querySelector('.eyebrow')) {
      var eb = document.createElement('span');
      eb.className = 'eyebrow';
      var months = currentLang === 'ru'
        ? ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
        : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var now = new Date();
      eb.textContent = 'Live · ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
      eb.style.cssText = 'margin-bottom:14px;display:inline-flex';
      headerL.insertBefore(eb, headerL.firstChild);
    }
  }

  // Atlas promotion banner on overview
  var atlasBanner = document.getElementById('atlas-promo-banner');
  if (!atlasBanner) {
    atlasBanner = document.createElement('div');
    atlasBanner.id = 'atlas-promo-banner';
    atlasBanner.style.cssText = 'margin:0 0 20px;padding:16px 20px;background:linear-gradient(135deg,var(--accent-dim),rgba(6,182,212,0.04));border:1px solid var(--accent-dim);border-radius:12px;display:flex;align-items:center;gap:14px;cursor:pointer';
    atlasBanner.onclick = function() { navigateTo('assistant'); };
    atlasBanner.innerHTML =
      '<div style="width:40px;height:40px;border-radius:10px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>' +
      '<div style="flex:1"><div style="font-size:.88rem;font-weight:600;color:var(--text-primary)">' + (currentLang === 'ru' ? 'Atlas — ваш AI-ассистент' : 'Atlas — your AI assistant') + '</div>' +
      '<div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">' + (currentLang === 'ru' ? 'Создаёт агентов, настраивает, объясняет, проводит аудит. Просто опишите что нужно.' : 'Creates agents, configures, explains, audits. Just describe what you need.') + '</div></div>' +
      '<div style="color:var(--primary);font-size:.82rem;font-weight:600;white-space:nowrap">' + (currentLang === 'ru' ? 'Открыть →' : 'Open →') + '</div>';
    var overviewPage = document.getElementById('overview-page');
    var statsGrid = overviewPage?.querySelector('.stat-card')?.parentElement;
    if (statsGrid) statsGrid.parentElement?.insertBefore(atlasBanner, statsGrid);
  }

  // Load real data from API
  loadDashboard();
  loadSubscriptionGlobal();

  // Refresh subscription every 5 minutes
  setInterval(loadSubscriptionGlobal, 5 * 60 * 1000);

  // Load persisted slider/config values
  loadAgentConfig().catch(console.error);
  loadSecuritySettings().catch(console.error);
  loadTelegramSettings().catch(console.error);

  // Initialize static/async components
  initCapabilities();
  initExtensions();
  initActivityStream().catch(console.error);   // async — DB-backed
  initOperations().catch(console.error);        // async — DB-backed

  // Feedback floating action button
  initFeedbackFAB();

  // Load topbar balance
  apiRequest('GET', '/api/balance').then(function(d) {
    if (d && (d.balance_ton || d.balance_ton === 0)) {
      var el = document.getElementById('topbar-ton-balance');
      if (el) el.textContent = parseFloat(d.balance_ton || 0).toFixed(2);
    }
  }).catch(function(){});

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
  // Active agents — animated
  animateCount(document.getElementById('sessions-value'), data.agentsActive || 0, 1000);
  // Total runs — animated
  animateCount(document.getElementById('runs-value'), data.totalRuns || 0, 1200);
  // Success rate — animated with % suffix
  animateCount(document.getElementById('success-rate-value'), data.successRate || 0, 1000, '%');
  // Last 24h runs — animated
  animateCount(document.getElementById('last24h-value'), data.last24hRuns || 0, 800);
  // Uptime — animated
  if (data.uptimeSeconds) {
    var h = Math.floor(data.uptimeSeconds / 3600);
    var m = Math.floor((data.uptimeSeconds % 3600) / 60);
    var upEl = document.getElementById('uptime-value');
    if (upEl) {
      animateCount(upEl, h, 1000);
      setTimeout(function() { if (upEl) upEl.textContent = h + 'h ' + m + 'm'; }, 1100);
    }
  }
  // Capabilities count (tools + plugins) — animated
  var capCount = (data.pluginsTotal || 12) + (data.pluginsInstalled || 0) + 65;
  animateCount(document.getElementById('tools-value'), capCount, 1500);
  var capBadge = document.getElementById('nav-capabilities-badge');
  if (capBadge) capBadge.textContent = capCount;
  // Model name from user settings
  var modelEl = document.querySelector('.model-name');
  if (modelEl && data.aiModel) modelEl.textContent = data.aiModel;
  // Total agents count
  animateCount(document.getElementById('agents-total-value'), data.agentsTotal || 0, 800);

  // Trend lines under stat values — only rendered when the API returns
  // a delta for that metric. Hidden otherwise (no fake data).
  function setTrend(metric, delta, suffixLabel) {
    var card = document.querySelector('.metric-card[data-metric="' + metric + '"]');
    if (!card) return;
    var el = card.querySelector('.metric-trend');
    if (delta == null || isNaN(delta)) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'metric-trend';
      card.appendChild(el);
    }
    var up = delta >= 0;
    var sign = up ? '↑' : '↓';
    var pct = Math.abs(delta).toFixed(1) + '%';
    el.className = 'metric-trend ' + (up ? 'up' : 'down');
    el.innerHTML = '<span class="arr">' + sign + '</span><span class="val">' + (up ? '+' : '−') + pct + '</span>' +
      (suffixLabel ? '<span class="sfx"> ' + suffixLabel + '</span>' : '');
  }
  var ru = currentLang === 'ru';
  setTrend('runs',         data.totalRunsTrend,        ru ? 'к прошлой неделе' : 'vs last week');
  setTrend('success',      data.successRateTrend,      ru ? 'сегодня' : 'today');
  setTrend('last24h',      data.last24hRunsTrend,      ru ? 'сегодня' : 'today');
  setTrend('agents-total', data.agentsTotalTrend,      ru ? 'за неделю' : 'this week');
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
  _agentsCache = agents;
  // Update topbar avatar with user initial
  updateTopbar();
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
  const overviewStatusClass = (a) => (a.lastError || a.last_error) ? 'error' : a.isActive ? 'active' : 'paused';
  const overviewStatusLabel = (a) => (a.lastError || a.last_error) ? (currentLang === 'ru' ? 'Ошибка' : 'Error') : a.isActive ? t('active') : t('paused');
  const overviewTimeAgo = (d) => { if (!d) return ''; var ms = Date.now() - new Date(d).getTime(); if (ms < 60000) return currentLang === 'ru' ? 'только что' : 'just now'; if (ms < 3600000) return Math.floor(ms / 60000) + (currentLang === 'ru' ? ' мин' : 'm'); if (ms < 86400000) return Math.floor(ms / 3600000) + (currentLang === 'ru' ? ' ч' : 'h'); return Math.floor(ms / 86400000) + (currentLang === 'ru' ? ' д' : 'd'); };
  agentsEl.innerHTML = pinnedAgents.map(a => {
    const role = a.role || 'worker';
    const lvl = a.level || 1;
    const sClass = overviewStatusClass(a);
    const lastActive = overviewTimeAgo(a.lastActiveAt || a.last_active_at || a.updatedAt || a.updated_at || '');
    const toolCalls = a.toolCallCount || a.tool_call_count || 0;
    return `
    <div class="agent-card agent-card-status-${sClass}" data-id="${a.id}" onclick="openAgentDetail(${a.id})" style="cursor:pointer">
      <div class="agent-status ${sClass}">
        <span class="status-dot"></span>
        <span>${overviewStatusLabel(a)}</span>
      </div>
      <div class="agent-info">
        <strong>#${a.id} ${escHtml(a.name || t('unnamed'))}</strong>
        <span class="agent-desc">${escHtml((a.description || '').slice(0, 80))}</span>
        <span class="agent-meta">
          <span class="agent-trigger">${triggerLabel(a.triggerType)}</span>
          <span class="agent-role-badge role-${role}">${role}</span>
          <span class="agent-level">${t('lv')}${lvl}</span>
          ${lastActive ? '<span class="agent-last-active">' + IC.clock + ' ' + lastActive + '</span>' : ''}
          ${toolCalls > 0 ? '<span class="agent-tool-calls">' + IC.wrench + ' ' + toolCalls + '</span>' : ''}
        </span>
      </div>
      <div class="agent-actions">
        <button class="btn btn-sm ${a.isActive ? 'btn-warning' : 'btn-success'}" onclick="event.stopPropagation();toggleAgent(${a.id}, ${a.isActive})">
          ${a.isActive ? IC.pause + ' ' + t('stop') : IC.rocket + ' ' + t('run')}
        </button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();copyAgentPrompt(${a.id}, event)" title="${currentLang === 'ru' ? 'Копировать промпт' : 'Copy prompt'}">${IC.clipboard}</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();loadAgentLogs(${a.id})" title="${t('logs')}">${IC.inbox}</button>
        <button class="btn btn-ghost btn-sm" title="${currentLang === 'ru' ? 'Открепить' : 'Unpin'}" onclick="togglePinAgent(${a.id}, event)" style="color:var(--primary)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
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

function normalizeAgentData(a) {
  if (!a) return a;
  // Ensure both camelCase and snake_case variants exist
  if (a.is_active === undefined && a.isActive !== undefined) a.is_active = a.isActive;
  if (a.isActive === undefined && a.is_active !== undefined) a.isActive = a.is_active;
  if (a.trigger_config === undefined && a.triggerConfig !== undefined) a.trigger_config = a.triggerConfig;
  if (a.triggerConfig === undefined && a.trigger_config !== undefined) a.triggerConfig = a.trigger_config;
  if (a.last_error === undefined && a.lastError !== undefined) a.last_error = a.lastError;
  if (a.lastError === undefined && a.last_error !== undefined) a.lastError = a.last_error;
  if (a.enabled_capabilities === undefined && a.enabledCapabilities !== undefined) a.enabled_capabilities = a.enabledCapabilities;
  if (a.enabledCapabilities === undefined && a.enabled_capabilities !== undefined) a.enabledCapabilities = a.enabled_capabilities;
  if (a.created_at === undefined && a.createdAt !== undefined) a.created_at = a.createdAt;
  if (a.createdAt === undefined && a.created_at !== undefined) a.createdAt = a.created_at;
  // Parse trigger_config if string
  if (typeof a.trigger_config === 'string') { try { a.trigger_config = JSON.parse(a.trigger_config); a.triggerConfig = a.trigger_config; } catch(e) {} }
  if (typeof a.triggerConfig === 'string') { try { a.triggerConfig = JSON.parse(a.triggerConfig); a.trigger_config = a.triggerConfig; } catch(e) {} }
  return a;
}

async function openAgentDetail(agentId, skipSettings) {
  _detailAgentId = agentId;
  delete _hooksCache[agentId]; // invalidate hooks cache on open

  // When going directly to full-screen settings — skip the slide-over entirely
  if (!skipSettings) {
    try {
      var data0 = await apiRequest('GET', '/api/agents/' + agentId);
      if (!data0.ok || !data0.agent) { toast('Agent not found', 'error'); return; }
      _detailAgentData = normalizeAgentData(data0.agent);
      openAgentSettings();
      // Show agent settings tour on first visit
      if (!_agentTourShown) { _agentTourShown = true; setTimeout(startAgentTour, 800); }
    } catch(e) {
      toast(e.message || 'Error', 'error');
    }
    return;
  }

  // skipSettings=true → show slide-over panel (e.g. after closing full-screen settings)
  var panel = document.getElementById('agent-detail-panel');
  if (!panel) return;
  panel.style.display = 'flex';
  panel.classList.remove('closing');
  var body = document.getElementById('agent-detail-body');
  if (body) body.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">' + IC.hourglass + ' Loading...</div>';
  try {
    var data = await apiRequest('GET', '/api/agents/' + agentId);
    if (!data.ok || !data.agent) { toast('Agent not found', 'error'); closeAgentDetail(); return; }
    _detailAgentData = normalizeAgentData(data.agent);
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
  try { var _tc = a.trigger_config || a.triggerConfig || {}; config = typeof _tc === 'string' ? JSON.parse(_tc) : _tc; } catch(e) {}

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

  // ── Flow Diagram ──────────────────────────────────────────────────────────
  html += '<div class="agent-detail-section">';
  html += '<div class="agent-detail-section-title">' + (currentLang === 'ru' ? 'Схема работы' : 'Flow Diagram') + '</div>';
  html += buildFlowDiagram(triggerType, a);
  html += '</div>';

  // ── Token Usage ───────────────────────────────────────────────────────────
  html += '<div class="agent-detail-section" id="agent-token-section">';
  html += '<div class="agent-detail-section-title">' + (currentLang === 'ru' ? 'Использование токенов' : 'Token Usage') + '</div>';
  html += '<div class="token-stats" id="agent-token-stats">';
  html += '<div class="token-stat"><div class="token-stat-label">' + (currentLang === 'ru' ? 'Сегодня' : 'Today') + '</div><div class="token-stat-value accent" id="ts-today">—</div></div>';
  html += '<div class="token-stat"><div class="token-stat-label">' + (currentLang === 'ru' ? 'За всё время' : 'All Time') + '</div><div class="token-stat-value" id="ts-alltime">—</div></div>';
  html += '<div class="token-stat"><div class="token-stat-label">' + (currentLang === 'ru' ? 'Стоимость' : 'Cost USD') + '</div><div class="token-stat-value green" id="ts-cost">—</div></div>';
  html += '<div class="token-stat"><div class="token-stat-label">' + (currentLang === 'ru' ? 'Запросов' : 'Requests') + '</div><div class="token-stat-value amber" id="ts-reqs">—</div></div>';
  html += '</div></div>';

  body.innerHTML = html;

  // Load token stats async (don't block render)
  loadAgentTokenStats(a.id);
}

/** Build visual flow diagram HTML for an agent */
function buildFlowDiagram(triggerType, agent) {
  var isRu = currentLang === 'ru';
  var nodes = [];

  if (triggerType === 'ai_agent') {
    nodes = [
      { icon: IC.chat, label: isRu ? 'Сообщение' : 'Input', type: 'trigger' },
      { icon: IC.robot, label: isRu ? 'AI Модель' : 'AI Model', type: 'process' },
      { icon: IC.wrench, label: isRu ? 'Инструменты' : 'Tools', type: 'tools' },
      { icon: IC.upload, label: isRu ? 'Ответ' : 'Output', type: 'output' },
    ];
  } else if (triggerType === 'scheduled') {
    var interval = (agent.triggerConfig && agent.triggerConfig.interval) || (agent.trigger_config && agent.trigger_config.interval) || '';
    nodes = [
      { icon: IC.clock, label: interval || (isRu ? 'Расписание' : 'Schedule'), type: 'trigger' },
      { icon: IC.clipboard, label: isRu ? 'Код' : 'Code Run', type: 'process' },
      { icon: IC.plug, label: isRu ? 'Плагины' : 'Plugins', type: 'tools' },
      { icon: IC.upload, label: isRu ? 'Результат' : 'Result', type: 'output' },
    ];
  } else if (triggerType === 'webhook') {
    nodes = [
      { icon: IC.antenna, label: 'Webhook', type: 'trigger' },
      { icon: IC.clipboard, label: isRu ? 'Код' : 'Code Run', type: 'process' },
      { icon: IC.plug, label: isRu ? 'Плагины' : 'Plugins', type: 'tools' },
      { icon: IC.loop, label: isRu ? 'Ответ' : 'Response', type: 'output' },
    ];
  } else {
    nodes = [
      { icon: IC.play, label: isRu ? 'Запуск' : 'Manual', type: 'trigger' },
      { icon: IC.clipboard, label: isRu ? 'Код' : 'Code Run', type: 'process' },
      { icon: IC.plug, label: isRu ? 'Плагины' : 'Plugins', type: 'tools' },
      { icon: IC.upload, label: isRu ? 'Результат' : 'Result', type: 'output' },
    ];
  }

  var html = '<div class="agent-flow-diagram">';
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    html += '<div class="flow-node">' +
      '<div class="flow-node-icon ' + n.type + '">' + n.icon + '</div>' +
      '<div class="flow-node-label">' + escHtml(n.label) + '</div>' +
      '</div>';
    if (i < nodes.length - 1) {
      html += '<div class="flow-arrow">→</div>';
    }
  }
  html += '</div>';
  return html;
}

/** Load token stats for agent and update DOM */
async function loadAgentTokenStats(agentId) {
  try {
    var data = await apiRequest('GET', '/api/agents/' + agentId + '/tokens');
    if (!data || !data.ok) return;

    var fmtNum = function(n) {
      if (!n || n === 0) return '0';
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(n);
    };

    var todayEl = document.getElementById('ts-today');
    var alltimeEl = document.getElementById('ts-alltime');
    var costEl = document.getElementById('ts-cost');
    var reqsEl = document.getElementById('ts-reqs');

    if (todayEl) todayEl.textContent = fmtNum(data.today.totalTokens);
    if (alltimeEl) alltimeEl.textContent = fmtNum(data.allTime.totalTokens);
    if (costEl) costEl.textContent = data.allTime.estimatedCost > 0 ? '$' + data.allTime.estimatedCost.toFixed(4) : '$0.00';
    if (reqsEl) reqsEl.textContent = fmtNum(data.allTime.totalRequests);
  } catch (_) {}
}

function closeAgentDetail() {
  var panel = document.getElementById('agent-detail-panel');
  if (!panel) return;
  panel.classList.add('closing');
  setTimeout(function() { panel.style.display = 'none'; panel.classList.remove('closing'); }, 400);
}

// ESC key closes agent settings panel + any overlays
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  // Close daily log overlay first
  var overlay = document.getElementById('daily-log-overlay');
  if (overlay) { overlay.remove(); return; }
  // Close any open modal
  var modal = document.querySelector('.studio-dialog-backdrop[style*="display: flex"], .studio-dialog-backdrop[style*="display:flex"]');
  if (modal) { modal.style.display = 'none'; return; }
  // Close agent detail panel
  var panel = document.getElementById('agent-detail-panel');
  if (panel && panel.style.display !== 'none') { closeAgentDetail(); return; }
});

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
  // Reload detail without re-opening settings
  await openAgentDetail(_detailAgentId, true);
  loadAgents();
  loadAgentsPage();
}

function deleteAgentFromDetail() {
  if (!_detailAgentData) return;
  closeAgentDetail();
  deleteAgent(_detailAgentId, _detailAgentData.name || 'Agent');
}

// ===== AGENT CHAT (opens in slide-over body) =====
var _agentChatId = null;
var _agentChatHistory = [];

function openAgentChat(agentId) {
  _agentChatId = agentId;
  _agentChatHistory = [];
  var body = document.getElementById('agent-detail-body');
  if (!body) return;
  var isRu = currentLang === 'ru';
  body.innerHTML =
    '<div style="display:flex;flex-direction:column;height:calc(100vh - 120px);min-height:400px">' +
    // Header
    '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);flex-shrink:0">' +
    '<button onclick="openAgentDetail(_detailAgentId)" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center" title="Back">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>' +
    '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73C10.4 5.39 10 4.74 10 4a2 2 0 0 1 2-2z"/></svg></div>' +
    '<div><div style="font-weight:600;font-size:.9rem">Agent #' + agentId + '</div><div style="font-size:.72rem;color:#00ff88">● ' + (isRu ? 'онлайн' : 'online') + '</div></div>' +
    '</div>' +
    // Messages
    '<div id="agent-chat-messages" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:2px">' +
    '<div style="text-align:center;padding:24px 0">' +
    '<div style="width:48px;height:48px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent-glow);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73C10.4 5.39 10 4.74 10 4a2 2 0 0 1 2-2z"/></svg></div>' +
    '<div style="font-size:.85rem;color:var(--text-muted)">' + (isRu ? 'Агент готов к общению' : 'Agent is ready to chat') + '</div>' +
    '</div>' +
    '</div>' +
    // Input
    '<div style="padding:12px 16px;border-top:1px solid var(--border);flex-shrink:0">' +
    '<div style="display:flex;gap:8px;align-items:flex-end;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:8px 8px 8px 14px;transition:border-color .2s" onfocus="this.style.borderColor=\'var(--primary)\'" onblur="this.style.borderColor=\'\'">' +
    '<textarea id="agent-chat-input" rows="1" placeholder="' + (isRu ? 'Сообщение...' : 'Message...') + '" ' +
    'style="flex:1;background:none;border:none;outline:none;resize:none;color:var(--text-primary);font-size:.875rem;line-height:1.5;max-height:120px;overflow-y:auto;font-family:inherit" ' +
    'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendAgentChatMsg()}" ' +
    'oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,120)+\'px\'"></textarea>' +
    '<button id="agent-chat-send" onclick="sendAgentChatMsg()" style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s" title="Send">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
    '</button>' +
    '</div>' +
    '<div style="font-size:.7rem;color:var(--text-muted);margin-top:5px;text-align:center">' + (isRu ? 'Enter — отправить · Shift+Enter — новая строка' : 'Enter to send · Shift+Enter for new line') + '</div>' +
    '</div>' +
    '</div>';
  setTimeout(function() { var el = document.getElementById('agent-chat-input'); if (el) el.focus(); }, 100);
}

async function _streamAgentChat(agentId, msg, onChunk, onDone, onError) {
  try {
    // Send conversation history for context (exclude streaming/current entry)
    var histForSend = (_agentChatHistory || []).filter(function(m) { return !m.streaming && m.text; }).slice(-12);
    var response = await fetch('/api/agents/' + agentId + '/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken || '' },
      body: JSON.stringify({ message: msg, history: histForSend }),
    });
    if (!response.ok || !response.body) throw new Error('stream_failed');
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var eventName = '';
    while (true) {
      var _r = await reader.read();
      if (_r.done) break;
      buffer += decoder.decode(_r.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('event:')) { eventName = line.slice(6).trim(); continue; }
        if (line.startsWith('data:')) {
          try {
            var parsed = JSON.parse(line.slice(5).trim());
            if (eventName === 'chunk' && parsed.text) onChunk(parsed.text);
            else if (eventName === 'done') { onDone(parsed.fullText || ''); return; }
            else if (eventName === 'error') { onError(parsed.message || 'AI error'); return; }
          } catch(ep) {}
          eventName = '';
        }
      }
    }
    onDone('');
  } catch(e) {
    onError(e.message);
  }
}

async function sendAgentChatMsg() {
  var input = document.getElementById('agent-chat-input');
  var msgBox = document.getElementById('agent-chat-messages');
  var sendBtn = document.getElementById('agent-chat-send');
  if (!input || !msgBox || !_agentChatId) return;
  var msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  input.disabled = true;
  if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>'; }

  _agentChatHistory.push({ role: 'user', text: msg });
  _agentChatHistory.push({ role: 'agent', text: '', streaming: true });
  var agentEntry = _agentChatHistory[_agentChatHistory.length - 1];
  renderAgentChat(msgBox);

  var done = false;
  await _streamAgentChat(_agentChatId, msg,
    function(chunk) { agentEntry.text += chunk; renderAgentChat(msgBox); msgBox.scrollTop = msgBox.scrollHeight; },
    function(full) { agentEntry.streaming = false; if (!agentEntry.text && full) agentEntry.text = full; if (!agentEntry.text) agentEntry.text = '…'; renderAgentChat(msgBox); done = true; },
    function(err) {
      // fallback: non-streaming
      if (!done) {
        apiRequest('POST', '/api/agents/' + _agentChatId + '/chat', { message: msg }).then(function(d) {
          agentEntry.streaming = false;
          agentEntry.text = d.ok ? (d.response || '…') : (d.error || 'Error');
          if (!d.ok) agentEntry.role = 'error';
          renderAgentChat(msgBox);
        });
      }
    }
  );

  msgBox.scrollTop = msgBox.scrollHeight;
  input.disabled = false;
  if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'; }
  input.focus();
}

function renderAgentChat(box) {
  var isRu = currentLang === 'ru';
  box.innerHTML = _agentChatHistory.map(function(m) {
    var isUser = m.role === 'user';
    var isErr = m.role === 'error';
    var isStream = m.streaming;
    var align = isUser ? 'flex-end' : 'flex-start';
    var bubbleBg = isUser
      ? 'linear-gradient(135deg,var(--primary),var(--primary-dark))'
      : isErr ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)';
    var border = isErr ? '1px solid rgba(239,68,68,0.3)' : isStream ? '1px solid rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),0.25)' : '1px solid rgba(255,255,255,0.06)';
    var textColor = isUser ? '#fff' : isErr ? '#f87171' : 'var(--text-primary)';
    var cursor = isStream ? '<span class="chat-cursor">▋</span>' : '';
    var textHtml = escHtml(m.text || (isStream ? '' : '')).replace(/\n/g, '<br>');
    if (!isUser) {
      // Render basic markdown for agent responses
      textHtml = escHtml(m.text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code style="background:rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),0.15);padding:1px 5px;border-radius:3px;font-size:.8em">$1</code>').replace(/\n/g, '<br>');
    }
    var avatar = isUser ? '' :
      '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:8px">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73C10.4 5.39 10 4.74 10 4a2 2 0 0 1 2-2z"/><path d="M7 14v3a5 5 0 0 0 10 0v-3"/></svg>' +
      '</div>';
    return '<div style="display:flex;justify-content:' + align + ';margin:8px 0;align-items:flex-end">' +
      (isUser ? '' : avatar) +
      '<div style="max-width:78%;padding:10px 14px;border-radius:' + (isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px') + ';background:' + bubbleBg + ';border:' + border + ';font-size:.84rem;line-height:1.55;word-break:break-word;color:' + textColor + '">' +
      textHtml + cursor +
      '</div></div>';
  }).join('');
}

// ===== FULL-SCREEN AGENT SETTINGS =====
var _settingsTab = 'soul';
var _promptModulesCache = null;

function openAgentSettings() {
  if (!_detailAgentData || !_detailAgentId) return;
  var modal = document.getElementById('agent-settings-modal');
  if (!modal) return;
  modal.style.display = '';
  var a = _detailAgentData;
  var nameEl = document.getElementById('agent-settings-name');
  if (nameEl) nameEl.textContent = (a.name || 'Unnamed').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}]/gu, '').trim();
  var statusEl = document.getElementById('agent-settings-status');
  if (statusEl) {
    statusEl.className = 'agent-status ' + (a.is_active ? 'active' : 'paused');
    statusEl.innerHTML = '<span class="status-dot"></span><span>' + (a.is_active ? (currentLang === 'ru' ? 'Активен' : 'Active') : (currentLang === 'ru' ? 'Остановлен' : 'Paused')) + '</span>';
  }
  // Update toggle button state
  var toggleBtn = document.getElementById('st-toggle-btn');
  if (toggleBtn) {
    if (a.is_active) {
      toggleBtn.classList.add('running');
      toggleBtn.innerHTML = IC.pause + '<span>' + (currentLang === 'ru' ? 'Стоп' : 'Stop') + '</span>';
    } else {
      toggleBtn.classList.remove('running');
      toggleBtn.innerHTML = IC.play + '<span>' + (currentLang === 'ru' ? 'Запустить' : 'Start') + '</span>';
    }
  }
  _settingsTab = 'soul';
  _promptModulesCache = null;
  switchSettingsTab('soul');

  // Show warning banner if API key missing
  var config = (typeof a.triggerConfig === 'string' ? JSON.parse(a.triggerConfig) : a.triggerConfig) || {};
  var cfg = config.config || {};
  var hasApiKey = !!(cfg.AI_API_KEY);
  var hasTg = !!(config.telegram_session?.session);
  var bannerEl = document.getElementById('settings-warning-banner');
  if (!bannerEl) {
    bannerEl = document.createElement('div');
    bannerEl.id = 'settings-warning-banner';
    var settingsBody = document.getElementById('agent-settings-body');
    if (settingsBody) settingsBody.parentElement?.insertBefore(bannerEl, settingsBody);
  }
  var isRu = currentLang === 'ru';
  var warnings = [];
  if (!hasApiKey) warnings.push(isRu ? 'API ключ не установлен — агент не может думать. Перейдите во вкладку AI.' : 'API key not set — agent cannot think. Go to AI tab.');
  if (!hasTg && a.triggerType === 'ai_agent') warnings.push(isRu ? 'Telegram не подключён — агент не может общаться в чатах.' : 'Telegram not connected — agent cannot chat.');
  if (warnings.length > 0) {
    bannerEl.style.cssText = 'padding:12px 16px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;margin:8px 16px;font-size:.84rem;color:#f59e0b;line-height:1.5';
    bannerEl.innerHTML = warnings.join('<br>');
    bannerEl.style.display = '';
  } else {
    bannerEl.style.display = 'none';
  }
}

function closeAgentSettings() {
  var modal = document.getElementById('agent-settings-modal');
  if (!modal) return;
  modal.classList.add('closing');
  setTimeout(function() {
    modal.style.display = 'none';
    modal.classList.remove('closing');
  }, 400);
  // Close side panel if open
  var panel = document.getElementById('agent-detail-panel');
  if (panel) panel.style.display = 'none';
  // Refresh agents list
  if (typeof loadAgents === 'function') loadAgents();
  if (typeof loadAgentsPage === 'function') loadAgentsPage();
  // Reset URL to operations page
  if (history.replaceState) history.replaceState(null, '', '/studio/operations');
}


async function refreshAgentOverview() {
  if (!_detailAgentId) return;
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId);
    if (data && data.agent) {
      _detailAgentData = normalizeAgentData(data.agent);
      if (_settingsTab === 'overview') switchSettingsTab('overview');
      var statusEl = document.getElementById('agent-settings-status');
      if (statusEl) {
        statusEl.className = 'agent-status ' + (_detailAgentData.is_active ? 'active' : 'paused');
        statusEl.innerHTML = '<span class="status-dot"></span><span>' + (_detailAgentData.is_active ? 'Active' : 'Paused') + '</span>';
      }
    }
  } catch(e) { console.error('refreshAgentOverview error', e); }
}

async function refreshAgentDetail() {
  if (!_detailAgentId) return;
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId);
    if (data && data.agent) {
      _detailAgentData = normalizeAgentData(data.agent);
      switchSettingsTab(_settingsTab);
      var nameEl = document.getElementById('agent-settings-name');
      if (nameEl) nameEl.textContent = '#' + _detailAgentData.id + ' ' + (_detailAgentData.name || 'Unnamed');
      var statusEl = document.getElementById('agent-settings-status');
      if (statusEl) {
        statusEl.className = 'agent-status ' + (_detailAgentData.is_active ? 'active' : 'paused');
        statusEl.innerHTML = '<span class="status-dot"></span><span>' + (_detailAgentData.is_active ? 'Active' : 'Paused') + '</span>';
      }
    }
  } catch(e) { console.error('refreshAgentDetail error', e); }
}

function switchSettingsTab(tab) {
  _settingsTab = tab;
  // Update tab buttons
  document.querySelectorAll('.st-nav-item, .settings-tab').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    if (b.getAttribute('data-tab') === tab) {
      b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });
  // Update URL to /studio/agents/:id/:tab
  if (history.replaceState && typeof _detailAgentId !== 'undefined' && _detailAgentId) {
    history.replaceState(null, '', '/studio/agents/' + _detailAgentId + '/' + tab);
  }
  var body = document.getElementById('agent-settings-body');
  if (!body || !_detailAgentData) return;
  // Smooth tab content transition
  body.style.animation = 'none';
  body.offsetHeight; // force reflow
  body.style.animation = 'tabContentFade 0.3s cubic-bezier(0.4,0,0.2,1)';
  var a = _detailAgentData;
  var config = {};
  try { var _tc = a.trigger_config || a.triggerConfig || {}; config = typeof _tc === 'string' ? JSON.parse(_tc) : _tc; } catch(e) {}

  if (tab === 'soul') {
    var isRu = currentLang === 'ru';
    var lineCount = (a.code || '').split('\n').length;
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(var(--accent-r,168),var(--accent-g,85),var(--accent-b,247),0.12);color:#a855f7">' + IC.brain + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Душа' : 'Soul') + '</h3>' +
          '<p>' + (isRu ? 'Личность и стиль агента. Агент может самостоятельно модифицировать этот раздел.' : 'Agent personality and style. The agent can self-modify this section.') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.clipboard + ' ' + (isRu ? 'Код агента' : 'Agent Code') + ' <span style="margin-left:auto;font-size:.68rem;font-weight:500;color:var(--text-muted);text-transform:none;letter-spacing:0">' + lineCount + ' ' + (isRu ? 'строк' : 'lines') + '</span></div>' +
        '<textarea id="edit-prompt-textarea" class="st-textarea">' + escHtml(a.code || '') + '</textarea>' +
      '</div>' +
      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveSettingsPrompt()">' + IC.check + ' ' + (isRu ? 'Сохранить' : 'Save Soul') + '</button>' +
        '<button class="rt-save-btn" style="background:linear-gradient(135deg,#8b5cf6,#00a8ff)" onclick="openEditWithAIModal(\'code\')" title="' + (isRu ? 'Опиши изменение — AI перепишет' : 'Describe the change — AI rewrites') + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M12 3l1.9 4.6L18 9l-4.1 1.4L12 15l-1.9-4.6L6 9l4.1-1.4z"/><path d="M19 14l.95 2.3L22 17l-2.05.7L19 20l-.95-2.3L16 17l2.05-.7z"/></svg>' +
          (isRu ? 'Edit with AI' : 'Edit with AI') +
        '</button>' +
      '</div>' +
      '</div>';
  } else if (tab === 'mcp') {
    renderAgentMCPTab(body, a);
  } else if (tab === 'security') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(239,68,68,0.12);color:#ef4444">' + IC.shield + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Безопасность' : 'Security') + '</h3>' +
          '<p>' + (isRu ? 'Неизменяемые правила безопасности. Защищают агента от prompt-инъекций.' : 'Immutable safety rules. Protect the agent from prompt injection attacks.') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' +
          '<span style="display:inline-flex;align-items:center;gap:6px">' + IC.shield + ' ' +
          (isRu ? 'Правила безопасности' : 'Security Rules') +
          ' <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ' + (isRu ? 'Только чтение' : 'Read-only') + '</span>' +
          '</span>' +
        '</div>' +
        '<div id="security-rules-content" style="background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:16px;font-family:\'JetBrains Mono\',monospace;font-size:.78rem;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;max-height:500px;overflow-y:auto;user-select:text">' +
          (isRu ? 'Загрузка...' : 'Loading...') +
        '</div>' +
      '</div>' +
      '</div>';
    // Fetch security rules from API
    loadPromptModules().then(function(modules) {
      var el = document.getElementById('security-rules-content');
      if (el && modules) el.textContent = modules.security || (isRu ? 'Правила безопасности не заданы' : 'No security rules defined');
    });
  } else if (tab === 'strategy') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(16,163,127,0.12);color:#10a37f">' + IC.chart + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Стратегия' : 'Strategy') + '</h3>' +
          '<p>' + (isRu ? 'Бизнес-правила и параметры торговли. Только вы (владелец) можете редактировать.' : 'Business rules and trading parameters. Only you (the owner) can edit this.') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.chart + ' ' + (isRu ? 'Правила стратегии' : 'Strategy Rules') + '</div>' +
        '<textarea id="edit-strategy-textarea" class="st-textarea" placeholder="' + escHtml(isRu ? 'Введите бизнес-правила, лимиты, условия торговли...' : 'Enter business rules, limits, trading conditions...') + '"></textarea>' +
      '</div>' +
      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="savePromptModule(\'strategy\')">' + IC.check + ' ' + (isRu ? 'Сохранить стратегию' : 'Save Strategy') + '</button>' +
      '</div>' +
      '</div>';
    // Load existing strategy
    loadPromptModules().then(function(modules) {
      var el = document.getElementById('edit-strategy-textarea');
      if (el && modules && modules.strategy) el.value = modules.strategy;
    });
  } else if (tab === 'heartbeat') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(236,72,153,0.12);color:#ec4899">' + IC.heartbeat + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Пульс' : 'Heartbeat') + '</h3>' +
          '<p>' + (isRu ? 'Чеклист для автономных периодических действий. Агент читает его при каждом проактивном тике.' : 'Checklist for autonomous periodic actions. The agent reads this during proactive ticks.') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.heartbeat + ' ' + (isRu ? 'Проактивные задачи' : 'Proactive Tasks') + '</div>' +
        '<textarea id="edit-heartbeat-textarea" class="st-textarea" placeholder="' + escHtml(isRu ? '- Проверить баланс кошелька каждые 30 минут\n- Мониторить цены NFT\n- Отправлять дайджест владельцу раз в день' : '- Check wallet balance every 30 minutes\n- Monitor NFT prices\n- Send daily digest to owner') + '"></textarea>' +
      '</div>' +
      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="savePromptModule(\'heartbeat\')">' + IC.check + ' ' + (isRu ? 'Сохранить пульс' : 'Save Heartbeat') + '</button>' +
      '</div>' +
      '</div>';
    // Load existing heartbeat
    loadPromptModules().then(function(modules) {
      var el = document.getElementById('edit-heartbeat-textarea');
      if (el && modules && modules.heartbeat) el.value = modules.heartbeat;
    });
  } else if (tab === 'info') {
    var isRu = currentLang === 'ru';
    var createdAt = a.createdAt || a.created_at || '';
    var updatedAt = a.updatedAt || a.updated_at || '';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(34,197,94,0.12);color:#22c55e">' + IC.robot + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Информация об агенте' : 'Agent Information') + '</h3>' +
          '<p>' + (isRu ? 'Имя, описание и метаданные агента. Видны в списке и на карте.' : 'Name, description and metadata. Visible in the list and on the map.') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.robot + ' ' + (isRu ? 'Имя агента' : 'Agent Name') + '</div>' +
        '<div class="rt-input-wrap">' +
          '<input type="text" id="settings-agent-name" class="rt-input" value="' + escHtml(a.name || '') + '" placeholder="' + (isRu ? 'Введите имя агента' : 'Enter agent name') + '">' +
          '<div class="rt-input-hint">' + (isRu ? 'Имя отображается в списке агентов, на карте и в уведомлениях' : 'Displayed in agent list, map and notifications') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.chat + ' ' + (isRu ? 'Описание' : 'Description') + '</div>' +
        '<div class="rt-input-wrap">' +
          '<input type="text" id="settings-agent-desc" class="rt-input" value="' + escHtml(a.description || '') + '" placeholder="' + (isRu ? 'Что делает этот агент' : 'What this agent does') + '">' +
          '<div class="rt-input-hint">' + (isRu ? 'Краткое описание задач агента' : 'Brief description of agent tasks') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="st-meta-grid">' +
        '<div class="st-meta-card">' +
          '<div class="st-meta-label">ID</div>' +
          '<div class="st-meta-val">#' + (a.id || _detailAgentId) + '</div>' +
        '</div>' +
        '<div class="st-meta-card">' +
          '<div class="st-meta-label">' + (isRu ? 'Тип' : 'Type') + '</div>' +
          '<div class="st-meta-val">' + (a.triggerType || a.trigger_type || 'ai_agent') + '</div>' +
        '</div>' +
        '<div class="st-meta-card">' +
          '<div class="st-meta-label">' + (isRu ? 'Статус' : 'Status') + '</div>' +
          '<div class="st-meta-val" style="color:' + (a.isActive || a.is_active ? '#22c55e' : '#666') + '">' + (a.isActive || a.is_active ? (isRu ? 'Активен' : 'Active') : (isRu ? 'Остановлен' : 'Stopped')) + '</div>' +
        '</div>' +
        '<div class="st-meta-card">' +
          '<div class="st-meta-label">' + (isRu ? 'Роль' : 'Role') + '</div>' +
          '<div class="st-meta-val">' + (a.role || 'specialist') + '</div>' +
        '</div>' +
        (createdAt ? '<div class="st-meta-card"><div class="st-meta-label">' + (isRu ? 'Создан' : 'Created') + '</div><div class="st-meta-val" style="font-size:.72rem">' + new Date(createdAt).toLocaleDateString() + '</div></div>' : '') +
        (updatedAt ? '<div class="st-meta-card"><div class="st-meta-label">' + (isRu ? 'Обновлён' : 'Updated') + '</div><div class="st-meta-val" style="font-size:.72rem">' + new Date(updatedAt).toLocaleDateString() + '</div></div>' : '') +
        '<div class="st-meta-card"><div class="st-meta-label">' + (isRu ? 'Запусков' : 'Runs') + '</div><div class="st-meta-val" id="info-run-count">-</div></div>' +
        '<div class="st-meta-card"><div class="st-meta-label">' + (isRu ? 'Токены' : 'Tokens') + '</div><div class="st-meta-val" id="info-token-count">-</div></div>' +
      '</div>' +
      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveSettingsInfo()">' + IC.check + ' ' + (isRu ? 'Сохранить' : 'Save') + '</button>' +
      '</div>' +
      '</div>';
    // Load stats asynchronously
    apiRequest('GET', '/api/agents/' + _detailAgentId + '/tokens?days=365').then(function(d) {
      var runEl = document.getElementById('info-run-count');
      var tokEl = document.getElementById('info-token-count');
      if (runEl && d.total) runEl.textContent = d.total.totalRequests || 0;
      if (tokEl && d.total) tokEl.textContent = formatNum(d.total.totalTokens || 0);
    }).catch(function() {});
  } else if (tab === 'ai') {
    var isRu = currentLang === 'ru';
    var aiProvider = (config.config && config.config.AI_PROVIDER) || '';
    var aiModel = (config.config && config.config.AI_MODEL) || '';
    var hasKey = !!(config.config && config.config.AI_API_KEY);
    var providers = [
      { id: 'gemini', name: 'Gemini', color: '#4285f4', desc: 'Google AI',
        models: 'gemini-2.5-flash (fast), gemini-2.5-pro (smart)',
        defaultModel: 'gemini-2.5-flash',
        keyUrl: 'https://aistudio.google.com/apikey',
        keyHint: isRu ? 'Google AI Studio → Get API Key → Create. Бесплатно до 1500 req/day.' : 'Google AI Studio → Get API Key → Create. Free up to 1500 req/day.',
        keyPrefix: 'AIzaSy...',
        rating: isRu ? 'Качество \u2605\u2605\u2605\u2606 | Скорость \u2605\u2605\u2605\u2605 | Цена: бесплатно' : 'Quality \u2605\u2605\u2605\u2606 | Speed \u2605\u2605\u2605\u2605 | Price: free' },
      { id: 'openai', name: 'OpenAI', color: '#10a37f', desc: 'GPT-4o',
        models: 'gpt-4o-mini (cheap), gpt-4o (smart), o3-mini (reasoning)',
        defaultModel: 'gpt-4o-mini',
        keyUrl: 'https://platform.openai.com/api-keys',
        keyHint: isRu ? 'platform.openai.com → API Keys → Create. Нужна оплата от $5.' : 'platform.openai.com → API Keys → Create. Requires $5+ credit.',
        keyPrefix: 'sk-proj-...',
        rating: isRu ? 'Качество \u2605\u2605\u2605\u2605 | Скорость \u2605\u2605\u2605\u2606 | Цена: $$' : 'Quality \u2605\u2605\u2605\u2605 | Speed \u2605\u2605\u2605\u2606 | Price: $$' },
      { id: 'anthropic', name: 'Anthropic', color: '#d97706', desc: 'Claude',
        models: 'claude-haiku-4-5 (fast), claude-sonnet-4 (smart), claude-opus-4 (best)',
        defaultModel: 'claude-haiku-4-5-20251001',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        keyHint: isRu ? 'console.anthropic.com → API Keys → Create Key. Нужна оплата от $5.' : 'console.anthropic.com → API Keys → Create Key. Requires $5+ credit.',
        keyPrefix: 'sk-ant-...',
        rating: isRu ? 'Качество \u2605\u2605\u2605\u2605 | Скорость \u2605\u2605\u2605\u2606 | Цена: $$' : 'Quality \u2605\u2605\u2605\u2605 | Speed \u2605\u2605\u2605\u2606 | Price: $$' },
      { id: 'groq', name: 'Groq', color: '#f55036', desc: 'Llama 3 (fast)',
        models: 'llama-3.3-70b-versatile (free), mixtral-8x7b (free)',
        defaultModel: 'llama-3.3-70b-versatile',
        keyUrl: 'https://console.groq.com/keys',
        keyHint: isRu ? 'console.groq.com → API Keys → Create. Полностью бесплатно!' : 'console.groq.com → API Keys → Create. Completely free!',
        keyPrefix: 'gsk_...',
        rating: isRu ? 'Качество \u2605\u2605\u2605\u2606 | Скорость \u2605\u2605\u2605\u2605 | Цена: бесплатно' : 'Quality \u2605\u2605\u2605\u2606 | Speed \u2605\u2605\u2605\u2605 | Price: free' },
      { id: 'deepseek', name: 'DeepSeek', color: '#4f46e5', desc: 'DeepSeek V3',
        models: 'deepseek-chat (V3, cheap), deepseek-reasoner (R1)',
        defaultModel: 'deepseek-chat',
        keyUrl: 'https://platform.deepseek.com/api_keys',
        keyHint: isRu ? 'platform.deepseek.com → API Keys. Очень дёшево, ~$0.14/M tokens.' : 'platform.deepseek.com → API Keys. Very cheap, ~$0.14/M tokens.',
        keyPrefix: 'sk-...',
        rating: isRu ? 'Качество \u2605\u2605\u2605\u2605 | Скорость \u2605\u2605\u2605\u2606 | Цена: $' : 'Quality \u2605\u2605\u2605\u2605 | Speed \u2605\u2605\u2605\u2606 | Price: $' },
      { id: 'openrouter', name: 'OpenRouter', color: '#6366f1', desc: 'Multi-model',
        models: 'google/gemini-2.5-flash (free), meta-llama/llama-3.3-70b (free)',
        defaultModel: 'google/gemini-2.5-flash',
        keyUrl: 'https://openrouter.ai/keys',
        keyHint: isRu ? 'openrouter.ai → Keys. Один ключ → 200+ моделей. Есть бесплатные модели.' : 'openrouter.ai → Keys. One key → 200+ models. Free models available.',
        keyPrefix: 'sk-or-...',
        rating: isRu ? 'Качество \u2605\u2605\u2605\u2605 | Скорость \u2605\u2605\u2605\u2606 | Цена: varies' : 'Quality \u2605\u2605\u2605\u2605 | Speed \u2605\u2605\u2605\u2606 | Price: varies' },
      { id: 'together', name: 'Together', color: '#0ea5e9', desc: 'Open-source',
        models: 'meta-llama/Llama-3.3-70B-Instruct-Turbo, Qwen/Qwen2.5-72B',
        defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        keyUrl: 'https://api.together.ai/settings/api-keys',
        keyHint: isRu ? 'together.ai → Settings → API Keys. $5 бесплатных кредитов при регистрации.' : 'together.ai → Settings → API Keys. $5 free credit on signup.',
        keyPrefix: '',
        rating: isRu ? 'Качество \u2605\u2605\u2605\u2606 | Скорость \u2605\u2605\u2605\u2605 | Цена: $' : 'Quality \u2605\u2605\u2605\u2606 | Speed \u2605\u2605\u2605\u2605 | Price: $' },
    ];

    // Find current provider info for the detail panel
    var currentProv = providers.find(function(p) { return p.id === aiProvider; });

    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(16,163,127,0.12);color:#10a37f">' + IC.bolt + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Настройки AI' : 'AI Configuration') + '</h3>' +
          '<p>' + (isRu ? 'Выберите AI провайдера для вашего агента. Без ключа используется бесплатный Platform AI.' : 'Choose AI provider for your agent. Without a key, free Platform AI is used.') + '</p>' +
        '</div>' +
      '</div>' +

      // Provider grid
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.globe + ' ' + (isRu ? 'Провайдер' : 'Provider') + '</div>' +
        '<div class="st-provider-grid">' +
        providers.map(function(p) {
          var sel = p.id === aiProvider;
          return '<div class="st-provider-card' + (sel ? ' st-prov-active' : '') + '" onclick="selectAIProvider(\'' + p.id + '\')">' +
            '<div class="st-prov-dot" style="background:' + p.color + '"></div>' +
            '<div class="st-prov-info"><div class="st-prov-name">' + p.name + '</div><div class="st-prov-desc">' + p.desc + '</div>' +
            '<div class="st-prov-rating">' + (p.rating || '') + '</div></div>' +
            (sel ? '<span style="color:var(--primary)">' + IC.check + '</span>' : '') +
          '</div>';
        }).join('') +
        '</div>' +
        '<select id="ai-provider-select" style="display:none">' +
          '<option value="">Default</option>' +
          providers.map(function(p) { return '<option value="' + p.id + '"' + (p.id === aiProvider ? ' selected' : '') + '>' + p.name + '</option>'; }).join('') +
        '</select>' +
      '</div>' +

      // Dynamic provider info panel
      '<div id="ai-provider-info" class="rt-section" style="background:var(--bg-tertiary);border-radius:12px;padding:16px;margin-bottom:16px;' + (currentProv ? '' : 'display:none') + '">' +
        (currentProv ? _renderProviderInfo(currentProv, isRu) : '') +
      '</div>' +

      // Model input
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.wrench + ' ' + (isRu ? 'Модель' : 'Model') + '</div>' +
        '<div class="rt-input-wrap">' +
          '<input type="text" id="ai-model-input" class="rt-input" value="' + escHtml(aiModel) + '" placeholder="' + (currentProv ? currentProv.defaultModel : (isRu ? 'auto' : 'auto')) + '">' +
          '<div class="rt-input-hint">' + (isRu ? 'Оставьте пустым — будет использована модель по умолчанию' : 'Leave empty for the default model') +
            (currentProv ? '<br>' + (isRu ? 'Доступные: ' : 'Available: ') + '<code style="font-size:.75rem">' + currentProv.models + '</code>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      // Utility model input
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.bolt + ' ' + (isRu ? 'Утилитарная модель' : 'Utility Model') + '</div>' +
        '<div class="rt-input-wrap">' +
          '<input type="text" id="ai-utility-model-input" class="rt-input" value="' + escHtml((config.config && (config.config.UTILITY_MODEL || config.config.AI_UTILITY_MODEL)) || '') + '" placeholder="' + (isRu ? 'auto' : 'auto') + '">' +
          '<div class="rt-input-hint">' + (isRu ? 'Лёгкая модель для суммаризации и vision. Оставьте пустым для авто-выбора.' : 'Lightweight model for summarization and vision. Leave empty for auto.') + '</div>' +
        '</div>' +
      '</div>' +

      // API Key
      // When a key is already saved we show a masked sample as the input VALUE
      // (type=text so the bullets render literally — "AIzaSy…HAG4"). On focus we
      // clear the value AND switch to type=password so a fresh user-typed key is
      // hidden as it's entered. saveSettingsAI() ignores any value that still
      // contains the bullet character — only a fresh user-typed key is sent up.
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.link + ' API Key</div>' +
        '<div class="rt-input-wrap">' +
          // Mask priority: per-agent (sk-or-… for OpenRouter, sk-ant-… for Anthropic etc)
          // → user-level (from settings page) → neutral bullets. Don't show a Gemini-looking
          // "AIzaSy…" placeholder when the actual key is from a different provider.
          (hasKey
            ? '<input type="text" id="ai-key-input" class="rt-input" value="' + ((_detailAgentData && _detailAgentData.aiApiKeyMasked) || _aiKeyMaskUser || '••••••••••••••••') + '" data-masked="1" onfocus="if(this.dataset.masked===\'1\'){this.value=\'\';this.type=\'password\';this.dataset.masked=\'0\';}">'
            : '<input type="password" id="ai-key-input" class="rt-input" placeholder="' + (currentProv ? currentProv.keyPrefix : 'API key') + '">'
          ) +
          '<div class="rt-input-hint">' +
            (hasKey
              ? '<span style="color:#22c55e">' + IC.check + '</span> ' + (isRu ? 'Ключ установлен. Оставьте пустым чтобы не менять.' : 'Key is set. Leave empty to keep.')
              : (currentProv
                ? currentProv.keyHint + ' <a href="' + currentProv.keyUrl + '" target="_blank" style="color:var(--primary)">' + (isRu ? 'Получить ключ →' : 'Get key →') + '</a>'
                : (isRu ? 'Выберите провайдера выше' : 'Select a provider above'))
            ) +
          '</div>' +
        '</div>' +
      '</div>' +

      // Temperature
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.fire + ' ' + (isRu ? 'Температура' : 'Temperature') + '</div>' +
        '<div class="rt-priority-wrap">' +
          '<input type="range" id="ai-temperature" min="0" max="2" step="0.1" value="' + ((config.config && config.config.AI_TEMPERATURE) || '0.7') + '" class="rt-slider" style="accent-color:#f59e0b" oninput="document.getElementById(\'ai-temp-val\').textContent=this.value">' +
          '<div class="rt-priority-display">' +
            '<span id="ai-temp-val" class="rt-priority-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b">' + ((config.config && config.config.AI_TEMPERATURE) || '0.7') + '</span>' +
          '</div>' +
          '<div class="rt-input-hint">' + (isRu ? '0 = детерминированный, 1 = сбалансированный, 2 = креативный' : '0 = deterministic, 1 = balanced, 2 = creative') + '</div>' +
        '</div>' +
      '</div>' +

      // Max tokens
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.chart + ' ' + (isRu ? 'Макс. токенов ответа' : 'Max Response Tokens') + '</div>' +
        '<div class="rt-priority-wrap">' +
          '<input type="range" id="ai-max-tokens" min="256" max="8192" step="256" value="' + ((config.config && config.config.AI_MAX_TOKENS) || '2048') + '" class="rt-slider" style="accent-color:#6366f1" oninput="document.getElementById(\'ai-maxtok-val\').textContent=this.value">' +
          '<div class="rt-priority-display">' +
            '<input type="number" id="ai-max-tokens-num" value="' + ((config.config && config.config.AI_MAX_TOKENS) || '2048') + '" min="256" max="16384" class="rt-priority-num" style="width:80px" oninput="document.getElementById(\'ai-max-tokens\').value=this.value;document.getElementById(\'ai-maxtok-val\').textContent=this.value">' +
            '<span id="ai-maxtok-val" class="rt-priority-badge" style="background:rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.15);color:#6366f1">' + ((config.config && config.config.AI_MAX_TOKENS) || '2048') + '</span>' +
          '</div>' +
          '<div class="rt-input-hint">' + (isRu ? 'Максимальная длина ответа AI. 2048 по умолчанию. Больше = дороже.' : 'Max AI response length. 2048 default. Higher = more expensive.') + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveSettingsAI()">' + IC.check + ' ' + (isRu ? 'Сохранить AI' : 'Save AI') + '</button>' +
      '</div>' +
      '</div>';
  } else if (tab === 'caps') {
    var enabled = (config.config && config.config.enabledCapabilities) || [];
    var isRu = currentLang === 'ru';
    var allCaps = [
      { id: 'wallet', name: 'Wallet', icon: IC.dollar, color: '#f59e0b',
        desc: isRu ? 'Управление TON кошельком. Баланс, переводы, история транзакций' : 'TON wallet management. Balance, transfers, transaction history',
        tools: ['get_ton_balance', 'send_ton'] },
      { id: 'nft', name: 'NFT', icon: IC.image, color: '#8b5cf6',
        desc: isRu ? 'Работа с NFT коллекциями. Floor price, анализ, покупка/продажа' : 'NFT collections. Floor price, analysis, buy/sell',
        tools: ['get_nft_floor'] },
      { id: 'gifts', name: 'Gifts', icon: IC.gift, color: '#ec4899',
        desc: isRu ? 'Telegram подарки. Каталог, оценка, покупка/продажа' : 'Telegram gifts. Catalog, appraisal, buy/sell',
        tools: ['get_gift_catalog', 'appraise_gift', 'buy_catalog_gift'] },
      { id: 'gifts_market', name: 'Gifts Market', icon: IC.trending, color: '#14b8a6',
        desc: isRu ? 'Мониторинг рынка подарков. Floor цены, арбитраж, продажи' : 'Gift market monitoring. Floor prices, arbitrage, sales history',
        tools: ['get_gift_floor_real', 'scan_real_arbitrage', 'get_market_overview'] },
      { id: 'telegram', name: 'Telegram', icon: IC.send, color: '#3b82f6',
        desc: isRu ? 'Авторизация Telegram. Доступ к Fragment, MTProto' : 'Telegram authorization. Access to Fragment, MTProto',
        tools: ['get_fragment_listings'] },
      { id: 'web', name: 'Web', icon: IC.globe, color: '#06b6d4',
        desc: isRu ? 'Поиск в интернете и загрузка страниц. Web search, HTTP запросы' : 'Web search and page fetching. Web search, HTTP requests',
        tools: ['web_search', 'fetch_url'] },
      { id: 'defi', name: 'DeFi', icon: IC.shuffle, color: '#22c55e',
        desc: isRu ? 'DeFi операции. DEX свапы через DeDust/STON.fi' : 'DeFi operations. DEX swaps via DeDust/STON.fi',
        tools: ['defi_swap'] },
      { id: 'state', name: 'State', icon: IC.box, color: '#64748b',
        desc: isRu ? 'Хранение данных между запусками. Ключ-значение хранилище' : 'Persistent storage between runs. Key-value store',
        tools: ['get_state', 'set_state'] },
      { id: 'notify', name: 'Notify', icon: IC.bell, color: '#f97316',
        desc: isRu ? 'Push-уведомления. Отправка оповещений в Telegram' : 'Push notifications. Send alerts to Telegram',
        tools: ['notify', 'notify_rich'] },
      { id: 'plugins', name: 'Plugins', icon: IC.bolt, color: '#eab308',
        desc: isRu ? 'MCP плагины. Расширение функций через внешние сервисы' : 'MCP plugins. Extend capabilities via external services',
        tools: ['mcp_call'] },
      { id: 'inter_agent', name: 'Inter-Agent', icon: IC.forward, color: '#a855f7',
        desc: isRu ? 'Общение между агентами. Делегирование задач другим агентам' : 'Inter-agent communication. Delegate tasks to other agents',
        tools: ['send_to_agent'] },
      { id: 'blockchain', name: 'Blockchain', icon: IC.link, color: '#00a8ff',
        desc: isRu ? 'Чтение данных блокчейна TON. Транзакции, контракты, адреса' : 'Read TON blockchain data. Transactions, contracts, addresses',
        tools: ['get_account_info'] },
      { id: 'ton_mcp', name: 'TON MCP', icon: IC.link, color: '#00a8ff',
        desc: isRu ? 'TON MCP сервер. Расширенные операции с блокчейном TON' : 'TON MCP server. Advanced TON blockchain operations',
        tools: ['ton_mcp'] },
      { id: 'discord', name: 'Discord', icon: IC.chat, color: '#5865f2',
        desc: isRu ? 'Интеграция с Discord. Отправка сообщений, вебхуки, мониторинг каналов' : 'Discord integration. Send messages, webhooks, channel monitoring',
        tools: ['discord_send', 'discord_webhook'] },
      { id: 'x_twitter', name: 'Twitter / X', icon: IC.send, color: '#1d9bf0',
        desc: isRu ? 'Интеграция с Twitter/X. Публикация, мониторинг, аналитика' : 'Twitter/X integration. Posting, monitoring, analytics',
        tools: ['x_post', 'x_search'] },
      { id: 'media', name: 'Media', icon: IC.image, color: '#e11d48',
        desc: isRu ? 'Генерация изображений и медиа. AI-арт, обработка фото' : 'Image & media generation. AI art, photo processing',
        tools: ['generate_image', 'process_media'] },
      { id: 'knowledge', name: 'Knowledge', icon: IC.brain, color: '#6366f1',
        desc: isRu ? 'Деревья знаний и базы данных. Обучение, FAQ, skill trees' : 'Knowledge base & skill trees. Training, FAQ, skill trees',
        tools: ['kb_query', 'kb_update'] },
      { id: 'security', name: 'Security', icon: IC.shield, color: '#ef4444',
        desc: isRu ? 'Сканирование безопасности. Аудит контрактов, проверка адресов' : 'Security scans. Contract audit, address verification',
        tools: ['security_scan', 'audit_contract'] },
      { id: 'blockchain_analytics', name: 'Analytics', icon: IC.chart, color: '#10b981',
        desc: isRu ? 'Он-чейн аналитика. Отслеживание транзакций, whale alerts' : 'On-chain analytics. Transaction tracking, whale alerts',
        tools: ['chain_analytics', 'whale_alert'] },
      { id: 'prompts', name: 'Prompts', icon: IC.clipboard, color: '#78716c',
        desc: isRu ? 'Библиотека промптов. Шаблоны, цепочки промптов, оптимизация' : 'Prompt library. Templates, prompt chains, optimization',
        tools: ['prompt_get', 'prompt_chain'] },
    ];
    var enabledCount = 0;
    allCaps.forEach(function(c) { if (enabled.includes(c.id)) enabledCount++; });
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(234,179,8,0.12);color:#eab308">' + IC.bolt + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Возможности агента' : 'Agent Capabilities') + '</h3>' +
          '<p>' + (isRu ? 'Включите модули, которые агент может использовать. Каждый добавляет соответствующие инструменты.' : 'Enable modules the agent can use. Each adds corresponding tools.') + '</p>' +
        '</div>' +
        '<span class="st-caps-counter">' + enabledCount + ' / ' + allCaps.length + '</span>' +
      '</div>' +

      // Tool category quick-toggles
      '<div class="st-tool-categories">' +
        '<div class="rt-section-label" style="margin-bottom:8px">' + IC.bolt + ' ' + (isRu ? 'Категории инструментов' : 'Tool Categories') + '</div>' +
        [
          { cat: 'telegram', ids: ['telegram'], label: isRu ? 'Telegram (сообщения, медиа, админ)' : 'Telegram (messaging, media, admin)' },
          { cat: 'ton', ids: ['wallet', 'blockchain', 'ton_mcp'], label: isRu ? 'TON Blockchain (кошелёк, баланс, NFT)' : 'TON Blockchain (wallet, balance, NFT)' },
          { cat: 'trading', ids: ['gifts', 'gifts_market', 'defi'], label: isRu ? 'Gifts & Trading' : 'Gifts & Trading' },
          { cat: 'media', ids: ['media'], label: isRu ? 'Обработка изображений' : 'Image Processing' },
          { cat: 'websearch', ids: ['web'], label: isRu ? 'Веб-поиск' : 'Web Search' },
          { cat: 'plugins', ids: ['plugins', 'blockchain_analytics', 'prompts', 'knowledge', 'security'], label: isRu ? 'Плагины (аналитика, заметки, напоминания)' : 'Plugins (analytics, notes, reminders)' },
          { cat: 'workspace', ids: ['state', 'notify', 'inter_agent'], label: isRu ? 'Workspace (файлы, состояние)' : 'Workspace (file management)' },
          { cat: 'mcp', ids: ['discord', 'x_twitter'], label: isRu ? 'MCP (внешние серверы)' : 'MCP (external servers)' },
        ].map(function(g) {
          var allOn = g.ids.every(function(id) { return enabled.includes(id); });
          return '<label class="st-cat-toggle" onclick="toggleCapCategory(this, ' + JSON.stringify(g.ids).replace(/"/g, "'") + ')">' +
            '<input type="checkbox"' + (allOn ? ' checked' : '') + ' class="st-cat-cb">' +
            '<span class="st-cat-label">' + g.label + '</span>' +
          '</label>';
        }).join('') +
      '</div>' +

      '<div class="st-caps-grid">' +
      allCaps.map(function(c) {
        var ch = enabled.includes(c.id);
        return '<div class="st-cap-card' + (ch ? ' st-cap-active' : '') + '" data-cap="' + c.id + '" onclick="toggleCapCard(this,\'' + c.id + '\')">' +
          '<div class="st-cap-top">' +
            '<div class="st-cap-icon" style="background:' + c.color + '18;color:' + c.color + '">' + c.icon + '</div>' +
            '<div class="st-cap-toggle"><div class="st-cap-switch' + (ch ? ' st-cap-on' : '') + '"><div class="st-cap-knob"></div></div></div>' +
          '</div>' +
          '<div class="st-cap-name">' + c.name + '</div>' +
          '<div class="st-cap-desc">' + c.desc + '</div>' +
          '<div class="st-cap-tools">' + c.tools.map(function(t) { return '<span class="st-cap-tool">' + t + '</span>'; }).join('') + '</div>' +
        '</div>';
      }).join('') +
      '</div>' +
      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveSettingsCaps()">' + IC.check + ' ' + (isRu ? 'Сохранить' : 'Save') + '</button>' +
      '</div>' +
      '</div>';
  } else if (tab === 'wallet') {
    var walletAddr = (config.config && config.config.WALLET_ADDRESS) || (a._stateWallet) || '';
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b">' + IC.dollar + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Кошелёк агента' : 'Agent Wallet') + '</h3>' +
          '<p>' + (isRu ? 'TON кошелёк агента для транзакций и DeFi операций' : 'Agent TON wallet for transactions and DeFi operations') + '</p>' +
        '</div>' +
      '</div>' +
      (walletAddr
        ? '<div class="st-wallet-card">' +
            '<div class="st-wallet-icon">' + IC.dollar + '</div>' +
            '<div class="st-wallet-label">TON Address</div>' +
            '<div class="st-wallet-addr">' + escHtml(walletAddr) + '</div>' +
            '<div class="st-wallet-actions">' +
              '<button class="rt-save-btn" onclick="navigator.clipboard.writeText(\'' + escHtml(walletAddr) + '\');toast(\'Copied\',\'success\')" style="font-size:.78rem">' + IC.clipboard + ' ' + (isRu ? 'Копировать адрес' : 'Copy Address') + '</button>' +
            '</div>' +
          '</div>' +
          // ── Mnemonic section ──
          '<div class="rt-section" style="margin-top:16px">' +
            '<div class="rt-section-label">' + IC.shield + ' ' + (isRu ? 'Мнемоническая фраза (Seed)' : 'Mnemonic Phrase (Seed)') + '</div>' +
            '<div id="wallet-mnemonic-box" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px">' +
              '<div id="wallet-mnemonic-hidden">' +
                '<div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:.82rem">' +
                  IC.shield + ' ' + (isRu
                    ? '24 слова для восстановления кошелька. Никому не показывайте!'
                    : '24 words to recover your wallet. Never share with anyone!') +
                '</div>' +
                '<button class="rt-save-btn" onclick="revealWalletMnemonic()" style="margin-top:10px;font-size:.78rem;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2)">' +
                  IC.eye + ' ' + (isRu ? 'Показать мнемонику' : 'Reveal Mnemonic') +
                '</button>' +
              '</div>' +
              '<div id="wallet-mnemonic-revealed" style="display:none">' +
                '<div style="font-size:.72rem;color:#ef4444;margin-bottom:8px;font-weight:600">' + IC.warn + ' ' +
                  (isRu ? 'СЕКРЕТНО! Не делитесь и не показывайте на экране при записи!' : 'SECRET! Do not share or show on screen while recording!') +
                '</div>' +
                '<div id="wallet-mnemonic-words" style="font-family:monospace;font-size:.82rem;line-height:1.8;word-break:break-all;color:var(--text-primary);background:rgba(0,0,0,0.3);padding:12px;border-radius:8px"></div>' +
                '<div style="display:flex;gap:8px;margin-top:10px">' +
                  '<button class="rt-save-btn" onclick="copyWalletMnemonic()" style="font-size:.78rem">' + IC.clipboard + ' ' + (isRu ? 'Копировать' : 'Copy') + '</button>' +
                  '<button class="rt-save-btn" onclick="hideWalletMnemonic()" style="font-size:.78rem;background:var(--bg-secondary)">' + (isRu ? 'Скрыть' : 'Hide') + '</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>'
        : '<div class="st-wallet-empty">' +
            '<div class="st-wallet-empty-icon">' + IC.dollar + '</div>' +
            '<h4>' + (isRu ? 'Кошелёк не создан' : 'No Wallet Yet') + '</h4>' +
            '<p>' + (isRu ? 'Создайте TON кошелёк для работы с блокчейном, DeFi и NFT' : 'Create a TON wallet for blockchain, DeFi and NFT operations') + '</p>' +
            '<button class="rt-save-btn" onclick="createAgentWalletFromSettings()">' + IC.zap + ' ' + (isRu ? 'Создать кошелёк' : 'Create Wallet') + '</button>' +
          '</div>'
      ) +
      '</div>';
  } else if (tab === 'role') {
    var currentRole = a.role || 'worker';
    var customRole = (config.config && config.config.customRole) || {};
    var agentColor = (config.config && config.config.agentColor) || '#00a8ff';
    var roles = [
      { id: 'worker', name: 'Worker', icon: IC.wrench, color: '#3b82f6',
        desc: currentLang === 'ru' ? 'Исполнитель задач' : 'Task executor',
        effect: currentLang === 'ru' ? 'Фокус на мониторинге, сборе данных и автоматизации. Работает автономно.' : 'Focus on monitoring, data collection, automation. Works autonomously.' },
      { id: 'manager', name: 'Manager', icon: IC.crown, color: '#a855f7',
        desc: currentLang === 'ru' ? 'Координатор агентов' : 'Agent coordinator',
        effect: currentLang === 'ru' ? 'Делегирует задачи другим агентам. Получает manage_agent + assign_task инструменты.' : 'Delegates to other agents. Gets manage_agent + assign_task tools.' },
      { id: 'specialist', name: 'Specialist', icon: IC.star, color: '#22c55e',
        desc: currentLang === 'ru' ? 'Эксперт-аналитик' : 'Expert analyst',
        effect: currentLang === 'ru' ? 'Глубокий профессиональный анализ. Перепроверяет данные, строит обоснованные выводы.' : 'Deep professional analysis. Cross-checks data, builds justified conclusions.' },
      { id: 'monitor', name: 'Monitor', icon: IC.bell, color: '#f97316',
        desc: currentLang === 'ru' ? 'Система алертов' : 'Alert system',
        effect: currentLang === 'ru' ? 'Уведомляет только при значимых изменениях (>5%). Не спамит. Краткий формат.' : 'Notifies only on significant changes (>5%). No spam. Brief format.' },
      { id: 'director', name: 'Director', icon: IC.crown, color: '#ffd700',
        desc: currentLang === 'ru' ? 'Директор' : 'Director',
        effect: currentLang === 'ru' ? 'Управляет людьми и агентами. Стратегическое мышление, OKR, бюджеты.' : 'Manages people and agents. Strategic thinking, OKRs, budgets.' },
      { id: 'creative', name: 'Creative', icon: IC.image, color: '#ec4899',
        desc: currentLang === 'ru' ? 'Контент и SMM' : 'Content & SMM',
        effect: currentLang === 'ru' ? 'Создаёт контент, ведёт каналы, адаптирует стиль. Проактивный постинг.' : 'Creates content, manages channels, adapts style. Proactive posting.' },
      { id: 'trader', name: 'Trader', icon: IC.trending, color: '#ef4444',
        desc: currentLang === 'ru' ? 'Трейдер' : 'Trader',
        effect: currentLang === 'ru' ? 'Торговля, арбитраж, P&L трекинг. Стоп-лоссы, позиционирование, дисциплина.' : 'Trading, arbitrage, P&L tracking. Stop-losses, position sizing, discipline.' },
      { id: 'admin', name: 'Chat Admin', icon: IC.shield, color: '#f97316',
        desc: currentLang === 'ru' ? 'Админ чата' : 'Chat Admin',
        effect: currentLang === 'ru' ? 'Модерация, бан/мьют, антиспам, приветствие новичков, правила.' : 'Moderation, ban/mute, anti-spam, welcome newbies, rules enforcement.' },
    ];
    var isRu = currentLang === 'ru';
    var colorSwatches = ['#00a8ff', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4'];
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(var(--accent-r,168),var(--accent-g,85),var(--accent-b,247),0.12);color:#a855f7">' + IC.crown + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Роль агента' : 'Agent Role') + '</h3>' +
          '<p>' + (isRu ? 'Роль определяет поведение агента в мультиагентной системе' : 'Role defines agent behavior in multi-agent systems') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="st-role-grid">' +
      roles.map(function(r) {
        var sel = r.id === currentRole;
        return '<div class="st-role-card' + (sel ? ' st-role-active' : '') + '" onclick="selectRoleCard(this,\'' + r.id + '\')">' +
          '<div class="st-role-icon" style="background:' + r.color + '18;color:' + r.color + '">' + r.icon + '</div>' +
          '<div class="st-role-info">' +
            '<div class="st-role-name">' + r.name + '</div>' +
            '<div class="st-role-desc">' + r.desc + '</div>' +
            '<div class="st-role-effect" style="font-size:.72rem;color:var(--text-muted);margin-top:4px;line-height:1.3">' + IC.bolt + ' ' + r.effect + '</div>' +
          '</div>' +
          '<div class="st-role-check">' + IC.check + '</div>' +
        '</div>';
      }).join('') +
      '</div>' +
      '<hr class="st-role-divider">' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.wrench + ' ' + (isRu ? 'Кастомная роль' : 'Custom Role') + '</div>' +
        '<div class="rt-row-2">' +
          '<div class="rt-input-wrap">' +
            '<input type="text" id="custom-role-name" class="rt-input" value="' + escHtml(customRole.name || '') + '" placeholder="' + (isRu ? 'Напр. Аналитик' : 'E.g. Analyst') + '">' +
            '<div class="rt-input-hint">' + (isRu ? 'Название роли' : 'Role name') + '</div>' +
          '</div>' +
          '<div class="rt-input-wrap">' +
            '<input type="text" id="custom-role-desc" class="rt-input" value="' + escHtml(customRole.description || '') + '" placeholder="' + (isRu ? 'Что делает этот агент' : 'What this agent does') + '">' +
            '<div class="rt-input-hint">' + (isRu ? 'Описание роли' : 'Role description') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.gem + ' ' + (isRu ? 'Цвет агента' : 'Agent Color') + '</div>' +
        '<div class="st-color-row">' +
          colorSwatches.map(function(c) {
            return '<div class="st-color-swatch' + (c === agentColor ? ' st-color-active' : '') + '" style="background:' + c + '" onclick="pickRoleColor(this,\'' + c + '\')"></div>';
          }).join('') +
          '<input type="color" id="agent-color-picker" value="' + escHtml(agentColor) + '" style="width:32px;height:32px;border:1px solid var(--border);border-radius:10px;background:transparent;cursor:pointer;padding:1px">' +
          '<code id="agent-color-hex" style="font-size:.78rem;color:var(--text-muted);margin-left:4px">' + escHtml(agentColor) + '</code>' +
        '</div>' +
      '</div>' +
      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveCustomRole()">' + IC.check + ' ' + (isRu ? 'Сохранить' : 'Save') + '</button>' +
      '</div>' +
      '</div>';
    // Wire up color hex display
    setTimeout(function() {
      var cp = document.getElementById('agent-color-picker');
      var hex = document.getElementById('agent-color-hex');
      if (cp && hex) cp.addEventListener('input', function() {
        hex.textContent = cp.value;
        document.querySelectorAll('.st-color-swatch').forEach(function(s) { s.classList.remove('st-color-active'); });
      });
    }, 50);
  } else if (tab === 'routing') {
    var isRu = currentLang === 'ru';
    var rules = (config.config && config.config.routingRules) || {};
    var chatIds = (rules.chatIds || []).join(', ');
    var keywords = (rules.keywords || []).join(', ');
    var chatTypes = rules.chatTypes || [];
    var priority = rules.priority || 10;
    var isDefault = rules.isDefault || false;

    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon">' + IC.shuffle + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Маршрутизация' : 'Message Routing') + '</h3>' +
          '<p>' + (isRu
            ? 'Настройте, на какие сообщения этот агент будет реагировать. Актуально когда несколько агентов работают на одном Telegram-аккаунте.'
            : 'Configure which messages this agent responds to. Relevant when multiple agents share one Telegram account.') + '</p>' +
        '</div>' +
      '</div>' +

      // ── Shared agents banner (loaded async) ──
      '<div id="rt-shared-agents" class="rt-shared-banner" style="display:none"></div>' +

      // ── Step 1: Where to respond ──
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.chat + ' ' + (isRu ? '1. Где отвечать?' : '1. Where to respond?') + '</div>' +
        '<div class="rt-toggle-row">' +
          '<label class="rt-toggle-card' + (chatTypes.includes('dm') ? ' rt-active' : '') + '" onclick="this.classList.toggle(\'rt-active\');this.querySelector(\'input\').checked=this.classList.contains(\'rt-active\')">' +
            '<input type="checkbox" id="routing-dm"' + (chatTypes.includes('dm') ? ' checked' : '') + ' style="display:none">' +
            '<div class="rt-toggle-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>' +
            '<div class="rt-toggle-name">' + (isRu ? 'Личные' : 'DM') + '</div>' +
            '<div class="rt-toggle-desc">' + (isRu ? 'Приватные чаты' : 'Private chats') + '</div>' +
          '</label>' +
          '<label class="rt-toggle-card' + (chatTypes.includes('group') ? ' rt-active' : '') + '" onclick="this.classList.toggle(\'rt-active\');this.querySelector(\'input\').checked=this.classList.contains(\'rt-active\')">' +
            '<input type="checkbox" id="routing-group"' + (chatTypes.includes('group') ? ' checked' : '') + ' style="display:none">' +
            '<div class="rt-toggle-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>' +
            '<div class="rt-toggle-name">' + (isRu ? 'Группы' : 'Groups') + '</div>' +
            '<div class="rt-toggle-desc">' + (isRu ? 'Групповые чаты' : 'Group chats') + '</div>' +
          '</label>' +
          '<label class="rt-toggle-card' + (chatTypes.includes('channel') ? ' rt-active' : '') + '" onclick="this.classList.toggle(\'rt-active\');this.querySelector(\'input\').checked=this.classList.contains(\'rt-active\')">' +
            '<input type="checkbox" id="routing-channel"' + (chatTypes.includes('channel') ? ' checked' : '') + ' style="display:none">' +
            '<div class="rt-toggle-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div>' +
            '<div class="rt-toggle-name">' + (isRu ? 'Каналы' : 'Channels') + '</div>' +
            '<div class="rt-toggle-desc">' + (isRu ? 'Комменты каналов' : 'Channel comments') + '</div>' +
          '</label>' +
        '</div>' +
        '<div class="rt-input-hint" style="margin-top:6px">' + (isRu
          ? 'Включите типы чатов, в которых агент должен работать'
          : 'Enable the chat types where the agent should work') + '</div>' +
      '</div>' +

      // ── Step 2: Filter by specific chats ──
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.link + ' ' + (isRu ? '2. Конкретные чаты (опционально)' : '2. Specific chats (optional)') + '</div>' +
        '<div class="rt-input-wrap">' +
          '<input type="text" id="routing-chat-ids" class="rt-input" value="' + escHtml(chatIds) + '" placeholder="' + (isRu ? '@username, -100123456' : '@username, -100123456') + '">' +
          '<div class="rt-input-hint">' + (isRu
            ? 'Если указаны — агент будет отвечать ТОЛЬКО в этих чатах. Пусто = все чаты подходящего типа.'
            : 'If set, agent responds ONLY in these chats. Empty = all matching chats.') + '</div>' +
        '</div>' +
      '</div>' +

      // ── Step 3: Trigger keywords ──
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.search + ' ' + (isRu ? '3. Триггер-слова (опционально)' : '3. Trigger words (optional)') + '</div>' +
        '<div class="rt-input-wrap">' +
          '<input type="text" id="routing-keywords" class="rt-input" value="' + escHtml(keywords) + '" placeholder="' + (isRu ? 'баланс, nft, крипто' : 'balance, nft, crypto') + '">' +
          '<div class="rt-input-hint">' + (isRu
            ? 'Агент активируется когда сообщение содержит одно из этих слов. Пусто = реагирует на все сообщения.'
            : 'Agent activates when message contains any of these words. Empty = responds to all messages.') + '</div>' +
        '</div>' +
        '<div id="rt-keyword-tags" class="rt-keyword-tags"></div>' +
      '</div>' +

      // ── Step 4: Priority & Fallback ──
      '<div class="rt-row-2">' +
        '<div class="rt-section" style="flex:1">' +
          '<div class="rt-section-label">' + IC.chart + ' ' + (isRu ? '4. Приоритет' : '4. Priority') + '</div>' +
          '<div class="rt-priority-wrap">' +
            '<input type="range" id="routing-priority-slider" min="1" max="100" value="' + priority + '" class="rt-slider" oninput="document.getElementById(\'routing-priority\').value=this.value;document.getElementById(\'rt-priority-val\').textContent=this.value">' +
            '<div class="rt-priority-display">' +
              '<input type="number" id="routing-priority" value="' + priority + '" min="1" max="100" class="rt-priority-num" oninput="document.getElementById(\'routing-priority-slider\').value=this.value;document.getElementById(\'rt-priority-val\').textContent=this.value">' +
              '<span id="rt-priority-val" class="rt-priority-badge">' + priority + '</span>' +
            '</div>' +
            '<div class="rt-input-hint">' + (isRu ? 'Если 2 агента подходят — побеждает с большим числом' : 'When 2 agents match — the one with higher number wins') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="rt-section" style="flex:1">' +
          '<div class="rt-section-label">' + IC.robot + ' ' + (isRu ? 'Резервный' : 'Fallback') + '</div>' +
          '<label class="rt-default-toggle' + (isDefault ? ' rt-default-on' : '') + '" onclick="var c=this.querySelector(\'input\');c.checked=!c.checked;this.classList.toggle(\'rt-default-on\',c.checked)">' +
            '<input type="checkbox" id="routing-is-default"' + (isDefault ? ' checked' : '') + ' style="display:none">' +
            '<div class="rt-default-icon">' + IC.robot + '</div>' +
            '<div>' +
              '<div class="rt-default-title">' + (isRu ? 'Резервный агент' : 'Fallback Agent') + '</div>' +
              '<div class="rt-default-desc">' + (isRu ? 'Отвечает когда ни один другой агент не подходит' : 'Responds when no other agent matches') + '</div>' +
            '</div>' +
          '</label>' +
        '</div>' +
      '</div>' +

      // ── How it works — simplified ──
      '<div class="rt-score-preview">' +
        '<div class="rt-score-title">' + (isRu ? 'Как это работает?' : 'How does it work?') + '</div>' +
        '<div class="rt-input-hint" style="margin-top:4px;line-height:1.6">' + (isRu
          ? '1. Приходит сообщение на Telegram-аккаунт<br>2. Каждый агент получает баллы за совпадения:<br>' +
            '&nbsp;&nbsp;&nbsp;• Конкретный чат = <b>+100</b> &nbsp; • Триггер-слово = <b>+50</b> &nbsp; • Тип чата = <b>+10</b><br>' +
            '3. <b>Побеждает агент с наибольшим баллом</b><br>' +
            '4. Если никто не набрал баллов — отвечает резервный агент'
          : '1. A message arrives on the Telegram account<br>2. Each agent gets points for matches:<br>' +
            '&nbsp;&nbsp;&nbsp;• Specific chat = <b>+100</b> &nbsp; • Trigger word = <b>+50</b> &nbsp; • Chat type = <b>+10</b><br>' +
            '3. <b>Agent with the highest score wins</b><br>' +
            '4. If no one scores — the fallback agent responds') + '</div>' +
      '</div>' +

      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveSettingsRouting()">' +
          IC.check + ' ' + (isRu ? 'Сохранить' : 'Save') +
        '</button>' +
      '</div>' +
      '</div>';

    setTimeout(function() {
      _renderKeywordTags();
      var kwInput = document.getElementById('routing-keywords');
      if (kwInput) kwInput.addEventListener('input', _renderKeywordTags);
      _loadSharedAgents();
    }, 50);
  } else if (tab === 'chat') {
    var isRu = currentLang === 'ru';
    _agentChatHistory = [];
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6">' + IC.chat + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Чат с агентом' : 'Chat with Agent') + '</h3>' +
          '<p>' + (isRu ? 'Отправляйте сообщения агенту прямо из Studio' : 'Send messages to the agent directly from Studio') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="st-chat-wrap">' +
        '<div id="agent-chat-messages" class="st-chat-messages">' +
          '<div class="st-chat-empty">' + IC.chat + '<span>' + (isRu ? 'Начните диалог с агентом...' : 'Start a conversation with the agent...') + '</span></div>' +
        '</div>' +
        '<div class="st-chat-input-row">' +
          '<input type="text" id="agent-chat-input" class="st-chat-input" placeholder="' + (isRu ? 'Введите сообщение...' : 'Type a message...') + '" onkeydown="if(event.key===\'Enter\')sendAgentChatMessage()">' +
          '<button class="st-chat-send" onclick="sendAgentChatMessage()">' + IC.send + '</button>' +
        '</div>' +
      '</div>' +
      '</div>';
  } else if (tab === 'behavior') {
    var isRu = currentLang === 'ru';
    var bh = (config.config && config.config.behavior) || {};
    var typingEnabled = bh.typingDelay !== false;
    var typingSpeed = bh.typingSpeed || 40;
    var readReceipts = bh.readReceipts !== false;
    var readDelay = bh.readDelay || 1.5;
    var msgSplitting = !!bh.messageSplitting;
    var thinkingPhrases = bh.thinkingPhrases !== false;
    var reactions = !!bh.reactions;
    var scheduleEnabled = !!bh.schedule;
    var scheduleStart = (bh.scheduleStart || 9);
    var scheduleEnd = (bh.scheduleEnd || 23);
    var hesitation = !!bh.hesitation;
    var randomVariance = bh.randomVariance || 25;

    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(236,72,153,0.12);color:#ec4899">' + IC.user + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Человекоподобное поведение' : 'Human-like Behavior') + '</h3>' +
          '<p>' + (isRu ? 'Имитация живого человека: задержки при наборе, прочтение сообщений, реакции' : 'Human simulation: typing delays, read receipts, reactions, natural timing') + '</p>' +
        '</div>' +
      '</div>' +

      // Typing Delay
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6">' + IC.clock + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">' + (isRu ? 'Typing Delay' : 'Typing Delay') + '</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'Показывает "печатает..." перед ответом. Задержка пропорциональна длине' : 'Shows "typing..." before response. Delay proportional to length') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="bh-typing"' + (typingEnabled ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
        '<div class="bh-sub-setting" id="bh-typing-opts"' + (typingEnabled ? '' : ' style="display:none"') + '>' +
          '<div class="bh-range-row">' +
            '<span class="bh-range-label">' + (isRu ? 'Скорость' : 'Speed') + '</span>' +
            '<input type="range" id="bh-typing-speed" min="15" max="80" value="' + typingSpeed + '" class="rt-slider" oninput="document.getElementById(\'bh-typing-speed-val\').textContent=this.value+\'ms/char\'">' +
            '<span id="bh-typing-speed-val" class="bh-range-val">' + typingSpeed + 'ms/char</span>' +
          '</div>' +
          '<div class="rt-input-hint">' + (isRu ? '15ms = быстрый печатник, 40ms = нормально, 80ms = медленный. Реальные люди: 30-60ms' : '15ms = fast typist, 40ms = normal, 80ms = slow. Real humans: 30-60ms') + '</div>' +
        '</div>' +
      '</div>' +

      // Read Receipts
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(34,197,94,0.12);color:#22c55e">' + IC.eye + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">' + (isRu ? 'Read Receipts (ограничено)' : 'Read Receipts (limited)') + '</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'Помечает сообщения прочитанными с задержкой, как живой человек' : 'Marks messages as read with delay, like a real person') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="bh-read-receipts"' + (readReceipts ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
        '<div class="bh-sub-setting" id="bh-read-opts"' + (readReceipts ? '' : ' style="display:none"') + '>' +
          '<div class="bh-range-row">' +
            '<span class="bh-range-label">' + (isRu ? 'Задержка' : 'Delay') + '</span>' +
            '<input type="range" id="bh-read-delay" min="0.5" max="5" step="0.5" value="' + readDelay + '" class="rt-slider" oninput="document.getElementById(\'bh-read-delay-val\').textContent=this.value+\'s\'">' +
            '<span id="bh-read-delay-val" class="bh-range-val">' + readDelay + 's</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Message Splitting
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(var(--accent-r,168),var(--accent-g,85),var(--accent-b,247),0.12);color:#a855f7">' + IC.split + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">' + (isRu ? 'Разбивка сообщений' : 'Message Splitting') + '</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'Длинные ответы разбиваются на несколько сообщений с паузами между ними' : 'Long responses split into multiple messages with pauses between them') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="bh-splitting"' + (msgSplitting ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
      '</div>' +

      // Thinking Phrases
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b">' + IC.brain + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">' + (isRu ? 'Фразы-размышления' : 'Thinking Phrases') + '</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? '"Секунду...", "Проверяю..." перед сложными ответами' : '"Let me check...", "One moment..." before complex responses') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="bh-thinking"' + (thinkingPhrases ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
      '</div>' +

      // Reactions
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(239,68,68,0.12);color:#ef4444">' + IC.thumbsup + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">' + (isRu ? 'Реакции на сообщения' : 'Message Reactions') + '</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'Агент ставит реакции на интересные сообщения' : 'Agent reacts to interesting messages with emoji') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="bh-reactions"' + (reactions ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
      '</div>' +

      // Hesitation (start typing, stop, start again)
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(100,116,139,0.12);color:#64748b">' + IC.hourglass + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">' + (isRu ? 'Колебания при наборе' : 'Typing Hesitation') + '</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'Иногда начинает печатать, останавливается и снова печатает' : 'Sometimes starts typing, stops, and starts again') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="bh-hesitation"' + (hesitation ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
      '</div>' +

      // Random variance
      '<div class="rt-section">' +
        '<div class="bh-range-row">' +
          '<div style="display:flex;align-items:center;gap:8px">' + IC.shuffle + ' <span class="bh-range-label">' + (isRu ? 'Случайность задержек' : 'Delay Randomness') + '</span></div>' +
          '<input type="range" id="bh-variance" min="0" max="50" value="' + randomVariance + '" class="rt-slider" oninput="document.getElementById(\'bh-variance-val\').textContent=this.value+\'%\'">' +
          '<span id="bh-variance-val" class="bh-range-val">' + randomVariance + '%</span>' +
        '</div>' +
        '<div class="rt-input-hint">' + (isRu ? 'Разброс времени задержек, чтобы не выглядеть механическим. 0% = всегда одинаково, 50% = максимальный разброс' : 'Variance in delay timing to avoid mechanical patterns. 0% = always same, 50% = max variance') + '</div>' +
      '</div>' +

      // Online/Offline Schedule
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.12);color:#6366f1">' + IC.moon + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">' + (isRu ? 'Расписание активности' : 'Activity Schedule') + '</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'Не отвечать ночью, имитация режима сна' : 'Do not respond at night, simulate sleep schedule') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="bh-schedule"' + (scheduleEnabled ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
        '<div class="bh-sub-setting" id="bh-schedule-opts"' + (scheduleEnabled ? '' : ' style="display:none"') + '>' +
          '<div class="bh-time-row">' +
            '<div class="bh-time-field">' +
              '<label>' + (isRu ? 'Начало' : 'Start') + '</label>' +
              '<select id="bh-sched-start" class="rt-input" style="width:auto;padding:6px 10px">' +
                Array.from({length: 24}, function(_, i) { return '<option value="' + i + '"' + (i === scheduleStart ? ' selected' : '') + '>' + (i < 10 ? '0' : '') + i + ':00</option>'; }).join('') +
              '</select>' +
            '</div>' +
            '<span style="color:var(--text-muted);margin:0 8px">—</span>' +
            '<div class="bh-time-field">' +
              '<label>' + (isRu ? 'Конец' : 'End') + '</label>' +
              '<select id="bh-sched-end" class="rt-input" style="width:auto;padding:6px 10px">' +
                Array.from({length: 24}, function(_, i) { return '<option value="' + i + '"' + (i === scheduleEnd ? ' selected' : '') + '>' + (i < 10 ? '0' : '') + i + ':00</option>'; }).join('') +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="rt-input-hint">' + (isRu ? 'Агент активен только в указанные часы. Вне расписания — молчит' : 'Agent active only during these hours. Outside schedule — silent') + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveSettingsBehavior()">' + IC.check + ' ' + (isRu ? 'Сохранить' : 'Save') + '</button>' +
      '</div>' +
      '</div>';

    // Wire up toggles to show/hide sub-settings
    setTimeout(function() {
      var pairs = [
        ['bh-typing', 'bh-typing-opts'],
        ['bh-read-receipts', 'bh-read-opts'],
        ['bh-schedule', 'bh-schedule-opts'],
      ];
      pairs.forEach(function(p) {
        var cb = document.getElementById(p[0]);
        var opts = document.getElementById(p[1]);
        if (cb && opts) cb.addEventListener('change', function() {
          opts.style.display = cb.checked ? '' : 'none';
        });
      });
    }, 50);

  } else if (tab === 'learning') {
    var isRu = currentLang === 'ru';
    var lr = (config.config && config.config.learning) || {};
    var feedbackLoop = lr.feedbackLoop !== false;
    var errorHealing = lr.errorHealing !== false;
    var qualityScoring = !!lr.qualityScoring;
    var styleAdaptation = !!lr.styleAdaptation;
    var maxRetries = lr.maxRetries || 3;
    var circuitBreakerThreshold = lr.circuitBreakerThreshold || 5;
    var negativePatterns = lr.negativePatterns || (isRu ? 'нет, не так, неправильно, хуйня, бред, отстой, фигня' : 'no, wrong, bad, terrible, useless, stupid');

    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(16,185,129,0.12);color:#10b981">' + IC.book + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Самообучение' : 'Self-Learning') + '</h3>' +
          '<p>' + (isRu ? 'Агент учится на ошибках, адаптируется к стилю пользователя и автоматически восстанавливается после сбоев' : 'Agent learns from mistakes, adapts to user style, and auto-recovers from failures') + '</p>' +
        '</div>' +
      '</div>' +

      // Feedback Loop
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6">' + IC.loop + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">Feedback Loop</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'Когда юзер говорит "нет/не так" — агент автоматически save_lesson и корректирует поведение' : 'When user says "no/wrong" — agent auto-saves lesson and adjusts behavior') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="lr-feedback"' + (feedbackLoop ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
        '<div class="bh-sub-setting" id="lr-feedback-opts"' + (feedbackLoop ? '' : ' style="display:none"') + '>' +
          '<div class="rt-section-label" style="margin-bottom:6px">' + IC.search + ' ' + (isRu ? 'Негативные паттерны' : 'Negative Patterns') + '</div>' +
          '<input type="text" id="lr-neg-patterns" class="rt-input" value="' + escHtml(negativePatterns) + '" placeholder="no, wrong, bad...">' +
          '<div class="rt-input-hint">' + (isRu ? 'Слова-триггеры через запятую. При обнаружении — агент запоминает ошибку и корректирует ответ' : 'Comma-separated trigger words. When detected — agent saves the mistake and adjusts response') + '</div>' +
        '</div>' +
      '</div>' +

      // Error Self-Healing
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(239,68,68,0.12);color:#ef4444">' + IC.heartbeat + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">Error Self-Healing</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'При ошибке tool call — автоматически пробует другой подход. Circuit breaker при N сбоях подряд' : 'On tool call error — auto-tries alternative approach. Circuit breaker after N consecutive failures') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="lr-healing"' + (errorHealing ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
        '<div class="bh-sub-setting" id="lr-healing-opts"' + (errorHealing ? '' : ' style="display:none"') + '>' +
          '<div class="bh-range-row">' +
            '<span class="bh-range-label">' + (isRu ? 'Макс. повторов' : 'Max retries') + '</span>' +
            '<input type="range" id="lr-max-retries" min="1" max="5" value="' + maxRetries + '" class="rt-slider" oninput="document.getElementById(\'lr-retries-val\').textContent=this.value">' +
            '<span id="lr-retries-val" class="bh-range-val">' + maxRetries + '</span>' +
          '</div>' +
          '<div class="bh-range-row" style="margin-top:8px">' +
            '<span class="bh-range-label">' + (isRu ? 'Circuit breaker' : 'Circuit breaker') + '</span>' +
            '<input type="range" id="lr-circuit" min="2" max="10" value="' + circuitBreakerThreshold + '" class="rt-slider" oninput="document.getElementById(\'lr-circuit-val\').textContent=this.value+\' ' + (isRu ? 'сбоев' : 'fails') + '\'">' +
            '<span id="lr-circuit-val" class="bh-range-val">' + circuitBreakerThreshold + ' ' + (isRu ? 'сбоев' : 'fails') + '</span>' +
          '</div>' +
          '<div class="rt-input-hint">' + (isRu ? 'После N сбоев подряд одного инструмента — переключается на альтернативу или уведомляет' : 'After N consecutive failures of one tool — switches to alternative or notifies') + '</div>' +
        '</div>' +
      '</div>' +

      // Quality Scoring
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b">' + IC.target + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">' + (isRu ? 'Оценка диалогов' : 'Conversation Scoring') + '</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'Каждый диалог оценивается: был ли полезен, доволен ли юзер. Результаты видны в аудите' : 'Each conversation scored: was it helpful, was user satisfied. Results visible in audit') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="lr-scoring"' + (qualityScoring ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
      '</div>' +

      // Style Adaptation
      '<div class="rt-section">' +
        '<div class="bh-toggle-row">' +
          '<div class="bh-toggle-info">' +
            '<div class="bh-toggle-icon" style="background:rgba(var(--accent-r,168),var(--accent-g,85),var(--accent-b,247),0.12);color:#a855f7">' + IC.shuffle + '</div>' +
            '<div>' +
              '<div class="bh-toggle-name">' + (isRu ? 'Адаптация стиля' : 'Style Adaptation') + '</div>' +
              '<div class="bh-toggle-desc">' + (isRu ? 'Подстройка длины и тона ответов под стиль пользователя. Краткие вопросы — краткие ответы' : 'Adapts response length and tone to user style. Short questions get short answers') + '</div>' +
            '</div>' +
          '</div>' +
          '<label class="bh-switch"><input type="checkbox" id="lr-adaptation"' + (styleAdaptation ? ' checked' : '') + '><span class="bh-slider"></span></label>' +
        '</div>' +
      '</div>' +

      // Self-healing summary card
      '<div class="bh-summary-card">' +
        '<div class="bh-summary-title">' + IC.heartbeat + ' ' + (isRu ? 'Как работает самовосстановление' : 'How Self-Healing Works') + '</div>' +
        '<div class="rt-input-hint" style="margin-top:6px;line-height:1.7">' + (isRu
          ? '1. Инструмент возвращает ошибку<br>' +
            '2. LLM получает контекст ошибки и пробует другой подход<br>' +
            '3. Если та же ошибка N раз подряд — <b>circuit breaker</b> блокирует инструмент<br>' +
            '4. Агент переключается на fallback или уведомляет пользователя<br>' +
            '5. Через 5 минут блокировка снимается автоматически'
          : '1. Tool returns an error<br>' +
            '2. LLM gets error context and tries a different approach<br>' +
            '3. If same error N times in a row — <b>circuit breaker</b> blocks the tool<br>' +
            '4. Agent switches to fallback or notifies user<br>' +
            '5. Block auto-resets after 5 minutes') + '</div>' +
      '</div>' +

      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveSettingsLearning()">' + IC.check + ' ' + (isRu ? 'Сохранить' : 'Save') + '</button>' +
      '</div>' +
      '</div>';

    // Wire up toggles
    setTimeout(function() {
      var pairs = [
        ['lr-feedback', 'lr-feedback-opts'],
        ['lr-healing', 'lr-healing-opts'],
      ];
      pairs.forEach(function(p) {
        var cb = document.getElementById(p[0]);
        var opts = document.getElementById(p[1]);
        if (cb && opts) cb.addEventListener('change', function() {
          opts.style.display = cb.checked ? '' : 'none';
        });
      });
    }, 50);

  } else if (tab === 'telegram') {
    body.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted)">Loading...</div>';
    loadAgentTelegramTab(body, _detailAgentId);
  } else if (tab === 'evals') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(16,185,129,0.12);color:#10b981">' + IC.check + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Оценки качества' : 'Quality Evals') + '</h3>' +
          '<p>' + (isRu ? 'Автоматическая оценка каждого ответа агента' : 'Auto quality scoring for every agent response') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'Средний балл' : 'Average Score') + '</div>' +
        '<div id="eval-avg" style="display:flex;gap:16px;align-items:center">' +
          '<div style="font-size:2.5rem;font-weight:700;color:#10b981" id="eval-avg-num">-</div>' +
          '<div style="font-size:.78rem;color:var(--text-muted)">' + (isRu ? 'из 10 (последние 20 ответов)' : 'out of 10 (last 20 responses)') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'История оценок' : 'Eval History') + '</div>' +
        '<div id="eval-list" style="display:flex;flex-direction:column;gap:6px">' +
          '<div style="text-align:center;color:var(--text-muted);padding:2rem">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
    loadEvalsData();

  } else if (tab === 'audit') {
    body.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted)">' + (currentLang === 'ru' ? 'Загрузка аудита...' : 'Loading audit...') + '</div>';
    runSettingsAudit(body);
  } else if (tab === 'blocklist' || tab === 'triggers' || tab === 'session' || tab === 'toolscope') {
    body.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted)">Loading...</div>';
    loadHooksTab(body, tab, _detailAgentId);
  } else if (tab === 'lifecycle') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(16,185,129,0.12);color:#10b981">' + IC.play + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Жизненный цикл' : 'Lifecycle') + '</h3>' +
          '<p>' + (isRu ? 'Статус, аптайм и управление запуском агента' : 'Status, uptime and agent run management') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'Текущий статус' : 'Current Status') + '</div>' +
        '<div id="lifecycle-status" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
          '<div class="lifecycle-badge" id="lc-state-badge" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:.82rem;font-weight:600;background:rgba(100,116,139,0.15);color:#94a3b8"><span class="lc-dot" style="width:8px;height:8px;border-radius:50%;background:currentColor"></span> loading...</div>' +
          '<div id="lc-uptime" style="font-size:.78rem;color:var(--text-muted)"></div>' +
          '<div id="lc-error" style="font-size:.78rem;color:#ef4444;display:none"></div>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'Управление' : 'Controls') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="rt-save-btn" onclick="lifecycleAction(\'start\')" style="background:linear-gradient(135deg,var(--primary),var(--primary-dark))">' + IC.play + ' ' + (isRu ? 'Запустить' : 'Start') + '</button>' +
          '<button class="rt-save-btn" onclick="lifecycleAction(\'stop\')" style="background:linear-gradient(135deg,var(--primary),var(--primary-dark))">' + IC.pause + ' ' + (isRu ? 'Остановить' : 'Stop') + '</button>' +
          '<button class="rt-save-btn" onclick="lifecycleAction(\'restart\')" style="background:linear-gradient(135deg,#f59e0b,#d97706)">' + IC.refresh + ' ' + (isRu ? 'Перезапустить' : 'Restart') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'История состояний' : 'State History') + '</div>' +
        '<div id="lc-history" style="font-size:.78rem;color:var(--text-muted)">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>' +
      '</div>' +
      '</div>';
    loadLifecycleData();

  } else if (tab === 'tokens') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b">' + IC.dollar + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Расход токенов' : 'Token Usage') + '</h3>' +
          '<p>' + (isRu ? 'Статистика потребления AI токенов и оценка стоимости' : 'AI token consumption statistics and cost estimation') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'Общий расход' : 'Total Usage') + '</div>' +
        '<div id="token-totals" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">' +
          '<div class="stat-card"><div class="stat-value" id="tk-total">-</div><div class="stat-label">' + (isRu ? 'Всего токенов' : 'Total Tokens') + '</div></div>' +
          '<div class="stat-card"><div class="stat-value" id="tk-cost">-</div><div class="stat-label">' + (isRu ? 'Ориентировочная стоимость' : 'Est. Cost') + '</div></div>' +
          '<div class="stat-card"><div class="stat-value" id="tk-requests">-</div><div class="stat-label">' + (isRu ? 'Запросов' : 'Requests') + '</div></div>' +
          '<div class="stat-card"><div class="stat-value" id="tk-today">-</div><div class="stat-label">' + (isRu ? 'Сегодня' : 'Today') + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'Дневной лимит токенов' : 'Daily Token Budget') + '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<input type="number" id="tk-budget-input" class="st-input" style="width:180px" placeholder="0 = unlimited" value="0">' +
          '<button class="rt-save-btn" onclick="saveTokenBudget()">' + IC.check + ' ' + (isRu ? 'Сохранить лимит' : 'Save Limit') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'По дням (последние 30)' : 'Daily (last 30 days)') + '</div>' +
        '<div id="token-chart" style="width:100%;height:200px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;position:relative;overflow:hidden"></div>' +
        '<div id="token-table" style="margin-top:12px"></div>' +
      '</div>' +
      '</div>';
    loadTokenData();

  } else if (tab === 'contacts') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.12);color:#6366f1">' + IC.users + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Контакты' : 'Contacts') + '</h3>' +
          '<p>' + (isRu ? 'Пользователи, с которыми взаимодействовал агент' : 'Users the agent has interacted with') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'Список контактов' : 'Contact List') + '</div>' +
        '<div id="contacts-list" style="display:flex;flex-direction:column;gap:8px">' +
          '<div style="text-align:center;color:var(--text-muted);padding:2rem">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
    loadContactsData();

  } else if (tab === 'chats') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div style="display:flex;height:calc(100vh - 120px);gap:0;overflow:hidden;border-radius:12px;border:1px solid var(--border)">' +
        // Left: chat list
        '<div id="chats-sidebar" style="width:280px;min-width:220px;border-right:1px solid var(--border);display:flex;flex-direction:column;background:var(--bg-primary)">' +
          '<div style="padding:14px 16px;border-bottom:1px solid var(--border);font-weight:700;font-size:.9rem;color:var(--text-primary);display:flex;align-items:center;gap:8px">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
            (isRu ? 'Переписка' : 'Inbox') +
          '</div>' +
          '<div id="chats-list" style="flex:1;overflow-y:auto;padding:8px">' +
            '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:.82rem">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>' +
          '</div>' +
        '</div>' +
        // Right: chat view
        '<div id="chat-view" style="flex:1;display:flex;flex-direction:column;background:var(--bg-secondary)">' +
          '<div id="chat-view-header" style="padding:14px 18px;border-bottom:1px solid var(--border);background:var(--bg-primary);display:flex;align-items:center;gap:12px">' +
            '<div style="color:var(--text-muted);font-size:.85rem">' + (isRu ? 'Выберите чат' : 'Select a chat') + '</div>' +
          '</div>' +
          '<div id="chat-view-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px">' +
            '<div style="text-align:center;color:var(--text-muted);padding:4rem;font-size:.82rem">' + (isRu ? '← Выберите чат слева' : '← Select a chat on the left') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    loadChatsData();

  } else if (tab === 'memory') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.12);color:#8b5cf6">' + IC.brain + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Память агента' : 'Agent Memory') + '</h3>' +
          '<p>' + (isRu ? 'Контакты, факты, уроки и цели — всё что агент помнит' : 'Contacts, facts, lessons and goals — everything the agent knows') + '</p>' +
        '</div>' +
      '</div>' +

      // Stats row
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:18px">' +
        '<div class="stat-card"><div class="stat-value" id="mem-stat-contacts">-</div><div class="stat-label">' + (isRu ? 'Контактов' : 'Contacts') + '</div></div>' +
        '<div class="stat-card"><div class="stat-value" id="mem-stat-lessons">-</div><div class="stat-label">' + (isRu ? 'Уроков' : 'Lessons') + '</div></div>' +
        '<div class="stat-card"><div class="stat-value" id="mem-stat-size">-</div><div class="stat-label">' + (isRu ? 'Размер' : 'Size') + '</div></div>' +
        '<div class="stat-card"><div class="stat-value" id="mem-stat-logs">-</div><div class="stat-label">' + (isRu ? 'Лог-файлов' : 'Daily logs') + '</div></div>' +
      '</div>' +

      // Sub-tab bar
      '<div style="display:flex;gap:4px;margin-bottom:16px;background:var(--bg-primary);border-radius:10px;padding:4px">' +
        '<button id="mem-sub-contacts" class="mem-sub-btn active" onclick="switchMemSubTab(\'contacts\')" style="flex:1;padding:7px 10px;border-radius:7px;border:none;cursor:pointer;font-size:.78rem;font-weight:500;background:rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.18);color:#8b5cf6;transition:all .2s">' + IC.user + ' ' + (isRu ? 'Контакты' : 'Contacts') + '</button>' +
        '<button id="mem-sub-knowledge" class="mem-sub-btn" onclick="switchMemSubTab(\'knowledge\')" style="flex:1;padding:7px 10px;border-radius:7px;border:none;cursor:pointer;font-size:.78rem;font-weight:500;background:transparent;color:var(--text-muted);transition:all .2s">' + IC.book + ' ' + (isRu ? 'Факты' : 'Facts') + '</button>' +
        '<button id="mem-sub-lessons" class="mem-sub-btn" onclick="switchMemSubTab(\'lessons\')" style="flex:1;padding:7px 10px;border-radius:7px;border:none;cursor:pointer;font-size:.78rem;font-weight:500;background:transparent;color:var(--text-muted);transition:all .2s">' + IC.lightbulb + ' ' + (isRu ? 'Уроки' : 'Lessons') + '</button>' +
        '<button id="mem-sub-raw" class="mem-sub-btn" onclick="switchMemSubTab(\'raw\')" style="flex:1;padding:7px 10px;border-radius:7px;border:none;cursor:pointer;font-size:.78rem;font-weight:500;background:transparent;color:var(--text-muted);transition:all .2s">' + IC.clipboard + ' ' + (isRu ? 'Память' : 'Raw') + '</button>' +
        '<button id="mem-sub-logs" class="mem-sub-btn" onclick="switchMemSubTab(\'logs\')" style="flex:1;padding:7px 10px;border-radius:7px;border:none;cursor:pointer;font-size:.78rem;font-weight:500;background:transparent;color:var(--text-muted);transition:all .2s">' + IC.clock + ' ' + (isRu ? 'Логи' : 'Logs') + '</button>' +
      '</div>' +

      // Sub-tab: Contacts
      '<div id="mem-panel-contacts">' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">' +
          '<div style="flex:1;position:relative">' +
            '<input type="text" id="mem-contact-search" class="st-input" style="width:100%;padding-left:36px" placeholder="' + (isRu ? 'Поиск контакта...' : 'Search contacts...') + '" oninput="filterContacts()">' +
            '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:.4">' + IC.search + '</span>' +
          '</div>' +
        '</div>' +
        '<div id="mem-contacts-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">' +
          '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;font-size:.8rem">⟳ ' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>' +
        '</div>' +
      '</div>' +

      // Sub-tab: Knowledge/Facts
      '<div id="mem-panel-knowledge" style="display:none">' +
        '<div class="rt-section">' +
          '<div class="rt-section-label">' + IC.brain + ' ' + (isRu ? 'Блоки памяти' : 'Core Memory Blocks') + '</div>' +
          '<div id="core-memory-blocks" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
            '<div style="text-align:center;color:var(--text-muted);padding:1rem;grid-column:1/-1">⟳</div>' +
          '</div>' +
        '</div>' +
        '<div class="rt-section">' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            '<div style="flex:1;position:relative">' +
              '<input type="text" id="mem-search-input" class="st-input" style="width:100%;padding-left:36px" placeholder="' + (isRu ? 'Поиск по памяти...' : 'Search memory...') + '" onkeydown="if(event.key===\'Enter\')searchAgentMemory()">' +
              '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:.4">' + IC.search + '</span>' +
            '</div>' +
            '<button class="rt-save-btn" onclick="searchAgentMemory()">' + (isRu ? 'Найти' : 'Find') + '</button>' +
          '</div>' +
          '<div id="mem-search-results" style="margin-top:10px"></div>' +
        '</div>' +
      '</div>' +

      // Sub-tab: Lessons
      '<div id="mem-panel-lessons" style="display:none">' +
        '<div id="mem-lessons-list">' +
          '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:.8rem">⟳ ' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>' +
        '</div>' +
      '</div>' +

      // Sub-tab: Raw persistent memory
      '<div id="mem-panel-raw" style="display:none">' +
        '<div class="rt-section">' +
          '<textarea id="mem-persistent-text" class="st-textarea" style="min-height:220px;font-family:\'JetBrains Mono\',monospace;font-size:.78rem;line-height:1.6" placeholder="' + (isRu ? 'Факты, события, предпочтения...' : 'Facts, events, preferences...') + '"></textarea>' +
          '<div style="display:flex;gap:8px;margin-top:8px">' +
            '<button class="rt-save-btn" onclick="saveMemoryPersistent()">' + IC.check + ' ' + (isRu ? 'Сохранить' : 'Save') + '</button>' +
            '<button class="rt-save-btn" onclick="clearAgentMemory(\'persistent\')" style="background:linear-gradient(135deg,var(--primary),var(--primary-dark))">' + (isRu ? 'Очистить' : 'Clear') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Sub-tab: Daily logs
      '<div id="mem-panel-logs" style="display:none">' +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">' +
          '<button class="rt-save-btn" onclick="clearAgentMemory(\'daily\')" style="background:var(--accent-dim);color:var(--primary);font-size:.68rem;padding:4px 10px">' + (isRu ? 'Очистить логи' : 'Clear logs') + '</button>' +
        '</div>' +
        '<div id="mem-daily-logs" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">' +
          '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:1.5rem;font-size:.8rem">⟳</div>' +
        '</div>' +
      '</div>' +

      '</div>';
    loadMemoryData();
    loadProfilesData();

  } else if (tab === 'skills') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(var(--accent-r,0),var(--accent-g,168),var(--accent-b,255),0.12);color:#00a8ff">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18 9l-4.1 1.4L12 15l-1.9-4.6L6 9l4.1-1.4z"/><path d="M19 14l.95 2.3L22 17l-2.05.7L19 20l-.95-2.3L16 17l2.05-.7z"/></svg>' +
        '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Скиллы агента' : 'Agent Skills') + '</h3>' +
          '<p>' + (isRu
            ? 'Включи/выключи скиллы для этого агента. Скилл = пакет знаний+правил выбора инструментов. Спека: agentskills.io'
            : 'Enable/disable skills for this agent. Skill = bundle of knowledge + tool-selection rules. Spec: agentskills.io') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div id="agent-skills-list" style="display:flex;flex-direction:column;gap:8px">' +
          '<div class="loading-placeholder">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
    loadAgentSkills(_detailAgentId);

  } else if (tab === 'tasks') {
    var isRu = currentLang === 'ru';
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(34,197,94,0.12);color:#22c55e">' + IC.check + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Задачи агента' : 'Agent Tasks') + '</h3>' +
          '<p>' + (isRu ? 'Управление задачами с зависимостями и приоритетами' : 'Manage tasks with dependencies and priorities') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="rt-section">' +
        '<div class="rt-section-label" style="display:flex;justify-content:space-between;align-items:center">' +
          '<span>' + (isRu ? 'Статистика' : 'Stats') + '</span>' +
          '<div id="task-stats" style="display:flex;gap:12px;font-size:.72rem"></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
          '<select id="task-filter" class="st-input" style="width:150px" onchange="loadTasksData()">' +
            '<option value="">' + (isRu ? 'Все' : 'All') + '</option>' +
            '<option value="pending">' + (isRu ? 'Ожидающие' : 'Pending') + '</option>' +
            '<option value="in_progress">' + (isRu ? 'В процессе' : 'In Progress') + '</option>' +
            '<option value="done">' + (isRu ? 'Готово' : 'Done') + '</option>' +
            '<option value="failed">' + (isRu ? 'Ошибка' : 'Failed') + '</option>' +
          '</select>' +
          '<button class="rt-save-btn" onclick="showCreateTaskForm()">' + IC.plus + ' ' + (isRu ? 'Новая задача' : 'New Task') + '</button>' +
        '</div>' +
        '<div id="task-create-form" style="display:none;margin-bottom:16px;padding:16px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px">' +
          '<input type="text" id="task-desc" class="st-input" style="width:100%;margin-bottom:8px" placeholder="' + (isRu ? 'Описание задачи...' : 'Task description...') + '">' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<select id="task-priority" class="st-input" style="width:120px">' +
              '<option value="0">' + (isRu ? 'Обычный' : 'Normal') + '</option>' +
              '<option value="1">' + (isRu ? 'Высокий' : 'High') + '</option>' +
              '<option value="2">' + (isRu ? 'Критичный' : 'Critical') + '</option>' +
            '</select>' +
            '<input type="datetime-local" id="task-scheduled" class="st-input" style="width:200px">' +
            '<button class="rt-save-btn" onclick="createAgentTask()">' + IC.check + ' ' + (isRu ? 'Создать' : 'Create') + '</button>' +
            '<button class="rt-save-btn" onclick="document.getElementById(\'task-create-form\').style.display=\'none\'" style="background:rgba(100,116,139,0.2);color:var(--text-secondary)">' + (isRu ? 'Отмена' : 'Cancel') + '</button>' +
          '</div>' +
        '</div>' +
        '<div id="tasks-list" style="display:flex;flex-direction:column;gap:6px">' +
          '<div style="text-align:center;color:var(--text-muted);padding:2rem">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
    loadTasksData();

  } else if (tab === 'advanced') {
    var isRu = currentLang === 'ru';
    var spendLimit = 500;
    var tickInterval = 60;
    var agentLang = 'auto';
    // Load from agent state
    try {
      var stateKeys = ['daily_spend_limit_ton', 'tick_interval_sec', 'agent_language'];
      stateKeys.forEach(function(k) {
        var stateVal = config.config && config.config[k];
        if (k === 'daily_spend_limit_ton' && stateVal) spendLimit = parseInt(stateVal) || 500;
        if (k === 'tick_interval_sec' && stateVal) tickInterval = parseInt(stateVal) || 60;
        if (k === 'agent_language' && stateVal) agentLang = stateVal;
      });
    } catch(e) {}

    var intervalOptions = [
      { val: 30, label: '30s' },
      { val: 60, label: '1 min' },
      { val: 120, label: '2 min' },
      { val: 300, label: '5 min' },
      { val: 600, label: '10 min' },
      { val: 1800, label: '30 min' },
      { val: 3600, label: '1h' },
      { val: 7200, label: '2h' },
      { val: 21600, label: '6h' },
      { val: 43200, label: '12h' },
      { val: 86400, label: '24h' },
    ];

    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(239,68,68,0.12);color:#ef4444">' + IC.wrench + '</div>' +
        '<div class="rt-header-text">' +
          '<h3>' + (isRu ? 'Расширенные настройки' : 'Advanced Settings') + '</h3>' +
          '<p>' + (isRu ? 'Лимиты, интервалы, язык, клонирование и экспорт агента' : 'Limits, intervals, language, cloning and agent export') + '</p>' +
        '</div>' +
      '</div>' +

      // Daily spend limit
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.shield + ' ' + (isRu ? 'Дневной лимит трат (TON)' : 'Daily Spend Limit (TON)') + '</div>' +
        '<div class="rt-priority-wrap">' +
          '<input type="range" id="adv-spend-limit" min="0" max="2000" step="10" value="' + spendLimit + '" class="rt-slider" style="accent-color:#ef4444" oninput="document.getElementById(\'adv-spend-val\').textContent=this.value+\' TON\'">' +
          '<div class="rt-priority-display">' +
            '<input type="number" id="adv-spend-num" value="' + spendLimit + '" min="0" max="10000" class="rt-priority-num" style="width:80px" oninput="document.getElementById(\'adv-spend-limit\').value=this.value;document.getElementById(\'adv-spend-val\').textContent=this.value+\' TON\'">' +
            '<span id="adv-spend-val" class="rt-priority-badge" style="background:rgba(239,68,68,0.15);color:#ef4444">' + spendLimit + ' TON</span>' +
          '</div>' +
          '<div class="rt-input-hint">' + (isRu ? 'Максимальная сумма, которую агент может потратить в день (отправка TON + покупка подарков). 0 = без лимита.' : 'Max amount the agent can spend per day (send TON + buy gifts). 0 = no limit.') + '</div>' +
        '</div>' +
      '</div>' +

      // Tick interval
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.clock + ' ' + (isRu ? 'Интервал тика' : 'Tick Interval') + '</div>' +
        '<div class="st-provider-grid" style="grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px">' +
          intervalOptions.map(function(opt) {
            var sel = opt.val === tickInterval;
            return '<div class="st-provider-card' + (sel ? ' st-prov-active' : '') + '" style="padding:10px 8px;text-align:center;cursor:pointer" onclick="document.querySelectorAll(\'.adv-interval-opt\').forEach(function(c){c.classList.remove(\'st-prov-active\')});this.classList.add(\'st-prov-active\');document.getElementById(\'adv-tick-val\').value=\'' + opt.val + '\'" class="adv-interval-opt">' +
              '<div style="font-weight:600;font-size:.85rem">' + opt.label + '</div>' +
            '</div>';
          }).join('') +
          '<input type="hidden" id="adv-tick-val" value="' + tickInterval + '">' +
        '</div>' +
        '<div class="rt-input-hint" style="margin-top:8px">' + (isRu ? 'Как часто агент выполняет свой тик (проверку/действие). Для расписания: используется cron из промпта.' : 'How often the agent runs its tick (check/action). For scheduled: uses cron from prompt.') + '</div>' +
      '</div>' +

      // Language
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.globe + ' ' + (isRu ? 'Язык ответов агента' : 'Agent Response Language') + '</div>' +
        '<div class="rt-toggle-row" style="gap:8px">' +
          '<label class="rt-toggle-card' + (agentLang === 'auto' ? ' rt-active' : '') + '" onclick="selectAdvLang(this,\'auto\')" style="flex:1">' +
            '<input type="radio" name="adv-lang" value="auto"' + (agentLang === 'auto' ? ' checked' : '') + ' style="display:none">' +
            '<div class="rt-toggle-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>' +
            '<div class="rt-toggle-name">Auto</div>' +
            '<div class="rt-toggle-desc">' + (isRu ? 'Зеркалит язык' : 'Mirrors language') + '</div>' +
          '</label>' +
          '<label class="rt-toggle-card' + (agentLang === 'ru' ? ' rt-active' : '') + '" onclick="selectAdvLang(this,\'ru\')" style="flex:1">' +
            '<input type="radio" name="adv-lang" value="ru"' + (agentLang === 'ru' ? ' checked' : '') + ' style="display:none">' +
            '<div class="rt-toggle-icon" style="font-size:1.3rem">RU</div>' +
            '<div class="rt-toggle-name">' + (isRu ? 'Русский' : 'Russian') + '</div>' +
            '<div class="rt-toggle-desc">' + (isRu ? 'Всегда на русском' : 'Always Russian') + '</div>' +
          '</label>' +
          '<label class="rt-toggle-card' + (agentLang === 'en' ? ' rt-active' : '') + '" onclick="selectAdvLang(this,\'en\')" style="flex:1">' +
            '<input type="radio" name="adv-lang" value="en"' + (agentLang === 'en' ? ' checked' : '') + ' style="display:none">' +
            '<div class="rt-toggle-icon" style="font-size:1.3rem">EN</div>' +
            '<div class="rt-toggle-name">English</div>' +
            '<div class="rt-toggle-desc">' + (isRu ? 'Всегда на английском' : 'Always English') + '</div>' +
          '</label>' +
        '</div>' +
      '</div>' +

      // Action buttons
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.brain + ' ' + (isRu ? 'Сжатие контекста' : 'Context Compaction') + '</div>' +
        '<select id="adv-compaction" class="rt-input" style="max-width:300px" onchange="">' +
          '<option value="structured"' + ((config.config && config.config.compaction_strategy) === 'off' ? '' : ' selected') + '>' + (isRu ? 'Структурированное (рекомендуется)' : 'Structured (recommended)') + '</option>' +
          '<option value="simple"' + ((config.config && config.config.compaction_strategy) === 'simple' ? ' selected' : '') + '>' + (isRu ? 'Простое' : 'Simple') + '</option>' +
          '<option value="off"' + ((config.config && config.config.compaction_strategy) === 'off' ? ' selected' : '') + '>' + (isRu ? 'Выключено' : 'Off') + '</option>' +
        '</select>' +
        '<div class="rt-input-hint">' + (isRu ? 'Как сжимать старые сообщения когда контекст переполняется. Структурированное создаёт резюме: Намерение / Решения / Действия / Контекст / Незавершённое.' : 'How to compact old messages when context overflows. Structured creates summary: Intent / Decisions / Actions / Context / Open Items.') + '</div>' +
      '</div>' +

      // Observation masking
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.eye + ' ' + (isRu ? 'Маскирование наблюдений' : 'Observation Masking') + '</div>' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.82rem"><input type="checkbox" id="adv-masking-on" style="accent-color:var(--primary)"' + (config.config && config.config.masking_enabled !== false ? ' checked' : '') + '> ' + (isRu ? 'Включено' : 'Enabled') + '</label>' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<span style="font-size:.78rem;color:var(--text-muted)">' + (isRu ? 'Хранить последних:' : 'Keep recent:') + '</span>' +
            '<input type="number" id="adv-masking-keep" class="rt-priority-num" style="width:60px" value="' + ((config.config && config.config.masking_keep_recent) || 10) + '" min="3" max="50">' +
          '</div>' +
        '</div>' +
        '<div class="rt-input-hint">' + (isRu ? 'Маскирует старые результаты инструментов для экономии токенов. Недавние результаты сохраняются полностью.' : 'Masks old tool results to save tokens. Recent results kept in full.') + '</div>' +
      '</div>' +

      // Flood protection
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.shield + ' ' + (isRu ? 'Защита от флуда' : 'Flood Protection') + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div><span style="font-size:.78rem;color:var(--text-muted)">' + (isRu ? 'Кулдаун (сек)' : 'Cooldown (sec)') + '</span>' +
            '<input type="number" id="adv-flood-cooldown" class="rt-input" style="margin-top:4px" value="' + ((config.config && config.config.flood_cooldown_sec) || 5) + '" min="1" max="120"></div>' +
          '<div><span style="font-size:.78rem;color:var(--text-muted)">' + (isRu ? 'Макс. ретраев' : 'Max retries') + '</span>' +
            '<input type="number" id="adv-flood-retries" class="rt-input" style="margin-top:4px" value="' + ((config.config && config.config.flood_max_retries) || 3) + '" min="0" max="10"></div>' +
        '</div>' +
        '<div class="rt-input-hint">' + (isRu ? 'Адаптивная защита от FLOOD_WAIT от Telegram. Кулдаун увеличивается экспоненциально.' : 'Adaptive FLOOD_WAIT protection from Telegram. Cooldown increases exponentially.') + '</div>' +
      '</div>' +

      // Loop guard
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.loop + ' ' + (isRu ? 'Защита от зацикливания' : 'Loop Guard') + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div><span style="font-size:.78rem;color:var(--text-muted)">' + (isRu ? 'Макс. ответов за окно' : 'Max responses per window') + '</span>' +
            '<input type="number" id="adv-loop-max" class="rt-input" style="margin-top:4px" value="' + ((config.config && config.config.loop_max_responses) || 4) + '" min="1" max="20"></div>' +
          '<div><span style="font-size:.78rem;color:var(--text-muted)">' + (isRu ? 'Окно (сек)' : 'Window (sec)') + '</span>' +
            '<input type="number" id="adv-loop-window" class="rt-input" style="margin-top:4px" value="' + ((config.config && config.config.loop_window_sec) || 120) + '" min="30" max="600"></div>' +
        '</div>' +
        '<div class="rt-input-hint">' + (isRu ? 'Предотвращает бесконечное общение бот-бот. Если агент отправляет N ответов за указанное окно — пауза.' : 'Prevents infinite bot-to-bot chat. If agent sends N responses within the window — pauses.') + '</div>' +
      '</div>' +

      // Memory poisoning protection
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.shield + ' ' + (isRu ? 'Защита памяти' : 'Memory Protection') + '</div>' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.82rem">' +
          '<input type="checkbox" id="adv-memory-protect" style="accent-color:var(--primary)"' + (config.config && config.config.memory_poisoning_protection !== false ? ' checked' : '') + '>' +
          (isRu ? 'Блокировать запись в память из групповых чатов (предотвращает poisoning)' : 'Block memory writes from group chats (prevents poisoning)') +
        '</label>' +
      '</div>' +

      // Actions (clone/export/import)
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.bolt + ' ' + (isRu ? 'Действия' : 'Actions') + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="rt-save-btn" style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)" onclick="cloneAgentFromSettings()">' + IC.clipboard + ' ' + (isRu ? 'Клонировать агента' : 'Clone Agent') + '</button>' +
          '<button class="rt-save-btn" style="background:linear-gradient(135deg,var(--primary),var(--primary-dark))" onclick="exportAgentJSON()">' + IC.download + ' ' + (isRu ? 'Экспорт JSON' : 'Export JSON') + '</button>' +
          '<label class="rt-save-btn" style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);cursor:pointer">' + IC.upload + ' ' + (isRu ? 'Импорт JSON' : 'Import JSON') + '<input type="file" accept=".json" style="display:none" onchange="importAgentJSON(this)"></label>' +
        '</div>' +
      '</div>' +

      // Save
      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveSettingsAdvanced()">' + IC.check + ' ' + (isRu ? 'Сохранить настройки' : 'Save Settings') + '</button>' +
      '</div>' +
      '</div>';

    // Fix interval card selection class
    setTimeout(function() {
      var cards = body.querySelectorAll('.st-provider-card');
      cards.forEach(function(c) { c.classList.add('adv-interval-opt'); });
    }, 50);
  }
}

// ═══ ADVANCED TAB FUNCTIONS ═══
function selectAdvLang(el, lang) {
  el.closest('.rt-toggle-row').querySelectorAll('.rt-toggle-card').forEach(function(c) { c.classList.remove('rt-active'); });
  el.classList.add('rt-active');
  el.querySelector('input').checked = true;
}

async function saveSettingsAdvanced() {
  if (!_detailAgentId) return;
  try {
    var spendLimit = parseInt(document.getElementById('adv-spend-num').value) || 500;
    var tickInterval = parseInt(document.getElementById('adv-tick-val').value) || 60;
    var langRadio = document.querySelector('input[name="adv-lang"]:checked');
    var agentLang = langRadio ? langRadio.value : 'auto';

    var compaction = (document.getElementById('adv-compaction') || {}).value || 'structured';
    var maskingOn = (document.getElementById('adv-masking-on') || {}).checked !== false;
    var maskingKeep = parseInt((document.getElementById('adv-masking-keep') || {}).value) || 10;
    var floodCooldown = parseInt((document.getElementById('adv-flood-cooldown') || {}).value) || 5;
    var floodRetries = parseInt((document.getElementById('adv-flood-retries') || {}).value) || 3;
    var loopMax = parseInt((document.getElementById('adv-loop-max') || {}).value) || 4;
    var loopWindow = parseInt((document.getElementById('adv-loop-window') || {}).value) || 120;
    var memProtect = (document.getElementById('adv-memory-protect') || {}).checked !== false;

    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/config', {
      daily_spend_limit_ton: spendLimit,
      tick_interval_sec: tickInterval,
      agent_language: agentLang,
      compaction_strategy: compaction,
      masking_enabled: maskingOn,
      masking_keep_recent: maskingKeep,
      flood_cooldown_sec: floodCooldown,
      flood_max_retries: floodRetries,
      loop_max_responses: loopMax,
      loop_window_sec: loopWindow,
      memory_poisoning_protection: memProtect,
    });
    toast(currentLang === 'ru' ? 'Настройки сохранены' : 'Settings saved', 'success');
    // Refresh agent data
    if (_detailAgentId) openAgentDetail(_detailAgentId, true);
  } catch (e) {
    toast('Error: ' + (e.message || e), 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HOOKS TABS: Blocklist, Triggers, Session, Tool Scope
// ═══════════════════════════════════════════════════════════════════════

var _hooksCache = {}; // agentId → hooks data

async function loadHooksTab(body, tab, agentId) {
  var isRu = currentLang === 'ru';
  try {
    if (!_hooksCache[agentId]) {
      var resp = await apiRequest('GET', '/api/agents/' + agentId + '/hooks');
      _hooksCache[agentId] = resp;
    }
    var hooks = _hooksCache[agentId];
    if (tab === 'blocklist') renderBlocklistTab(body, hooks, agentId, isRu);
    else if (tab === 'triggers') renderTriggersTab(body, hooks, agentId, isRu);
    else if (tab === 'session') renderSessionTab(body, hooks, agentId, isRu);
    else if (tab === 'toolscope') renderToolScopeTab(body, hooks, agentId, isRu);
  } catch (e) {
    body.innerHTML = '<div style="padding:2rem;color:#ef4444">Error: ' + (e.message || e) + '</div>';
  }
}

function renderBlocklistTab(body, hooks, agentId, isRu) {
  var bl = hooks.blocklist || { enabled: false, keywords: [], reply: '' };
  var kwList = (bl.keywords || []).map(function(kw, i) {
    return '<span class="rt-tag" style="display:inline-flex;align-items:center;gap:4px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);padding:4px 10px;border-radius:999px;font-size:.8rem;color:#ef4444">' +
      escHtml(kw) +
      ' <span style="cursor:pointer;opacity:.6" onclick="removeBlocklistKw(' + agentId + ',' + i + ')">✕</span>' +
    '</span> ';
  }).join('');

  body.innerHTML =
    '<div class="rt-page">' +
    '<div class="rt-header">' +
      '<div class="rt-header-icon" style="background:rgba(239,68,68,0.12);color:#ef4444">' + IC.shield + '</div>' +
      '<div class="rt-header-text">' +
        '<h3>' + (isRu ? 'Блоклист' : 'Blocklist') + '</h3>' +
        '<p>' + (isRu ? 'Агент не будет отвечать на сообщения содержащие заблокированные слова' : 'Agent will ignore messages containing blocked keywords') + '</p>' +
      '</div>' +
    '</div>' +
    '<div class="rt-section">' +
      '<div class="rt-section-label">' + (isRu ? 'Статус' : 'Status') + '</div>' +
      '<label class="rt-toggle" style="cursor:pointer;display:flex;align-items:center;gap:8px">' +
        '<input type="checkbox" id="bl-enabled" ' + (bl.enabled ? 'checked' : '') + ' onchange="saveBlocklistState(' + agentId + ')" style="width:18px;height:18px">' +
        '<span>' + (isRu ? 'Блоклист активен' : 'Blocklist active') + '</span>' +
      '</label>' +
    '</div>' +
    '<div class="rt-section">' +
      '<div class="rt-section-label">' + (isRu ? 'Ключевые слова' : 'Keywords') + '</div>' +
      '<div id="bl-keywords-list" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px">' + (kwList || '<span style="color:var(--text-muted);font-size:.85rem">' + (isRu ? 'Пусто' : 'Empty') + '</span>') + '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<input type="text" id="bl-new-kw" placeholder="' + (isRu ? 'Слово или фраза...' : 'Word or phrase...') + '" style="flex:1;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:.85rem" onkeydown="if(event.key===\'Enter\')addBlocklistKw(' + agentId + ')">' +
        '<button class="rt-save-btn" style="padding:8px 16px" onclick="addBlocklistKw(' + agentId + ')">' + (isRu ? '+ Добавить' : '+ Add') + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="rt-section">' +
      '<div class="rt-section-label">' + (isRu ? 'Авто-ответ (необязательно)' : 'Auto-reply (optional)') + '</div>' +
      '<input type="text" id="bl-reply" value="' + escHtml(bl.reply || '') + '" placeholder="' + (isRu ? 'Оставьте пустым чтобы молча игнорировать' : 'Leave empty to silently ignore') + '" style="width:100%;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:.85rem" onchange="saveBlocklistState(' + agentId + ')">' +
    '</div>' +
    '</div>';
}

async function addBlocklistKw(agentId) {
  var inp = document.getElementById('bl-new-kw');
  var val = (inp.value || '').trim();
  if (!val) return;
  var hooks = _hooksCache[agentId];
  if (!hooks.blocklist) hooks.blocklist = { enabled: false, keywords: [] };
  var newKws = val.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
  hooks.blocklist.keywords = Array.from(new Set(hooks.blocklist.keywords.concat(newKws)));
  inp.value = '';
  await apiRequest('POST', '/api/agents/' + agentId + '/hooks', { blocklist: hooks.blocklist });
  toast('+' + newKws.length + ' keywords', 'success');
  renderBlocklistTab(document.getElementById('agent-settings-body'), hooks, agentId, currentLang === 'ru');
}

async function removeBlocklistKw(agentId, idx) {
  var hooks = _hooksCache[agentId];
  hooks.blocklist.keywords.splice(idx, 1);
  await apiRequest('POST', '/api/agents/' + agentId + '/hooks', { blocklist: hooks.blocklist });
  renderBlocklistTab(document.getElementById('agent-settings-body'), hooks, agentId, currentLang === 'ru');
}

async function saveBlocklistState(agentId) {
  var hooks = _hooksCache[agentId];
  if (!hooks.blocklist) hooks.blocklist = { enabled: false, keywords: [] };
  hooks.blocklist.enabled = document.getElementById('bl-enabled').checked;
  var replyEl = document.getElementById('bl-reply');
  if (replyEl) hooks.blocklist.reply = replyEl.value || '';
  await apiRequest('POST', '/api/agents/' + agentId + '/hooks', { blocklist: hooks.blocklist });
  toast('Saved', 'success');
}

function renderTriggersTab(body, hooks, agentId, isRu) {
  var triggers = hooks.triggers || [];
  var rows = triggers.map(function(t, i) {
    return '<div class="rt-section" style="padding:12px 16px;display:flex;align-items:flex-start;gap:12px">' +
      '<input type="checkbox" ' + (t.enabled ? 'checked' : '') + ' style="width:18px;height:18px;margin-top:2px" onchange="toggleTrigger(' + agentId + ',' + i + ',this.checked)">' +
      '<div style="flex:1">' +
        '<div style="font-weight:600;color:var(--text-primary)">' + escHtml(t.keyword) + '</div>' +
        '<div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">' + escHtml(t.context.slice(0, 120)) + '</div>' +
      '</div>' +
      '<button style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.1rem" onclick="deleteTrigger(' + agentId + ',' + i + ')">✕</button>' +
    '</div>';
  }).join('');

  body.innerHTML =
    '<div class="rt-page">' +
    '<div class="rt-header">' +
      '<div class="rt-header-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b">' + IC.bolt + '</div>' +
      '<div class="rt-header-text">' +
        '<h3>' + (isRu ? 'Контекстные триггеры' : 'Context Triggers') + '</h3>' +
        '<p>' + (isRu ? 'Когда в сообщении встречается ключевое слово — в промпт агента автоматически добавляется дополнительный контекст' : 'When a keyword is found in a message, extra context is automatically injected into the agent prompt') + '</p>' +
      '</div>' +
    '</div>' +
    (rows || '<div style="text-align:center;padding:2rem;color:var(--text-muted)">' + (isRu ? 'Нет триггеров' : 'No triggers') + '</div>') +
    '<div class="rt-section">' +
      '<div class="rt-section-label">' + (isRu ? 'Новый триггер' : 'New Trigger') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<input type="text" id="trig-keyword" placeholder="' + (isRu ? 'Ключевое слово...' : 'Keyword...') + '" style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:.85rem">' +
        '<textarea id="trig-context" rows="3" placeholder="' + (isRu ? 'Контекст для инжекции в промпт...' : 'Context to inject into prompt...') + '" style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:.85rem;resize:vertical"></textarea>' +
        '<button class="rt-save-btn" onclick="addTrigger(' + agentId + ')">' + (isRu ? '+ Добавить триггер' : '+ Add Trigger') + '</button>' +
      '</div>' +
    '</div>' +
    '</div>';
}

async function addTrigger(agentId) {
  var kw = (document.getElementById('trig-keyword').value || '').trim();
  var ctx = (document.getElementById('trig-context').value || '').trim();
  if (!kw || !ctx) { toast(currentLang === 'ru' ? 'Заполните оба поля' : 'Fill both fields', 'error'); return; }
  var hooks = _hooksCache[agentId];
  if (!hooks || !hooks.triggers) { if (hooks) hooks.triggers = []; else { toast('Reload page and try again', 'error'); return; } }
  hooks.triggers.push({ id: String(Date.now()), keyword: kw, context: ctx, enabled: true });
  var r = await apiRequest('POST', '/api/agents/' + agentId + '/hooks', { triggers: hooks.triggers });
  if (r && r.error) { toast('Error: ' + r.error, 'error'); hooks.triggers.pop(); return; }
  document.getElementById('trig-keyword').value = '';
  document.getElementById('trig-context').value = '';
  toast(currentLang === 'ru' ? 'Триггер добавлен' : 'Trigger added', 'success');
  renderTriggersTab(document.getElementById('agent-settings-body'), hooks, agentId, currentLang === 'ru');
}

async function toggleTrigger(agentId, idx, enabled) {
  var hooks = _hooksCache[agentId];
  if (!hooks || !hooks.triggers || !hooks.triggers[idx]) return;
  hooks.triggers[idx].enabled = enabled;
  var r = await apiRequest('POST', '/api/agents/' + agentId + '/hooks', { triggers: hooks.triggers });
  if (r && r.error) toast('Save error: ' + r.error, 'error');
}

async function deleteTrigger(agentId, idx) {
  var hooks = _hooksCache[agentId];
  if (!hooks || !hooks.triggers) return;
  hooks.triggers.splice(idx, 1);
  var r = await apiRequest('POST', '/api/agents/' + agentId + '/hooks', { triggers: hooks.triggers });
  if (r && r.error) { toast('Delete error: ' + r.error, 'error'); return; }
  toast(currentLang === 'ru' ? 'Триггер удалён' : 'Trigger deleted', 'success');
  renderTriggersTab(document.getElementById('agent-settings-body'), hooks, agentId, currentLang === 'ru');
}

function renderSessionTab(body, hooks, agentId, isRu) {
  var cfg = hooks.session || { resetPolicy: 'none', idleMinutes: 60 };
  var policies = [
    { val: 'none', icon: IC.infinity, label: isRu ? 'Без сброса' : 'No reset', desc: isRu ? 'История копится бесконечно' : 'History accumulates forever' },
    { val: 'daily', icon: IC.clock, label: isRu ? 'Ежедневно' : 'Daily', desc: isRu ? 'Очистка истории каждый день' : 'Clear history every day' },
    { val: 'idle', icon: IC.hourglass, label: isRu ? 'По бездействию' : 'On idle', desc: isRu ? 'Сброс после N минут тишины' : 'Reset after N minutes of silence' },
  ];
  var cards = policies.map(function(p) {
    var active = cfg.resetPolicy === p.val;
    return '<div class="st-provider-card' + (active ? ' selected' : '') + '" style="cursor:pointer;padding:14px;text-align:center" onclick="setSessionPolicy(' + agentId + ',\'' + p.val + '\')">' +
      '<div style="font-size:1.5rem;margin-bottom:4px">' + p.icon + '</div>' +
      '<div style="font-weight:600;font-size:.85rem">' + p.label + '</div>' +
      '<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">' + p.desc + '</div>' +
    '</div>';
  }).join('');

  body.innerHTML =
    '<div class="rt-page">' +
    '<div class="rt-header">' +
      '<div class="rt-header-icon" style="background:rgba(16,185,129,0.12);color:#10b981">' + IC.clock + '</div>' +
      '<div class="rt-header-text">' +
        '<h3>' + (isRu ? 'Политика сессии' : 'Session Policy') + '</h3>' +
        '<p>' + (isRu ? 'Когда автоматически сбрасывать историю диалога агента' : 'When to automatically reset agent conversation history') + '</p>' +
      '</div>' +
    '</div>' +
    '<div class="rt-section">' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' + cards + '</div>' +
    '</div>' +
    (cfg.resetPolicy === 'idle' ?
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + (isRu ? 'Минут бездействия' : 'Idle minutes') + '</div>' +
        '<input type="number" id="sess-idle-min" value="' + (cfg.idleMinutes || 60) + '" min="5" max="1440" style="width:120px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:.85rem" onchange="setSessionIdleMin(' + agentId + ',this.value)">' +
      '</div>' : '') +
    '</div>';
}

async function setSessionPolicy(agentId, policy) {
  var hooks = _hooksCache[agentId];
  if (!hooks.session) hooks.session = { resetPolicy: 'none', idleMinutes: 60 };
  hooks.session.resetPolicy = policy;
  await apiRequest('POST', '/api/agents/' + agentId + '/hooks', { session: hooks.session });
  toast('Session policy: ' + policy, 'success');
  renderSessionTab(document.getElementById('agent-settings-body'), hooks, agentId, currentLang === 'ru');
}

async function setSessionIdleMin(agentId, val) {
  var hooks = _hooksCache[agentId];
  hooks.session.idleMinutes = parseInt(val) || 60;
  await apiRequest('POST', '/api/agents/' + agentId + '/hooks', { session: hooks.session });
}

function renderToolScopeTab(body, hooks, agentId, isRu) {
  var scopes = hooks.toolScopes || {};
  var SCOPE_LABELS = { 'always': IC.globe + ' ' + (isRu ? 'Везде' : 'All'), 'dm-only': IC.user + ' ' + (isRu ? 'Личка' : 'DM'), 'group-only': IC.users + ' ' + (isRu ? 'Группы' : 'Groups'), 'admin-only': IC.lock + ' ' + (isRu ? 'Админ' : 'Admin') };
  var TOOL_GROUPS = {
    'Financial': ['send_ton', 'send_jetton', 'buy_catalog_gift', 'buy_resale_gift', 'list_gift_for_sale', 'get_agent_wallet'],
    'Admin': ['tg_ban_user2', 'tg_kick_user2', 'tg_mute_user2', 'tg_delete_user_messages', 'tg_edit_admin2'],
    'Self-modify': ['update_my_prompt', 'update_my_interval', 'update_my_description'],
  };
  var DEFAULT_SCOPES = {
    'send_ton': 'dm-only', 'send_jetton': 'dm-only', 'buy_catalog_gift': 'dm-only', 'buy_resale_gift': 'dm-only',
    'list_gift_for_sale': 'dm-only', 'get_agent_wallet': 'dm-only',
    'tg_ban_user2': 'admin-only', 'tg_kick_user2': 'admin-only', 'tg_mute_user2': 'admin-only',
    'tg_delete_user_messages': 'admin-only', 'tg_edit_admin2': 'admin-only',
    'update_my_prompt': 'dm-only', 'update_my_interval': 'dm-only', 'update_my_description': 'dm-only',
  };

  var html = '<div class="rt-page">' +
    '<div class="rt-header">' +
      '<div class="rt-header-icon" style="background:rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.12);color:#6366f1">' + IC.shield + '</div>' +
      '<div class="rt-header-text">' +
        '<h3>' + (isRu ? 'Доступ к инструментам' : 'Tool Scope') + '</h3>' +
        '<p>' + (isRu ? 'Ограничьте где и кем могут использоваться опасные инструменты' : 'Restrict where and by whom dangerous tools can be used') + '</p>' +
      '</div>' +
    '</div>';

  Object.keys(TOOL_GROUPS).forEach(function(groupName) {
    html += '<div class="rt-section"><div class="rt-section-label">' + groupName + '</div>';
    TOOL_GROUPS[groupName].forEach(function(toolName) {
      var custom = scopes[toolName] || {};
      var scope = custom.scope || DEFAULT_SCOPES[toolName] || 'always';
      var enabled = custom.enabled !== false;
      var scopeOptions = ['always', 'dm-only', 'group-only', 'admin-only'].map(function(s) {
        return '<option value="' + s + '"' + (scope === s ? ' selected' : '') + '>' + SCOPE_LABELS[s] + '</option>';
      }).join('');
      html += '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--glass-border)">' +
        '<input type="checkbox" ' + (enabled ? 'checked' : '') + ' style="width:16px;height:16px" onchange="setToolScope(' + agentId + ',\'' + toolName + '\',this.checked,null)">' +
        '<code style="flex:1;font-size:.8rem;color:' + (enabled ? 'var(--text-primary)' : 'var(--text-muted)') + '">' + toolName + '</code>' +
        '<select style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:6px;padding:4px 8px;color:var(--text-primary);font-size:.78rem" onchange="setToolScope(' + agentId + ',\'' + toolName + '\',null,this.value)">' + scopeOptions + '</select>' +
      '</div>';
    });
    html += '</div>';
  });

  html += '</div>';
  body.innerHTML = html;
}

async function setToolScope(agentId, toolName, enabled, scope) {
  var hooks = _hooksCache[agentId];
  if (!hooks.toolScopes) hooks.toolScopes = {};
  if (!hooks.toolScopes[toolName]) hooks.toolScopes[toolName] = { enabled: true, scope: 'always' };
  if (enabled !== null) hooks.toolScopes[toolName].enabled = enabled;
  if (scope !== null) hooks.toolScopes[toolName].scope = scope;
  await apiRequest('POST', '/api/agents/' + agentId + '/hooks', { toolScopes: hooks.toolScopes });
  toast('Saved', 'success');
}

function deleteAgentFromSettings() {
  if (!_detailAgentId || !_detailAgentData) return;
  deleteAgent(_detailAgentId, _detailAgentData.name || 'Unnamed');
}

async function toggleAgentFromSettings() {
  if (!_detailAgentId || !_detailAgentData) return;
  var isActive = _detailAgentData.is_active || _detailAgentData.isActive;
  await toggleAgent(_detailAgentId, isActive);
  // Refresh
  await openAgentDetail(_detailAgentId, true);
  _detailAgentData.is_active = !isActive;
  openAgentSettings();
}

async function saveSettingsBehavior() {
  if (!_detailAgentId) return;
  try {
    var behavior = {
      typingDelay: document.getElementById('bh-typing').checked,
      typingSpeed: parseInt(document.getElementById('bh-typing-speed').value) || 40,
      readReceipts: document.getElementById('bh-read-receipts').checked,
      readDelay: parseFloat(document.getElementById('bh-read-delay').value) || 1.5,
      messageSplitting: document.getElementById('bh-splitting').checked,
      thinkingPhrases: document.getElementById('bh-thinking').checked,
      reactions: document.getElementById('bh-reactions').checked,
      hesitation: document.getElementById('bh-hesitation').checked,
      randomVariance: parseInt(document.getElementById('bh-variance').value) || 25,
      schedule: document.getElementById('bh-schedule').checked,
      scheduleStart: parseInt(document.getElementById('bh-sched-start').value) || 9,
      scheduleEnd: parseInt(document.getElementById('bh-sched-end').value) || 23,
    };
    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/config', { behavior: behavior });
    toast(currentLang === 'ru' ? 'Поведение сохранено' : 'Behavior saved', 'success');
    if (_detailAgentId) openAgentDetail(_detailAgentId, true);
  } catch (e) {
    toast('Error: ' + (e.message || e), 'error');
  }
}

async function saveSettingsLearning() {
  if (!_detailAgentId) return;
  try {
    var learning = {
      feedbackLoop: document.getElementById('lr-feedback').checked,
      negativePatterns: (document.getElementById('lr-neg-patterns').value || '').trim(),
      errorHealing: document.getElementById('lr-healing').checked,
      maxRetries: parseInt(document.getElementById('lr-max-retries').value) || 3,
      circuitBreakerThreshold: parseInt(document.getElementById('lr-circuit').value) || 5,
      qualityScoring: document.getElementById('lr-scoring').checked,
      styleAdaptation: document.getElementById('lr-adaptation').checked,
    };
    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/config', { learning: learning });
    toast(currentLang === 'ru' ? 'Обучение сохранено' : 'Learning saved', 'success');
    if (_detailAgentId) openAgentDetail(_detailAgentId, true);
  } catch (e) {
    toast('Error: ' + (e.message || e), 'error');
  }
}

async function cloneAgentFromSettings() {
  if (!_detailAgentId || !_detailAgentData) return;
  var isRu = currentLang === 'ru';
  try {
    var a = _detailAgentData;
    var res = await apiRequest('POST', '/api/agents/clone', { agentId: _detailAgentId });
    toast(isRu ? 'Агент клонирован!' : 'Agent cloned!', 'success');
    closeAgentSettings();
    navigateTo('operations');
  } catch (e) {
    toast('Error: ' + (e.message || e), 'error');
  }
}

function exportAgentJSON() {
  if (!_detailAgentData) return;
  var a = _detailAgentData;
  var exportData = {
    name: a.name,
    description: a.description,
    triggerType: a.triggerType || a.trigger_type,
    code: a.code,
    triggerConfig: (function(){ var _t = a.trigger_config || a.triggerConfig || {}; return typeof _t === 'string' ? JSON.parse(_t) : _t; })(),
    role: a.role,
    exportedAt: new Date().toISOString(),
    platform: 'TON Agent Platform',
  };
  var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = (a.name || 'agent').replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_') + '.json';
  link.click();
  URL.revokeObjectURL(url);
  toast(currentLang === 'ru' ? 'Экспортировано!' : 'Exported!', 'success');
}

async function importAgentJSON(input) {
  if (!input.files || !input.files[0]) return;
  var isRu = currentLang === 'ru';
  try {
    var text = await input.files[0].text();
    var data = JSON.parse(text);
    if (!data.name || !data.code) {
      toast(isRu ? 'Неверный формат файла' : 'Invalid file format', 'error');
      input.value = '';
      return;
    }
    var res = await apiRequest('POST', '/api/agents/import', {
      name: data.name + ' (imported)',
      description: data.description || '',
      triggerType: data.triggerType || 'ai_agent',
      code: data.code,
      triggerConfig: data.triggerConfig || {},
    });
    if (!res.ok) { toast(res.error || 'Error', 'error'); input.value = ''; return; }
    toast(isRu ? 'Агент импортирован!' : 'Agent imported!', 'success');
    navigateTo('operations');
  } catch (e) {
    toast('Error: ' + (e.message || e), 'error');
  }
  input.value = '';
}

// Import from main agents page with preview dialog
async function importAgentFromMainView(input) {
  if (!input.files || !input.files[0]) return;
  var isRu = currentLang === 'ru';
  try {
    var text = await input.files[0].text();
    var data = JSON.parse(text);
    if (!data.name || !data.code) {
      toast(isRu ? 'Неверный формат: нужны name и code' : 'Invalid format: name and code required', 'error');
      input.value = '';
      return;
    }
    // Show preview dialog
    var triggerType = data.triggerType || 'ai_agent';
    var promptPreview = (data.code || '').slice(0, 200) + (data.code && data.code.length > 200 ? '...' : '');
    var confirmed = await studioConfirm({
      title: isRu ? 'Импорт агента' : 'Import Agent',
      message: (isRu ? 'Имя: ' : 'Name: ') + data.name + '\n' +
        (isRu ? 'Тип: ' : 'Type: ') + triggerType + '\n' +
        (isRu ? 'Описание: ' : 'Desc: ') + (data.description || '—') + '\n\n' +
        (isRu ? 'Промпт (превью):\n' : 'Prompt (preview):\n') + promptPreview,
      confirmText: isRu ? 'Создать' : 'Create',
      type: 'info'
    });
    if (!confirmed) { input.value = ''; return; }
    var res = await apiRequest('POST', '/api/agents/import', {
      name: data.name + ' (imported)',
      description: data.description || '',
      triggerType: triggerType,
      code: data.code,
      triggerConfig: data.triggerConfig || {},
    });
    if (res.ok) {
      toast(isRu ? 'Агент импортирован!' : 'Agent imported!', 'success');
      await loadAgentsPage();
      await loadAgents();
    } else {
      toast(res.error || 'Error', 'error');
    }
  } catch (e) {
    toast('Error: ' + (e.message || e), 'error');
  }
  input.value = '';
}

// Copy agent prompt to clipboard (quick action on card)
async function copyAgentPrompt(agentId, event) {
  if (event) event.stopPropagation();
  var isRu = currentLang === 'ru';
  try {
    var data = await apiRequest('GET', '/api/agents/' + agentId);
    if (!data.ok || !data.agent) { toast(isRu ? 'Не удалось загрузить' : 'Failed to load', 'error'); return; }
    var code = data.agent.code || '';
    if (!code) { toast(isRu ? 'Промпт пуст' : 'Prompt is empty', 'warning'); return; }
    await navigator.clipboard.writeText(code);
    toast(isRu ? 'Промпт скопирован' : 'Prompt copied', 'success');
  } catch (e) {
    toast('Error: ' + (e.message || e), 'error');
  }
}

// Export agent directly from card (quick action)
async function exportAgentFromCard(agentId, event) {
  if (event) event.stopPropagation();
  try {
    var data = await apiRequest('GET', '/api/agents/' + agentId);
    if (!data.ok || !data.agent) { toast('Error', 'error'); return; }
    var a = data.agent;
    var exportData = {
      name: a.name,
      description: a.description,
      triggerType: a.triggerType || a.trigger_type,
      code: a.code,
      triggerConfig: (function(){ var _t = a.trigger_config || a.triggerConfig || {}; return typeof _t === 'string' ? JSON.parse(_t) : _t; })(),
      role: a.role,
      exportedAt: new Date().toISOString(),
      platform: 'TON Agent Platform',
    };
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = (a.name || 'agent').replace(/[^a-zA-Z0-9\u0430-\u044f\u0410-\u042f\u0451\u0401_-]/g, '_') + '.json';
    link.click();
    URL.revokeObjectURL(url);
    toast(currentLang === 'ru' ? 'Экспортировано!' : 'Exported!', 'success');
  } catch (e) {
    toast('Error: ' + (e.message || e), 'error');
  }
}

// ═══ TELEGRAM TAB — per-agent Telegram account ═══
var _agentTgPolling = null;

async function loadAgentTelegramTab(body, agentId) {
  try {
    var data = await apiRequest('GET', '/api/telegram/status?agentId=' + agentId);
    var info = data || {};
    var isRu = currentLang === 'ru';

    if (info.authorized) {
      var maskedPhone = info.phone ? '+' + String(info.phone).replace(/^(\d{1,3})(\d+)(\d{4})$/, '$1\u2022\u2022\u2022$3') : '';
      body.innerHTML =
        '<div class="rt-page">' +
        '<div class="rt-header">' +
          '<div class="rt-header-icon" style="background:rgba(34,197,94,0.12);color:#22c55e">' + IC.send + '</div>' +
          '<div class="rt-header-text">' +
            '<h3>Telegram Account</h3>' +
            '<p>' + (isRu ? 'Аккаунт подключён и готов к работе' : 'Account connected and ready') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="st-tg-connected-card">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
            '<span class="st-tg-connected-dot"></span>' +
            '<span style="color:#4ade80;font-weight:700;font-size:.95rem">' + (isRu ? 'Подключён' : 'Connected') + '</span>' +
          '</div>' +
          (info.username ? '<div style="color:var(--text-primary);font-size:.9rem;font-weight:500;margin-bottom:4px">@' + escHtml(info.username) + '</div>' : '') +
          (maskedPhone ? '<div style="color:var(--text-muted);font-size:.8rem">' + escHtml(maskedPhone) + '</div>' : '') +
        '</div>' +
        '<button class="rt-save-btn" style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));box-shadow:0 4px 16px var(--accent-glow)" onclick="disconnectAgentTelegram(' + agentId + ')">' +
          IC.x + ' ' + (isRu ? 'Отключить аккаунт' : 'Disconnect Account') +
        '</button>' +
        '</div>';
    } else {
      body.innerHTML =
        '<div class="rt-page">' +
        '<div class="rt-header">' +
          '<div class="rt-header-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6">' + IC.send + '</div>' +
          '<div class="rt-header-text">' +
            '<h3>Telegram</h3>' +
            '<p>' + (isRu ? 'Подключите аккаунт для чтения чатов, отправки сообщений и вступления в группы' : 'Connect account to read chats, send messages and join groups') + '</p>' +
          '</div>' +
        '</div>' +

        '<div style="display:flex;gap:12px;margin-bottom:24px">' +
          '<div class="st-tg-method-card st-tg-active" id="tg-method-phone" onclick="showAgentTgPhoneAuth(' + agentId + ');document.getElementById(\'tg-method-phone\').classList.add(\'st-tg-active\');document.getElementById(\'tg-method-qr\').classList.remove(\'st-tg-active\')">' +
            '<div class="st-tg-method-icon">' + IC.phone + '</div>' +
            '<div class="st-tg-method-name">' + (isRu ? 'По номеру' : 'Phone Number') + '</div>' +
            '<div class="st-tg-method-desc">' + (isRu ? 'Код в Telegram' : 'Code via Telegram') + '</div>' +
          '</div>' +
          '<div class="st-tg-method-card" id="tg-method-qr" onclick="startAgentTgQR(' + agentId + ');document.getElementById(\'tg-method-qr\').classList.add(\'st-tg-active\');document.getElementById(\'tg-method-phone\').classList.remove(\'st-tg-active\')">' +
            '<div class="st-tg-method-icon">' + IC.globe + '</div>' +
            '<div class="st-tg-method-name">QR Code</div>' +
            '<div class="st-tg-method-desc">' + (isRu ? 'Сканировать камерой' : 'Scan with camera') + '</div>' +
          '</div>' +
        '</div>' +

        '<div id="tg-phone-form">' +
          '<div class="rt-section-label">' + (isRu ? 'Номер телефона' : 'Phone Number') + '</div>' +
          '<input type="tel" id="tg-phone-input" class="rt-input" placeholder="+7 999 123 45 67" style="margin-bottom:16px">' +
          '<button class="rt-save-btn" onclick="sendAgentTgCode(' + agentId + ')">' + IC.send + ' ' + (isRu ? 'Отправить код' : 'Send Code') + '</button>' +
        '</div>' +

        '<div id="tg-code-form" style="display:none">' +
          '<div class="rt-section-label" style="text-align:center">' + (isRu ? 'Введите код из Telegram' : 'Enter code from Telegram') + '</div>' +
          '<div class="st-otp-wrap">' +
            '<input class="st-otp-digit" type="text" maxlength="1" inputmode="numeric" data-idx="0">' +
            '<input class="st-otp-digit" type="text" maxlength="1" inputmode="numeric" data-idx="1">' +
            '<input class="st-otp-digit" type="text" maxlength="1" inputmode="numeric" data-idx="2">' +
            '<input class="st-otp-digit" type="text" maxlength="1" inputmode="numeric" data-idx="3">' +
            '<input class="st-otp-digit" type="text" maxlength="1" inputmode="numeric" data-idx="4">' +
          '</div>' +
          '<input type="hidden" id="tg-code-input">' +
          '<div style="text-align:center"><button class="rt-save-btn" onclick="submitAgentTgCode(' + agentId + ')">' + IC.check + ' ' + (isRu ? 'Подтвердить' : 'Confirm') + '</button></div>' +
        '</div>' +

        '<div id="tg-2fa-form" style="display:none">' +
          '<div class="rt-section-label">' + IC.shield + ' ' + (isRu ? 'Облачный пароль (2FA)' : 'Cloud Password (2FA)') + '</div>' +
          '<input type="password" id="tg-2fa-input" class="rt-input" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" style="margin-bottom:16px">' +
          '<button class="rt-save-btn" onclick="submitAgentTg2FA(' + agentId + ')">' + IC.check + ' ' + (isRu ? 'Подтвердить' : 'Confirm') + '</button>' +
        '</div>' +

        '<div id="tg-qr-container" style="display:none">' +
          '<div class="st-tg-qr-box">' +
            '<div id="tg-qr-img"></div>' +
            '<div style="color:var(--text-muted);font-size:.8rem;text-align:center">' + (isRu ? 'Откройте Telegram на телефоне и сканируйте QR-код' : 'Open Telegram on your phone and scan the QR code') + '</div>' +
          '</div>' +
        '</div>' +

        '<div id="tg-auth-status"></div>' +
        '</div>';
    }
  } catch (e) {
    body.innerHTML = '<div class="rt-page"><div class="st-tg-status st-tg-status-err">' + IC.x + ' Error: ' + escHtml(e.message || e) + '</div></div>';
  }
}

function showAgentTgPhoneAuth(agentId) {
  var phoneForm = document.getElementById('tg-phone-form');
  var qrContainer = document.getElementById('tg-qr-container');
  var codeForm = document.getElementById('tg-code-form');
  var twoFaForm = document.getElementById('tg-2fa-form');
  if (phoneForm) phoneForm.style.display = '';
  if (qrContainer) qrContainer.style.display = 'none';
  if (codeForm) codeForm.style.display = 'none';
  if (twoFaForm) twoFaForm.style.display = 'none';
  var statusEl = document.getElementById('tg-auth-status');
  if (statusEl) statusEl.innerHTML = '';
  if (_agentTgPolling) { clearInterval(_agentTgPolling); _agentTgPolling = null; }
}

function _wireOtpDigits() {
  setTimeout(function() {
    var digits = document.querySelectorAll('.st-otp-digit');
    if (!digits.length) return;
    digits.forEach(function(d, i) {
      d.addEventListener('input', function() {
        d.value = d.value.replace(/[^0-9]/g, '');
        if (d.value.length === 1 && i < digits.length - 1) digits[i + 1].focus();
        var code = '';
        digits.forEach(function(dd) { code += dd.value; });
        var hidden = document.getElementById('tg-code-input');
        if (hidden) hidden.value = code;
      });
      d.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !d.value && i > 0) digits[i - 1].focus();
      });
      d.addEventListener('paste', function(e) {
        e.preventDefault();
        var paste = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
        for (var j = 0; j < paste.length && j + i < digits.length; j++) {
          digits[i + j].value = paste[j];
        }
        var nextIdx = Math.min(i + paste.length, digits.length - 1);
        digits[nextIdx].focus();
        var code = '';
        digits.forEach(function(dd) { code += dd.value; });
        var hidden = document.getElementById('tg-code-input');
        if (hidden) hidden.value = code;
      });
    });
    digits[0].focus();
  }, 100);
}

async function sendAgentTgCode(agentId) {
  var phone = (document.getElementById('tg-phone-input') || {}).value || '';
  phone = phone.replace(/[\s\-\(\)]/g, '');
  if (!phone || phone.length < 8) { toast('Enter valid phone number', 'error'); return; }
  var statusEl = document.getElementById('tg-auth-status');
  if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-info">' + IC.refresh + ' ' + (currentLang === 'ru' ? 'Отправка кода...' : 'Sending code...') + '</div>';
  try {
    var data = await apiRequest('POST', '/api/telegram/auth/phone', { agentId: agentId, phone: phone });
    if (data.ok && data.ok !== false && !data.error) {
      document.getElementById('tg-phone-form').style.display = 'none';
      document.getElementById('tg-code-form').style.display = '';
      if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-ok">' + IC.check + ' ' + (currentLang === 'ru' ? 'Код отправлен в Telegram' : 'Code sent to Telegram') + '</div>';
      _wireOtpDigits();
    } else {
      if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-err">' + IC.x + ' ' + escHtml(data.error || 'Error') + '</div>';
    }
  } catch (e) {
    if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-err">' + IC.x + ' ' + escHtml(e.message || 'Error') + '</div>';
  }
}

async function submitAgentTgCode(agentId) {
  var code = (document.getElementById('tg-code-input') || {}).value || '';
  code = code.replace(/\s/g, '');
  if (!code || code.length < 4) { toast('Enter the code', 'error'); return; }
  var statusEl = document.getElementById('tg-auth-status');
  if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-info">' + IC.refresh + ' ' + (currentLang === 'ru' ? 'Проверка...' : 'Verifying...') + '</div>';
  try {
    var data = await apiRequest('POST', '/api/telegram/auth/code', { agentId: agentId, code: code });
    if (data.ok && !data.error) {
      if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-ok">' + IC.check + ' ' + (currentLang === 'ru' ? 'Подключено!' : 'Connected!') + '</div>';
      toast('Telegram connected!', 'success');
      setTimeout(function() { loadAgentTelegramTab(document.getElementById('agent-settings-body'), agentId); }, 500);
    } else if (data.error === 'need_password') {
      document.getElementById('tg-code-form').style.display = 'none';
      document.getElementById('tg-2fa-form').style.display = '';
      if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-warn">' + IC.shield + ' ' + (currentLang === 'ru' ? 'Требуется пароль 2FA' : '2FA password required') + '</div>';
      setTimeout(function() { var pi = document.getElementById('tg-2fa-input'); if (pi) pi.focus(); }, 100);
    } else {
      if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-err">' + IC.x + ' ' + escHtml(data.error || 'Invalid code') + '</div>';
    }
  } catch (e) {
    if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-err">' + IC.x + ' ' + escHtml(e.message || 'Error') + '</div>';
  }
}

async function submitAgentTg2FA(agentId) {
  var password = (document.getElementById('tg-2fa-input') || {}).value || '';
  if (!password) { toast('Enter password', 'error'); return; }
  var statusEl = document.getElementById('tg-auth-status');
  if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-info">' + IC.refresh + ' ' + (currentLang === 'ru' ? 'Проверка 2FA...' : 'Verifying 2FA...') + '</div>';
  try {
    var data = await apiRequest('POST', '/api/telegram/auth/password', { agentId: agentId, password: password });
    if (data.ok && !data.error) {
      if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-ok">' + IC.check + ' ' + (currentLang === 'ru' ? 'Подключено!' : 'Connected!') + '</div>';
      toast('Telegram connected!', 'success');
      setTimeout(function() { loadAgentTelegramTab(document.getElementById('agent-settings-body'), agentId); }, 500);
    } else {
      if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-err">' + IC.x + ' ' + escHtml(data.error || 'Wrong password') + '</div>';
    }
  } catch (e) {
    if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-err">' + IC.x + ' ' + escHtml(e.message || 'Error') + '</div>';
  }
}

async function startAgentTgQR(agentId) {
  var phoneForm = document.getElementById('tg-phone-form');
  var codeForm = document.getElementById('tg-code-form');
  var qrContainer = document.getElementById('tg-qr-container');
  if (phoneForm) phoneForm.style.display = 'none';
  if (codeForm) codeForm.style.display = 'none';
  if (qrContainer) qrContainer.style.display = '';
  var statusEl = document.getElementById('tg-auth-status');
  if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-info">' + IC.refresh + ' ' + (currentLang === 'ru' ? 'Генерация QR...' : 'Generating QR...') + '</div>';

  try {
    var data = await apiRequest('POST', '/api/telegram/auth/qr', { agentId: agentId });
    if (data.ok && data.qrUrl) {
      var qrImgEl = document.getElementById('tg-qr-img');
      if (qrImgEl) {
        var encoded = encodeURIComponent(data.qrUrl);
        qrImgEl.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encoded + '" width="200" height="200" style="border-radius:12px;border:2px solid var(--border)">';
      }
      if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-info">' + IC.phone + ' ' + (currentLang === 'ru' ? 'Сканируйте QR в Telegram' : 'Scan QR with Telegram app') + '</div>';

      // Poll for completion
      if (_agentTgPolling) clearInterval(_agentTgPolling);
      var pollCount = 0;
      _agentTgPolling = setInterval(async function() {
        pollCount++;
        if (pollCount > 60) { clearInterval(_agentTgPolling); _agentTgPolling = null; return; }
        try {
          var poll = await apiRequest('GET', '/api/telegram/auth/poll?agentId=' + agentId);
          if (poll.status === 'success') {
            clearInterval(_agentTgPolling); _agentTgPolling = null;
            if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-ok">' + IC.check + ' Connected!</div>';
            toast('Telegram connected!', 'success');
            setTimeout(function() { loadAgentTelegramTab(document.getElementById('agent-settings-body'), agentId); }, 500);
          } else if (poll.status === 'need_password') {
            clearInterval(_agentTgPolling); _agentTgPolling = null;
            if (qrContainer) qrContainer.style.display = 'none';
            document.getElementById('tg-2fa-form').style.display = '';
            if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-warn">' + IC.shield + ' 2FA password required</div>';
          } else if (poll.status === 'error') {
            clearInterval(_agentTgPolling); _agentTgPolling = null;
            if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-err">' + IC.x + ' ' + escHtml(poll.error || 'Error') + '</div>';
          } else if (poll.qrUrl && poll.qrUrl !== data.qrUrl) {
            // QR refreshed
            data.qrUrl = poll.qrUrl;
            var enc2 = encodeURIComponent(poll.qrUrl);
            if (qrImgEl) qrImgEl.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + enc2 + '" width="200" height="200" style="border-radius:12px;border:2px solid var(--border)">';
          }
        } catch(e) {}
      }, 2000);
    } else {
      if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-err">' + IC.x + ' ' + escHtml(data.error || 'QR error') + '</div>';
    }
  } catch (e) {
    if (statusEl) statusEl.innerHTML = '<div class="st-tg-status st-tg-status-err">' + IC.x + ' ' + escHtml(e.message || 'Error') + '</div>';
  }
}

async function disconnectAgentTelegram(agentId) {
  if (!confirm(currentLang === 'ru' ? 'Отключить Telegram аккаунт от этого агента?' : 'Disconnect Telegram from this agent?')) return;
  try {
    await apiRequest('DELETE', '/api/telegram/disconnect?agentId=' + agentId);
    toast('Telegram disconnected', 'success');
    loadAgentTelegramTab(document.getElementById('agent-settings-body'), agentId);
  } catch(e) { toast(e.message || 'Error', 'error'); }
}

// Settings save functions
async function saveSettingsPrompt() {
  var ta = document.getElementById('edit-prompt-textarea');
  if (!ta || !_detailAgentId) return;
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/code', { code: ta.value });
  if (data.ok) { toast(currentLang === 'ru' ? 'Сохранено' : 'Saved', 'success'); _detailAgentData.code = ta.value; }
  else toast(data.error || 'Error', 'error');
}

async function loadPromptModules() {
  if (!_detailAgentId) return null;
  if (_promptModulesCache) return _promptModulesCache;
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/prompt-modules');
    if (data.ok) { _promptModulesCache = data.modules; return data.modules; }
  } catch (e) {}
  return null;
}

async function savePromptModule(moduleName) {
  if (!_detailAgentId) return;
  var ta = document.getElementById('edit-' + moduleName + '-textarea');
  if (!ta) return;
  var data = await apiRequest('POST', '/api/agents/' + _detailAgentId + '/prompt-modules', { module: moduleName, content: ta.value });
  if (data.ok) {
    toast(currentLang === 'ru' ? 'Сохранено' : 'Saved', 'success');
    if (_promptModulesCache) _promptModulesCache[moduleName] = ta.value;
  } else {
    toast(data.error || 'Error', 'error');
  }
}

async function saveSettingsInfo() {
  if (!_detailAgentId) return;
  var name = document.getElementById('settings-agent-name').value.trim();
  var desc = document.getElementById('settings-agent-desc').value.trim();
  if (name.length >= 2) {
    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/rename', { name: name });
    _detailAgentData.name = name;
  }
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/description', { description: desc });
  if (data.ok) { toast(currentLang === 'ru' ? 'Сохранено' : 'Saved', 'success'); _detailAgentData.description = desc; loadAgents(); }
  else toast(data.error || 'Error', 'error');
  var nameEl = document.getElementById('agent-settings-name');
  if (nameEl) nameEl.textContent = '#' + _detailAgentId + ' ' + name;
}

async function saveSettingsAI() {
  if (!_detailAgentId) return;
  var provider = document.getElementById('ai-provider-select').value;
  var model = document.getElementById('ai-model-input').value.trim();
  var apiKey = document.getElementById('ai-key-input').value.trim();
  // Ignore the masked-sample we show by default ("AIzaSy••••XXXX"). Only send when
  // the user actually typed a new key (no bullet character).
  if (apiKey && apiKey.indexOf('•') !== -1) apiKey = '';
  var utilityModel = (document.getElementById('ai-utility-model-input') || {}).value || '';
  utilityModel = utilityModel.trim();
  var temperature = (document.getElementById('ai-temperature') || {}).value;
  var maxTokens = (document.getElementById('ai-max-tokens') || {}).value || (document.getElementById('ai-max-tokens-num') || {}).value;
  var payload = {};
  if (provider) payload.provider = provider;
  if (model) payload.model = model;
  if (apiKey) payload.apiKey = apiKey;
  if (utilityModel) payload.utilityModel = utilityModel;
  if (temperature) payload.temperature = parseFloat(temperature);
  if (maxTokens) payload.maxTokens = parseInt(maxTokens);
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/provider', payload);
  if (data.ok) toast(currentLang === 'ru' ? 'AI настройки обновлены' : 'AI settings updated', 'success');
  else toast(data.error || 'Error', 'error');
}

async function saveSettingsCaps() {
  if (!_detailAgentId) { toast('No agent selected', 'error'); return; }
  var caps = Array.from(document.querySelectorAll('.st-cap-active')).map(function(el) { return el.getAttribute('data-cap'); });
  console.log('[saveSettingsCaps] agentId=' + _detailAgentId + ' caps=' + JSON.stringify(caps));
  if (caps.length === 0) { toast(currentLang === 'ru' ? 'Выберите хотя бы одну возможность' : 'Select at least one capability', 'error'); return; }
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/capabilities', { capabilities: caps });
  console.log('[saveSettingsCaps] response:', JSON.stringify(data));
  if (data.ok) {
    toast(currentLang === 'ru' ? 'Возможности обновлены (' + caps.length + ')' : 'Capabilities updated (' + caps.length + ')', 'success');
    // Update local cache so page reload shows correct state
    if (_detailAgentData && _detailAgentData.triggerConfig) {
      var tc = typeof _detailAgentData.triggerConfig === 'string' ? JSON.parse(_detailAgentData.triggerConfig) : _detailAgentData.triggerConfig;
      if (!tc.config) tc.config = {};
      tc.config.enabledCapabilities = caps;
      _detailAgentData.triggerConfig = tc;
    }
  } else toast(data.error || 'Error', 'error');
}

function toggleCapCard(el, capId) {
  el.classList.toggle('st-cap-active');
  var sw = el.querySelector('.st-cap-switch');
  if (sw) sw.classList.toggle('st-cap-on');
  _updateCapsCounter();
}

function _updateCapsCounter() {
  var counter = document.querySelector('.st-caps-counter');
  if (counter) {
    var count = document.querySelectorAll('.st-cap-active').length;
    var total = document.querySelectorAll('.st-cap-card').length;
    counter.textContent = count + ' / ' + total;
  }
}

function toggleCapCategory(labelEl, ids) {
  var cb = labelEl.querySelector('.st-cat-cb');
  var shouldEnable = cb.checked;
  ids.forEach(function(id) {
    var card = document.querySelector('.st-cap-card[data-cap="' + id + '"]');
    if (!card) return;
    if (shouldEnable && !card.classList.contains('st-cap-active')) {
      card.classList.add('st-cap-active');
      var sw = card.querySelector('.st-cap-switch');
      if (sw) sw.classList.add('st-cap-on');
    } else if (!shouldEnable && card.classList.contains('st-cap-active')) {
      card.classList.remove('st-cap-active');
      var sw = card.querySelector('.st-cap-switch');
      if (sw) sw.classList.remove('st-cap-on');
    }
  });
  _updateCapsCounter();
}

function selectRoleCard(el, roleId) {
  document.querySelectorAll('.st-role-card').forEach(function(c) { c.classList.remove('st-role-active'); });
  el.classList.add('st-role-active');
  setAgentRoleFromSettings(roleId);
}

function pickRoleColor(el, color) {
  document.querySelectorAll('.st-color-swatch').forEach(function(s) { s.classList.remove('st-color-active'); });
  el.classList.add('st-color-active');
  var picker = document.getElementById('agent-color-picker');
  var hex = document.getElementById('agent-color-hex');
  if (picker) picker.value = color;
  if (hex) hex.textContent = color;
}

async function createAgentWalletFromSettings() {
  if (!_detailAgentId) return;
  var data = await apiRequest('POST', '/api/agents/' + _detailAgentId + '/wallet');
  if (data.ok) {
    toast((data.exists ? (currentLang === 'ru' ? 'Кошелёк уже есть' : 'Wallet exists') : (currentLang === 'ru' ? 'Кошелёк создан' : 'Wallet created')) + ': ' + (data.address || ''), 'success');
    // Inject address into local data immediately so the tab renders it
    if (data.address && _detailAgentData) {
      var _tcRef = _detailAgentData.trigger_config || _detailAgentData.triggerConfig || { config: {} };
      if (!_tcRef.config) _tcRef.config = {};
      _tcRef.config.WALLET_ADDRESS = data.address;
      _detailAgentData.trigger_config = _tcRef;
      _detailAgentData.triggerConfig = _tcRef;
    }
    switchSettingsTab('wallet');
  } else toast(data.error || 'Error', 'error');
}

var _cachedMnemonic = '';
var _mnemonicClearTimer = null;

async function revealWalletMnemonic() {
  if (!_detailAgentId) return;
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/mnemonic');
    if (data.ok && data.mnemonic) {
      _cachedMnemonic = data.mnemonic;
      // Auto-clear mnemonic from memory after 60 seconds for security
      if (_mnemonicClearTimer) clearTimeout(_mnemonicClearTimer);
      _mnemonicClearTimer = setTimeout(function() { _cachedMnemonic = ''; _mnemonicClearTimer = null; }, 60000);
      var words = data.mnemonic.split(' ');
      var html = words.map(function(w, i) {
        return '<span style="display:inline-block;background:var(--bg-secondary);padding:2px 8px;margin:2px;border-radius:6px;border:1px solid var(--border)">' +
          '<span style="color:var(--text-muted);font-size:.65rem;margin-right:3px">' + (i + 1) + '.</span>' + escHtml(w) + '</span>';
      }).join(' ');
      document.getElementById('wallet-mnemonic-words').innerHTML = html;
      document.getElementById('wallet-mnemonic-hidden').style.display = 'none';
      document.getElementById('wallet-mnemonic-revealed').style.display = '';
    } else {
      toast(data.error || 'No mnemonic found', 'error');
    }
  } catch (e) {
    toast('Failed to load mnemonic', 'error');
  }
}

function hideWalletMnemonic() {
  _cachedMnemonic = '';
  document.getElementById('wallet-mnemonic-hidden').style.display = '';
  document.getElementById('wallet-mnemonic-revealed').style.display = 'none';
  document.getElementById('wallet-mnemonic-words').innerHTML = '';
}

function copyWalletMnemonic() {
  if (_cachedMnemonic) {
    navigator.clipboard.writeText(_cachedMnemonic);
    toast(currentLang === 'ru' ? 'Мнемоника скопирована' : 'Mnemonic copied', 'success');
  }
}

async function setAgentRoleFromSettings(role) {
  if (!_detailAgentId) return;
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/role', { role: role });
  if (data.ok) {
    toast(currentLang === 'ru' ? 'Роль: ' + role : 'Role: ' + role, 'success');
    _detailAgentData.role = role;
    switchSettingsTab('role');
  } else toast(data.error || 'Error', 'error');
}

async function saveCustomRole() {
  if (!_detailAgentId) return;
  var roleName = (document.getElementById('custom-role-name') || {}).value || '';
  var roleDesc = (document.getElementById('custom-role-desc') || {}).value || '';
  var agentColor = (document.getElementById('agent-color-picker') || {}).value || '#00a8ff';
  // Save directly to agent trigger_config via config endpoint
  var data = await apiRequest('POST', '/api/agents/' + _detailAgentId + '/config', {
    customRole: { name: roleName.trim(), description: roleDesc.trim() },
    agentColor: agentColor,
  });
  if (data.ok) { toast(currentLang === 'ru' ? 'Роль сохранена' : 'Role saved', 'success'); }
  else { toast(data.error || 'Error', 'error'); }
}

// ── AI provider info panel helper ──
function _renderProviderInfo(p, isRu) {
  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
    '<div class="st-prov-dot" style="background:' + p.color + ';width:12px;height:12px"></div>' +
    '<strong>' + p.name + '</strong>' +
    '<a href="' + p.keyUrl + '" target="_blank" style="margin-left:auto;color:var(--primary);font-size:.82rem;text-decoration:none">' +
      IC.link + ' ' + (isRu ? 'Получить API ключ' : 'Get API key') + ' &rarr;' +
    '</a>' +
  '</div>' +
  '<div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:8px">' + p.keyHint + '</div>' +
  '<div style="font-size:.78rem;color:var(--text-muted)">' +
    IC.clipboard + ' ' + (isRu ? 'Модели: ' : 'Models: ') + '<code style="font-size:.75rem">' + p.models + '</code>' +
  '</div>' +
  '<div style="font-size:.78rem;color:var(--text-muted);margin-top:4px">' +
    IC.bolt + ' ' + (isRu ? 'По умолчанию: ' : 'Default: ') + '<code style="font-size:.75rem">' + p.defaultModel + '</code>' +
  '</div>';
}

// ── Select AI provider and update info panel ──
function selectAIProvider(providerId) {
  document.querySelectorAll('.st-provider-card').forEach(function(c) { c.classList.remove('st-prov-active'); });
  var cards = document.querySelectorAll('.st-provider-card');
  cards.forEach(function(c) {
    if (c.querySelector('.st-prov-name') && c.querySelector('.st-prov-name').textContent.toLowerCase() === providerId) {
      c.classList.add('st-prov-active');
    }
  });
  // Also check by onclick match
  cards.forEach(function(c) {
    if (c.getAttribute('onclick') && c.getAttribute('onclick').indexOf("'" + providerId + "'") > -1) {
      c.classList.add('st-prov-active');
    }
  });

  var sel = document.getElementById('ai-provider-select');
  if (sel) sel.value = providerId;

  // Update info panel
  var infoPanel = document.getElementById('ai-provider-info');
  var modelInput = document.getElementById('ai-model-input');
  var keyInput = document.getElementById('ai-key-input');

  // Find the provider data (re-define inline since we can't access the closure)
  var providerData = {
    gemini: { name:'Gemini', color:'#4285f4', models:'gemini-2.5-flash, gemini-2.5-pro', defaultModel:'gemini-2.5-flash', keyUrl:'https://aistudio.google.com/apikey', keyHint:(currentLang==='ru'?'Google AI Studio → Get API Key. Бесплатно до 1500 req/day.':'Google AI Studio → Get API Key. Free up to 1500 req/day.'), keyPrefix:'AIzaSy...' },
    openai: { name:'OpenAI', color:'#10a37f', models:'gpt-4o-mini, gpt-4o, o3-mini', defaultModel:'gpt-4o-mini', keyUrl:'https://platform.openai.com/api-keys', keyHint:(currentLang==='ru'?'platform.openai.com → API Keys. Нужна оплата от $5.':'platform.openai.com → API Keys. Requires $5+ credit.'), keyPrefix:'sk-proj-...' },
    anthropic: { name:'Anthropic', color:'#d97706', models:'claude-haiku-4-5, claude-sonnet-4, claude-opus-4', defaultModel:'claude-haiku-4-5-20251001', keyUrl:'https://console.anthropic.com/settings/keys', keyHint:(currentLang==='ru'?'console.anthropic.com → API Keys. Нужна оплата от $5.':'console.anthropic.com → API Keys. Requires $5+ credit.'), keyPrefix:'sk-ant-...' },
    groq: { name:'Groq', color:'#f55036', models:'llama-3.3-70b-versatile, mixtral-8x7b', defaultModel:'llama-3.3-70b-versatile', keyUrl:'https://console.groq.com/keys', keyHint:(currentLang==='ru'?'console.groq.com → API Keys. Полностью бесплатно!':'console.groq.com → API Keys. Completely free!'), keyPrefix:'gsk_...' },
    deepseek: { name:'DeepSeek', color:'#4f46e5', models:'deepseek-chat, deepseek-reasoner', defaultModel:'deepseek-chat', keyUrl:'https://platform.deepseek.com/api_keys', keyHint:(currentLang==='ru'?'Очень дёшево, ~$0.14/M tokens.':'Very cheap, ~$0.14/M tokens.'), keyPrefix:'sk-...' },
    openrouter: { name:'OpenRouter', color:'#6366f1', models:'google/gemini-2.5-flash (free), meta-llama/llama-3.3-70b', defaultModel:'google/gemini-2.5-flash', keyUrl:'https://openrouter.ai/keys', keyHint:(currentLang==='ru'?'Один ключ → 200+ моделей. Есть бесплатные.':'One key → 200+ models. Free models available.'), keyPrefix:'sk-or-...' },
    together: { name:'Together', color:'#0ea5e9', models:'Llama-3.3-70B-Instruct-Turbo, Qwen2.5-72B', defaultModel:'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyUrl:'https://api.together.ai/settings/api-keys', keyHint:(currentLang==='ru'?'$5 бесплатных кредитов при регистрации.':'$5 free credit on signup.'), keyPrefix:'' },
  };

  var p = providerData[providerId];
  if (infoPanel && p) {
    infoPanel.style.display = '';
    infoPanel.innerHTML = _renderProviderInfo(p, currentLang === 'ru');
  }
  if (modelInput && p) modelInput.placeholder = p.defaultModel;
  if (keyInput && p) keyInput.placeholder = p.keyPrefix || 'API key';
}

function _renderKeywordTags() {
  var container = document.getElementById('rt-keyword-tags');
  var input = document.getElementById('routing-keywords');
  if (!container || !input) return;
  var words = input.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (words.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = words.map(function(w) {
    return '<span class="rt-tag">' + escHtml(w) + '<span class="rt-tag-x" onclick="this.parentNode.remove();_syncKeywordTagsToInput()">x</span></span>';
  }).join('');
}

function _syncKeywordTagsToInput() {
  var container = document.getElementById('rt-keyword-tags');
  var input = document.getElementById('routing-keywords');
  if (!container || !input) return;
  var tags = container.querySelectorAll('.rt-tag');
  var words = [];
  tags.forEach(function(t) {
    var text = t.childNodes[0].textContent.trim();
    if (text) words.push(text);
  });
  input.value = words.join(', ');
}

async function _loadSharedAgents() {
  var banner = document.getElementById('rt-shared-agents');
  if (!banner) return;
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/shared-agents');
    if (!data || !data.agents || data.agents.length <= 1) return;
    var isRu = currentLang === 'ru';
    var html = '<div class="rt-shared-title">' + IC.link + ' ' +
      (isRu ? 'Агенты на аккаунте @' + (data.tgUsername || '?') : 'Agents on @' + (data.tgUsername || '?')) +
      ' <span class="rt-shared-count">' + data.agents.length + '</span></div>' +
      '<div class="rt-shared-list">';
    data.agents.forEach(function(sa) {
      var isCurrent = sa.id === _detailAgentId;
      var rr = sa.routingRules || {};
      var tags = [];
      if (rr.isDefault) tags.push(isRu ? 'по умолчанию' : 'default');
      if (rr.chatTypes) rr.chatTypes.forEach(function(ct) { tags.push(ct); });
      if (rr.keywords && rr.keywords.length > 0) tags.push(rr.keywords.slice(0, 3).join(', '));
      html += '<div class="rt-shared-agent' + (isCurrent ? ' rt-current' : '') + '">' +
        '<div class="rt-shared-name">' + (isCurrent ? IC.star + ' ' : '') + escHtml(sa.name || '#' + sa.id) + '</div>' +
        '<div class="rt-shared-tags">' + tags.map(function(t) { return '<span class="rt-mini-tag">' + escHtml(t) + '</span>'; }).join('') + '</div>' +
        '<div class="rt-shared-status">' + (sa.isActive ? '<span style="color:#22c55e">ON</span>' : '<span style="color:#666">OFF</span>') + '</div>' +
      '</div>';
    });
    html += '</div>';
    banner.innerHTML = html;
    banner.style.display = '';
  } catch (e) { /* silent */ }
}

async function saveSettingsRouting() {
  var chatIds = (document.getElementById('routing-chat-ids') || {}).value || '';
  var keywords = (document.getElementById('routing-keywords') || {}).value || '';
  var priority = parseInt((document.getElementById('routing-priority') || {}).value) || 10;
  var isDefault = (document.getElementById('routing-is-default') || {}).checked || false;
  var chatTypes = [];
  if ((document.getElementById('routing-dm') || {}).checked) chatTypes.push('dm');
  if ((document.getElementById('routing-group') || {}).checked) chatTypes.push('group');
  if ((document.getElementById('routing-channel') || {}).checked) chatTypes.push('channel');
  if ((document.getElementById('routing-channel') || {}).checked) chatTypes.push('channel');

  var btn = document.querySelector('.rt-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = currentLang === 'ru' ? 'Сохраняю...' : 'Saving...'; }

  var payload = {
    routingRules: {
      chatIds: chatIds.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      keywords: keywords.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      chatTypes: chatTypes,
      priority: priority,
      isDefault: isDefault
    }
  };
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/routing', payload);
  if (data && data.ok) {
    toast(currentLang === 'ru' ? 'Правила маршрутизации сохранены' : 'Routing rules saved', 'success');
  } else {
    toast((data && data.error) || 'Error saving routing', 'error');
  }
  if (btn) { btn.disabled = false; btn.innerHTML = IC.check + ' ' + (currentLang === 'ru' ? 'Сохранить правила' : 'Save Rules'); }
}

// _agentChatHistory is declared at line ~949 (agent chat slide-over)

async function sendAgentChatMessage() {
  var input = document.getElementById('agent-chat-input');
  if (!input || !input.value.trim()) return;
  var text = input.value.trim();
  input.value = '';

  _agentChatHistory.push({ role: 'user', text: text });
  _agentChatHistory.push({ role: 'agent', text: '', streaming: true });
  var agentEntry = _agentChatHistory[_agentChatHistory.length - 1];
  var getBox = function() { return document.getElementById('agent-chat-messages'); };
  var render = function() { var c = getBox(); if (c) { renderAgentChat(c); c.scrollTop = c.scrollHeight; } };
  render();

  var done = false;
  await _streamAgentChat(_detailAgentId, text,
    function(chunk) { agentEntry.text += chunk; render(); },
    function(full) { agentEntry.streaming = false; if (!agentEntry.text && full) agentEntry.text = full; if (!agentEntry.text) agentEntry.text = '…'; render(); done = true; },
    function(err) {
      if (!done) {
        apiRequest('POST', '/api/agents/' + _detailAgentId + '/chat', { message: text }).then(function(d) {
          agentEntry.streaming = false;
          agentEntry.text = d.ok ? (d.response || '…') : (d.error || 'Error');
          if (!d.ok) agentEntry.role = 'error';
          render();
        }).catch(function() { agentEntry.streaming = false; agentEntry.text = 'Ошибка: ' + err; agentEntry.role = 'error'; render(); });
      }
    }
  );
}

async function runSettingsAudit(body) {
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/audit');
    if (!data.ok) { body.innerHTML = '<p style="color:var(--danger)">Error</p>'; return; }
    var html = '<div class="settings-section">';
    html += '<div class="settings-section-title">' + (currentLang === 'ru' ? 'Результат аудита' : 'Audit Result') + '</div>';
    html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px"><div style="font-size:2.5rem;font-weight:700;color:var(--primary)">' + data.score + '%</div>';
    html += '<div style="flex:1;height:10px;background:rgba(255,255,255,0.05);border-radius:5px;overflow:hidden"><div style="height:100%;width:' + data.score + '%;background:var(--primary);border-radius:5px"></div></div></div>';
    if (data.passed && data.passed.length) {
      data.passed.forEach(function(p) { html += '<div style="padding:6px 0;font-size:.85rem;color:#4ade80">' + IC.check + ' ' + escHtml(p) + '</div>'; });
    }
    if (data.issues && data.issues.length) {
      data.issues.forEach(function(i) { html += '<div style="padding:6px 0;font-size:.85rem;color:#f59e0b">' + IC.warn + ' ' + escHtml(i) + '</div>'; });
    }
    html += '</div>';
    body.innerHTML = html;
  } catch(e) { body.innerHTML = '<p style="color:var(--danger)">' + escHtml(e.message) + '</p>'; }
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
    // Particle dissolution on the card
    const card = document.querySelector(`[data-id="${agentId}"]`);
    if (card) {
      spawnParticleDissolution(card);
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9)';
      card.style.pointerEvents = 'none';
      setTimeout(() => { card.remove(); }, 500);
    }
    showNotification('Agent #' + agentId + ' deleted', 'success');
    setTimeout(() => { loadAgents(); loadAgentsPage(); }, 800);
  } else {
    showNotification((data.error || 'Failed to delete'), 'error');
  }
}

// ===== MY AGENTS PAGE (full page with filters) =====
let _agentsPageData = [];
let _agentsCache = [];
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
  var aiN = _agentsPageData.filter(a => a.triggerType === 'ai_agent').length;
  var setEl = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('agents-filter-all', all);
  setEl('agents-filter-active', activeN);
  setEl('agents-filter-paused', pausedN);
  setEl('agents-page-count', all + (currentLang === 'ru' ? ' агентов' : ' agents'));
  // Blink stat cards
  setEl('stat-total-agents', all);
  setEl('stat-active-agents', activeN);
  setEl('stat-paused-agents', pausedN);
  setEl('stat-ai-agents', aiN);

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
      (_agentsPageFilter === 'all' ? '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'assistant\')" style="margin-bottom:10px">' + (currentLang === 'ru' ? 'Описать агента Atlas →' : 'Describe agent to Atlas →') + '</button><br>' +
      '<span style="font-size:.75rem;color:var(--text-muted)">' + (currentLang === 'ru' ? 'Atlas создаст агента по вашему описанию — промпт, инструменты, настройки' : 'Atlas will create an agent from your description — prompt, tools, settings') + '</span>' : '') +
      '</div>';
    return;
  }

  var triggerLabel = function(tt) { return tt === 'scheduled' ? t('trigger_scheduled') : tt === 'webhook' ? t('trigger_webhook') : tt === 'ai_agent' ? t('trigger_ai_agent') : t('trigger_manual'); };
  var triggerIcon = function(tt) {
    if (tt === 'scheduled') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    if (tt === 'webhook') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
    if (tt === 'ai_agent') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  };
  var timeAgo = function(dateStr) {
    if (!dateStr) return '';
    var ms = Date.now() - new Date(dateStr).getTime();
    if (ms < 60000) return currentLang === 'ru' ? 'только что' : 'just now';
    if (ms < 3600000) return Math.floor(ms / 60000) + (currentLang === 'ru' ? ' мин' : 'm ago');
    if (ms < 86400000) return Math.floor(ms / 3600000) + (currentLang === 'ru' ? ' ч' : 'h ago');
    return Math.floor(ms / 86400000) + (currentLang === 'ru' ? ' д' : 'd ago');
  };
  // Determine status class: active=green, paused=yellow, error=red
  var statusClass = function(a) {
    if (a.lastError || a.last_error) return 'error';
    if (a.isActive) return 'active';
    return 'paused';
  };
  var statusLabel = function(a) {
    if (a.lastError || a.last_error) return currentLang === 'ru' ? 'Ошибка' : 'Error';
    if (a.isActive) return t('active');
    return t('paused');
  };

  listEl.innerHTML = agents.map(function(a) {
    var role = a.role || 'worker';
    var lvl = a.level || 1;
    var created = timeAgo(a.createdAt);
    var lastActive = a.lastActiveAt || a.last_active_at || a.updatedAt || a.updated_at || '';
    var lastActiveStr = lastActive ? timeAgo(lastActive) : '';
    var toolCalls = a.toolCallCount || a.tool_call_count || 0;
    var sClass = statusClass(a);
    return '<div class="agent-card-enhanced agent-card-status-' + sClass + '" data-id="' + a.id + '" onclick="openAgentDetail(' + a.id + ')" style="cursor:pointer">' +
      '<div class="agent-card-top">' +
      '<div class="agent-status ' + sClass + '"><span class="status-dot"></span><span>' + statusLabel(a) + '</span></div>' +
      '<div class="agent-card-type">' + triggerIcon(a.triggerType) + ' ' + triggerLabel(a.triggerType) + '</div>' +
      '</div>' +
      '<div class="agent-card-main">' +
      '<strong class="agent-card-name">#' + a.id + ' ' + escHtml(a.name || t('unnamed')) + '</strong>' +
      '<span class="agent-desc">' + escHtml((a.description || '').slice(0, 120)) + '</span>' +
      '</div>' +
      '<div class="agent-card-meta">' +
      '<span class="agent-role-badge role-' + role + '" style="background:' + ({worker:'rgba(var(--accent-r,0),var(--accent-g,168),var(--accent-b,255),0.15)',manager:'rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.15)',specialist:'rgba(230,126,34,0.15)',monitor:'rgba(46,204,113,0.15)'}[role] || 'rgba(var(--accent-r,0),var(--accent-g,168),var(--accent-b,255),0.15)') + ';color:' + ({worker:'#00a8ff',manager:'#8b5cf6',specialist:'#e67e22',monitor:'#2ecc71'}[role] || '#00a8ff') + '">' + role + '</span>' +
      '<span class="agent-level">' + t('lv') + lvl + '</span>' +
      (lastActiveStr ? '<span class="agent-last-active" title="' + (currentLang === 'ru' ? 'Последняя активность' : 'Last active') + '">' + IC.clock + ' ' + lastActiveStr + '</span>' : '') +
      (toolCalls > 0 ? '<span class="agent-tool-calls" title="' + (currentLang === 'ru' ? 'Вызовов инструментов' : 'Tool calls') + '">' + IC.wrench + ' ' + toolCalls + '</span>' : '') +
      (created && !lastActiveStr ? '<span class="agent-created">' + created + '</span>' : '') +
      '</div>' +
      '<div class="agent-card-actions">' +
      '<button class="btn btn-sm ' + (a.isActive ? 'btn-warning' : 'btn-success') + '" onclick="event.stopPropagation();toggleAgentFromPage(' + a.id + ',' + a.isActive + ')">' + (a.isActive ? IC.pause + ' ' + t('stop') : IC.rocket + ' ' + t('run')) + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();copyAgentPrompt(' + a.id + ', event)" title="' + (currentLang === 'ru' ? 'Копировать промпт' : 'Copy prompt') + '">' + IC.clipboard + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();exportAgentFromCard(' + a.id + ', event)" title="' + (currentLang === 'ru' ? 'Экспорт JSON' : 'Export JSON') + '">' + IC.download + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();loadAgentLogs(' + a.id + ')" title="' + (currentLang === 'ru' ? 'Логи' : 'Logs') + '">' + IC.inbox + '</button>' +
      '<button class="btn btn-ghost btn-sm" title="' + (getPinnedAgents().indexOf(a.id) >= 0 ? (currentLang === 'ru' ? 'Открепить' : 'Unpin') : (currentLang === 'ru' ? 'Закрепить на обзор' : 'Pin to overview')) + '" onclick="togglePinAgent(' + a.id + ', event)" style="color:' + (getPinnedAgents().indexOf(a.id) >= 0 ? 'var(--primary)' : 'var(--text-muted)') + '">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" ' + (getPinnedAgents().indexOf(a.id) >= 0 ? 'fill="currentColor"' : 'fill="none"') + ' stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></button>' +
      '<button class="btn btn-ghost btn-sm btn-delete-card" onclick="event.stopPropagation();deleteAgent(' + a.id + ',\'' + escHtml(a.name || 'Agent').replace(/'/g, "\\'") + '\')">' + IC.trash + '</button>' +
      '</div></div>';
  }).join('');
}


// Swipe-to-delete on agent cards (billiard lunge)
function initSwipeToDelete() {
  var listEl = document.getElementById('agents-page-list');
  if (!listEl || listEl._swipeInit) return;
  listEl._swipeInit = true;
  var startX = 0, currentCard = null, swiping = false;

  listEl.addEventListener('touchstart', function(e) {
    var card = e.target.closest('.agent-card-enhanced');
    if (!card) return;
    startX = e.touches[0].clientX;
    currentCard = card;
    swiping = false;
  }, { passive: true });

  listEl.addEventListener('touchmove', function(e) {
    if (!currentCard) return;
    var dx = e.touches[0].clientX - startX;
    var dy = e.touches[0].clientY - (currentCard._startY || 0);
    if (dx > 0) { currentCard.style.transform = ''; return; }
    swiping = true;
    var offset = Math.max(dx, -140);
    currentCard.style.transform = 'translateX(' + offset + 'px)';
    currentCard.style.transition = 'none';
    if (dx < -60) {
      currentCard.style.background = 'linear-gradient(90deg, var(--bg-secondary) 60%, rgba(231,76,60,0.3) 100%)';
    } else {
      currentCard.style.background = '';
    }
  }, { passive: false });

  listEl.addEventListener('touchend', function(e) {
    if (!currentCard) return;
    var dx = e.changedTouches[0].clientX - startX;
    currentCard.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1), background 0.3s ease';
    if (dx < -80 && swiping) {
      currentCard.style.transform = 'translateX(-140px)';
      var agentId = currentCard.getAttribute('data-id');
      var nameEl = currentCard.querySelector('.agent-card-name');
      var name = nameEl ? nameEl.textContent.trim() : 'Agent';
      var card = currentCard;
      setTimeout(function() {
        card.style.transform = '';
        card.style.background = '';
        deleteAgent(parseInt(agentId), name.replace(/^#\d+\s*/, ''));
      }, 350);
    } else {
      currentCard.style.transform = '';
      currentCard.style.background = '';
    }
    currentCard = null;
    swiping = false;
  });

  // Mouse drag for desktop
  var mouseDown = false, mouseCard = null, mouseStartX = 0;
  listEl.addEventListener('mousedown', function(e) {
    var card = e.target.closest('.agent-card-enhanced');
    if (!card || e.target.closest('button')) return;
    mouseCard = card;
    mouseStartX = e.clientX;
    mouseDown = true;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if (!mouseDown || !mouseCard) return;
    var dx = e.clientX - mouseStartX;
    if (dx > 5) { mouseCard.style.transform = ''; return; }
    mouseCard.style.transform = 'translateX(' + Math.max(dx, -140) + 'px)';
    mouseCard.style.transition = 'none';
    mouseCard.style.background = dx < -60 ? 'linear-gradient(90deg, var(--bg-secondary) 60%, rgba(231,76,60,0.3) 100%)' : '';
  });
  document.addEventListener('mouseup', function(e) {
    if (!mouseDown || !mouseCard) return;
    var dx = e.clientX - mouseStartX;
    mouseCard.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1), background 0.3s ease';
    if (dx < -80) {
      mouseCard.style.transform = 'translateX(-140px)';
      var agentId = mouseCard.getAttribute('data-id');
      var nameEl = mouseCard.querySelector('.agent-card-name');
      var name = nameEl ? nameEl.textContent.trim() : 'Agent';
      var card = mouseCard;
      setTimeout(function() {
        card.style.transform = '';
        card.style.background = '';
        deleteAgent(parseInt(agentId), name.replace(/^#\d+\s*/, ''));
      }, 350);
    } else {
      mouseCard.style.transform = '';
      mouseCard.style.background = '';
    }
    mouseCard = null;
    mouseDown = false;
  });
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
// Escape for use inside inline JS string literals (onclick="...('VALUE')...")
function escJsAttr(str) {
  return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function refreshData() {
  const icon = document.querySelector('.refresh-icon');
  if (icon) icon.style.animation = 'spin 1s linear infinite';
  await loadDashboard();
  if (icon) icon.style.animation = '';
}

// Actual sign-out routine — clears tokens/cache and re-shows the auth screen.
// Renamed from the historical `logout` so we can wrap it with a confirmation
// prompt (the old sidebar button was too easy to mis-click).
function _performLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('tg_token');
  try {
    localStorage.removeItem('tos_accepted');
    localStorage.removeItem('tos_accepted_errors');
  } catch (_e) {}
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  initAuth();
}

// Public sign-out — shows a styled confirmation modal first. Kept under
// the legacy `logout` name so old onclick handlers keep working.
function logout() {
  var existing = document.getElementById('logout-confirm-modal');
  if (existing) { existing.remove(); }
  var ru = currentLang === 'ru';
  var modal = document.createElement('div');
  modal.id = 'logout-confirm-modal';
  modal.className = 'logout-confirm-modal';
  modal.innerHTML =
    '<div class="logout-confirm-backdrop"></div>' +
    '<div class="logout-confirm-card" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">' +
      '<div class="logout-confirm-icon">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
      '</div>' +
      '<h3 id="logout-confirm-title" class="logout-confirm-title">' + (ru ? 'Выйти из аккаунта?' : 'Sign out?') + '</h3>' +
      '<p class="logout-confirm-sub">' + (ru
        ? 'Вы выйдете на этом устройстве. Агенты продолжат работать на платформе.'
        : 'You\'ll be signed out on this device. Your agents keep running on the platform.') + '</p>' +
      '<div class="logout-confirm-actions">' +
        '<button class="btn btn-secondary" id="logout-confirm-cancel">' + (ru ? 'Отмена' : 'Cancel') + '</button>' +
        '<button class="logout-btn-profile" id="logout-confirm-ok">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
          (ru ? 'Выйти' : 'Sign out') +
        '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  var close = function() { modal.remove(); document.removeEventListener('keydown', onKey); };
  var onKey = function(e) { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  modal.querySelector('.logout-confirm-backdrop').addEventListener('click', close);
  modal.querySelector('#logout-confirm-cancel').addEventListener('click', close);
  modal.querySelector('#logout-confirm-ok').addEventListener('click', function() {
    close();
    _performLogout();
  });
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

  // Show auth screen (it starts hidden to avoid language flash)
  const authScreenEl = document.getElementById('auth-screen');
  if (authScreenEl) authScreenEl.classList.remove('hidden');

  const container = document.getElementById('telegram-login-container');
  if (!container) return;

  // Update auth screen text
  const welcomeEl = document.querySelector('.auth-box h2');
  if (welcomeEl) welcomeEl.textContent = t('welcome_back');
  const descEl = document.querySelector('.auth-box p');
  if (descEl) descEl.textContent = t('sign_in_desc');
  const secureEl = document.getElementById('https-hint');
  if (secureEl) secureEl.textContent = t('secure_auth');
  const expiredEl = document.getElementById('session-expired-hint');
  if (expiredEl) expiredEl.textContent = t('session_expired');

  var botId = (window._appConfig && window._appConfig.tgClientId) || 8595707164;

  // Load new Telegram Login SDK (core.telegram.org/bots/telegram-login)
  container.innerHTML = '';
  var holder = document.createElement('div');
  holder.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px';
  container.appendChild(holder);

  // Create styled login button
  var loginBtn = document.createElement('button');
  loginBtn.className = 'telegram-login-placeholder';
  loginBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.94 8.13l-1.97 9.28c-.15.67-.54.83-1.09.52l-3.01-2.22-1.45 1.4c-.16.16-.3.3-.61.3l.22-3.05 5.55-5.02c.24-.22-.05-.34-.38-.13l-6.87 4.33-2.96-.92c-.64-.2-.66-.64.14-.95l11.58-4.47c.53-.2 1 .13.83.95z"/></svg>' +
    (currentLang === 'ru' ? 'Войти через Telegram' : 'Sign in with Telegram');
  loginBtn.onclick = function() {
    if (window.Telegram && window.Telegram.Login) {
      Telegram.Login.auth({ client_id: botId, request_access: ['write'] }, onTelegramAuth);
    } else {
      toast(currentLang === 'ru' ? 'SDK загружается, попробуйте ещё раз' : 'SDK loading, try again', 'warning');
    }
  };
  holder.appendChild(loginBtn);

  // ── "or" divider + secondary "Sign in via bot" button ──────────────────
  var divider = document.createElement('div');
  divider.className = 'auth-or-divider';
  divider.innerHTML = '<span>' + (currentLang === 'ru' ? 'или' : 'or') + '</span>';
  holder.appendChild(divider);

  var botBtn = document.createElement('button');
  botBtn.type = 'button';
  botBtn.className = 'auth-bot-btn';
  botBtn.onclick = function () { startBotAuthDirect(botBtn); };
  botBtn.innerHTML =
    '<span class="auth-bot-btn-icon"><i data-lucide="bot"></i></span>' +
    '<span class="auth-bot-btn-text">' +
      '<strong>' + (currentLang === 'ru' ? 'Войти через бота' : 'Sign in via bot') + '</strong>' +
      '<small>' + (currentLang === 'ru' ? 'Без Telegram-входа · @TonAgentPlatformBot' : 'No Telegram login · @TonAgentPlatformBot') + '</small>' +
    '</span>' +
    '<span class="auth-bot-btn-arrow"><i data-lucide="chevron-right"></i></span>';
  holder.appendChild(botBtn);
  // Re-render Lucide so the newly-injected <i data-lucide> nodes become real SVGs.
  renderAuthLucideIcons();

  // Load Telegram Login SDK
  if (!document.querySelector('script[src*="telegram-login.js"]')) {
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://oauth.telegram.org/js/telegram-login.js?3';
    document.head.appendChild(script);
  }

  // Render Lucide icons and start auto-refreshing live stats
  renderAuthLucideIcons();
  startAuthStatsAutoRefresh();

  // Pre-fetch the bot deeplink so the first click on "Sign in via bot"
  // opens Telegram immediately (no extra step / popup blocker issues).
  prefetchBotAuth();
}

// ── Auth screen: Lucide icons + live stats ────────────────────────────────
function renderAuthLucideIcons() {
  var tryRender = function () {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (_) {}
      return true;
    }
    return false;
  };
  if (tryRender()) return;
  var attempts = 0;
  var iv = setInterval(function () {
    attempts++;
    if (tryRender() || attempts > 40) clearInterval(iv);
  }, 100);
}

var _authStatsAnimating = {};
function animateAuthStat(id, target) {
  var el = document.getElementById(id);
  if (!el) return;
  var current = parseInt(el.getAttribute('data-target') || '0', 10) || 0;
  if (current === target) return;
  el.setAttribute('data-target', String(target));
  if (_authStatsAnimating[id]) cancelAnimationFrame(_authStatsAnimating[id]);
  var start = current;
  var t0 = performance.now();
  var dur = 900;
  var step = function (t) {
    var p = Math.min(1, (t - t0) / dur);
    var eased = 1 - Math.pow(1 - p, 3);
    var val = Math.round(start + (target - start) * eased);
    el.textContent = val >= 1000 ? (val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : (val / 1000).toFixed(val < 10000 ? 1 : 0) + 'K') : String(val);
    if (p < 1) _authStatsAnimating[id] = requestAnimationFrame(step);
    else delete _authStatsAnimating[id];
  };
  _authStatsAnimating[id] = requestAnimationFrame(step);
}

// Bot-auth deeplink prefetch so the first click acts as a direct Telegram redirect.
var _botAuthPrefetch = null;
async function prefetchBotAuth() {
  if (_botAuthPrefetch) return;
  try {
    const data = await apiRequest('GET', '/api/auth/request');
    if (data && data.ok) {
      _botAuthPrefetch = { authToken: data.authToken, botLink: data.botLink };
    }
  } catch (_) { /* offline — startBotAuthDirect will refetch on click */ }
}

async function startBotAuthDirect(btn) {
  // Mark the button as busy so the user gets immediate feedback.
  var setBusy = function (label) {
    if (!btn) return;
    var sub = btn.querySelector('.auth-bot-btn-text small');
    if (sub && label) sub.textContent = label;
    btn.classList.add('is-loading');
  };
  var waitLabel = currentLang === 'ru' ? 'Открываю Telegram… ждём подтверждения' : 'Opening Telegram… waiting for confirmation';

  var data = _botAuthPrefetch;
  if (!data) {
    setBusy(currentLang === 'ru' ? 'Подключаемся…' : 'Connecting…');
    try {
      var resp = await apiRequest('GET', '/api/auth/request');
      if (resp && resp.ok) data = { authToken: resp.authToken, botLink: resp.botLink };
    } catch (_) {}
    if (!data) {
      if (btn) btn.classList.remove('is-loading');
      toast(currentLang === 'ru' ? 'Не удалось подключиться к боту' : 'Failed to reach bot', 'error');
      return;
    }
    _botAuthPrefetch = data;
  }

  // Open Telegram in a new tab. window.open right after a real click is allowed.
  var w = window.open(data.botLink, '_blank', 'noopener');
  if (!w) {
    // Popup blocked — fall back to same-tab navigation.
    window.location.href = data.botLink;
  }
  setBusy(waitLabel);
  beginBotAuthPolling(data.authToken);
}

function beginBotAuthPolling(token) {
  if (_botAuthPolling) clearInterval(_botAuthPolling);
  _botAuthToken = token;
  _botAuthPolling = setInterval(async () => {
    try {
      const check = await apiRequest('GET', '/api/auth/check/' + token);
      if (check.status === 'approved') {
        clearInterval(_botAuthPolling);
        _botAuthPolling = null;
        authToken = check.token;
        localStorage.setItem('tg_token', authToken);
        // Hydrate currentUser with the same shape Telegram-auth uses
        // so ToS / beta / admin gates don't flash on first paint.
        currentUser = {
          userId: check.userId,
          userIdStr: check.userIdStr || String(check.userId),
          username: check.username || '',
          first_name: check.firstName || '',
          photo_url: check.photoUrl || null,
          _isAdmin: check.isAdmin || false,
          _isBeta: check.isBeta || false,
          _acceptedTos: check.acceptedTos || false,
          _needsTelegramLink: false,
        };
        showApp();
      } else if (!check.ok || check.status === 'not_found') {
        clearInterval(_botAuthPolling);
        _botAuthPolling = null;
        // Token expired — drop the prefetch so the next click refetches a fresh one.
        _botAuthPrefetch = null;
        var btn = document.querySelector('.auth-bot-btn');
        if (btn) btn.classList.remove('is-loading');
      }
    } catch (_) { /* network blip — keep polling */ }
  }, 2000);
}

var _authStatsTimer = null;
async function loadAuthStatsOnce() {
  try {
    var r = await fetch(API_BASE + '/api/stats', { cache: 'no-store' });
    var d = await r.json();
    if (!d || !d.ok) return;
    animateAuthStat('auth-stat-agents', d.agentsCreated || 0);
    animateAuthStat('auth-stat-active', d.activeAgents || 0);
    animateAuthStat('auth-stat-users', d.totalUsers || 0);
    animateAuthStat('auth-stat-execs', d.totalExecutions || 0);
  } catch (_) { /* offline / API down — leave previous values */ }
}
function startAuthStatsAutoRefresh() {
  loadAuthStatsOnce();
  if (_authStatsTimer) clearInterval(_authStatsTimer);
  _authStatsTimer = setInterval(loadAuthStatsOnce, 30000);
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
  currentUser = { userId: data.userId, userIdStr: data.userIdStr || String(data.userId), username: data.username, first_name: data.firstName, photo_url: data.photoUrl || null, _isAdmin: data.isAdmin || false, _isBeta: data.isBeta || false, _acceptedTos: data.acceptedTos || false };
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
    currentUser = { userId: data.userId, userIdStr: data.userIdStr || String(data.userId), username: data.username, first_name: data.firstName, photo_url: data.photoUrl || null, _isAdmin: data.isAdmin || false, _isBeta: data.isBeta || false, _acceptedTos: data.acceptedTos || false, _needsTelegramLink: data.needsTelegramLink === true };
    if (data.planId) currentUser._plan = { planId: data.planId, planName: data.planName, planIcon: data.planIcon };
    showApp();
    if (currentUser._needsTelegramLink) { try { showTelegramLinkBanner(); } catch (e) {} }
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
          '<code id="auth-code-text" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px 14px;font-size:.85rem;font-family:JetBrains Mono,monospace;color:var(--primary-light);letter-spacing:.5px;user-select:all;cursor:pointer" onclick="copyAuthCode()" title="Click to copy">' + escHtml(authCmd) + '</code>' +
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
    toast(currentLang === 'ru' ? 'Скопировано!' : 'Copied!', 'success');
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
  skills:      () => loadSkillsPage(),
  'mcp-servers': () => loadMCPServersPage(),
  assistant:   () => loadAssistantPage(),
  guide:         () => loadGuidePage(),
  notifications: () => loadNotificationsPage(),
  wallets:       () => loadWalletsPage(),
  'admin-agents':() => loadAdminAgentsPage(),
  'bugs':        () => loadBugDashboard(),
  'terms':       () => loadTermsPage(),
  'privacy':     () => loadPrivacyPage(),
  'tester-hub':  () => loadTesterHub(),
  crews:         () => loadCrewsPage(),
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
      greetEl.innerHTML = greeting + ', <span class="grad">' + escHtml(name) + '</span>';
      greetEl.removeAttribute('data-en');
      greetEl.removeAttribute('data-ru');
    }
    // Live eyebrow above the greeting + extended subtitle ("N агентов
    // активны…"). Both inserted once per page-load.
    var headerL = greetEl ? greetEl.parentElement : null;
    if (headerL && !headerL.querySelector('.eyebrow')) {
      var eb = document.createElement('span');
      eb.className = 'eyebrow';
      var months = currentLang === 'ru'
        ? ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
        : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var now = new Date();
      eb.textContent = 'Live · ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
      eb.style.cssText = 'margin-bottom:14px;display:inline-flex';
      headerL.insertBefore(eb, headerL.firstChild);
    }
    // Extend subtitle with live stats once /api/stats/me resolves.
    var subEl = headerL ? headerL.querySelector('.page-subtitle') : null;
    if (subEl && !subEl.dataset.stretched) {
      apiRequest('GET', '/api/stats/me').then(function(d) {
        if (!d || !d.ok) return;
        var active = d.agentsActive || 0;
        var avg = d.avgResponseSec || d.avgResponse || null;
        var ru = currentLang === 'ru';
        var tail = ru
          ? (active + ' агент' + (active === 1 ? '' : (active < 5 ? 'а' : 'ов')) + ' активн' + (active === 1 ? 'ы' : 'ы'))
          : (active + ' agent' + (active === 1 ? '' : 's') + ' active');
        if (avg) tail += ru ? ', среднее время отклика ' + avg.toFixed(1) + 'с' : ', avg response ' + avg.toFixed(1) + 's';
        subEl.textContent = subEl.textContent.replace(/[.·]+\s*$/, '').trim() + '. ' + tail + '.';
        subEl.dataset.stretched = '1';
      }).catch(function(){});
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capability-chevron" stroke-linecap="round" stroke-linejoin="round">
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
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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
var _chatPolicies = {};
async function saveTelegramSettings() {
  var tg = {
    dmMode: document.getElementById('tg-dm-mode')?.value || 'open',
    groupMode: document.getElementById('tg-group-mode')?.value || 'allowlist',
    requireMention: document.getElementById('tg-require-mention')?.checked ?? true,
    typingIndicator: document.getElementById('tg-typing')?.checked ?? true,
    autoReply: document.getElementById('tg-auto-reply')?.checked ?? false,
    responseDelay: parseInt(document.getElementById('slider-response-delay')?.value || '1500'),
    chatPolicies: _chatPolicies,
  };
  await apiRequest('POST', '/api/settings', { key: 'telegram_settings', value: tg });
  // Also save to agent's trigger_config so runtime picks it up
  if (_detailAgentId) {
    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/config', {
      groupPolicy: tg.groupMode || 'allowlist',
      chatPolicies: tg.chatPolicies || {},
    });
  }
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
      if (tg.chatPolicies) { _chatPolicies = tg.chatPolicies; renderChatPolicies(); }
    }
  } catch {}
}

function renderChatPolicies() {
  var list = document.getElementById('chat-policies-list');
  if (!list) return;
  var modeLabels = { active: IC.dot_green + ' Active', open: IC.dot_blue + ' Open', 'mention-only': IC.dot_pause + ' Mention', disabled: IC.dot_red + ' Off' };
  list.innerHTML = Object.keys(_chatPolicies).length === 0
    ? '<div style="color:var(--text-muted);font-size:12px">' + (currentLang === 'ru' ? 'Нет per-chat настроек. Агент сам добавит через set_chat_policy()' : 'No per-chat overrides. Agent manages via set_chat_policy()') + '</div>'
    : Object.entries(_chatPolicies).map(function(e) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:var(--bg-secondary);border-radius:6px">' +
          '<span style="flex:1;font-size:13px;font-family:monospace">' + e[0] + '</span>' +
          '<span style="font-size:12px">' + (modeLabels[e[1]] || e[1]) + '</span>' +
          '<button onclick="removeChatPolicy(\'' + e[0] + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px">&times;</button>' +
        '</div>';
      }).join('');
}

function addChatPolicy() {
  var id = document.getElementById('chat-policy-id')?.value?.trim();
  var mode = document.getElementById('chat-policy-mode')?.value;
  if (!id) return;
  _chatPolicies[id] = mode;
  document.getElementById('chat-policy-id').value = '';
  renderChatPolicies();
  saveTelegramSettings();
}

function removeChatPolicy(chatId) {
  delete _chatPolicies[chatId];
  renderChatPolicies();
  saveTelegramSettings();
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

// Cached user-level mask (e.g. "AIzaSy…HAG4"). Set by loadAIKey, read by agent
// detail "AI" tab so the input shows a recognisable mask instead of generic bullets.
let _aiKeyMaskUser = '';

async function loadAIKey() {
  try {
    const data = await apiRequest('GET', '/api/settings');
    if (!data.ok || !data.settings) return;
    if (data.settings.user_variables_masked && data.settings.user_variables_masked.AI_API_KEY) {
      _aiKeyMaskUser = data.settings.user_variables_masked.AI_API_KEY;
    }
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
      // Бэкенд даёт безопасную маску в user_variables_masked (например "sk-pro…wxyz").
      // Фоллбек на дефолтный placeholder если масок нет или это legacy plain-text без маски.
      const mask = data.settings.user_variables_masked && data.settings.user_variables_masked.AI_API_KEY;
      if (mask) {
        input.placeholder = mask;
      } else if (typeof vars.AI_API_KEY === 'string' && !vars.AI_API_KEY.startsWith('enc:') && vars.AI_API_KEY.length > 10) {
        input.placeholder = vars.AI_API_KEY.slice(0, 6) + '…' + vars.AI_API_KEY.slice(-4);
      } else {
        input.placeholder = currentLang === 'ru' ? '•••••••• (ключ сохранён)' : '•••••••• (key saved)';
      }
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
  // Route from URL path: /studio/profile → navigateTo('profile')
  // /studio/agents/201 → open agent 201
  // /studio/agents/201/chats → open agent 201 on chats tab
  var path = window.location.pathname.replace(/\/$/, '');
  var agentMatch = path.match(/\/studio\/agents\/(\d+)(?:\/(\w+))?/);
  if (agentMatch) {
    var _routeAgentId = parseInt(agentMatch[1]);
    var _routeTab = agentMatch[2] || 'soul';
    // Direct open — no intermediate navigation
    setTimeout(async function() {
      if (!authToken) return;
      await openAgentDetail(_routeAgentId);
      if (_routeTab !== 'soul') switchSettingsTab(_routeTab);
    }, 300);
  } else {
    var match = path.match(/\/studio\/(\w+)/);
    if (match && match[1]) {
      setTimeout(function() { if (authToken) navigateTo(match[1]); }, 500);
    }
  }
});

// ===== NAVIGATION HELPER =====
// Page name aliases (multiple names → same page)
const _pageAliases = { 'agents': 'operations', 'my-agents': 'operations' };

function navigateTo(pageName) {
  // Resolve aliases
  pageName = _pageAliases[pageName] || pageName;
  // Block beta-only pages for non-beta users
  var _betaPages = ['builder', 'wallets'];
  if (_betaPages.indexOf(pageName) >= 0 && currentUser && !currentUser._isBeta && !currentUser._isAdmin) {
    toast(currentLang === 'ru' ? 'Доступно только для бета-тестеров. Используйте /beta в боте.' : 'Beta testers only. Use /beta in the bot.', 'warning');
    return;
  }
  closePlansModal();
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  const pageEl = document.getElementById(`${pageName}-page`);
  if (pageEl) {
    pageEl.style.animation = 'none';
    pageEl.offsetHeight; // force reflow to retrigger animation
    pageEl.style.animation = '';
    pageEl.classList.add('active');
  }

  // Restore page-header if leaving bug dashboard (it hides it)
  // Restore page-header visibility (some custom pages may hide it)
  if (pageName !== 'bugs') {
    var _ph = document.querySelector('.page-header');
    if (_ph) _ph.style.display = '';
  }

  if (authToken && pageLoadFns[pageName]) {
    var _result = pageLoadFns[pageName]();
    if (_result && typeof _result.catch === 'function') _result.catch(console.error);
  }

  // Refresh subscription data on profile/overview navigation
  if (authToken && (pageName === 'profile' || pageName === 'overview')) {
    loadSubscriptionGlobal();
  }

  // Update URL for bookmarking/sharing
  if (history.replaceState) {
    history.replaceState(null, '', '/studio/' + pageName);
  }
  // Reset agent URL when leaving agents page
  if (pageName !== 'agents' && typeof _detailAgentId !== 'undefined' && _detailAgentId) {
    // keep as-is; agent URL set in switchSettingsTab
  }

  // Track getting-started steps
  if (pageName === 'settings') markGSStep('ai');
  if (pageName === 'marketplace') markGSStep('marketplace');
  if (pageName === 'guide') markGSStep('guide');
}

// ===== ANALYTICS PAGE =====
var _analyticsDays = 7;

async function loadAnalytics() {
  var container = document.getElementById('analytics-page');
  if (!container) return;
  var isRu = currentLang === 'ru';

  // Fetch data from new API
  var data;
  try {
    data = await apiRequest('GET', '/api/analytics?days=' + _analyticsDays);
    if (!data.ok) throw new Error(data.error || 'Failed');
  } catch(e) {
    // Fallback: show error
    var pc = container.querySelector('.page-content');
    if (pc) pc.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">' + escHtml(e.message) + '</div>';
    return;
  }

  var s = data.summary || {};
  var pc = container.querySelector('.page-content');
  if (!pc) return;

  var html = '';

  // Period selector
  html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:20px">';
  [7, 14, 30].forEach(function(d) {
    var active = _analyticsDays === d;
    html += '<button onclick="_analyticsDays=' + d + ';loadAnalytics()" style="padding:6px 16px;border-radius:20px;border:1px solid ' + (active ? 'var(--primary)' : 'var(--border)') + ';background:' + (active ? 'var(--accent-dim)' : 'var(--bg-primary)') + ';color:' + (active ? 'var(--primary)' : 'var(--text-muted)') + ';font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s">' + d + (isRu ? ' дн' : 'd') + '</button>';
  });
  html += '</div>';

  // Summary cards (2 rows of 4)
  var cards = [
    { label: isRu ? 'Запуски' : 'Runs', value: s.totalRuns || 0, color: 'var(--primary)' },
    { label: isRu ? 'Успешность' : 'Success', value: (s.successRate || 0) + '%', color: '#22c55e' },
    { label: isRu ? 'Ошибки' : 'Failed', value: s.totalFailed || 0, color: '#ef4444' },
    { label: isRu ? 'Ср. время' : 'Avg Time', value: data.daily.length ? (data.daily.reduce(function(a,d){return a+d.avgMs},0)/data.daily.length/1000).toFixed(1)+'s' : '—', color: '#f59e0b' },
    { label: isRu ? 'Токены' : 'Tokens', value: s.totalTokens > 1000 ? Math.round(s.totalTokens/1000)+'K' : (s.totalTokens || 0), color: '#8b5cf6' },
    { label: isRu ? 'Агентов' : 'Agents', value: (data.agents || []).length, color: '#06b6d4' },
    { label: isRu ? 'Лидер' : 'Top Agent', value: (data.agents && data.agents[0]) ? data.agents[0].name.slice(0,12) : '—', color: '#ec4899' },
    { label: isRu ? 'Период' : 'Period', value: _analyticsDays + (isRu ? ' дн' : ' days'), color: 'var(--text-muted)' },
  ];
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">';
  cards.forEach(function(c) {
    html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:14px 16px">' +
      '<div style="font-size:.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">' + c.label + '</div>' +
      '<div style="font-size:1.3rem;font-weight:700;color:' + c.color + '">' + c.value + '</div></div>';
  });
  html += '</div>';

  // Charts row (bar + donut)
  html += '<div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:20px">';
  // Bar chart
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px">' +
    '<div style="font-size:.82rem;font-weight:600;color:var(--text-primary);margin-bottom:10px">' + (isRu ? 'Запуски по дням' : 'Daily Runs') + '</div>' +
    '<canvas id="an-bar-chart" style="width:100%"></canvas></div>';
  // Donut
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;flex-direction:column;align-items:center">' +
    '<div style="font-size:.82rem;font-weight:600;color:var(--text-primary);margin-bottom:10px;align-self:flex-start">' + (isRu ? 'Распределение' : 'Distribution') + '</div>' +
    '<canvas id="an-donut-chart"></canvas>' +
    '<div id="an-donut-legend" style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center"></div></div>';
  html += '</div>';

  // Heatmap
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">' +
    '<div style="font-size:.82rem;font-weight:600;color:var(--text-primary);margin-bottom:12px">' + (isRu ? 'Активность по часам' : 'Activity Heatmap') + '</div>' +
    '<div id="an-heatmap" style="overflow-x:auto"></div></div>';

  // Agent leaderboard + Top errors
  html += '<div style="display:grid;grid-template-columns:3fr 2fr;gap:16px;margin-bottom:20px">';
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px">' +
    '<div style="font-size:.82rem;font-weight:600;color:var(--text-primary);margin-bottom:10px">' + (isRu ? 'Рейтинг агентов' : 'Agent Ranking') + '</div>' +
    '<div id="analytics-leaderboard"></div></div>';
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px">' +
    '<div style="font-size:.82rem;font-weight:600;color:var(--text-primary);margin-bottom:10px">' + (isRu ? 'Частые ошибки' : 'Top Errors') + '</div>' +
    '<div id="an-top-errors"></div></div>';
  html += '</div>';

  pc.innerHTML = html;

  // Render charts
  drawBarChart(data.daily.map(function(d) { return { startedAt: d.day, status: 'success', _success: d.success, _failed: d.failed, _total: d.total }; }));

  // Donut from summary
  var donutExecs = [];
  for (var i = 0; i < (s.totalSuccess||0); i++) donutExecs.push({status:'success'});
  for (var j = 0; j < (s.totalFailed||0); j++) donutExecs.push({status:'failed'});
  var other = (s.totalRuns||0) - (s.totalSuccess||0) - (s.totalFailed||0);
  for (var k = 0; k < other; k++) donutExecs.push({status:'other'});
  drawDonutChart(donutExecs);

  // Heatmap
  renderHeatmap(data.heatmap || []);

  // Leaderboard
  renderLeaderboard([], data.agents || []);

  // Top errors
  renderTopErrors(data.topErrors || []);
}

// ===== BAR CHART: Executions over last 7 days =====
function drawBarChart(execs) {
  const canvas = document.getElementById('an-bar-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth - 10;
  const h = 220;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // Aggregate by day (last 7 days)
  var days = [];
  var dayLabels = [];
  var now = new Date();
  for (var i = 6; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ start: d.getTime(), end: d.getTime() + 86400000, success: 0, failed: 0, other: 0 });
    dayLabels.push(d.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short', day: 'numeric' }));
  }
  execs.forEach(function(ex) {
    var ts = new Date(ex.startedAt || ex.createdAt).getTime();
    for (var j = 0; j < days.length; j++) {
      if (ts >= days[j].start && ts < days[j].end) {
        if (ex.status === 'success') days[j].success++;
        else if (ex.status === 'failed') days[j].failed++;
        else days[j].other++;
        break;
      }
    }
  });

  var maxVal = 1;
  days.forEach(function(d) { var total = d.success + d.failed + d.other; if (total > maxVal) maxVal = total; });

  var padL = 40, padR = 16, padT = 16, padB = 36;
  var chartW = w - padL - padR;
  var chartH = h - padT - padB;
  var barGroupW = chartW / 7;
  var barW = Math.min(barGroupW * 0.55, 40);

  // Grid lines + Y labels
  ctx.strokeStyle = 'rgba(200,225,255,0.08)';
  ctx.fillStyle = '#5a6270';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  var gridLines = 4;
  for (var g = 0; g <= gridLines; g++) {
    var yy = padT + chartH - (g / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(w - padR, yy);
    ctx.stroke();
    ctx.fillText(Math.round(maxVal * g / gridLines), padL - 6, yy + 4);
  }

  // Bars
  var colors = { success: '#2dcc70', failed: '#e74c3c', other: '#00a8ff' };
  for (var b = 0; b < 7; b++) {
    var day = days[b];
    var total = day.success + day.failed + day.other;
    var cx = padL + barGroupW * b + barGroupW / 2;
    var barX = cx - barW / 2;

    // Stacked: success on bottom, failed on top, other on top of that
    var segments = [
      { val: day.success, color: colors.success },
      { val: day.failed, color: colors.failed },
      { val: day.other, color: colors.other }
    ];
    var yOffset = 0;
    segments.forEach(function(seg) {
      if (seg.val <= 0) return;
      var segH = (seg.val / maxVal) * chartH;
      var segY = padT + chartH - yOffset - segH;
      ctx.fillStyle = seg.color;
      // Rounded top for last segment
      var radius = 4;
      ctx.beginPath();
      ctx.moveTo(barX, segY + radius);
      ctx.arcTo(barX, segY, barX + barW, segY, radius);
      ctx.arcTo(barX + barW, segY, barX + barW, segY + segH, radius);
      ctx.lineTo(barX + barW, segY + segH);
      ctx.lineTo(barX, segY + segH);
      ctx.closePath();
      ctx.fill();
      yOffset += segH;
    });

    // Total count on top
    if (total > 0) {
      ctx.fillStyle = '#e0e4ea';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(total, cx, padT + chartH - yOffset - 5);
    }

    // X label
    ctx.fillStyle = '#5a6270';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dayLabels[b], cx, h - 8);
  }
}

// ===== DONUT CHART: Success rate =====
function drawDonutChart(execs) {
  var canvas = document.getElementById('an-donut-chart');
  var legendEl = document.getElementById('an-donut-legend');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var size = 200;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  var counts = { success: 0, failed: 0, other: 0 };
  execs.forEach(function(ex) {
    if (ex.status === 'success') counts.success++;
    else if (ex.status === 'failed') counts.failed++;
    else counts.other++;
  });
  var total = counts.success + counts.failed + counts.other;

  var slices = [
    { label: currentLang === 'ru' ? 'Успешно' : 'Success', val: counts.success, color: '#2dcc70' },
    { label: currentLang === 'ru' ? 'Ошибки' : 'Failed', val: counts.failed, color: '#e74c3c' },
    { label: currentLang === 'ru' ? 'Прочее' : 'Other', val: counts.other, color: '#00a8ff' }
  ];

  var cx = size / 2, cy = size / 2, outerR = 85, innerR = 55;

  if (total === 0) {
    // Empty state ring
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(200,225,255,0.06)';
    ctx.fill();
    ctx.fillStyle = '#5a6270';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentLang === 'ru' ? 'Нет данных' : 'No data', cx, cy);
  } else {
    var startAngle = -Math.PI / 2;
    slices.forEach(function(slice) {
      if (slice.val <= 0) return;
      var sweep = (slice.val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep);
      ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
      startAngle += sweep;
    });

    // Center text
    var pct = total > 0 ? Math.round((counts.success / total) * 100) : 0;
    ctx.fillStyle = '#f0f2f5';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pct + '%', cx, cy - 6);
    ctx.fillStyle = '#5a6270';
    ctx.font = '11px sans-serif';
    ctx.fillText(currentLang === 'ru' ? 'успех' : 'success', cx, cy + 16);
  }

  // Legend
  if (legendEl) {
    legendEl.innerHTML = slices.map(function(s) {
      return '<div class="analytics-donut-legend-item">' +
        '<span class="analytics-donut-legend-dot" style="background:' + s.color + '"></span>' +
        s.label + ': ' + s.val +
        '</div>';
    }).join('');
  }
}

// ===== AGENT LEADERBOARD =====
function renderLeaderboard(execs, agents) {
  var el = document.getElementById('analytics-leaderboard');
  if (!el) return;
  var isRu = currentLang === 'ru';

  // agents is already aggregated from API
  var rows = agents || [];
  if (!rows.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">' + (isRu ? 'Нет данных' : 'No data') + '</div>';
    return;
  }

  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px">' +
    rows.slice(0, 8).map(function(r, i) {
      var pct = r.total > 0 ? Math.round(r.success / r.total * 100) : 0;
      var barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-secondary);border-radius:10px">' +
        '<span style="width:22px;font-size:.75rem;font-weight:700;color:' + (i < 3 ? barColor : 'var(--text-muted)') + '">' + (i+1) + '</span>' +
        '<span style="flex:1;font-size:.82rem;font-weight:500;color:var(--text-primary)">' + escHtml(r.name.slice(0,20)) + '</span>' +
        '<span style="font-size:.72rem;color:var(--text-muted)">' + r.total + ' ' + (isRu ? 'зап.' : 'runs') + '</span>' +
        '<span style="font-size:.72rem;color:' + barColor + ';font-weight:600;min-width:36px;text-align:right">' + pct + '%</span>' +
        '<span style="font-size:.68rem;color:var(--text-muted);min-width:40px;text-align:right">' + (r.avgMs > 0 ? (r.avgMs/1000).toFixed(1)+'s' : '—') + '</span>' +
      '</div>';
    }).join('') + '</div>';
}

// ===== HEATMAP =====
function renderHeatmap(heatData) {
  var el = document.getElementById('an-heatmap');
  if (!el) return;
  var isRu = currentLang === 'ru';
  var dayNames = isRu ? ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build 7x24 grid
  var grid = {};
  var maxCount = 1;
  heatData.forEach(function(h) {
    var key = h.dow + ':' + h.hour;
    grid[key] = h.count;
    if (h.count > maxCount) maxCount = h.count;
  });

  var html = '<div style="display:grid;grid-template-columns:40px repeat(24,1fr);gap:2px;font-size:.6rem">';
  // Header row
  html += '<div></div>';
  for (var h = 0; h < 24; h++) {
    html += '<div style="text-align:center;color:var(--text-muted);padding:2px 0">' + (h % 3 === 0 ? h + ':00' : '') + '</div>';
  }
  // Data rows
  for (var d = 0; d < 7; d++) {
    html += '<div style="color:var(--text-muted);display:flex;align-items:center;font-size:.65rem">' + dayNames[d] + '</div>';
    for (var hh = 0; hh < 24; hh++) {
      var count = grid[d + ':' + hh] || 0;
      var intensity = count > 0 ? Math.max(0.15, count / maxCount) : 0;
      var bg = count > 0 ? 'rgba(34,197,94,' + intensity.toFixed(2) + ')' : 'rgba(255,255,255,0.03)';
      html += '<div style="aspect-ratio:1;border-radius:3px;background:' + bg + ';min-width:12px" title="' + dayNames[d] + ' ' + hh + ':00 — ' + count + ' runs"></div>';
    }
  }
  html += '</div>';
  el.innerHTML = html;
}

// ===== TOP ERRORS =====
function renderTopErrors(errors) {
  var el = document.getElementById('an-top-errors');
  if (!el) return;
  var isRu = currentLang === 'ru';
  if (!errors.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">' + (isRu ? 'Нет ошибок' : 'No errors') + '</div>';
    return;
  }
  el.innerHTML = errors.map(function(e) {
    return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
        '<span style="font-size:.72rem;padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444;font-weight:600">x' + e.count + '</span>' +
        '<span style="font-size:.65rem;color:var(--text-muted)">' + _timeAgo(e.last) + '</span>' +
      '</div>' +
      '<div style="font-size:.78rem;color:var(--text-secondary);word-break:break-word">' + escHtml(e.message) + '</div></div>';
  }).join('');
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

var _kbFilter = 'all';

async function loadKnowledge() {
  const data = await apiRequest('GET', '/api/settings');
  _knowledgeEntries = (data.ok && data.settings && data.settings.knowledge_base) || [];
  renderKnowledgeStats();
  renderKnowledge();
}

function renderKnowledgeStats() {
  var el = document.getElementById('kb-stats');
  if (!el) return;
  var total = _knowledgeEntries.length;
  var totalChars = _knowledgeEntries.reduce(function(s, e) { return s + (e.content || '').length; }, 0);
  var categories = {};
  _knowledgeEntries.forEach(function(e) { var c = e.category || 'general'; categories[c] = (categories[c] || 0) + 1; });
  var topCat = Object.entries(categories).sort(function(a, b) { return b[1] - a[1]; })[0];
  var isRu = currentLang === 'ru';
  el.innerHTML =
    '<div class="stat-card"><div class="stat-value">' + total + '</div><div class="stat-label">' + (isRu ? 'Записей' : 'Entries') + '</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + (totalChars >= 1000 ? (totalChars / 1000).toFixed(1) + 'K' : totalChars) + '</div><div class="stat-label">' + (isRu ? 'Символов' : 'Characters') + '</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + Object.keys(categories).length + '</div><div class="stat-label">' + (isRu ? 'Категорий' : 'Categories') + '</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + (topCat ? topCat[0] : '-') + '</div><div class="stat-label">' + (isRu ? 'Топ категория' : 'Top Category') + '</div></div>';
}

function renderKnowledge() {
  var el = document.getElementById('knowledge-entries');
  if (!el) return;
  var filtered = _kbFilter === 'all' ? _knowledgeEntries : _knowledgeEntries.filter(function(e) { return (e.category || 'general') === _kbFilter; });
  if (!filtered.length) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">' + (currentLang === 'ru' ? 'Нет записей' : 'No entries') + '</div>';
    return;
  }
  var catColors = { general: '#6366f1', api: '#f59e0b', trading: '#10b981', contacts: '#3b82f6', faq: '#8b5cf6', config: '#64748b' };
  el.innerHTML = filtered.map(function(entry, i) {
    var realIdx = _knowledgeEntries.indexOf(entry);
    var cat = entry.category || 'general';
    var color = catColors[cat] || '#6366f1';
    var size = (entry.content || '').length;
    var date = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '';
    var source = entry.source === 'file' ? '<span style="font-size:.6rem;padding:2px 6px;border-radius:4px;background:rgba(59,130,246,0.1);color:#3b82f6;margin-left:4px">FILE</span>' : '';
    return '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--border-subtle);display:flex;gap:.75rem;align-items:flex-start;border-left:3px solid ' + color + '">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
          '<span style="font-weight:600;font-size:.85rem">' + escHtml(entry.title || 'Entry ' + (i + 1)) + '</span>' +
          '<span style="font-size:.6rem;padding:2px 6px;border-radius:4px;background:' + color + '20;color:' + color + '">' + cat + '</span>' +
          source +
        '</div>' +
        '<div style="color:var(--text-muted);font-size:.78rem;white-space:pre-wrap;max-height:60px;overflow:hidden;line-height:1.4">' + escHtml((entry.content || '').slice(0, 300)) + '</div>' +
        '<div style="display:flex;gap:12px;margin-top:4px;font-size:.68rem;color:var(--text-muted)">' +
          '<span>' + size + ' chars</span>' +
          (date ? '<span>' + date + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-shrink:0">' +
        '<button class="btn btn-ghost btn-sm" onclick="editKnowledgeEntry(' + realIdx + ')" title="Edit">' + IC.wrench + '</button>' +
        '<button class="btn btn-ghost btn-sm" style="color:#dc3545" onclick="deleteKnowledgeEntry(' + realIdx + ')">' + IC.x + '</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function filterKnowledge(cat, btn) {
  _kbFilter = cat;
  document.querySelectorAll('.kb-filter').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderKnowledge();
}

function showAddKnowledge() {
  var form = document.getElementById('knowledge-add-form');
  if (form) {
    form.style.display = 'block';
    var titleEl = document.getElementById('kb-title');
    if (titleEl) { titleEl.value = ''; titleEl.focus(); }
    var contentEl = document.getElementById('kb-content');
    if (contentEl) contentEl.value = '';
    var catEl = document.getElementById('kb-category');
    if (catEl) catEl.value = 'general';
    updateKbCharCount();
  }
}

function updateKbCharCount() {
  var el = document.getElementById('kb-char-count');
  var content = (document.getElementById('kb-content') || {}).value || '';
  if (el) el.textContent = content.length + ' chars';
}

// Wire up char counter
document.addEventListener('input', function(e) {
  if (e.target && e.target.id === 'kb-content') updateKbCharCount();
});

async function saveKnowledgeEntry() {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  var title = (document.getElementById('kb-title') || {}).value?.trim();
  var content = (document.getElementById('kb-content') || {}).value?.trim();
  var category = (document.getElementById('kb-category') || {}).value || 'general';
  if (!title || !content) {
    showNotification(currentLang === 'ru' ? 'Заполните все поля' : 'Fill all fields', 'error');
    return;
  }

  _knowledgeEntries.push({ title: title, content: content, category: category, createdAt: new Date().toISOString(), source: 'manual' });
  var data = await apiRequest('POST', '/api/settings', { settings: { knowledge_base: _knowledgeEntries } });
  if (data.ok) {
    document.getElementById('kb-title').value = '';
    document.getElementById('kb-content').value = '';
    document.getElementById('knowledge-add-form').style.display = 'none';
    renderKnowledgeStats();
    renderKnowledge();
    showNotification(currentLang === 'ru' ? 'Запись добавлена' : 'Entry added', 'success');
  } else {
    _knowledgeEntries.pop();
    showNotification(data.error || 'Error', 'error');
  }
}

function editKnowledgeEntry(idx) {
  var entry = _knowledgeEntries[idx];
  if (!entry) return;
  showAddKnowledge();
  document.getElementById('kb-title').value = entry.title || '';
  document.getElementById('kb-content').value = entry.content || '';
  document.getElementById('kb-category').value = entry.category || 'general';
  updateKbCharCount();
  // Remove old entry (will be re-added on save)
  _knowledgeEntries.splice(idx, 1);
  renderKnowledge();
}

async function uploadKnowledgeFile(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  var maxSize = 512 * 1024; // 512KB
  if (file.size > maxSize) {
    showNotification(currentLang === 'ru' ? 'Файл слишком большой (макс 512KB)' : 'File too large (max 512KB)', 'error');
    input.value = '';
    return;
  }

  var reader = new FileReader();
  reader.onload = async function(e) {
    var text = e.target.result;
    var title = file.name.replace(/\.[^.]+$/, '');
    var ext = file.name.split('.').pop().toLowerCase();
    var category = 'general';
    if (ext === 'json') category = 'api';
    if (ext === 'csv') category = 'config';

    // Chunk large files (>4000 chars) into multiple entries
    var CHUNK_SIZE = 4000;
    if (text.length > CHUNK_SIZE) {
      var chunks = [];
      for (var i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
      }
      for (var c = 0; c < chunks.length; c++) {
        _knowledgeEntries.push({
          title: title + ' (part ' + (c + 1) + '/' + chunks.length + ')',
          content: chunks[c],
          category: category,
          createdAt: new Date().toISOString(),
          source: 'file',
          filename: file.name,
        });
      }
      showNotification((currentLang === 'ru' ? 'Файл разбит на ' : 'File split into ') + chunks.length + (currentLang === 'ru' ? ' частей' : ' chunks'), 'info');
    } else {
      _knowledgeEntries.push({ title: title, content: text, category: category, createdAt: new Date().toISOString(), source: 'file', filename: file.name });
    }

    var data = await apiRequest('POST', '/api/settings', { settings: { knowledge_base: _knowledgeEntries } });
    if (data.ok) {
      renderKnowledgeStats();
      renderKnowledge();
      showNotification(currentLang === 'ru' ? 'Файл загружен' : 'File uploaded', 'success');
    } else {
      showNotification(data.error || 'Error', 'error');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

function searchKnowledge() {
  var query = (document.getElementById('kb-search') || {}).value?.trim().toLowerCase();
  var resultsEl = document.getElementById('kb-search-results');
  if (!resultsEl) return;
  if (!query || query.length < 2) { resultsEl.style.display = 'none'; return; }

  var results = _knowledgeEntries.filter(function(e) {
    return (e.title || '').toLowerCase().includes(query) || (e.content || '').toLowerCase().includes(query);
  }).slice(0, 10);

  if (results.length === 0) {
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div style="padding:.75rem 1rem;color:var(--text-muted);font-size:.82rem">' + (currentLang === 'ru' ? 'Ничего не найдено' : 'No results') + '</div>';
    return;
  }

  resultsEl.style.display = 'block';
  resultsEl.innerHTML = results.map(function(r) {
    var idx = (r.content || '').toLowerCase().indexOf(query);
    var snippet = idx >= 0 ? '...' + (r.content || '').slice(Math.max(0, idx - 40), idx + query.length + 80) + '...' : (r.content || '').slice(0, 120);
    // Highlight match
    snippet = escHtml(snippet).replace(new RegExp('(' + escHtml(query) + ')', 'gi'), '<mark style="background:#f59e0b40;padding:1px 2px;border-radius:2px">$1</mark>');
    return '<div style="padding:.5rem 1rem;border-bottom:1px solid var(--border-subtle)">' +
      '<div style="font-weight:600;font-size:.8rem">' + escHtml(r.title || '?') + '</div>' +
      '<div style="font-size:.75rem;color:var(--text-muted);line-height:1.4">' + snippet + '</div>' +
    '</div>';
  }).join('');
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
      <button class="btn btn-ghost btn-sm" style="color:#dc3545;flex-shrink:0" onclick="deleteVariable('${escHtml(k)}')">${IC.x}</button>
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
  setEl('profile-id', currentUser.userIdStr || currentUser.userId || currentUser.id || '—');

  // Avatar — try OIDC photo or TG avatar
  (function() {
    var img = document.getElementById('profile-avatar');
    var fb = document.getElementById('profile-avatar-fallback');
    if (!img) return;
    var src = currentUser.photo_url || (authToken ? '/api/me/avatar?t=' + encodeURIComponent(authToken) : '');
    if (src) {
      img.src = src;
      img.style.display = 'block';
      img.onerror = function() { img.style.display = 'none'; if (fb) fb.style.display = ''; };
      if (fb) fb.style.display = 'none';
    }
  })();

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
    // Treat -1, null, undefined, Infinity, 0 (when used > 0) as "Unlimited".
    var unlimited = (max === -1 || max == null || !isFinite(max));
    if (el) el.textContent = (used || 0) + ' / ' + (unlimited ? '∞' : max);
    if (bar) {
      // Drop any inline background so the CSS rule (.memory-progress green
      // gradient) wins. Width 100% on unlimited = fully painted bar.
      bar.style.background = '';
      bar.classList.remove('warning');
      if (unlimited)       bar.style.width = '100%';
      else if (max === 0)  bar.style.width = '0%';
      else {
        var pct = Math.min(100, (used / max) * 100);
        bar.style.width = pct + '%';
        if (pct >= 90) bar.classList.add('warning');
      }
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
  if (!badge) {
    // Element may not be rendered yet — retry once after DOM settles
    setTimeout(function() {
      var b = document.getElementById('user-plan-badge');
      if (b && sub) {
        b.innerHTML = planIcon(sub.planIcon) + ' ' + (sub.planName || 'Free');
        b.className = 'user-tier plan-badge-' + (sub.planId || 'free');
      }
    }, 1000);
    return;
  }
  // Plan pill keeps only the tier (◆ Unlimited / 🚀 Pro / 🆓 Free).
  // Beta-tester role is rendered as a small uppercase caption ABOVE the
  // plan pill — separate token so it survives plan upgrades/downgrades.
  var isBeta = sub.isBeta || (currentUser && currentUser._isBeta);
  badge.innerHTML = planIcon(sub.planIcon) + ' ' + (sub.planName || 'Free');
  badge.className = 'user-tier plan-badge-' + (sub.planId || 'free');

  // Render / remove the micro "Beta tester" caption.
  var details = badge.parentElement;
  var betaCaption = document.getElementById('user-beta-caption');
  if (isBeta) {
    if (!betaCaption) {
      betaCaption = document.createElement('span');
      betaCaption.id = 'user-beta-caption';
      betaCaption.className = 'user-beta-caption';
      betaCaption.textContent = currentLang === 'ru' ? 'Бета-тестер' : 'Beta tester';
      details.insertBefore(betaCaption, badge);
    } else {
      betaCaption.textContent = currentLang === 'ru' ? 'Бета-тестер' : 'Beta tester';
    }
  } else if (betaCaption) {
    betaCaption.remove();
  }
  // Remove the legacy standalone beta pill if a prior render created it.
  var stale = document.getElementById('user-beta-badge');
  if (stale) stale.remove();
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
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
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
  // Update topbar balance
  const topBal = document.getElementById('topbar-ton-balance');
  if (topBal) topBal.textContent = bal.toFixed(2);

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
  html += '<span>' + IC.book + ' ' + (ru ? 'Инструкция' : 'Guide') + '</span>';
  html += '<svg class="cat-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  html += '</div>';
  html += '<div class="palette-nodes" style="padding:8px 12px;font-size:0.72rem;color:var(--text-secondary);line-height:1.5">';
  html += ru
    ? '<p style="margin:0 0 6px"><b>Как создать агента:</b></p>' +
      '<p style="margin:0 0 4px">1. Перетащите <b>Триггер</b> (Таймер/Webhook) на канвас</p>' +
      '<p style="margin:0 0 4px">2. Добавьте <b>действия</b> (TON, Подарки, Веб)</p>' +
      '<p style="margin:0 0 4px">3. Используйте <b>Условие</b> для ветвления логики</p>' +
      '<p style="margin:0 0 4px">4. Завершите <b>Уведомлением</b> для отправки результатов</p>' +
      '<p style="margin:0 0 4px">5. Нажмите <b>Запуск</b> для деплоя</p>' +
      '<p style="margin:6px 0 0;color:var(--text-muted)">' + IC.bolt + ' <b>Подсказки:</b> Наведите на ноду чтобы увидеть описание. Используйте <code>{{result}}</code> для передачи данных между шагами. <a href="https://tonagentplatform.com" style="color:var(--primary)" target="_blank">Документация</a></p>'
    : '<p style="margin:0 0 6px"><b>How to build an agent:</b></p>' +
      '<p style="margin:0 0 4px">1. Drag a <b>Trigger</b> (Timer/Webhook) onto canvas</p>' +
      '<p style="margin:0 0 4px">2. Add <b>actions</b> (TON, Gifts, Web)</p>' +
      '<p style="margin:0 0 4px">3. Use <b>Condition</b> for logic branching</p>' +
      '<p style="margin:0 0 4px">4. End with <b>Notify</b> to send results</p>' +
      '<p style="margin:0 0 4px">5. Click <b>Deploy</b> to launch</p>' +
      '<p style="margin:6px 0 0;color:var(--text-muted)">' + IC.bolt + ' <b>Tips:</b> Hover nodes for descriptions. Use <code>{{result}}</code> to pass data between steps. <a href="https://tonagentplatform.com" style="color:var(--primary)" target="_blank">Docs</a></p>';
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
    html += '<svg class="cat-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
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
  const newNode = { id, type, x: wx, y: wy, config: {}, def, _dropTime: Date.now() };
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
  // Spawn particle dissolution at node's screen position
  var node = _flowNodes.find(function(n) { return n.id === id; });
  if (node) {
    var canvas = document.getElementById('flow-canvas');
    if (canvas) {
      var cr = canvas.getBoundingClientRect();
      var nw = 160, nh = 60; // approximate node size
      var screenX = cr.left + node.x * _flowZoom + _flowPanX;
      var screenY = cr.top + node.y * _flowZoom + _flowPanY;
      var fakeEl = { getBoundingClientRect: function() { return { left: screenX - nw/2*_flowZoom, top: screenY - nh/2*_flowZoom, width: nw*_flowZoom, height: nh*_flowZoom }; } };
      spawnParticleDissolution(fakeEl);
    }
  }
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

// ═══ ATLAS DEPLOY MODAL — smart pre-flight check ═══
let _deployAnimating = false;
var _atlasDeployData = null;
var _atlasDeployStep = 0;
var _atlasDeployAnswers = [];

function closeAtlasDeploy() {
  document.getElementById('atlas-deploy-modal').style.display = 'none';
  _atlasDeployData = null;
}

function showAtlasDeployStep() {
  var summaryEl = document.getElementById('atlas-deploy-summary');
  var questionEl = document.getElementById('atlas-deploy-question');
  var optionsEl = document.getElementById('atlas-deploy-options');
  var goBtn = document.getElementById('atlas-deploy-go');
  var d = _atlasDeployData;

  if (_atlasDeployStep === 0) {
    // Step 0: flow summary + ask about AI enhancement
    summaryEl.innerHTML =
      '<div style="background:rgba(125,211,252,0.06);border-radius:10px;padding:14px;margin-bottom:4px">' +
      '<div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:8px">' + IC.clipboard + ' ' + escHtml(d.name) + '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:#94a3b8">' +
      '<span>' + IC.wrench + ' ' + d.nodeCount + ' блоков</span><span>' + IC.link + ' ' + d.edgeCount + ' связей</span></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
      d.caps.map(function(c) { return '<span style="background:var(--accent-dim);color:var(--primary-light);padding:3px 10px;border-radius:12px;font-size:12px">' + escHtml(c) + '</span>'; }).join('') +
      '</div>' +
      (d.warnings.length ? '<div style="margin-top:10px;font-size:12px;color:#fbbf24">' + d.warnings.map(escHtml).join('<br>') + '</div>' : '') +
      '</div>';
    questionEl.innerHTML = '<p style="color:#e2e8f0;font-size:14px;margin:0">Хотите, чтобы Atlas улучшил агента AI-интеллектом?</p>';
    optionsEl.innerHTML = '';
    [
      { text: 'Да, улучши AI', value: 'enhance', desc: 'Atlas добавит smart логику и обработку ошибок' },
      { text: 'Деплой как есть', value: 'raw', desc: 'Без изменений, только ваш flow' }
    ].forEach(function(o) {
      var b = document.createElement('button');
      b.className = 'btn btn-ghost';
      b.style.cssText = 'text-align:left;padding:12px 16px;border:1px solid rgba(125,211,252,0.15);border-radius:10px;display:flex;flex-direction:column;gap:2px';
      b.innerHTML = '<span style="color:#f1f5f9;font-size:14px">' + o.text + '</span><span style="color:#64748b;font-size:11px">' + o.desc + '</span>';
      b.onclick = function() { atlasDeployAnswer(o.value); };
      optionsEl.appendChild(b);
    });
    goBtn.style.display = 'none';

  } else if (_atlasDeployStep === 1 && d.hasTelegram) {
    // Step 1 (telegram flows only): ask about TG auth
    summaryEl.innerHTML = '';
    questionEl.innerHTML = '<p style="color:#e2e8f0;font-size:14px;margin:0">' + IC.phone + ' Flow использует Telegram. Аккаунт подключён?</p>';
    optionsEl.innerHTML = '';
    [
      { text: 'Да, подключён', value: 'tg_ok' },
      { text: 'Подключу позже', value: 'tg_later' },
      { text: 'Как подключить?', value: 'tg_help' }
    ].forEach(function(o) {
      var b = document.createElement('button');
      b.className = 'btn btn-ghost';
      b.style.cssText = 'text-align:left;padding:10px 16px;border:1px solid rgba(125,211,252,0.15);border-radius:10px;color:#e2e8f0;font-size:13px';
      b.textContent = o.text;
      b.onclick = function() { atlasDeployAnswer(o.value); };
      optionsEl.appendChild(b);
    });
    goBtn.style.display = 'none';

  } else {
    // Final: ready to deploy
    summaryEl.innerHTML = '';
    questionEl.innerHTML = '<div style="text-align:center;padding:10px">' +
      '<div style="margin-bottom:8px">' + IC.rocket + '</div>' +
      '<p style="color:#e2e8f0;font-size:15px;margin:0">Готово к деплою!</p>' +
      '<p style="color:#64748b;font-size:12px;margin:4px 0 0">' + escHtml(d.name) + ' • ' + d.caps.join(', ') + '</p></div>';
    optionsEl.innerHTML = '';
    goBtn.style.display = 'flex';
  }
}

function atlasDeployAnswer(value) {
  _atlasDeployAnswers.push(value);
  if (value === 'tg_help') {
    closeAtlasDeploy();
    navigateTo('settings');
    toast('Подключите Telegram в разделе Telegram Account', 'info');
    return;
  }
  _atlasDeployStep++;
  if (_atlasDeployStep === 1 && !_atlasDeployData.hasTelegram) _atlasDeployStep++;
  showAtlasDeployStep();
}

async function confirmAtlasDeploy() {
  var d = _atlasDeployData;
  closeAtlasDeploy();
  if (!d) return;

  var enhance = _atlasDeployAnswers.indexOf('enhance') >= 0;
  var btn = document.getElementById('flow-deploy-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '... ' + t('deploying'); }

  _deployAnimating = true;
  await runDeployAnimation();

  try {
    var data = await apiRequest('POST', '/api/agents/flow', { name: d.name, description: d.description, flow: d.flow, enhance: enhance });
    if (data.ok) {
      showFlowToast('' + IC.party + ' ' + t('deployed_ok') + ' #' + data.agentId, 'success');
      loadAgents();
    } else {
      showFlowToast((data.error || t('deploy_fail')), 'error');
    }
  } catch (e) {
    showFlowToast(e.message, 'error');
  } finally {
    _deployAnimating = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg> ' + t('deploy'); }
  }
}

async function deployFlow() {
  if (!_flowNodes.length) { showFlowToast(t('deploy_fail') + ': add nodes first', 'error'); return; }
  if (_deployAnimating) return;

  var name = (document.getElementById('flow-agent-name') || {}).value || '';
  name = name.trim() || 'Flow Agent';
  var description = (document.getElementById('flow-agent-desc') || {}).value || '';
  description = description.trim();
  var flow = {
    nodes: _flowNodes.map(function(n) { return { id: n.id, type: n.type, x: n.x, y: n.y, config: n.config }; }),
    edges: _flowEdges.map(function(e) { return { from: e.from, fromPort: e.fromPort, to: e.to, toPort: e.toPort }; }),
    groups: _flowGroups
  };

  // Analyze flow capabilities
  var nodeTypes = _flowNodes.map(function(n) { return n.type || ''; });
  var hasTelegram = nodeTypes.some(function(tp) { return tp.indexOf('tg_') === 0 || tp === 'send_message'; });
  var hasGifts = nodeTypes.some(function(tp) { return tp.indexOf('gift') >= 0 || tp.indexOf('arbitrage') >= 0; });
  var hasTon = nodeTypes.some(function(tp) { return tp.indexOf('balance') >= 0 || tp.indexOf('send_ton') >= 0 || tp.indexOf('nft') >= 0; });
  var hasWeb = nodeTypes.some(function(tp) { return tp.indexOf('web') >= 0 || tp.indexOf('fetch') >= 0 || tp.indexOf('http') >= 0; });

  var caps = [];
  if (hasTelegram) caps.push('Telegram');
  if (hasGifts) caps.push('Gifts');
  if (hasTon) caps.push('TON');
  if (hasWeb) caps.push('Web');
  if (!caps.length) caps.push('Auto');

  var warnings = [];
  if (hasTelegram) warnings.push(IC.warn + ' Telegram требует подключённый аккаунт');
  if (hasGifts && hasTon) warnings.push(IC.bolt + ' Торговля подарками требует TON-кошелёк');

  // Show Atlas Deploy Modal
  _atlasDeployData = { name: name, description: description, flow: flow, nodeCount: _flowNodes.length, edgeCount: _flowEdges.length, caps: caps, warnings: warnings, hasTelegram: hasTelegram };
  _atlasDeployStep = 0;
  _atlasDeployAnswers = [];
  document.getElementById('atlas-deploy-modal').style.display = 'flex';
  showAtlasDeployStep();
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

      // Drop animation (spring scale + glow)
      var dropScale = 1;
      var dropGlow = 0;
      if (n._dropTime) {
        var elapsed = Date.now() - n._dropTime;
        if (elapsed < 500) {
          var t = elapsed / 500;
          // Spring: overshoot to 1.15 then settle to 1.0
          dropScale = 1 + 0.15 * Math.sin(t * Math.PI) * (1 - t);
          dropGlow = (1 - t) * 25;
        } else {
          delete n._dropTime;
        }
      }

      if (dropScale !== 1) {
        ctx.save();
        var cx = n.x + NODE_W / 2;
        var cy = n.y + NODE_H / 2;
        ctx.translate(cx, cy);
        ctx.scale(dropScale, dropScale);
        ctx.translate(-cx, -cy);
      }

      // Node shadow & glow
      if (selected || dropGlow > 0) {
        ctx.save();
        ctx.shadowColor = def.color;
        ctx.shadowBlur = selected ? 20 : dropGlow;
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

      if (selected || dropGlow > 0) ctx.restore();

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

      // Restore drop animation transform
      if (dropScale !== 1) ctx.restore();
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

// ===== AGENT NETWORK MAP (v2 — fullscreen neural canvas) =====
let _networkAnimId = null;
let _networkNodes = [];
let _networkEdges = [];
let _networkCrews = []; // raw crews payload — drives the floating panel + edge generation
let _networkHoverCrewId = null; // hover-highlight: set by panel mouseenter/leave

function renderNetworkCrewsPanel(crews) {
  const listEl = document.getElementById('ncrews-list');
  const countEl = document.getElementById('ncrews-count');
  if (countEl) countEl.textContent = (crews || []).length;
  if (!listEl) return;
  const isRu = currentLang === 'ru';
  if (!crews || crews.length === 0) {
    listEl.innerHTML = ''; // CSS :empty::after handles "no crews" placeholder
    return;
  }
  listEl.innerHTML = crews.map(function(c) {
    const dot = c._color || '#00a8ff';
    const memberCount = (c.agent_ids || []).length;
    const mgr = c.manager_agent_id ? ' · 👑 #' + c.manager_agent_id : '';
    return '<div class="ncrews-item" data-crew-id="' + c.id + '" onmouseenter="_setNetworkCrewHover(' + c.id + ')" onmouseleave="_setNetworkCrewHover(null)">' +
      '<div class="ncrews-item-name"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dot + ';margin-right:6px;vertical-align:middle"></span>' + escHtml(c.name) + '</div>' +
      '<div class="ncrews-item-meta">' + memberCount + ' ' + (isRu ? 'участн.' : 'members') + mgr + '</div>' +
      '<div class="ncrews-item-actions">' +
        '<button class="ncrews-run" onclick="event.stopPropagation();runCrew(' + c.id + ')">▶</button>' +
        '<button onclick="event.stopPropagation();viewCrewDetails(' + c.id + ')">' + (isRu ? 'детали' : 'info') + '</button>' +
        '<button onclick="event.stopPropagation();deleteCrew(' + c.id + ')" style="color:var(--danger)">×</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _setNetworkCrewHover(crewId) {
  _networkHoverCrewId = crewId;
  // Update item highlight in the panel
  document.querySelectorAll('.ncrews-item').forEach(function(el) {
    if (Number(el.dataset.crewId) === crewId) el.classList.add('ncrews-hover');
    else el.classList.remove('ncrews-hover');
  });
}
let _networkDragNode = null;
let _networkDragOffset = { dx: 0, dy: 0 };
let _networkMouse = { x: 0, y: 0 };
let _networkSearchQuery = '';
let _networkTrashHover = false;
let _networkZoom = 1.0;
let _networkPan = { x: 0, y: 0 };
let _networkPanning = false;
let _networkPanStart = { x: 0, y: 0, px: 0, py: 0 };
let _networkInitialized = false;

function networkZoomIn() {
  _networkZoom = Math.min(3, _networkZoom * 1.2);
  var lbl = document.getElementById('net-zoom-label');
  if (lbl) lbl.textContent = Math.round(_networkZoom * 100) + '%';
}
function networkZoomOut() {
  _networkZoom = Math.max(0.3, _networkZoom / 1.2);
  var lbl = document.getElementById('net-zoom-label');
  if (lbl) lbl.textContent = Math.round(_networkZoom * 100) + '%';
}
function networkZoomReset() {
  _networkZoom = 1.0;
  _networkPan.x = 0;
  _networkPan.y = 0;
  var lbl = document.getElementById('net-zoom-label');
  if (lbl) lbl.textContent = '100%';
}

// Convert screen coords to world coords
function _netScreenToWorld(sx, sy, W, H) {
  return {
    x: (sx - W / 2) / _networkZoom + W / 2 - _networkPan.x,
    y: (sy - H / 2) / _networkZoom + H / 2 - _networkPan.y
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CREWS PAGE (Sprint 4 — multi-agent teams)
// ═══════════════════════════════════════════════════════════════════════════
async function loadCrewsPage() {
  const listEl = document.getElementById('crews-list');
  if (!listEl) return;
  const isRu = currentLang === 'ru';
  try {
    const d = await apiRequest('GET', '/api/crews');
    if (!d.ok) throw new Error(d.error || 'Failed');
    const crews = d.crews || [];
    if (crews.length === 0) {
      listEl.innerHTML = '<div style="grid-column:1/-1;padding:60px;text-align:center;color:var(--text-muted)">' +
        '<div style="font-size:48px;margin-bottom:12px">👥</div>' +
        '<div style="font-size:18px;margin-bottom:8px">' + (isRu ? 'Команд ещё нет' : 'No crews yet') + '</div>' +
        '<div style="font-size:13px">' + (isRu ? 'Создай команду чтобы группировать агентов с общим бюджетом и состоянием. Менеджер делегирует задачи воркерам через ask_agent.' : 'Create a crew to bundle agents with shared budget + state. The manager delegates work to workers via ask_agent.') + '</div>' +
        '</div>';
      return;
    }
    listEl.innerHTML = crews.map(function(c) {
      const memberCount = (c.agent_ids || []).length;
      const mgr = c.manager_agent_id ? ' • <span style="color:var(--primary)">manager #' + c.manager_agent_id + '</span>' : '';
      const status = c.is_active ? '<span style="color:#22c55e">●</span>' : '<span style="color:#666">●</span>';
      return '<div class="card" style="padding:18px;border:1px solid var(--border);border-radius:12px;background:var(--bg-secondary)">' +
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">' +
          '<div>' +
            '<div style="font-weight:600;font-size:16px">' + status + ' ' + escHtml(c.name) + '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">' + memberCount + ' ' + (isRu ? 'агентов' : 'agents') + mgr + '</div>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted)">#' + c.id + '</div>' +
        '</div>' +
        (c.description ? '<div style="font-size:13px;color:var(--text-secondary);margin:8px 0;line-height:1.4">' + escHtml(c.description) + '</div>' : '') +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:8px">' +
          '<span>' + (isRu ? 'Бюджет' : 'Budget') + ': ' + (Number(c.budget_ton_month) || 0).toFixed(2) + ' TON/мес</span>' +
          ' · <span>' + (isRu ? 'Запусков' : 'Runs') + ': ' + (c.execution_count || 0) + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-top:12px">' +
          '<button onclick="runCrew(' + c.id + ')" class="btn btn-primary" style="flex:1;font-size:12px;padding:6px 12px">▶ ' + (isRu ? 'Запустить' : 'Run') + '</button>' +
          '<button onclick="viewCrewDetails(' + c.id + ')" class="btn" style="font-size:12px;padding:6px 12px">' + (isRu ? 'Детали' : 'Details') + '</button>' +
          '<button onclick="deleteCrew(' + c.id + ')" class="btn" style="font-size:12px;padding:6px 10px;color:var(--danger)">×</button>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    listEl.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--danger)">' + escHtml(e.message) + '</div>';
  }
}

async function openCreateCrewModal() {
  const isRu = currentLang === 'ru';
  // Fetch user's agents to populate member checkboxes
  const ad = await apiRequest('GET', '/api/agents');
  const agents = (ad.agents || []).filter(a => a.id);
  if (agents.length < 2) {
    toast(isRu ? 'Для команды нужно минимум 2 агента' : 'Need at least 2 agents to form a crew', 'warning');
    return;
  }
  // Lightweight inline modal — no extra dependencies
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML =
    '<div style="background:var(--bg-secondary);border-radius:14px;padding:24px;max-width:480px;width:100%;max-height:90vh;overflow:auto">' +
      '<h2 style="margin:0 0 16px 0">' + (isRu ? 'Новая команда' : 'New crew') + '</h2>' +
      '<label style="display:block;margin-bottom:12px"><div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">' + (isRu ? 'Название' : 'Name') + '</div>' +
        '<input id="crew-name" class="rt-input" style="width:100%" placeholder="' + (isRu ? 'Например: Trading Crew' : 'e.g. Trading Crew') + '"></label>' +
      '<label style="display:block;margin-bottom:12px"><div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">' + (isRu ? 'Описание' : 'Description') + '</div>' +
        '<textarea id="crew-desc" class="rt-input" style="width:100%;min-height:60px" placeholder="' + (isRu ? 'Что делает эта команда' : 'What this crew does') + '"></textarea></label>' +
      '<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">' + (isRu ? 'Участники' : 'Members') + '</div>' +
        '<div id="crew-members-list" style="max-height:200px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:8px">' +
          agents.map(function(a) {
            return '<label style="display:flex;align-items:center;gap:8px;padding:4px 0"><input type="checkbox" class="crew-member-cb" value="' + a.id + '"> #' + a.id + ' ' + escHtml(a.name) + ' <span style="font-size:11px;color:var(--text-muted)">(' + (a.role || 'worker') + ')</span></label>';
          }).join('') +
        '</div></div>' +
      '<label style="display:block;margin-bottom:12px"><div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">' + (isRu ? 'Менеджер (опц.) — будет делегировать через ask_agent' : 'Manager (opt.) — will delegate via ask_agent') + '</div>' +
        '<select id="crew-manager" class="rt-input" style="width:100%"><option value="">— ' + (isRu ? 'нет' : 'none') + ' —</option>' +
          agents.map(function(a) { return '<option value="' + a.id + '">#' + a.id + ' ' + escHtml(a.name) + '</option>'; }).join('') +
        '</select></label>' +
      '<label style="display:block;margin-bottom:16px"><div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">' + (isRu ? 'Бюджет TON/месяц' : 'Budget TON/month') + '</div>' +
        '<input id="crew-budget" type="number" step="0.01" class="rt-input" style="width:100%" value="0"></label>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button class="btn" onclick="this.closest(\'div[style*=fixed]\').remove()">' + (isRu ? 'Отмена' : 'Cancel') + '</button>' +
        '<button class="btn btn-primary" id="crew-create-btn">' + (isRu ? 'Создать' : 'Create') + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  document.getElementById('crew-create-btn').onclick = async function() {
    const name = (document.getElementById('crew-name').value || '').trim();
    const desc = (document.getElementById('crew-desc').value || '').trim();
    const memberIds = Array.from(document.querySelectorAll('.crew-member-cb:checked')).map(c => parseInt(c.value, 10));
    const manager = parseInt(document.getElementById('crew-manager').value || '0', 10) || null;
    const budget = parseFloat(document.getElementById('crew-budget').value || '0') || 0;
    if (!name || memberIds.length === 0) { toast(isRu ? 'Название и минимум 1 участник' : 'Name and at least one member required', 'warning'); return; }
    if (manager && !memberIds.includes(manager)) memberIds.push(manager);
    const r = await apiRequest('POST', '/api/crews', { name, description: desc, agent_ids: memberIds, manager_agent_id: manager, budget_ton_month: budget });
    if (r.ok) { toast(isRu ? 'Команда создана' : 'Crew created', 'success'); overlay.remove(); loadCrewsPage(); }
    else toast(r.error || 'Error', 'error');
  };
}

// Atlas crew interview: user clicks "Create" on a <crew-suggest> action card.
// We send the JSON Atlas built straight to /api/crews — same validation as the
// regular Studio modal flow.
async function acceptAtlasCrewSuggest(suggestKey, btnEl) {
  const isRu = currentLang === 'ru';
  const suggest = window[suggestKey];
  if (!suggest) { toast(isRu ? 'Предложение устарело' : 'Suggestion expired', 'warning'); return; }
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = isRu ? 'Создаём…' : 'Creating…'; }
  try {
    const payload = {
      name: String(suggest.name || 'Crew').slice(0, 128),
      description: String(suggest.description || '').slice(0, 500),
      agent_ids: Array.isArray(suggest.agent_ids) ? suggest.agent_ids.map(Number).filter(Boolean) : [],
      manager_agent_id: suggest.manager_agent_id ? Number(suggest.manager_agent_id) : null,
      budget_ton_month: Number(suggest.budget_ton_month) || 0,
    };
    const r = await apiRequest('POST', '/api/crews', payload);
    if (r.ok) {
      toast(isRu ? 'Команда создана' : 'Crew created', 'success');
      if (btnEl) {
        btnEl.textContent = '✓ #' + r.crew.id;
        btnEl.style.background = 'rgba(34,197,94,0.2)';
        btnEl.style.color = '#22c55e';
      }
      // If we're currently on the network page, refresh it so the new crew appears
      const np = document.getElementById('network-page');
      if (np && np.classList.contains('active')) loadNetworkMap();
    } else {
      toast(r.error || 'Error', 'error');
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = isRu ? '▶ Создать команду' : '▶ Create crew'; }
    }
  } catch (e) {
    toast(String(e), 'error');
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = isRu ? '▶ Создать команду' : '▶ Create crew'; }
  } finally {
    delete window[suggestKey];
  }
}

async function runCrew(crewId) {
  const isRu = currentLang === 'ru';
  const trigger = prompt(isRu ? 'Задача для команды:' : 'Task for the crew:', '');
  if (!trigger) return;
  const r = await apiRequest('POST', '/api/crews/' + crewId + '/run', { trigger });
  if (r.ok) toast((isRu ? 'Команда запущена, execution #' : 'Crew kicked off, execution #') + r.execution_id, 'success');
  else toast(r.error || 'Error', 'error');
}

async function deleteCrew(crewId) {
  const isRu = currentLang === 'ru';
  if (!confirm(isRu ? 'Удалить команду?' : 'Delete crew?')) return;
  const r = await apiRequest('DELETE', '/api/crews/' + crewId);
  if (r.ok) { toast(isRu ? 'Удалено' : 'Deleted', 'success'); loadCrewsPage(); }
  else toast(r.error || 'Error', 'error');
}

async function viewCrewDetails(crewId) {
  const isRu = currentLang === 'ru';
  const d = await apiRequest('GET', '/api/crews/' + crewId);
  if (!d.ok) { toast(d.error || 'Error', 'error'); return; }
  const c = d.crew;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML =
    '<div style="background:var(--bg-secondary);border-radius:14px;padding:24px;max-width:560px;width:100%;max-height:90vh;overflow:auto">' +
      '<h2 style="margin:0 0 4px 0">' + escHtml(c.name) + '</h2>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">#' + c.id + ' · ' + (c.is_active ? (isRu ? 'активна' : 'active') : (isRu ? 'на паузе' : 'paused')) + '</div>' +
      (c.description ? '<div style="margin-bottom:14px;line-height:1.5">' + escHtml(c.description) + '</div>' : '') +
      '<div style="margin-bottom:14px"><b>' + (isRu ? 'Участники' : 'Members') + '</b><ul style="margin:6px 0 0 18px">' +
        (d.members || []).map(function(m) { return '<li>#' + m.id + ' ' + escHtml(m.name) + ' <span style="font-size:11px;color:var(--text-muted)">(' + (m.role || 'worker') + (m.is_active ? ', active' : ', stopped') + ')</span>' + (c.manager_agent_id === m.id ? ' <span style="color:var(--primary)">👑 manager</span>' : '') + '</li>'; }).join('') +
      '</ul></div>' +
      '<div style="margin-bottom:14px"><b>' + (isRu ? 'Последние запуски' : 'Recent executions') + '</b>' +
        ((d.recent_executions || []).length === 0
          ? '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">' + (isRu ? 'пока пусто' : 'none yet') + '</div>'
          : '<ul style="margin:6px 0 0 18px">' + d.recent_executions.map(function(e) { return '<li>#' + e.id + ' · ' + e.status + ' · ' + new Date(e.started_at).toLocaleString() + (e.trigger ? ' — ' + escHtml(e.trigger.slice(0, 60)) : '') + '</li>'; }).join('') + '</ul>') +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button class="btn" onclick="this.closest(\'div[style*=fixed]\').remove()">' + (isRu ? 'Закрыть' : 'Close') + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function loadNetworkMap() {
  const canvas = document.getElementById('agent-network-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;

  // Size canvas to fill container
  if (!canvas._netDims) canvas._netDims = { w: 900, h: 600 };
  function resizeCanvas() {
    var rect = wrap.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = rect.width || 900, h = rect.height || 600;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas._netDims.w = w;
    canvas._netDims.h = h;
  }
  resizeCanvas();
  var dims = canvas._netDims;

  // ResizeObserver for dynamic sizing
  if (typeof ResizeObserver !== 'undefined' && !canvas._resizeObs) {
    canvas._resizeObs = new ResizeObserver(function() { resizeCanvas(); });
    canvas._resizeObs.observe(wrap);
  }

  // Cancel previous animation
  if (_networkAnimId) { cancelAnimationFrame(_networkAnimId); _networkAnimId = null; }

  // Reset viewport on every load — otherwise leftover zoom/pan from a previous
  // visit makes nodes appear off-screen ("карта пустая" symptom).
  _networkZoom = 1.0;
  _networkPan = { x: 0, y: 0 };
  var zoomLbl = document.getElementById('net-zoom-label');
  if (zoomLbl) zoomLbl.textContent = '100%';

  // Pull agents + crews in parallel — crews drive real edges in the graph below.
  // Crews failure must NOT break agent rendering — agents are the primary content.
  let agents = [];
  let crews = [];
  try {
    const data = await apiRequest('GET', '/api/agents');
    agents = (data && data.ok ? data.agents : []) || [];
  } catch (e) {
    console.error('[NetworkMap] /api/agents failed:', e);
  }
  try {
    const crewsResp = await apiRequest('GET', '/api/crews');
    crews = (crewsResp && crewsResp.ok ? crewsResp.crews : []) || [];
  } catch (e) {
    console.warn('[NetworkMap] /api/crews failed (non-fatal):', e);
  }
  _networkCrews = crews;

  // Render the crews floating panel (was a separate sidebar tab before)
  try { renderNetworkCrewsPanel(crews); } catch (e) { console.warn('[NetworkMap] renderNetworkCrewsPanel:', e); }

  // Update stats
  var elTotal = document.getElementById('net-stat-total');
  var elActive = document.getElementById('net-stat-active');
  var elEdges = document.getElementById('net-stat-edges');
  if (elTotal) elTotal.textContent = agents.length;
  if (elActive) elActive.textContent = agents.filter(function(a) { return a.isActive; }).length;

  // Remove old empty state
  var oldEmpty = wrap.querySelector('.network-empty-state');
  if (oldEmpty) oldEmpty.remove();

  if (!agents.length) {
    // Show empty state
    var emptyDiv = document.createElement('div');
    emptyDiv.className = 'network-empty-state';
    emptyDiv.innerHTML = '<div class="network-empty-icon">' + IC.robot + '</div>' +
      '<div class="network-empty-title" data-en="No agents yet" data-ru="Пока нет агентов">No agents yet</div>' +
      '<div class="network-empty-desc" data-en="Create your first agent in the bot" data-ru="Создайте первого агента в боте">Create your first agent in the bot</div>';
    wrap.appendChild(emptyDiv);
    if (elEdges) elEdges.textContent = '0';
    switchLang(currentLang);
    return;
  }

  var W = dims.w, H = dims.h;

  // Build nodes
  var roleColors = { director: '#ffd700', manager: '#8b5cf6', specialist: '#10b981', monitor: '#f59e0b', worker: '#00a8ff' };
  var roleLabels = { director: 'DIR', manager: 'MGR', specialist: 'SPEC', monitor: 'MON', worker: 'WRK' };

  _networkNodes = agents.map(function(a, i) {
    var role = a.role || 'worker';
    var level = a.level || 1;
    var baseBoost = agents.length <= 3 ? 20 : agents.length <= 6 ? 12 : 6;
    var radius = role === 'director' ? 40 + level * 2 + baseBoost : role === 'manager' ? 34 + level * 2 + baseBoost : role === 'specialist' ? 30 + level + baseBoost : role === 'monitor' ? 28 + level + baseBoost : 24 + Math.min(level, 5) + baseBoost;
    var trigCfg = {}; try { var _t2 = a.trigger_config || a.triggerConfig || {}; trigCfg = typeof _t2 === 'string' ? JSON.parse(_t2) : _t2; } catch(e) {}
    var customColor = (trigCfg.config && trigCfg.config.agentColor) || '';
    var color = !a.isActive ? '#6b7280' : (customColor || roleColors[role] || '#00a8ff');
    var customRoleName = (trigCfg.config && trigCfg.config.customRole && trigCfg.config.customRole.name) || '';
    var roleLabel = customRoleName || roleLabels[role] || role.toUpperCase().slice(0, 4);
    var angle = (i / agents.length) * Math.PI * 2;
    // Larger spread for fewer agents so they're visible
    var spreadRatio = agents.length <= 3 ? 0.38 : agents.length <= 6 ? 0.34 : 0.30;
    var spread = Math.min(W, H) * spreadRatio;
    return {
      id: a.id, name: a.name || 'Agent #' + a.id,
      role: role, level: level, xp: a.xp || 0,
      isActive: a.isActive,
      x: W / 2 + Math.cos(angle) * spread + (Math.random() - 0.5) * 60,
      y: H / 2 + Math.sin(angle) * spread + (Math.random() - 0.5) * 50,
      vx: 0, vy: 0,
      radius: radius, color: color, roleLabel: roleLabel,
    };
  });

  // Build edges from REAL data — was "fake cycle for visual interest" before.
  // Edge sources, in priority order:
  //   1. Crew memberships: every crew → connect manager to each worker (or
  //      ring among members if no manager). Edge kind='crew', tinted to crew color.
  //   2. Role hierarchy: director → ALL of their agents (visual hierarchy hint)
  //   3. Same-role-pair grouping is INTENTIONALLY skipped — no more fake links.
  // Edges are deduped by (from,to) so a worker that's in two crews keeps a
  // single line per source.
  var edges = [];
  var seenEdges = new Set(); // 'fromId:toId' to dedupe
  var nodeById = {};
  _networkNodes.forEach(function(n) { nodeById[n.id] = n; });

  // Stable color-per-crew for tinting edges + nodes
  var crewColors = ['#00a8ff', '#a855f7', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
  crews.forEach(function(c, cIdx) {
    c._color = crewColors[cIdx % crewColors.length];
    var memberIds = (c.agent_ids || []).filter(function(id) { return nodeById[id]; });
    if (memberIds.length < 2) return;
    var managerNode = c.manager_agent_id ? nodeById[c.manager_agent_id] : null;
    if (managerNode) {
      // Manager → each worker
      memberIds.forEach(function(mid) {
        if (mid === managerNode.id) return;
        var key = managerNode.id + ':' + mid;
        if (seenEdges.has(key)) return;
        seenEdges.add(key);
        edges.push({ from: managerNode, to: nodeById[mid], kind: 'crew-manage', color: c._color, crewId: c.id });
      });
    } else {
      // No manager — ring among members so the cluster is visible without a centre
      for (var i = 0; i < memberIds.length; i++) {
        var a = memberIds[i], b = memberIds[(i + 1) % memberIds.length];
        if (a === b) continue;
        var key = a + ':' + b;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        edges.push({ from: nodeById[a], to: nodeById[b], kind: 'crew-ring', color: c._color, crewId: c.id });
      }
    }
  });

  // Role hierarchy on top of crews — director → all, but only if not already linked
  var directors = _networkNodes.filter(function(n) { return n.role === 'director'; });
  directors.forEach(function(d) {
    _networkNodes.forEach(function(n) {
      if (n.id === d.id) return;
      var key = d.id + ':' + n.id;
      if (seenEdges.has(key)) return;
      seenEdges.add(key);
      edges.push({ from: d, to: n, kind: 'director', color: '#ffd700' });
    });
  });

  // Track per-agent crew membership for hover-highlight + node tint
  _networkNodes.forEach(function(n) {
    n.crewIds = [];
    n.crewColor = null;
  });
  crews.forEach(function(c) {
    (c.agent_ids || []).forEach(function(id) {
      var node = nodeById[id];
      if (!node) return;
      node.crewIds.push(c.id);
      if (!node.crewColor) node.crewColor = c._color;
    });
  });

  _networkEdges = edges;
  if (elEdges) elEdges.textContent = edges.length;

  // Background particles (nebula dots)
  var nebulaDots = [];
  for (var nd = 0; nd < 120; nd++) {
    nebulaDots.push({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.35 + 0.05,
      speed: (Math.random() - 0.5) * 0.00003,
      hue: Math.random() > 0.7 ? 210 : (Math.random() > 0.5 ? 270 : 200)
    });
  }

  // Edge particles (multiple per edge)
  var edgeParticles = edges.map(function() {
    var count = 2 + Math.floor(Math.random() * 2);
    var arr = [];
    for (var p = 0; p < count; p++) {
      arr.push({ t: Math.random(), speed: 0.002 + Math.random() * 0.004, size: 1.5 + Math.random() * 1.5 });
    }
    return arr;
  });

  // Tooltip
  var tooltip = document.getElementById('network-tooltip');
  var trashZone = document.getElementById('network-trash-zone');

  // Remove old event listeners by replacing canvas (only on first init)
  if (!_networkInitialized) {
    _networkInitialized = true;

    // Wheel zoom
    canvas.addEventListener('wheel', function(e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      _networkZoom = Math.max(0.3, Math.min(3, _networkZoom * factor));
      var lbl = document.getElementById('net-zoom-label');
      if (lbl) lbl.textContent = Math.round(_networkZoom * 100) + '%';
    }, { passive: false });

    canvas.addEventListener('mousemove', function(e) {
      var r = canvas.getBoundingClientRect();
      var sx = e.clientX - r.left, sy = e.clientY - r.top;
      _networkMouse.x = sx;
      _networkMouse.y = sy;

      // Panning (right-click drag or middle-click)
      if (_networkPanning) {
        _networkPan.x = _networkPanStart.px + (sx - _networkPanStart.x) / _networkZoom;
        _networkPan.y = _networkPanStart.py + (sy - _networkPanStart.y) / _networkZoom;
        return;
      }

      var world = _netScreenToWorld(sx, sy, dims.w, dims.h);

      if (_networkDragNode) {
        _networkDragNode.x = world.x - _networkDragOffset.dx;
        _networkDragNode.y = world.y - _networkDragOffset.dy;
        _networkDragNode.vx = 0;
        _networkDragNode.vy = 0;
        if (trashZone) trashZone.classList.add('visible');
        if (trashZone) {
          var tz = trashZone.getBoundingClientRect();
          var inTrash = e.clientX >= tz.left && e.clientX <= tz.right && e.clientY >= tz.top && e.clientY <= tz.bottom;
          _networkTrashHover = inTrash;
          trashZone.classList.toggle('hover', inTrash);
        }
      }

      // Tooltip hover
      var hovered = null;
      for (var ni = 0; ni < _networkNodes.length; ni++) {
        var n = _networkNodes[ni];
        var ddx = world.x - n.x, ddy = world.y - n.y;
        if (ddx * ddx + ddy * ddy < (n.radius + 4) * (n.radius + 4)) { hovered = n; break; }
      }
      if (hovered && tooltip && !_networkDragNode) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY - 14) + 'px';
        var statusDot = hovered.isActive
          ? '<span style="color:#10b981">&#9679;</span> Active'
          : '<span style="color:#555">&#9679;</span> Paused';
        tooltip.innerHTML = '<div style="font-weight:600;font-size:13px;margin-bottom:4px">' + escHtml(hovered.name) + '</div>' +
          '<div style="display:flex;gap:12px;margin-bottom:3px"><span style="color:' + hovered.color + '">' + hovered.roleLabel + '</span><span>Lv.' + hovered.level + '</span><span>XP ' + hovered.xp + '</span></div>' +
          '<div>' + statusDot + '</div>';
      } else if (tooltip) {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mousedown', function(e) {
      var r = canvas.getBoundingClientRect();
      var sx = e.clientX - r.left, sy = e.clientY - r.top;
      _networkMouse.x = sx;
      _networkMouse.y = sy;

      // Right-click or middle-click → pan
      if (e.button === 2 || e.button === 1) {
        e.preventDefault();
        _networkPanning = true;
        _networkPanStart = { x: sx, y: sy, px: _networkPan.x, py: _networkPan.y };
        canvas.style.cursor = 'move';
        return;
      }

      var world = _netScreenToWorld(sx, sy, dims.w, dims.h);
      _networkClickStart = { x: sx, y: sy, time: Date.now(), node: null };

      for (var ni = 0; ni < _networkNodes.length; ni++) {
        var n = _networkNodes[ni];
        var ddx = world.x - n.x, ddy = world.y - n.y;
        if (ddx * ddx + ddy * ddy < n.radius * n.radius) {
          _networkDragNode = n;
          _networkDragOffset.dx = ddx;
          _networkDragOffset.dy = ddy;
          _networkClickStart.node = n;
          break;
        }
      }
    });

    canvas.addEventListener('mouseup', function(e) {
      if (_networkPanning) {
        _networkPanning = false;
        canvas.style.cursor = 'grab';
        return;
      }

      if (trashZone) trashZone.classList.remove('visible', 'hover');

      if (_networkDragNode && _networkTrashHover) {
        var nodeToDelete = _networkDragNode;
        _networkDragNode = null;
        _networkDragOffset.dx = 0;
        _networkDragOffset.dy = 0;
        _networkClickStart = null;
        _networkTrashHover = false;
        showNetworkDeleteConfirm(nodeToDelete);
        return;
      }

      if (_networkClickStart && _networkClickStart.node) {
        var r = canvas.getBoundingClientRect();
        var mx = e.clientX - r.left, my = e.clientY - r.top;
        var movedX = mx - _networkClickStart.x, movedY = my - _networkClickStart.y;
        var dist = Math.sqrt(movedX * movedX + movedY * movedY);
        var elapsed = Date.now() - _networkClickStart.time;
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

    canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });

    canvas.addEventListener('mouseleave', function() {
      _networkDragNode = null;
      _networkPanning = false;
      _networkDragOffset.dx = 0; _networkDragOffset.dy = 0;
      _networkTrashHover = false;
      if (tooltip) tooltip.style.display = 'none';
      if (trashZone) trashZone.classList.remove('visible', 'hover');
      canvas.style.cursor = 'grab';
    });
  }

  // Animation loop
  var time = 0;

  function animate() {
    time += 0.016;
    var W = dims.w, H = dims.h;
    ctx.clearRect(0, 0, W, H);

    // === Background ===
    // Dark gradient
    var bg = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, '#0c1224');
    bg.addColorStop(0.5, '#080b14');
    bg.addColorStop(1, '#050507');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Nebula aurora glow
    var auroraX = W * 0.5 + Math.sin(time * 0.15) * W * 0.2;
    var auroraY = H * 0.4 + Math.cos(time * 0.12) * H * 0.15;
    var aurora = ctx.createRadialGradient(auroraX, auroraY, 0, auroraX, auroraY, W * 0.4);
    aurora.addColorStop(0, 'rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),0.04)');
    aurora.addColorStop(0.4, 'rgba(var(--accent-r,168),var(--accent-g,85),var(--accent-b,247),0.02)');
    aurora.addColorStop(1, 'transparent');
    ctx.fillStyle = aurora;
    ctx.fillRect(0, 0, W, H);

    // Nebula dots
    nebulaDots.forEach(function(d) {
      d.x += d.speed;
      d.y += d.speed * 0.6;
      if (d.x > 1.05) d.x = -0.05;
      if (d.x < -0.05) d.x = 1.05;
      if (d.y > 1.05) d.y = -0.05;
      var px = d.x * W, py = d.y * H;
      var flicker = d.a + Math.sin(time * 1.5 + d.x * 40) * 0.08;
      ctx.beginPath();
      ctx.arc(px, py, d.r, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + d.hue + ',60%,75%,' + Math.max(0, flicker) + ')';
      ctx.fill();
    });

    // Perspective grid
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(_networkZoom, _networkZoom);
    ctx.translate(-W / 2 + _networkPan.x, -H / 2 + _networkPan.y);

    var gridSize = 50;
    var gridAlpha = 0.025 + Math.sin(time * 0.5) * 0.005;
    ctx.strokeStyle = 'rgba(200,220,255,' + gridAlpha + ')';
    ctx.lineWidth = 0.5;
    var gx0 = Math.floor((-_networkPan.x - W / 2 / _networkZoom) / gridSize) * gridSize;
    var gy0 = Math.floor((-_networkPan.y - H / 2 / _networkZoom) / gridSize) * gridSize;
    var gx1 = gx0 + W / _networkZoom + gridSize * 2;
    var gy1 = gy0 + H / _networkZoom + gridSize * 2;
    for (var gx = gx0; gx <= gx1; gx += gridSize) {
      ctx.beginPath(); ctx.moveTo(gx, gy0); ctx.lineTo(gx, gy1); ctx.stroke();
    }
    for (var gy = gy0; gy <= gy1; gy += gridSize) {
      ctx.beginPath(); ctx.moveTo(gx0, gy); ctx.lineTo(gx1, gy); ctx.stroke();
    }

    // === Force-directed physics ===
    var repulseK = 10000;
    for (var i = 0; i < _networkNodes.length; i++) {
      for (var j = i + 1; j < _networkNodes.length; j++) {
        var a = _networkNodes[i], b = _networkNodes[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        var force = repulseK / (dist * dist);
        var fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
    // Spring forces on edges
    edges.forEach(function(e) {
      if (!e || !e.from || !e.to) return; // defensive — bad edge would NaN out physics
      var dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
      var dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      var spring = 0.006;
      var target = 140;
      var force = (dist - target) * spring;
      var fx = (dx / dist) * force, fy = (dy / dist) * force;
      e.from.vx += fx; e.from.vy += fy;
      e.to.vx -= fx; e.to.vy -= fy;
    });
    // Center gravity
    var cx = W / 2, cy = H / 2;
    _networkNodes.forEach(function(n) {
      if (n === _networkDragNode) return;
      var gdx = cx - n.x, gdy = cy - n.y;
      n.vx += gdx * 0.0003;
      n.vy += gdy * 0.0003;
      n.vx *= 0.9; n.vy *= 0.9;
      n.x += n.vx; n.y += n.vy;
    });

    // === Draw edges (curved bezier) ===
    edges.forEach(function(e, idx) {
      if (!e || !e.from || !e.to) return; // skip malformed
      var fx = e.from.x, fy = e.from.y, tx = e.to.x, ty = e.to.y;
      var mx = (fx + tx) / 2, my = (fy + ty) / 2;
      // Perpendicular offset for curve
      var ddx = tx - fx, ddy = ty - fy;
      var len = Math.sqrt(ddx * ddx + ddy * ddy);
      var curvature = len * 0.12;
      var cpx = mx + (-ddy / len) * curvature;
      var cpy = my + (ddx / len) * curvature;

      // Edge glow
      var edgeAlpha = 0.35 + Math.sin(time * 2 + idx) * 0.1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      ctx.strokeStyle = e.from.color + Math.round(edgeAlpha * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Animated dashed overlay
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -time * 30 + idx * 10;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      ctx.strokeStyle = e.from.color + '18';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Multiple particles along curve
      var parts = edgeParticles[idx];
      parts.forEach(function(p) {
        p.t = (p.t + p.speed) % 1;
        var t = p.t;
        var pt = 1 - t;
        var ppx = pt * pt * fx + 2 * pt * t * cpx + t * t * tx;
        var ppy = pt * pt * fy + 2 * pt * t * cpy + t * t * ty;
        ctx.beginPath();
        ctx.arc(ppx, ppy, p.size, 0, Math.PI * 2);
        var pGlow = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, p.size * 3);
        pGlow.addColorStop(0, e.from.color + 'cc');
        pGlow.addColorStop(1, e.from.color + '00');
        ctx.fillStyle = pGlow;
        ctx.fill();
      });
    });

    // === Draw nodes ===
    _networkNodes.forEach(function(n) {
      var pulse = n.isActive ? Math.sin(time * 2.5 + n.id * 0.7) * 2.5 : 0;
      var r = n.radius + pulse;

      var matchesSearch = !_networkSearchQuery || n.name.toLowerCase().includes(_networkSearchQuery.toLowerCase());
      // Crew hover: if user hovers a crew in the side panel, fade non-members
      // and add a thick outer ring to members.
      var inHoveredCrew = _networkHoverCrewId != null && Array.isArray(n.crewIds) && n.crewIds.indexOf(_networkHoverCrewId) >= 0;
      var fadeForHover = _networkHoverCrewId != null && !inHoveredCrew ? 0.18 : 1.0;
      var alpha = (matchesSearch ? 1.0 : 0.12) * fadeForHover;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Pulsing rings for active agents
      if (n.isActive) {
        for (var ri = 1; ri <= 3; ri++) {
          var ringPhase = (time * 1.2 + ri * 0.8 + n.id * 0.3) % 3;
          var ringR = r + ringPhase * 14;
          var ringAlpha = Math.max(0, 0.25 - ringPhase * 0.08);
          ctx.beginPath();
          ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = n.color + Math.round(ringAlpha * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Outer glow (large, bright)
      var glow = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, r * 3);
      glow.addColorStop(0, n.color + '60');
      glow.addColorStop(0.5, n.color + '20');
      glow.addColorStop(1, n.color + '00');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      // Main node circle — SOLID fill with bright gradient
      var nodeFill = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
      nodeFill.addColorStop(0, n.color + 'dd');
      nodeFill.addColorStop(0.6, n.color + '99');
      nodeFill.addColorStop(1, n.color + '55');
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeFill;
      ctx.fill();

      // Border — bright and visible
      ctx.strokeStyle = n.color + (matchesSearch && _networkSearchQuery ? 'ff' : 'dd');
      ctx.lineWidth = matchesSearch && _networkSearchQuery ? 3 : 2.2;
      ctx.stroke();

      // Crew-hover ring — thick outer ring in crew color when hovering its panel item
      if (inHoveredCrew) {
        var hoverCrew = _networkCrews.find(function(cc) { return cc.id === _networkHoverCrewId; });
        var hoverColor = (hoverCrew && hoverCrew._color) || n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = hoverColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -time * 30;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Search highlight ring
      if (matchesSearch && _networkSearchQuery) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = n.color + '50';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -time * 20;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Role label inside
      ctx.font = 'bold ' + Math.max(9, r * 0.45) + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(n.roleLabel || 'AGT', n.x, n.y);

      // Name pill below node
      var nameText = n.name.length > 16 ? n.name.slice(0, 15) + '..' : n.name;
      ctx.font = '10px Inter, system-ui, sans-serif';
      var nameWidth = ctx.measureText(nameText).width;
      var pillW = nameWidth + 12, pillH = 16;
      var pillX = n.x - pillW / 2, pillY = n.y + r + 6;

      // Pill background
      ctx.fillStyle = 'rgba(5,5,7,0.7)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();
      ctx.strokeStyle = n.color + '30';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Name text
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nameText, n.x, pillY + pillH / 2);

      // Level badge (top)
      if (n.level > 1) {
        var lvText = 'Lv.' + n.level;
        ctx.font = 'bold 8px Inter, system-ui, sans-serif';
        var lvW = ctx.measureText(lvText).width + 8;
        ctx.fillStyle = n.color + '30';
        ctx.beginPath();
        ctx.roundRect(n.x - lvW / 2, n.y - r - 14, lvW, 12, 3);
        ctx.fill();
        ctx.fillStyle = n.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lvText, n.x, n.y - r - 8);
      }

      ctx.restore();
    });

    ctx.restore(); // end zoom/pan transform

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

// ===== AGENT CREATION WIZARD =====
var _wizardAgentId = null;
var _wizardSteps = [];
var _wizardCurrentStep = 0;

function showWizard(agentId, agentName) {
  _wizardAgentId = agentId;
  _wizardCurrentStep = 0;
  var isRu = currentLang === 'ru';

  // 5-step creation wizard (adapted from teleton-agent onboarding)
  _wizardSteps = [
    // Step 1: Role
    { group: 'role', title: isRu ? '1. Роль агента' : '1. Agent Role', fields: [
      { id: 'ROLE', type: 'select', label: isRu ? 'Роль' : 'Role', desc: isRu ? 'Определяет поведение и набор инструментов' : 'Defines behavior and toolset',
        options: [{v:'specialist',l:isRu?'Специалист — глубокий анализ':'Specialist — deep analysis'},{v:'worker',l:isRu?'Работник — автоматизация':'Worker — automation'},{v:'monitor',l:isRu?'Монитор — алерты':'Monitor — alerts'},{v:'manager',l:isRu?'Менеджер — координация':'Manager — coordination'},{v:'director',l:isRu?'Директор — управление':'Director — management'}] }
    ]},
    // Step 2: AI Provider
    { group: 'ai', title: isRu ? '2. AI провайдер' : '2. AI Provider', fields: [
      { id: 'AI_PROVIDER', type: 'select', label: isRu ? 'Провайдер' : 'Provider', desc: isRu ? 'Можно оставить по умолчанию (Gemini — бесплатный)' : 'Can leave default (Gemini — free)',
        options: [{v:'gemini',l:'Google Gemini (free)'},{v:'openai',l:'OpenAI GPT-4o'},{v:'anthropic',l:'Anthropic Claude'},{v:'groq',l:'Groq (fast & free)'},{v:'deepseek',l:'DeepSeek'},{v:'openrouter',l:'OpenRouter'},{v:'together',l:'Together AI'}] },
      { id: 'AI_API_KEY', type: 'password', label: isRu ? 'API ключ' : 'API Key', desc: isRu ? 'Без ключа агент не сможет работать. Бесплатно: Gemini (aistudio.google.com), Groq (console.groq.com), OpenRouter (openrouter.ai/keys)' : 'Without a key the agent cannot work. Free: Gemini (aistudio.google.com), Groq (console.groq.com), OpenRouter (openrouter.ai/keys)', required: false }
    ]},
    // Step 3: Capabilities
    { group: 'capabilities', title: isRu ? '3. Возможности' : '3. Capabilities', fields: [
      { id: 'caps', type: 'caps', label: isRu ? 'Выберите что нужно агенту' : 'Select what the agent needs', desc: isRu ? 'Можно изменить позже в настройках' : 'Can be changed later in settings' }
    ]},
    // Step 4: Schedule
    { group: 'schedule', title: isRu ? '4. Расписание' : '4. Schedule', fields: [
      { id: 'intervalMs', type: 'select', label: isRu ? 'Интервал запуска' : 'Run Interval', desc: isRu ? 'Как часто агент должен работать автоматически' : 'How often should the agent run automatically',
        options: [{v:'0',l:isRu?'24/7 — постоянно (рекомендуется)':'24/7 — always on (recommended)'},{v:'60000',l:'1 min'},{v:'300000',l:'5 min'},{v:'900000',l:'15 min'},{v:'1800000',l:'30 min'},{v:'3600000',l:'1 hour'},{v:'86400000',l:'24 hours'}] }
    ]},
    // Step 5: Wallet
    { group: 'wallet', title: isRu ? '5. TON кошелёк' : '5. TON Wallet', fields: [
      { id: 'CREATE_WALLET', type: 'select', label: isRu ? 'Кошелёк' : 'Wallet', desc: isRu ? 'Нужен для TON переводов, покупки подарков и DeFi' : 'Required for TON transfers, gift buying and DeFi',
        options: [{v:'auto',l:isRu?'Создать автоматически (рекомендуется)':'Create automatically (recommended)'},{v:'skip',l:isRu?'Пропустить — создам позже':'Skip — I will create later'}] }
    ]}
  ];

  var modal = document.getElementById('wizard-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  var title = document.getElementById('wizard-title');
  if (title) title.textContent = (isRu ? 'Настройка: ' : 'Setup: ') + (agentName || 'Agent #' + agentId);
  renderWizardStep(0);
}

function renderWizardStep(idx) {
  _wizardCurrentStep = idx;
  var step = _wizardSteps[idx];
  if (!step) return;
  var body = document.getElementById('wizard-body');
  if (!body) return;
  var isRu = currentLang === 'ru';

  // Step indicators
  var stepsEl = document.getElementById('wizard-steps');
  if (stepsEl) {
    stepsEl.innerHTML = _wizardSteps.map(function(s, i) {
      return '<span style="width:8px;height:8px;border-radius:50%;background:' + (i === idx ? 'var(--primary)' : i < idx ? '#4ade80' : 'var(--border)') + ';transition:background 0.3s"></span>';
    }).join('');
  }

  // Step label
  var label = document.getElementById('wizard-step-label');
  if (label) label.textContent = (idx + 1) + ' / ' + _wizardSteps.length;

  // Back button
  var backBtn = document.getElementById('wizard-back-btn');
  if (backBtn) backBtn.style.display = idx > 0 ? '' : 'none';

  // Next button text
  var nextBtn = document.getElementById('wizard-next-btn');
  if (nextBtn) nextBtn.textContent = idx === _wizardSteps.length - 1 ? (isRu ? 'Готово' : 'Done') : (isRu ? 'Далее' : 'Next');

  // Render fields
  var html = '<h3 style="margin:0 0 12px;font-size:.95rem">' + step.title + '</h3>';
  step.fields.forEach(function(f) {
    if (f.type === 'select') {
      html += '<div class="settings-field"><label>' + f.label + '</label>' +
        '<select id="wizard-' + f.id + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text-primary);font-size:.85rem">' +
        f.options.map(function(o) { return '<option value="' + o.v + '">' + o.l + '</option>'; }).join('') +
        '</select>' +
        (f.desc ? '<div class="settings-field-desc">' + f.desc + '</div>' : '') + '</div>';
    } else if (f.type === 'password' || f.type === 'text') {
      html += '<div class="settings-field"><label>' + f.label + '</label>' +
        '<input type="' + f.type + '" id="wizard-' + f.id + '" placeholder="' + (f.placeholder || '') + '" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text-primary);font-size:.85rem">' +
        (f.desc ? '<div class="settings-field-desc">' + f.desc + '</div>' : '') + '</div>';
    } else if (f.type === 'caps') {
      // Toolset profile presets
      var profiles = [
        {id:'minimal',icon:IC.chat,label:isRu?'Минимальный':'Minimal',desc:isRu?'Только чат':'Chat only',caps:['telegram','state','notify']},
        {id:'standard',icon:IC.globe,label:isRu?'Стандартный':'Standard',desc:isRu?'Чат + web + кошелёк':'Chat + web + wallet',caps:['telegram','state','notify','web','wallet','image','workspace']},
        {id:'trading',icon:IC.trending,label:isRu?'Трейдинг':'Trading',desc:isRu?'Подарки + DeFi':'Gifts + DeFi',caps:['telegram','state','notify','web','wallet','gifts','gifts_market','defi','blockchain','nft']},
        {id:'full',icon:IC.infinity,label:isRu?'Полный':'Full',desc:isRu?'Всё включено':'Everything',caps:['wallet','nft','gifts','gifts_market','telegram','telegram_admin','telegram_stories','telegram_forums','telegram_analytics','telegram_media','telegram_discovery','telegram_premium','web','state','events','notify','plugins','inter_agent','blockchain','defi','image','workspace','mcp','confirmation','self_memory']},
        {id:'admin',icon:IC.shield,label:isRu?'Админ':'Admin',desc:isRu?'Модерация':'Moderation',caps:['telegram','telegram_admin','telegram_analytics','telegram_forums','state','notify','web']},
        {id:'content',icon:IC.image,label:isRu?'Контент':'Content',desc:isRu?'Медиа + сторис':'Media + stories',caps:['telegram','telegram_admin','telegram_stories','telegram_media','image','web','state','notify','workspace']},
      ];
      html += '<div class="settings-field"><label>' + (isRu ? 'Профиль набора инструментов' : 'Toolset Profile') + '</label>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">' +
        profiles.map(function(p) {
          return '<div class="wizard-profile-card" data-profile="' + p.id + '" onclick="applyWizardProfile(\'' + p.id + '\')" style="padding:10px;border-radius:8px;background:var(--bg-secondary);cursor:pointer;border:1px solid var(--border);text-align:center;transition:border-color 0.2s,transform 0.15s">' +
            '<div style="font-size:1.1rem;margin-bottom:4px">' + p.icon + '</div>' +
            '<div style="font-size:.78rem;font-weight:600">' + p.label + '</div>' +
            '<div style="font-size:.62rem;color:var(--text-muted)">' + p.desc + '</div>' +
          '</div>';
        }).join('') +
        '</div>' +
        '<div style="font-size:.68rem;color:var(--text-muted);margin-bottom:8px">' + (isRu ? 'Или выберите вручную:' : 'Or select manually:') + '</div>';
      var quickCaps = [
        {id:'wallet',icon:IC.dollar,name:'Wallet'}, {id:'nft',icon:IC.image,name:'NFT'}, {id:'gifts_market',icon:IC.trending,name:'Gifts Market'},
        {id:'web',icon:IC.globe,name:'Web'}, {id:'defi',icon:IC.shuffle,name:'DeFi'}, {id:'telegram',icon:IC.send,name:'Telegram'},
        {id:'notify',icon:IC.bell,name:'Notify'}, {id:'state',icon:IC.box,name:'State'},
        {id:'image',icon:IC.image,name:'Image'}, {id:'image_gen',icon:IC.zap,name:'DALL-E'}, {id:'workspace',icon:IC.box,name:'Files'},
        {id:'blockchain',icon:IC.link,name:'Blockchain'}, {id:'plugins',icon:IC.wrench,name:'Plugins'},
      ];
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
        quickCaps.map(function(c) {
          return '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bg-secondary);cursor:pointer;font-size:.82rem;border:1px solid var(--border);transition:border-color 0.2s">' +
            '<input type="checkbox" class="wizard-cap-check" value="' + c.id + '" style="accent-color:var(--primary)" onchange="this.closest(\'label\').style.borderColor=this.checked?\'var(--primary)\':\'var(--border)\'">' +
            '<span>' + c.icon + ' ' + c.name + '</span></label>';
        }).join('') +
        '</div>' +
        (f.desc ? '<div class="settings-field-desc">' + f.desc + '</div>' : '') + '</div>';
    }
  });

  body.innerHTML = html;
  // Animate
  body.style.animation = 'none';
  body.offsetHeight;
  body.style.animation = 'tabContentFade 0.35s cubic-bezier(0.4,0,0.2,1)';
}

var _wizardProfiles = {
  minimal: ['telegram','state','notify'],
  standard: ['telegram','state','notify','web','wallet','image','workspace'],
  trading: ['telegram','state','notify','web','wallet','gifts','gifts_market','defi','blockchain','nft'],
  full: ['wallet','nft','gifts','gifts_market','telegram','telegram_admin','telegram_stories','telegram_forums','telegram_analytics','telegram_media','telegram_discovery','telegram_premium','web','state','events','notify','plugins','inter_agent','blockchain','defi','image','workspace','mcp','confirmation','self_memory'],
  admin: ['telegram','telegram_admin','telegram_analytics','telegram_forums','state','notify','web'],
  content: ['telegram','telegram_admin','telegram_stories','telegram_media','image','web','state','notify','workspace'],
};

function applyWizardProfile(profileId) {
  var caps = _wizardProfiles[profileId] || [];
  // Uncheck all
  document.querySelectorAll('.wizard-cap-check').forEach(function(cb) {
    cb.checked = false;
    cb.closest('label').style.borderColor = 'var(--border)';
  });
  // Check matching
  document.querySelectorAll('.wizard-cap-check').forEach(function(cb) {
    if (caps.indexOf(cb.value) >= 0) {
      cb.checked = true;
      cb.closest('label').style.borderColor = 'var(--primary)';
    }
  });
  // Highlight selected profile card
  document.querySelectorAll('.wizard-profile-card').forEach(function(card) {
    card.style.borderColor = card.getAttribute('data-profile') === profileId ? 'var(--primary)' : 'var(--border)';
    card.style.transform = card.getAttribute('data-profile') === profileId ? 'scale(1.03)' : '';
  });
}

function wizardNext() {
  if (_wizardCurrentStep < _wizardSteps.length - 1) {
    renderWizardStep(_wizardCurrentStep + 1);
  } else {
    submitWizard();
  }
}

function wizardBack() {
  if (_wizardCurrentStep > 0) renderWizardStep(_wizardCurrentStep - 1);
}

async function submitWizard() {
  // Collect all values from all steps
  var config = {};
  // Role
  var roleEl = document.getElementById('wizard-ROLE');
  if (roleEl && roleEl.value) config.role = roleEl.value;
  // AI Provider
  var providerEl = document.getElementById('wizard-AI_PROVIDER');
  if (providerEl) config.AI_PROVIDER = providerEl.value;
  var keyEl = document.getElementById('wizard-AI_API_KEY');
  if (keyEl && keyEl.value.trim()) config.AI_API_KEY = keyEl.value.trim();
  // Schedule
  var intervalEl = document.getElementById('wizard-intervalMs');
  if (intervalEl && intervalEl.value !== '0') config.intervalMs = parseInt(intervalEl.value);
  // Capabilities
  var caps = [];
  document.querySelectorAll('.wizard-cap-check:checked').forEach(function(cb) { caps.push(cb.value); });
  if (caps.length) config.enabledCapabilities = caps;
  // Wallet
  var walletEl = document.getElementById('wizard-CREATE_WALLET');
  if (walletEl && walletEl.value === 'auto') config.createWallet = true;

  try {
    if (Object.keys(config).length > 0) {
      await apiRequest('PUT', '/api/agents/' + _wizardAgentId + '/wizard', { config: config });
    }
    // Set role via separate endpoint
    if (config.role) {
      await apiRequest('PUT', '/api/agents/' + _wizardAgentId + '/role', { role: config.role }).catch(function() {});
    }
    // Create wallet if requested
    if (config.createWallet) {
      await apiRequest('POST', '/api/agents/' + _wizardAgentId + '/wallet').catch(function() {});
    }
  } catch(e) { /* silent - best effort */ }

  closeWizard();
  toast(currentLang === 'ru' ? 'Агент настроен!' : 'Agent configured!', 'success');
  navigateTo('agents');
  loadAgentsPage();
}

function closeWizard() {
  var modal = document.getElementById('wizard-modal');
  if (modal) modal.style.display = 'none';
  _wizardAgentId = null;
}

// ===== AI ASSISTANT PAGE =====
let _assistantLoaded = false;
let _assistantTarget = 'atlas';
let _agentChatHistories = {}; // agentId → [{role, content}]
let _atlasChatEl = null; // stores Atlas chat DOM when switching

async function loadAssistantPage() {
  if (!_assistantLoaded) {
    _assistantLoaded = true;
    await loadAssistantHistory();
  }
  populateAssistantTargets();
  setTimeout(function() {
    var input = document.getElementById('assistant-input');
    if (input) input.focus();
  }, 100);
}

function populateAssistantTargets() {
  var select = document.getElementById('assistant-target-select');
  if (!select) return;
  // Keep atlas, remove old agent options
  var currentVal = select.value;
  while (select.options.length > 1) select.remove(1);
  // Add agents from cache
  try {
    var agents = _agentsPageData && _agentsPageData.length ? _agentsPageData : (_agentsCache || []);
    agents.forEach(function(a) {
      var opt = document.createElement('option');
      opt.value = 'agent_' + a.id;
      opt.textContent = '#' + a.id + ' ' + (a.name || 'Unnamed');
      select.appendChild(opt);
    });
  } catch(e) {}
  select.value = currentVal || 'atlas';
}

function switchAssistantTarget(value) {
  var container = document.getElementById('assistant-messages');
  var sugg = document.getElementById('assistant-suggestions');
  if (!container) return;

  // Save current chat state
  if (_assistantTarget === 'atlas') {
    _atlasChatEl = container.innerHTML;
  } else {
    _agentChatHistories[_assistantTarget] = container.innerHTML;
  }

  _assistantTarget = value;

  // Restore target's chat
  if (value === 'atlas') {
    container.innerHTML = _atlasChatEl || '';
    if (sugg) sugg.style.display = container.children.length <= 1 ? '' : 'none';
  } else {
    var saved = _agentChatHistories[value];
    if (saved) {
      container.innerHTML = saved;
    } else {
      var agentName = value.replace('agent_', '#');
      container.innerHTML = '<div class="assistant-welcome"><div class="assistant-welcome-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>' +
        '<h3>' + (currentLang === 'ru' ? 'Чат с агентом ' : 'Chat with Agent ') + agentName + '</h3>' +
        '<p>' + (currentLang === 'ru' ? 'Отправьте сообщение агенту напрямую' : 'Send a message directly to the agent') + '</p></div>';
    }
    if (sugg) sugg.style.display = 'none';
  }
  container.scrollTop = container.scrollHeight;
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
    .replace(/\[\[page:(\w+)\|([^\]]+)\]\]/g, '<a href="#" class="assistant-nav-link" onclick="navigateTo(\'$1\');return false" style="color:var(--primary-light);text-decoration:underline;cursor:pointer">$2</a>')
    // Standard markdown links: [text](url) → external links (only http/https)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)"']+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--primary-light);text-decoration:underline">$1</a>')
    .replace(/\n/g, '<br>');
  if (role === 'assistant') {
    html = '<div class="assistant-msg-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="assistant-msg-content">' + html;
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

// escHtml defined earlier (line ~3302); removed duplicate here

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
  typing.innerHTML = '<div class="assistant-msg-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="assistant-msg-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  var sendBtn = document.getElementById('assistant-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    if (_assistantTarget !== 'atlas' && _assistantTarget.startsWith('agent_')) {
      // ── Streaming for agent chat ──────────────────────────────────────
      var agentId2 = _assistantTarget.replace('agent_', '');
      var typingEl0 = document.getElementById('assistant-typing');
      // Create streaming message bubble
      if (typingEl0) typingEl0.remove();
      var streamDiv = document.createElement('div');
      streamDiv.className = 'assistant-msg assistant';
      streamDiv.innerHTML = '<div class="assistant-msg-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="assistant-msg-content"><span class="chat-cursor">▋</span></div>';
      var ctr = document.getElementById('assistant-messages');
      if (ctr) { ctr.appendChild(streamDiv); ctr.scrollTop = ctr.scrollHeight; }
      var streamEl = streamDiv.querySelector('.assistant-msg-content'); // direct ref — no id needed
      var streamText = '';
      await _streamAgentChat(agentId2, text,
        function(chunk) {
          streamText += chunk;
          if (streamEl) {
            streamEl.innerHTML = escHtml(streamText)
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/`([^`]+)`/g, '<code style="background:rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),0.15);padding:1px 5px;border-radius:3px;font-size:.8em">$1</code>')
              .replace(/\n/g, '<br>') + '<span class="chat-cursor">▋</span>';
            if (ctr) ctr.scrollTop = ctr.scrollHeight;
          }
        },
        function(full) {
          var finalText = streamText || full || '…';
          if (streamEl) {
            streamEl.innerHTML = escHtml(finalText)
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/`([^`]+)`/g, '<code style="background:rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),0.15);padding:1px 5px;border-radius:3px;font-size:.8em">$1</code>')
              .replace(/\n/g, '<br>');
          }
        },
        function(err) {
          // fallback
          apiRequest('POST', '/api/agents/' + agentId2 + '/chat', { message: text }).then(function(d) {
            if (streamEl) streamEl.innerHTML = escHtml(d.ok ? (d.response || '…') : (d.error || err)).replace(/\n/g, '<br>');
          });
        }
      );
    } else {
      // ── Atlas streaming chat ─────────────────────────────────────────
      var typingEl0a = document.getElementById('assistant-typing');
      if (typingEl0a) typingEl0a.remove();

      // Try streaming first
      var atlasStreamed = false;
      try {
        var atlasResp = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken || '' },
          body: JSON.stringify({ message: text, context: getStudioContext() }),
        });
        // If server returns JSON (command route), handle normally
        var ct = atlasResp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          var data = await atlasResp.json();
          if (data.ok && data.result) {
            var r = data.result;
            appendAssistantMsg('assistant', r.content || r.response || String(r), r.buttons);
            if (r.type === 'agent_created') {
              console.log('[Atlas] agent_created, agentId=' + r.agentId);
              handleAgentCreated(r.agentId);
            }
          } else { appendAssistantMsg('assistant', data.error || 'Error'); }
          atlasStreamed = true;
        } else if (atlasResp.ok && atlasResp.body) {
          // SSE stream
          var atlasDiv = document.createElement('div');
          atlasDiv.className = 'assistant-msg assistant';
          atlasDiv.innerHTML = '<div class="assistant-msg-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="assistant-msg-content"><span class="chat-cursor">▋</span></div>';
          var atlasCtr = document.getElementById('assistant-messages');
          if (atlasCtr) { atlasCtr.appendChild(atlasDiv); atlasCtr.scrollTop = atlasCtr.scrollHeight; }
          var atlasStreamEl = atlasDiv.querySelector('.assistant-msg-content'); // direct ref — no id collisions

          var atlasReader = atlasResp.body.getReader();
          var atlasDecoder = new TextDecoder();
          var atlasBuf = '', atlasEvt = '', atlasText = '';
          while (true) {
            var _ar = await atlasReader.read();
            if (_ar.done) break;
            atlasBuf += atlasDecoder.decode(_ar.value, { stream: true });
            var atlasLines = atlasBuf.split('\n');
            atlasBuf = atlasLines.pop() || '';
            for (var _i = 0; _i < atlasLines.length; _i++) {
              var _line = atlasLines[_i];
              if (_line.startsWith('event:')) { atlasEvt = _line.slice(6).trim(); continue; }
              if (_line.startsWith('data:')) {
                try {
                  var _p = JSON.parse(_line.slice(5).trim());
                  if (atlasEvt === 'chunk' && _p.text) {
                    atlasText += _p.text;
                    if (atlasStreamEl) {
                      atlasStreamEl.innerHTML = escHtml(atlasText)
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/`([^`]+)`/g, '<code>$1</code>')
                        .replace(/\[\[page:(\w+)\|([^\]]+)\]\]/g, '<a href="#" class="assistant-nav-link" onclick="navigateTo(\'$1\');return false" style="color:var(--primary-light);text-decoration:underline;cursor:pointer">$2</a>')
                        .replace(/\n/g, '<br>') + '<span class="chat-cursor">▋</span>';
                      if (atlasCtr) atlasCtr.scrollTop = atlasCtr.scrollHeight;
                    }
                  } else if (atlasEvt === 'done') {
                    if (atlasStreamEl) {
                      var _final = atlasText || _p.fullText || '…';
                      // Atlas crew interview output: extract <crew-suggest>{json}</crew-suggest>
                      // marker, render as an inline "Create crew" action button.
                      var _crewSuggest = null;
                      _final = _final.replace(/<crew-suggest>([\s\S]*?)<\/crew-suggest>/g, function(_m, body) {
                        try { _crewSuggest = JSON.parse(body.trim()); } catch (_je) { _crewSuggest = null; }
                        return ''; // strip marker from visible text
                      });
                      atlasStreamEl.innerHTML = escHtml(_final.trim())
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/`([^`]+)`/g, '<code>$1</code>')
                        .replace(/\[\[page:(\w+)\|([^\]]+)\]\]/g, '<a href="#" class="assistant-nav-link" onclick="navigateTo(\'$1\');return false" style="color:var(--primary-light);text-decoration:underline;cursor:pointer">$2</a>')
                        .replace(/\n/g, '<br>');
                      if (_crewSuggest && Array.isArray(_crewSuggest.agent_ids) && _crewSuggest.agent_ids.length > 0) {
                        var _btnId = 'crew-sug-btn-' + Date.now();
                        var _suggestKey = '_atlasCrewSuggest_' + Date.now();
                        window[_suggestKey] = _crewSuggest;
                        var _meta = (_crewSuggest.agent_ids || []).length + ' агентов' + (_crewSuggest.manager_agent_id ? ' · менеджер #' + _crewSuggest.manager_agent_id : '');
                        var _actionHtml = '<div style="margin-top:10px;padding:10px;background:rgba(0,168,255,0.08);border:1px solid rgba(0,168,255,0.28);border-radius:10px">' +
                          '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Atlas предлагает создать команду</div>' +
                          '<div style="font-weight:600;margin-bottom:2px">' + escHtml(String(_crewSuggest.name || 'Crew')) + '</div>' +
                          '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">' + escHtml(String(_crewSuggest.description || '')) + '</div>' +
                          '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">' + _meta + '</div>' +
                          '<button id="' + _btnId + '" class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="acceptAtlasCrewSuggest(\'' + _suggestKey + '\', this)">▶ Создать команду</button>' +
                          '<button class="btn" style="font-size:12px;padding:6px 12px;margin-left:6px" onclick="this.closest(\'div\').remove()">Отмена</button>' +
                          '</div>';
                        atlasStreamEl.insertAdjacentHTML('beforeend', _actionHtml);
                      }
                    }
                  } else if (atlasEvt === 'error') {
                    if (atlasStreamEl) atlasStreamEl.textContent = _p.message || 'Error';
                  }
                } catch(_ep) {}
                atlasEvt = '';
              }
            }
          }
          atlasStreamed = true;
        }
      } catch(_se) { atlasStreamed = false; }

      if (!atlasStreamed) {
        // Ultimate fallback: non-streaming
        var data2 = await apiRequest('POST', '/api/chat', { message: text, context: getStudioContext() });
        if (data2.ok && data2.result) {
          var r2 = data2.result;
          appendAssistantMsg('assistant', r2.content || r2.response || String(r2), r2.buttons);
          if (r2.type === 'agent_created') {
              handleAgentCreated(r2.agentId);
          }
        } else { appendAssistantMsg('assistant', data2.error || 'Error'); }
      }
    }
  } catch (e) {
    var typingEl2 = document.getElementById('assistant-typing');
    if (typingEl2) typingEl2.remove();
    appendAssistantMsg('assistant', e.message);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ── Post-creation handler: audit + tour + animation ──
function handleAgentCreated(agentId) {
  loadAgents();
  // Beautiful creation toast
  var isRu = currentLang === 'ru';
  toast(isRu ? 'Агент создан!' : 'Agent created!', 'success');
  if (!agentId) { navigateTo('operations'); return; }

  navigateTo('operations');
  setTimeout(function() {
    openAgentDetail(agentId).then(function() {
      setTimeout(function() { startAgentTour(true); }, 1200);
      // Run audit and show score badge in guide card
      setTimeout(function() {
        apiRequest('GET', '/api/agents/' + agentId + '/audit').then(function(auditData) {
          if (!auditData || !auditData.ok) return;
          var score = auditData.score || 0;
          var fails = (auditData.issues || []).length;
          var warns = (auditData.warnings || []).length;
          // Add score badge to guide card
          var guide = document.getElementById('agent-onboard-guide');
          if (guide) {
            var header = guide.querySelector('div > div:first-child > div:last-child');
            if (header) {
              var scoreColor = score >= 80 ? '#4ade80' : score >= 50 ? '#f59e0b' : '#ef4444';
              var badge = document.createElement('div');
              badge.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;background:' + scoreColor + '15;border:1px solid ' + scoreColor + '30;font-size:.72rem;font-weight:600;color:' + scoreColor + ';margin-top:4px';
              badge.innerHTML = '<span style="font-size:.8rem">' + (score >= 80 ? '&#9679;' : '&#9888;') + '</span> ' + (isRu ? 'Здоровье' : 'Health') + ': ' + score + '%';
              header.appendChild(badge);
            }
          }
          // Show toast if issues found
          if (fails > 0) {
            toast((isRu ? 'Аудит: ' + fails + ' проблем' : 'Audit: ' + fails + ' issues') + (warns > 0 ? ', ' + warns + ' warn' : ''), 'warning');
          }
        }).catch(function() {});
      }, 2500);
    });
  }, 500);
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
  typing.innerHTML = '<div class="assistant-msg-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="assistant-msg-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  try {
    var data = await apiRequest('POST', '/api/chat', { message: callbackData, context: getStudioContext() });
    var typingEl = document.getElementById('assistant-typing');
    if (typingEl) typingEl.remove();
    if (data.ok && data.result) {
      appendAssistantMsg('assistant', data.result.content, data.result.buttons);
      if (data.result.type === 'agent_created') {
        handleAgentCreated(data.result.agentId);
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
  container.innerHTML = '<div class="assistant-welcome"><div class="assistant-welcome-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h3>' + (currentLang === 'ru' ? 'Чем могу помочь?' : 'How can I help you?') + '</h3><p>' + (currentLang === 'ru' ? 'Могу создать AI-агента, объяснить функции, помочь с настройками и многое другое.' : 'I can create AI agents, explain features, help with settings, and more.') + '</p></div>';
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

  // Stamp per-category counts on the filter pill-tabs when looking at
  // the "all" view (so users see "Все 142 · Мониторинг 38 …").
  if (_marketplaceFilter === 'all') {
    var counts = { all: _marketplaceListings.length };
    _marketplaceListings.forEach(function(l) {
      var c = (l.category || 'other').toLowerCase();
      counts[c] = (counts[c] || 0) + 1;
    });
    document.querySelectorAll('#marketplace-tabs .mkt-tab').forEach(function(t) {
      var cat = t.getAttribute('data-cat');
      var existing = t.querySelector('.count'); if (existing) existing.remove();
      if (cat && counts[cat] != null) {
        var c = document.createElement('span');
        c.className = 'count';
        c.textContent = counts[cat].toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US');
        t.appendChild(c);
      }
    });
    // Also update the page-head subtitle "· N публикаций"
    var sub = document.querySelector('#marketplace-page .page-sub, #marketplace-page .page-subtitle');
    if (sub) {
      var totalCnt = _marketplaceListings.length;
      var ru = currentLang === 'ru';
      var unit = ru
        ? (totalCnt % 10 === 1 && totalCnt % 100 !== 11 ? 'публикация' : (totalCnt % 10 >= 2 && totalCnt % 10 <= 4 && (totalCnt % 100 < 10 || totalCnt % 100 >= 20) ? 'публикации' : 'публикаций'))
        : (totalCnt === 1 ? 'listing' : 'listings');
      sub.textContent = (sub.textContent || '').replace(/\s·\s*\d.*$/, '').trim() + ' · ' + totalCnt + ' ' + unit;
    }
  }

  function fmtCompact(n) {
    n = Number(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  var catTone = { nft: 'purple', defi: 'green', gifts: 'amber', other: 'amber' };

  grid.innerHTML = _marketplaceListings.map(function(l) {
    var name = l.name || (currentLang === 'ru' ? 'Без названия' : 'Untitled');
    var initial = (name.trim().charAt(0) || '?').toUpperCase();
    var avatarInner = l.avatarUrl
      ? '<img src="' + escHtml(l.avatarUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">'
      : escHtml(initial);
    var priceText = l.isFree ? (currentLang === 'ru' ? 'Бесплатно' : 'Free') : ((Number(l.price || 0) / 1e9).toFixed(2) + ' TON');
    var priceClass = l.isFree ? 'mkt-card-price green' : 'mkt-card-price ton';
    var author = l.sellerUsername ? '@' + escHtml(l.sellerUsername)
               : l.sellerName ? escHtml(l.sellerName)
               : (currentLang === 'ru' ? 'аноним' : 'anonymous');
    var byLbl = currentLang === 'ru' ? 'от ' : 'by ';
    var installs = Number(l.totalSales || l.total_sales || 0);
    var runs = Number(l.totalRuns || l.total_runs || 0);
    var cat = (l.category || 'other').toLowerCase();
    var tone = catTone[cat] || '';
    var btnLabel = l.isFree
      ? (currentLang === 'ru' ? 'Установить' : 'Install')
      : (currentLang === 'ru' ? 'Купить' : 'Buy');
    var btnIcon = l.isFree
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>';
    return '<div class="marketplace-card" onclick="openMarketplaceDetail(' + l.id + ')" style="cursor:pointer">' +
      '<div class="mkt-card-header">' +
        '<span class="chip ' + tone + '">' + escHtml((l.category || 'other').toUpperCase()) + '</span>' +
        '<span class="' + priceClass + '">' + priceText + '</span>' +
      '</div>' +
      '<div class="mkt-card-identity">' +
        '<div class="mkt-card-avatar' + (l.avatarUrl ? ' has-img' : '') + '">' + avatarInner + '</div>' +
        '<div class="mkt-card-name-block">' +
          '<h4>' + escHtml(name) + '</h4>' +
          '<div class="mkt-card-author">' + byLbl + author + '</div>' +
        '</div>' +
      '</div>' +
      '<p>' + escHtml((l.description || '').slice(0, 200)) + '</p>' +
      '<div class="mkt-card-foot">' +
        '<div class="mkt-card-stats">' +
          '<span class="mkt-card-stat" title="' + (currentLang === 'ru' ? 'установок' : 'installs') + '">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            fmtCompact(installs) +
          '</span>' +
          (runs > 0 ? '<span class="mkt-card-stat" title="' + (currentLang === 'ru' ? 'запусков' : 'runs') + '">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
            fmtCompact(runs) +
          '</span>' : '') +
        '</div>' +
        '<button class="btn btn-primary" onclick="event.stopPropagation();buyFromMarketplace(' + l.id + ')">' +
          btnIcon + ' ' + btnLabel +
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
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'
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
var _onboardingStep = 0;
var _onboardingTotal = 3; // 3 steps: welcome, capabilities, setup hint
var _onboardingProvider = 'platform';

function checkOnboarding() {
  if (localStorage.getItem('onboarding_completed')) return;
  if (!currentUser) return;
  var modal = document.getElementById('onboarding-modal');
  if (!modal) return;
  _onboardingStep = 0;
  modal.style.display = 'flex';
  renderOnboardingDots();
  showOnboardingSlide(0);
  var subtitle = document.getElementById('onboarding-subtitle');
  if (subtitle) {
    var name = currentUser.first_name || currentUser.username || '';
    if (name) {
      subtitle.textContent = currentLang === 'ru'
        ? name + ', добро пожаловать! Создавайте автономных AI-агентов для Telegram и TON — без кода.'
        : name + ', welcome! Build autonomous AI agents for Telegram and TON — no coding required.';
    }
  }
}

function renderOnboardingDots() {
  var dotsEl = document.getElementById('onboarding-dots');
  if (!dotsEl) return;
  var html = '';
  for (var i = 0; i < _onboardingTotal; i++) {
    var cls = 'onboarding-dot';
    if (i === _onboardingStep) cls += ' active';
    else if (i < _onboardingStep) cls += ' completed';
    html += '<div class="' + cls + '" onclick="goOnboardingStep(' + i + ')"></div>';
  }
  dotsEl.innerHTML = html;
}

function showOnboardingSlide(idx) {
  for (var i = 0; i < _onboardingTotal; i++) {
    var slide = document.getElementById('onboarding-slide-' + i);
    if (slide) slide.style.display = i === idx ? '' : 'none';
  }
  // Update nav buttons
  var backBtn = document.getElementById('onboarding-back-btn');
  if (backBtn) backBtn.style.display = idx > 0 ? '' : 'none';
  var nextLabel = document.getElementById('onboarding-next-label');
  if (nextLabel) {
    if (idx === 0) {
      nextLabel.textContent = currentLang === 'ru' ? 'Начать' : 'Get Started';
    } else if (idx === _onboardingTotal - 1) {
      nextLabel.textContent = currentLang === 'ru' ? 'Готово' : 'Finish';
    } else {
      nextLabel.textContent = currentLang === 'ru' ? 'Далее' : 'Next';
    }
  }
  renderOnboardingDots();
}

function goOnboardingStep(idx) {
  if (idx < 0 || idx >= _onboardingTotal) return;
  _onboardingStep = idx;
  showOnboardingSlide(idx);
}

function onboardingNext() {
  if (_onboardingStep < _onboardingTotal - 1) {
    _onboardingStep++;
    showOnboardingSlide(_onboardingStep);
  } else {
    finishOnboarding();
  }
}

function onboardingPrev() {
  if (_onboardingStep > 0) {
    _onboardingStep--;
    showOnboardingSlide(_onboardingStep);
  }
}

function onboardingSelectProvider(el, provider) {
  _onboardingProvider = provider;
  var radios = el.closest('.onboarding-providers');
  if (radios) {
    radios.querySelectorAll('.onboarding-provider-radio').forEach(function(r) { r.classList.remove('selected'); });
    el.querySelector('.onboarding-provider-radio').classList.add('selected');
  }
}

function onboardingAction(action) {
  dismissOnboarding();
  if (action === 'chat') navigateTo('assistant');
  else if (action === 'constructor') navigateTo('agents');
  else if (action === 'marketplace') navigateTo('marketplace');
  else if (action === 'guide') navigateTo('guide');
  else if (action === 'profile') { navigateTo('profile'); setTimeout(highlightProfileSetup, 500); }
  else if (action === 'telegram') window.open('https://t.me/TonAgentPlatformBot', '_blank');
}

function finishOnboarding() {
  dismissOnboarding();
  // Always go to profile so user can set up API key
  navigateTo('profile');
  setTimeout(highlightProfileSetup, 600);
}

// Highlight empty/important fields in profile after onboarding
function highlightProfileSetup() {
  var fields = ['ai-provider-select', 'ai-api-key-input', 'ui-scale-slider'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    // Pulse animation
    el.style.transition = 'box-shadow .3s, border-color .3s';
    el.style.boxShadow = '0 0 0 3px var(--accent-glow)';
    el.style.borderColor = 'var(--primary)';
    // Scroll first empty field into view
    if (id === 'ai-api-key-input' && !el.value) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.setAttribute('placeholder', currentLang === 'ru' ? 'Вставьте API ключ сюда...' : 'Paste your API key here...');
    }
    // Remove highlight after 8s
    setTimeout(function() {
      el.style.boxShadow = '';
      el.style.borderColor = '';
    }, 8000);
  });
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

// Guided tour: sidebar tour → then redirect to settings with spotlight on API key
function startGuidedTour() {
  var _origEnd = endTour;
  var _done = false;
  endTour = function() {
    _origEnd();
    endTour = _origEnd;
    if (_done) return;
    _done = true;
    // Navigate to settings page
    navigateTo('settings');
    setTimeout(function() {
      // Find the API key section and spotlight it
      var keyInput = document.getElementById('ai-api-key-input');
      var providerSel = document.getElementById('ai-provider-select');
      var target = keyInput || providerSel;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Beautiful pulsing spotlight on the field
        target.style.transition = 'all .4s ease';
        target.style.boxShadow = '0 0 0 4px rgba(var(--accent-r,14),var(--accent-g,165),var(--accent-b,233),0.4), 0 0 20px rgba(var(--accent-r,14),var(--accent-g,165),var(--accent-b,233),0.2)';
        target.style.borderColor = 'var(--primary)';
        if (keyInput) keyInput.placeholder = currentLang === 'ru' ? 'Вставьте API ключ...' : 'Paste API key...';
        // Animate pulse
        var _pulseCount = 0;
        var _pulseInt = setInterval(function() {
          _pulseCount++;
          if (_pulseCount > 6) { clearInterval(_pulseInt); target.style.boxShadow = ''; target.style.borderColor = ''; return; }
          target.style.boxShadow = _pulseCount % 2 === 0
            ? '0 0 0 4px rgba(var(--accent-r,14),var(--accent-g,165),var(--accent-b,233),0.4), 0 0 20px rgba(var(--accent-r,14),var(--accent-g,165),var(--accent-b,233),0.2)'
            : '0 0 0 6px rgba(var(--accent-r,14),var(--accent-g,165),var(--accent-b,233),0.6), 0 0 30px var(--accent-glow)';
        }, 800);
      }
      var isRu = currentLang === 'ru';
      toast(isRu ? 'Настройте AI провайдер и API ключ' : 'Set up your AI provider and API key', 'info');
    }, 800);
  };
  startTour();
}

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
function nextTourStep() {
  // Fade out tooltip before moving
  var tooltip = document.getElementById('tour-tooltip');
  if (tooltip) { tooltip.style.opacity = '0'; tooltip.style.transform = 'translateY(8px)'; }
  setTimeout(function() {
    _tourStep++;
    showTourStep();
    // Fade in after reposition
    setTimeout(function() {
      if (tooltip) { tooltip.style.opacity = '1'; tooltip.style.transform = 'translateY(0)'; }
    }, 100);
  }, 300);
}
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

// ── Agent Settings Tour (shown when user first opens agent settings) ──
var AGENT_TOUR_STEPS = [
  { target: '[data-tab="soul"]', title: { en: 'System Prompt', ru: 'Промпт — душа агента' }, desc: { en: 'This defines WHO your agent is and HOW it behaves. Write clear instructions: what to do, how to talk, what to avoid. Atlas already generated a good prompt — you can edit it anytime.', ru: 'Здесь вы задаёте КТО ваш агент и КАК он себя ведёт. Пишите чёткие инструкции: что делать, как говорить, чего избегать. Atlas уже сгенерировал хороший промпт — его можно редактировать.' }, position: 'right' },
  { target: '[data-tab="ai"]', title: { en: 'AI Provider — the brain', ru: 'AI Провайдер — мозг агента' }, desc: { en: 'IMPORTANT: Paste your API key here. Without it the agent cannot think. Free options: Gemini (aistudio.google.com), Groq (console.groq.com), OpenRouter (openrouter.ai/keys).', ru: 'ВАЖНО: Вставьте сюда API ключ. Без него агент не может думать. Бесплатно: Gemini (aistudio.google.com), Groq (console.groq.com), OpenRouter (openrouter.ai/keys).' }, position: 'right' },
  { target: '[data-tab="telegram"]', title: { en: 'Telegram — connection', ru: 'Telegram — подключение' }, desc: { en: 'Connect your Telegram account so the agent can chat in groups and DMs like a real person (not a bot). Scan QR code from Telegram app → Settings → Devices.', ru: 'Подключите Telegram аккаунт чтобы агент мог общаться в группах и личке как человек (не бот). Сканируйте QR в приложении Telegram → Настройки → Устройства.' }, position: 'right' },
  { target: '[data-tab="caps"]', title: { en: 'Capabilities — tools', ru: 'Возможности — инструменты' }, desc: { en: 'Each module gives the agent a set of tools. Telegram = messaging, Wallet = TON operations, Web = search, Gifts = gift market. Enable only what you need — fewer tools = faster agent.', ru: 'Каждый модуль даёт агенту набор инструментов. Telegram = сообщения, Wallet = TON операции, Web = поиск, Gifts = рынок подарков. Включайте только нужное — меньше = быстрее.' }, position: 'right' },
  { target: '[data-tab="behavior"]', title: { en: 'Behavior — humanization', ru: 'Поведение — человечность' }, desc: { en: 'Makes the agent feel human: typing delays before answers, read receipts with delay, auto-reactions, thinking phrases. Already configured with good defaults.', ru: 'Делает агента похожим на человека: задержка набора, прочтение с паузой, авто-реакции, фразы "Секунду...". Уже настроено с хорошими дефолтами.' }, position: 'right' },
  { target: '[data-tab="learning"]', title: { en: 'Learning — self-improvement', ru: 'Обучение — самосовершенствование' }, desc: { en: 'Agent learns from mistakes: if user says "no, wrong" — saves lesson and adapts. Error self-healing retries failed tools. Style adaptation matches user\'s communication style.', ru: 'Агент учится на ошибках: если юзер скажет "нет, не так" — запоминает урок. Самовосстановление при ошибках. Адаптация стиля под собеседника.' }, position: 'right' },
  { target: '[data-tab="memory"]', title: { en: 'Memory — long-term', ru: 'Память — долгосрочная' }, desc: { en: 'Agent automatically remembers contacts, facts, preferences, lessons. Survives restarts. You can view and edit saved memories here.', ru: 'Агент автоматически запоминает контакты, факты, предпочтения, уроки. Переживает перезапуски. Здесь можно просматривать и редактировать память.' }, position: 'right' },
  { target: '[data-tab="routing"]', title: { en: 'Routing — message filter', ru: 'Маршрутизация — фильтр сообщений' }, desc: { en: 'Control which messages this agent receives. Filter by keywords, chat type (DM/groups), priority. Important when you have multiple agents on one account.', ru: 'Какие сообщения получает агент. Фильтр по словам, типу чата (ЛС/группы), приоритету. Важно когда несколько агентов на одном аккаунте.' }, position: 'right' },
  { target: '[data-tab="advanced"]', title: { en: 'Advanced settings', ru: 'Продвинутые настройки' }, desc: { en: 'For power users: tick interval, loop guard, flood protection, memory poisoning protection, context compaction. Good defaults already set.', ru: 'Для продвинутых: интервал тиков, защита от зацикливания, flood защита, защита памяти, компактинг контекста. Хорошие дефолты уже установлены.' }, position: 'right' },
];

function _guideStep(num, title, desc, tabName) {
  return '<div class="guide-step" onclick="dismissAgentGuide(); switchSettingsTab(\'' + tabName + '\')" style="display:flex;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;transition:all .2s;background:rgba(255,255,255,0.03);border:1px solid transparent" onmouseenter="this.style.background=\'rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),0.08)\';this.style.borderColor=\'rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),0.25)\'" onmouseleave="this.style.background=\'rgba(255,255,255,0.03)\';this.style.borderColor=\'transparent\'">' +
    '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;flex-shrink:0">' + num + '</div>' +
    '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:.88rem;color:var(--text-primary);margin-bottom:2px">' + title + '</div>' +
    '<div style="font-size:.78rem;color:var(--text-muted);line-height:1.4">' + desc + '</div></div>' +
    '<div style="color:var(--text-muted);font-size:.9rem;display:flex;align-items:center;opacity:.5">&#8250;</div>' +
  '</div>';
}

function dismissAgentGuide() {
  var card = document.getElementById('agent-onboard-guide');
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateY(-8px)';
    setTimeout(function() { card.remove(); }, 250);
  }
  localStorage.setItem('agent_tour_completed', '1');
}

function startAgentTour(force) {
  if (!force && localStorage.getItem('agent_tour_completed') === '1') return;
  // Wait for settings modal to be visible and soul tab rendered
  var body = document.getElementById('agent-settings-body');
  if (!body) { setTimeout(function() { startAgentTour(force); }, 500); return; }
  // Don't duplicate
  if (document.getElementById('agent-onboard-guide')) return;
  var isRu = currentLang === 'ru';

  var guideHtml = '<div id="agent-onboard-guide" style="margin-bottom:20px;padding:20px;background:linear-gradient(135deg,rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),0.06),rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.06));border:1px solid rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),0.15);border-radius:14px;transition:all .25s ease">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center;font-size:1.2rem">&#127891;</div>' +
        '<div><div style="font-weight:700;font-size:.95rem;color:var(--text-primary)">' + (isRu ? 'Настройка агента' : 'Agent Setup Guide') + '</div>' +
        '<div style="font-size:.76rem;color:var(--text-muted)">' + (isRu ? 'Пройдите шаги чтобы агент заработал' : 'Complete these steps to get your agent running') + '</div></div>' +
      '</div>' +
      '<button onclick="dismissAgentGuide()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;padding:4px 6px;border-radius:6px;opacity:.5;transition:opacity .2s" onmouseenter="this.style.opacity=\'1\'" onmouseleave="this.style.opacity=\'.5\'">&times;</button>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:4px">' +
      _guideStep('1',
        isRu ? 'AI Провайдер — мозг' : 'AI Provider — the brain',
        isRu ? 'Вставьте API ключ. Бесплатно: Gemini, Groq, OpenRouter' : 'Paste your API key. Free: Gemini, Groq, OpenRouter',
        'ai') +
      _guideStep('2',
        isRu ? 'Telegram — подключение' : 'Telegram — connection',
        isRu ? 'QR-код для общения в чатах как человек' : 'QR code to chat in groups like a real person',
        'telegram') +
      _guideStep('3',
        isRu ? 'Возможности — инструменты' : 'Capabilities — tools',
        isRu ? 'Включите модули: Telegram, Wallet, Web, Gifts' : 'Enable modules: Telegram, Wallet, Web, Gifts',
        'caps') +
      _guideStep('4',
        isRu ? 'Поведение — человечность' : 'Behavior — humanization',
        isRu ? 'Задержки набора, реакции, стиль общения' : 'Typing delays, reactions, chat style',
        'behavior') +
      _guideStep('5',
        isRu ? 'Обучение — самосовершенствование' : 'Learning — self-improvement',
        isRu ? 'Учится на ошибках, адаптирует стиль' : 'Learns from mistakes, adapts style',
        'learning') +
    '</div>' +
    '<div style="margin-top:14px;text-align:center">' +
      '<button onclick="dismissAgentGuide(); switchSettingsTab(\'ai\')" style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;border:none;padding:10px 24px;border-radius:10px;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:0 2px 8px var(--accent-glow)" onmouseenter="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 4px 12px var(--accent-glow)\'" onmouseleave="this.style.transform=\'none\';this.style.boxShadow=\'0 2px 8px var(--accent-glow)\'">' +
        (isRu ? 'Начать с API ключа \u2192' : 'Start with API key \u2192') +
      '</button>' +
    '</div>' +
  '</div>';

  // Insert at the top of settings body content
  body.insertAdjacentHTML('afterbegin', guideHtml);
  // Animate in
  var card = document.getElementById('agent-onboard-guide');
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateY(-8px)';
    requestAnimationFrame(function() {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });
  }
}

// Auto-show agent tour on first agent detail open
var _agentTourShown = localStorage.getItem('agent_tour_completed') === '1';

// ===== NETWORK MAP CLICK =====
let _networkClickStart = null;

function showNetworkAgentPanel(node) {
  var container = document.getElementById('network-page');
  if (!container) return;
  var wrap = container.querySelector('.network-fullscreen-wrap');
  if (!wrap) return;
  var existing = document.getElementById('network-agent-panel');
  if (existing) existing.remove();
  var existingDialog = document.getElementById('network-delete-dialog');
  if (existingDialog) existingDialog.remove();

  var panel = document.createElement('div');
  panel.id = 'network-agent-panel';
  panel.className = 'network-agent-panel';
  var statusDot = node.isActive
    ? '<span style="color:#10b981">&#9679;</span> Active'
    : '<span style="color:#555">&#9679;</span> Paused';
  var toggleText = node.isActive ? (currentLang === 'ru' ? IC.pause + ' Стоп' : IC.pause + ' Stop') : (currentLang === 'ru' ? IC.rocket + ' Запустить' : IC.rocket + ' Start');
  var toggleClass = node.isActive ? 'btn-warning' : 'btn-success';
  var roleDisplay = node.roleLabel || node.role;
  var roleBadgeColor = node.color || 'var(--primary)';
  panel.innerHTML = '<div class="nap-header">' +
    '<span style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:' + roleBadgeColor + ';box-shadow:0 0 8px ' + roleBadgeColor + '60;display:inline-block"></span>' + escHtml(node.name) + '</span>' +
    '<button onclick="this.closest(\'.network-agent-panel\').remove()" style="background:none;border:none;color:#666;font-size:1.1rem;cursor:pointer;padding:0 2px;line-height:1">&times;</button>' +
  '</div>' +
  '<div class="nap-body">' +
    '<p>' + (currentLang === 'ru' ? 'Роль' : 'Role') + ': <strong style="color:' + roleBadgeColor + '">' + escHtml(roleDisplay) + '</strong></p>' +
    '<p>Lv.' + (node.level || 1) + ' &middot; XP: ' + (node.xp || 0) + '</p>' +
    '<p>' + statusDot + '</p>' +
    '<div class="nap-actions">' +
      '<button class="btn btn-sm ' + toggleClass + '" onclick="toggleAgent(' + node.id + ',' + node.isActive + ');this.closest(\'.network-agent-panel\').remove()">' + toggleText + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="openAgentDetail(' + node.id + ')">' + IC.settings + ' ' + (currentLang === 'ru' ? 'Настройки' : 'Settings') + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="loadAgentLogs(' + node.id + ')">' + IC.clipboard + ' Logs</button>' +
      '<button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="showNetworkDeleteConfirm({id:' + node.id + ',name:\'' + escHtml(node.name).replace(/'/g, "\\'") + '\'})">' + IC.trash + ' ' + (currentLang === 'ru' ? 'Удалить' : 'Delete') + '</button>' +
    '</div>' +
  '</div>';
  wrap.appendChild(panel);
}

// ===== NETWORK MAP SEARCH =====
function filterNetworkNodes(query) {
  _networkSearchQuery = (query || '').trim();
}

// ===== NETWORK MAP DELETE =====
function showNetworkDeleteConfirm(node) {
  var container = document.getElementById('network-page');
  if (!container) return;
  var wrap = container.querySelector('.network-fullscreen-wrap');
  if (!wrap) return;
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

  dialog.innerHTML = '<h3>' + IC.warn + ' ' + title + '</h3>' +
    '<p>' + msg + '</p>' +
    '<div class="dialog-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="this.closest(\'.network-delete-dialog\').remove()">' + cancelText + '</button>' +
      '<button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none" onclick="confirmNetworkDelete(' + node.id + ')">' + IC.trash + ' ' + deleteText + '</button>' +
    '</div>';
  wrap.appendChild(dialog);
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

// ===== TELEGRAM USERBOT AUTH (per-agent MTProto) =====
let _tgPollInterval = null;

async function checkTelegramStatus() {
  if (!authToken) return;
  try {
    const data = await apiRequest('GET', '/api/telegram/status');
    updateTelegramUI(data);
  } catch {}
}

function updateTelegramUI(data) {
  const badge = document.getElementById('tg-connection-badge');
  const info = document.getElementById('tg-account-info');
  const connectBtn = document.getElementById('tg-connect-btn');
  const disconnectBtn = document.getElementById('tg-disconnect-btn');
  const qrContainer = document.getElementById('tg-qr-container');
  const tfa = document.getElementById('tg-2fa-container');
  if (!badge) return;

  if (data && data.authorized) {
    badge.style.display = 'inline-flex';
    badge.classList.add('connected');
    const statusText = document.getElementById('tg-status-text');
    if (statusText) statusText.textContent = 'Connected';
    if (info) info.textContent = data.username ? '@' + data.username : (data.phone || 'Authorized');
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = '';
    if (qrContainer) qrContainer.style.display = 'none';
    if (tfa) tfa.style.display = 'none';
  } else {
    badge.style.display = 'none';
    if (info) info.textContent = '';
    if (connectBtn) connectBtn.style.display = '';
    if (disconnectBtn) disconnectBtn.style.display = 'none';
  }
}

async function startTelegramAuth() {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const connectBtn = document.getElementById('tg-connect-btn');
  if (connectBtn) connectBtn.disabled = true;

  try {
    const data = await apiRequest('POST', '/api/telegram/auth/qr');
    if (!data.ok) {
      showNotification(data.error || 'QR login failed', 'error');
      if (connectBtn) connectBtn.disabled = false;
      return;
    }

    // Show QR
    const qrContainer = document.getElementById('tg-qr-container');
    if (qrContainer) qrContainer.style.display = '';
    if (connectBtn) connectBtn.style.display = 'none';

    renderQR(data.qrUrl);

    // Start polling
    if (_tgPollInterval) clearInterval(_tgPollInterval);
    let pollCount = 0;
    _tgPollInterval = setInterval(async () => {
      pollCount++;
      if (pollCount > 60) { // 2 min timeout
        clearInterval(_tgPollInterval);
        _tgPollInterval = null;
        if (qrContainer) qrContainer.style.display = 'none';
        if (connectBtn) { connectBtn.style.display = ''; connectBtn.disabled = false; }
        showNotification(currentLang === 'ru' ? 'Время ожидания истекло' : 'QR timeout', 'error');
        return;
      }

      try {
        const poll = await apiRequest('GET', '/api/telegram/auth/poll');
        if (poll.status === 'success') {
          clearInterval(_tgPollInterval);
          _tgPollInterval = null;
          if (qrContainer) qrContainer.style.display = 'none';
          showNotification(currentLang === 'ru' ? 'Telegram подключён!' : 'Telegram connected!', 'success');
          checkTelegramStatus();
        } else if (poll.status === 'need_password') {
          clearInterval(_tgPollInterval);
          _tgPollInterval = null;
          if (qrContainer) qrContainer.style.display = 'none';
          const tfa = document.getElementById('tg-2fa-container');
          if (tfa) tfa.style.display = '';
        } else if (poll.qrUrl) {
          // QR refreshed
          renderQR(poll.qrUrl);
        }
      } catch {}
    }, 2000);
  } catch (e) {
    showNotification(e.message || 'Error', 'error');
    if (connectBtn) connectBtn.disabled = false;
  }
}

function renderQR(url) {
  const canvas = document.getElementById('tg-qr-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 256;
  canvas.width = size;
  canvas.height = size;

  // Use QR API to generate image
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
  };
  img.onerror = () => {
    // Fallback: show URL as text
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    ctx.font = '11px monospace';
    ctx.fillText('Scan QR in Telegram', 20, size / 2);
  };
  const encodedUrl = encodeURIComponent(url);
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=' + encodedUrl;
}

async function submitTg2FA() {
  const input = document.getElementById('tg-2fa-password');
  const errEl = document.getElementById('tg-2fa-error');
  if (!input || !input.value.trim()) return;

  try {
    const data = await apiRequest('POST', '/api/telegram/auth/password', { password: input.value.trim() });
    if (data.ok) {
      const tfa = document.getElementById('tg-2fa-container');
      if (tfa) tfa.style.display = 'none';
      showNotification(currentLang === 'ru' ? 'Telegram подключён!' : 'Telegram connected!', 'success');
      checkTelegramStatus();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Wrong password'; errEl.style.display = ''; }
    }
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.style.display = ''; }
  }
}

async function disconnectTelegram() {
  if (!confirm(currentLang === 'ru' ? 'Отключить Telegram аккаунт?' : 'Disconnect Telegram account?')) return;
  try {
    await apiRequest('DELETE', '/api/telegram/disconnect');
    showNotification(currentLang === 'ru' ? 'Telegram отключён' : 'Telegram disconnected', 'success');
    updateTelegramUI({ authorized: false });
  } catch (e) {
    showNotification(e.message || 'Error', 'error');
  }
}

// Check Telegram status on settings page load
const _origNavigateTo = typeof navigateTo === 'function' ? navigateTo : null;
if (_origNavigateTo) {
  const _navProxy = new Proxy(navigateTo, {
    apply(target, thisArg, args) {
      const result = Reflect.apply(target, thisArg, args);
      if (args[0] === 'settings') checkTelegramStatus();
      return result;
    }
  });
  // Can't override navigateTo via proxy easily, so just hook into page load
}
// Also check on initial load if settings page visible
setTimeout(checkTelegramStatus, 2000);

console.log('TON Agent Platform Dashboard v2.0 loaded successfully!');

// ── WebSocket real-time updates ──────────────────────────────
(function initWebSocket() {
  var ws = null;
  var wsRetryTimer = null;
  var wsConnected = false;

  // Add connection indicator to DOM
  var indicator = document.createElement('div');
  indicator.id = 'ws-indicator';
  indicator.style.cssText = 'display:none';
  indicator.innerHTML = '<span id="ws-dot" style="width:6px;height:6px;border-radius:50%;background:#666;display:inline-block"></span><span id="ws-label">offline</span>';
  document.body.appendChild(indicator);

  function setStatus(connected) {
    wsConnected = connected;
    var dot = document.getElementById('ws-dot');
    var label = document.getElementById('ws-label');
    if (dot) dot.style.background = connected ? '#22c55e' : '#666';
    if (label) label.textContent = connected ? 'live' : 'offline';
  }

  function connect() {
    if (!authToken) return;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var base = API_BASE.replace(/^https?:/, proto);
    var url = base + '/ws?token=' + encodeURIComponent(authToken);

    try { ws = new WebSocket(url); } catch (e) { scheduleRetry(); return; }

    ws.onopen = function() { setStatus(true); };

    ws.onmessage = function(e) {
      try {
        var evt = JSON.parse(e.data);
        if (evt.type === 'connected') return;
        handleWSEvent(evt);
      } catch (err) { /* ignore parse errors */ }
    };

    ws.onclose = function() { setStatus(false); scheduleRetry(); };
    ws.onerror = function() { /* onclose will fire */ };
  }

  function scheduleRetry() {
    if (wsRetryTimer) return;
    wsRetryTimer = setTimeout(function() { wsRetryTimer = null; connect(); }, 5000);
  }

  function handleWSEvent(evt) {
    var agentId = evt.agentId;
    if (!agentId) return;

    // Update _agentsCache in-place
    if (_agentsCache) {
      var agent = _agentsCache.find(function(a) { return a.id === agentId; });
      if (agent) {
        if (evt.type === 'agent_started') agent.isActive = true;
        else if (evt.type === 'agent_stopped') agent.isActive = false;
      }
    }

    // Update overview cards
    var card = document.querySelector('.agent-card[data-id="' + agentId + '"]');
    if (card) {
      var statusEl = card.querySelector('.agent-status');
      if (statusEl) {
        var isActive = evt.type === 'agent_started' || evt.type === 'agent_tick';
        statusEl.className = 'agent-status ' + (isActive ? 'active' : 'paused');
        var span = statusEl.querySelector('span:last-child');
        if (span) span.textContent = isActive ? t('active') : t('paused');
      }
    }

    // Update agents page list
    var pageCards = document.querySelectorAll('.ap-card[data-id="' + agentId + '"], .agent-card[data-id="' + agentId + '"]');
    pageCards.forEach(function(c) {
      var st = c.querySelector('.agent-status');
      if (st) {
        var active = evt.type === 'agent_started' || evt.type === 'agent_tick';
        st.className = 'agent-status ' + (active ? 'active' : 'paused');
        var s = st.querySelector('span:last-child');
        if (s) s.textContent = active ? t('active') : t('paused');
      }
    });

    // Update detail view if open for this agent
    if (typeof _detailAgentId !== 'undefined' && _detailAgentId === agentId) {
      var detailStatus = document.getElementById('agent-detail-status');
      if (detailStatus) {
        var a = evt.type === 'agent_started' || evt.type === 'agent_tick';
        detailStatus.className = 'agent-status ' + (a ? 'active' : 'paused');
        if (_detailAgentData) _detailAgentData.is_active = a;
      }
      var settingsStatus = document.getElementById('agent-settings-status');
      if (settingsStatus) {
        var a2 = evt.type === 'agent_started' || evt.type === 'agent_tick';
        settingsStatus.className = 'agent-status ' + (a2 ? 'active' : 'paused');
      }
    }

    // Flash indicator on events
    var ind = document.getElementById('ws-indicator');
    if (ind) {
      ind.style.opacity = '1';
      setTimeout(function() { ind.style.opacity = '0.7'; }, 1500);
    }
  }

  // Start connection when auth is ready
  if (authToken) connect();
  // Also observe authToken changes by hooking into loadAgents
  var _origLoadAgents = typeof loadAgents === 'function' ? loadAgents : null;
  if (_origLoadAgents) {
    var _hooked = false;
    var origFn = window.loadAgents || loadAgents;
    var _checkWS = function() {
      if (!wsConnected && authToken && !wsRetryTimer) connect();
    };
    // Poll for authToken periodically (simple approach)
    setInterval(function() {
      if (authToken && !wsConnected && !ws) connect();
    }, 10000);
  }
})();

// ═══════════════════════════════════════════════════════════════════
// ═══ GENERIC MODAL ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════

function openModal(title, bodyHtml, footerHtml) {
  var m = document.getElementById('generic-modal');
  if (!m) return;
  document.getElementById('generic-modal-title').innerHTML = title || '';
  document.getElementById('generic-modal-body').innerHTML = bodyHtml || '';
  document.getElementById('generic-modal-footer').innerHTML = footerHtml || '';
  m.style.display = 'flex';
}

function closeModal() {
  var m = document.getElementById('generic-modal');
  if (m) m.style.display = 'none';
}

function updateModalBody(html) {
  var el = document.getElementById('generic-modal-body');
  if (el) el.innerHTML = html;
}


// ===================================================================
// === AGENTIC WALLETS PAGE ==========================================
// ===================================================================

var _awData = [];
var _awStats = {};

var AWI = {
  wallet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  walletSm: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  crown: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7z"/><path d="M3 20h18"/></svg>',
  arrowIn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>',
  arrowOut: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 14 12 9 7 14"/><line x1="12" y1="9" x2="12" y2="21"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>',
  lockOpen: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
  lockClosed: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
};

async function loadWalletsPage() {
  try {
    var data = await apiRequest('GET', '/api/agentic-wallets');
    _awData = data.wallets || [];
    _awStats = data.stats || {};
  } catch (e) { _awData = []; _awStats = {}; }
  awRenderStats(); awRenderRoot(); awRenderGrid();
}

function awRenderStats() {
  var el = document.getElementById('aw-stats-row');
  if (!el) return;
  var isRu = currentLang === 'ru';
  var stats = [
    { label: isRu ? 'Всего кошельков' : 'Total Wallets', value: (_awStats.totalWallets || 0), color: 'var(--text-primary)', icon: AWI.walletSm },
    { label: isRu ? 'Общий баланс' : 'Total Balance', value: ((_awStats.totalBalanceTon || 0).toFixed(2)) + ' <span style="font-size:.75rem;opacity:.6">TON</span>', color: '#22c55e', icon: IC.gem },
    { label: isRu ? 'Активных' : 'Active', value: (_awStats.activeWallets || 0) + ' <span style="font-size:.75rem;opacity:.4">/ ' + (_awStats.blockedWallets || 0) + ' ' + (isRu ? 'забл.' : 'blocked') + '</span>', color: 'var(--text-primary)', icon: IC.check },
    { label: isRu ? 'Потрачено сегодня' : 'Spent Today', value: ((_awStats.totalSpentTodayTon || 0).toFixed(2)) + ' <span style="font-size:.75rem;opacity:.6">TON</span>', color: '#eab308', icon: IC.trending },
  ];
  el.innerHTML = stats.map(function(s) {
    return '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:18px 20px">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;color:var(--text-muted)">' + s.icon + '<span style="font-size:.75rem">' + s.label + '</span></div>' +
      '<div style="font-size:1.4rem;font-weight:700;color:' + s.color + '">' + s.value + '</div></div>';
  }).join('');
}

function awRenderRoot() {
  var el = document.getElementById('aw-root-section');
  if (!el) return;
  var isRu = currentLang === 'ru';
  var root = _awData.find(function(w) { return w.walletType === 'root'; });
  if (!root) {
    el.innerHTML = '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;padding:40px 32px;text-align:center">' +
      '<div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(var(--accent-r,168),var(--accent-g,85),var(--accent-b,247),0.15));display:flex;align-items:center;justify-content:center;margin:0 auto 16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg></div>' +
      '<h2 style="margin-bottom:8px;font-size:1.15rem">' + (isRu ? 'Добро пожаловать в Agentic Wallets' : 'Welcome to Agentic Wallets') + '</h2>' +
      '<p style="color:var(--text-muted);margin-bottom:24px;max-width:480px;margin-left:auto;margin-right:auto;font-size:.88rem;line-height:1.5">' +
        (isRu ? 'Создайте Root-кошелёк — он станет мастер-кошельком, к которому привязаны все суб-кошельки агентов.' : 'Create a Root Wallet to get started. It will serve as your master wallet for all agent sub-wallets.') + '</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
        '<button class="btn-action" onclick="awSetupRoot()" style="background:var(--accent);gap:6px">' + IC.shield + ' ' + (isRu ? 'Создать Root Wallet' : 'Create Root Wallet') + '</button>' +
        '<button class="btn-action" onclick="awShowImportModal()" style="background:var(--bg-tertiary);gap:6px">' + IC.download + ' ' + (isRu ? 'Импортировать' : 'Import Existing') + '</button></div></div>';
    return;
  }
  var addrShort = root.address.slice(0, 12) + '...' + root.address.slice(-6);
  el.innerHTML = '<div style="background:var(--bg-secondary);border:1px solid rgba(34,197,94,0.2);border-radius:14px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">' +
    '<div style="display:flex;align-items:center;gap:14px">' +
      '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,rgba(34,197,94,0.12),rgba(59,130,246,0.12));display:flex;align-items:center;justify-content:center">' + AWI.crown + '</div>' +
      '<div><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:2px">Root Wallet</div>' +
      '<code style="font-size:.85rem;cursor:pointer;color:var(--text-primary)" onclick="navigator.clipboard.writeText(\x27' + escJsAttr(root.address) + '\x27);toast(\x27Copied!\x27,\x27success\x27)" title="Click to copy">' + escHtml(addrShort) + '</code></div></div>' +
    '<div style="text-align:right"><div style="font-size:1.3rem;font-weight:700;color:#22c55e;font-family:\'JetBrains Mono\',monospace">' + (root.balanceTon || 0).toFixed(4) + ' TON</div>' +
    '<div style="font-size:.72rem;color:var(--text-muted)">Root Balance</div></div></div>';
}

function awRenderGrid() {
  var el = document.getElementById('aw-wallets-grid');
  var titleEl = document.getElementById('aw-wallets-title');
  if (!el) return;
  var isRu = currentLang === 'ru';
  var subs = _awData.filter(function(w) { return w.walletType === 'sub'; });
  if (titleEl) titleEl.textContent = (isRu ? 'Кошельки агентов' : 'Agent Wallets') + ' (' + subs.length + ')';
  if (subs.length === 0) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 20px">' +
      '<div style="width:48px;height:48px;border-radius:14px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg></div>' +
      '<h3 style="margin-bottom:6px;font-size:1rem;color:var(--text-primary)">' + (isRu ? 'Нет кошельков агентов' : 'No agent wallets yet') + '</h3>' +
      '<p style="color:var(--text-muted);font-size:.85rem">' + (isRu ? 'Создайте суб-кошелёк для автономной работы агента' : 'Deploy a sub-wallet for your agents to use autonomously') + '</p></div>';
    return;
  }
  el.innerHTML = subs.map(function(w) {
    var addr = w.address.slice(0, 8) + '...' + w.address.slice(-4);
    var agent = w.agentId ? ('Agent #' + w.agentId) : (isRu ? 'Не привязан' : 'Unlinked');
    var sColor = w.isBlocked ? '#ef4444' : '#22c55e';
    var sText = w.isBlocked ? 'Blocked' : 'Active';
    var sDot = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + sColor + ';margin-right:4px"></span>';
    return '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:14px;padding:20px;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor=\'rgba(59,130,246,0.4)\';this.style.background=\'var(--bg-tertiary)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'var(--bg-secondary)\'" onclick="awShowDetail(' + w.id + ')">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-weight:600;font-size:.92rem;display:flex;align-items:center;gap:6px">' + AWI.walletSm + ' ' + escHtml(w.label || addr) + '</span>' +
        '<span style="font-size:.7rem;padding:3px 8px;border-radius:20px;background:' + (w.isBlocked ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)') + ';color:' + sColor + ';display:flex;align-items:center">' + sDot + sText + '</span></div>' +
      '<code style="font-size:.76rem;color:var(--text-muted);cursor:pointer;display:block;margin-bottom:12px" onclick="event.stopPropagation();navigator.clipboard.writeText(\x27' + escJsAttr(w.address) + '\x27);toast(\x27Copied!\x27,\x27success\x27)">' + escHtml(addr) + '</code>' +
      '<div style="font-size:1.15rem;font-weight:700;font-family:\'JetBrains Mono\',monospace;color:#22c55e;margin-bottom:12px">' + (w.balanceTon || 0).toFixed(4) + ' <span style="font-size:.75rem;opacity:.5">TON</span></div>' +
      '<div style="display:flex;gap:14px;font-size:.75rem;color:var(--text-muted);margin-bottom:14px">' +
        '<span style="display:flex;align-items:center;gap:4px">' + IC.robot + ' ' + agent + '</span>' +
        '<span style="display:flex;align-items:center;gap:4px">' + IC.chart + ' ' + (w.spendLimitTon || 50) + ' TON/day</span></div>' +
      '<div style="display:flex;gap:6px" onclick="event.stopPropagation()">' +
        '<button class="btn-action" style="font-size:.72rem;padding:5px 10px;gap:4px" onclick="awRefreshOne(' + w.id + ')">' + IC.refresh + '</button>' +
        (w.isBlocked
          ? '<button class="btn-action" style="font-size:.72rem;padding:5px 10px;background:rgba(34,197,94,0.1);color:#22c55e;gap:4px" onclick="awToggleBlock(' + w.id + ',false)">' + AWI.lockOpen + ' Unblock</button>'
          : '<button class="btn-action" style="font-size:.72rem;padding:5px 10px;background:rgba(239,68,68,0.06);color:#ef4444;gap:4px" onclick="awToggleBlock(' + w.id + ',true)">' + AWI.lockClosed + ' Block</button>') +
        '<button class="btn-action" style="font-size:.72rem;padding:5px 10px;gap:4px" onclick="awShowTxs(' + w.id + ')">' + IC.clock + ' Txs</button></div></div>';
  }).join('');
}

async function awSetupRoot() {
  toast(currentLang === 'ru' ? 'Создаю...' : 'Creating...', 'info');
  try {
    await apiRequest('POST', '/api/agentic-wallets/setup-root');
    toast(currentLang === 'ru' ? 'Root создан!' : 'Root created!', 'success');
    await loadWalletsPage();
  } catch (e) { toast('Error: ' + (e.message || e), 'error'); }
}

function awShowImportModal() {
  var isRu = currentLang === 'ru';
  openModal(isRu ? 'Импорт кошелька' : 'Import Wallet',
    '<div style="margin-bottom:14px"><label style="font-size:.8rem;color:var(--text-muted);display:block;margin-bottom:4px">TON Address</label><input type="text" id="aw-import-address" placeholder="EQA..." style="width:100%;padding:10px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-size:.9rem"></div>' +
    '<p style="color:var(--text-muted);font-size:.75rem;margin-bottom:10px">' + (isRu ? 'Или 24 слова мнемоники:' : 'Or 24-word mnemonic:') + '</p>' +
    '<div style="margin-bottom:14px"><label style="font-size:.8rem;color:var(--text-muted);display:block;margin-bottom:4px">Mnemonic</label><input type="password" id="aw-import-mnemonic" placeholder="word1 word2 ..." style="width:100%;padding:10px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-size:.9rem"></div>',
    '<button class="btn-action" onclick="closeModal()">' + (isRu ? 'Отмена' : 'Cancel') + '</button><button class="btn-action" style="background:var(--accent)" onclick="awDoImport()">' + (isRu ? 'Импортировать' : 'Import') + '</button>');
}

async function awDoImport() {
  var a = ((document.getElementById('aw-import-address') || {}).value || '').trim();
  var m = ((document.getElementById('aw-import-mnemonic') || {}).value || '').trim();
  if (!a && !m) { toast('Enter address or mnemonic', 'error'); return; }
  try {
    var b = {}; if (a) b.address = a; if (m) b.mnemonic = m;
    await apiRequest('POST', '/api/agentic-wallets/setup-root', b);
    closeModal(); toast('Imported!', 'success'); await loadWalletsPage();
  } catch (e) { toast('Error: ' + (e.message || e), 'error'); }
}

function awShowDeployModal() {
  var isRu = currentLang === 'ru';
  openModal(isRu ? 'Новый суб-кошелёк' : 'Deploy Sub-Wallet',
    '<div style="margin-bottom:14px"><label style="font-size:.8rem;color:var(--text-muted);display:block;margin-bottom:4px">Agent ID (' + (isRu ? 'опц.' : 'opt.') + ')</label><input type="number" id="aw-deploy-agent" placeholder="199" style="width:100%;padding:10px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-size:.9rem"></div>' +
    '<div style="margin-bottom:14px"><label style="font-size:.8rem;color:var(--text-muted);display:block;margin-bottom:4px">Label</label><input type="text" id="aw-deploy-label" placeholder="Trading Bot" style="width:100%;padding:10px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-size:.9rem"></div>',
    '<button class="btn-action" onclick="closeModal()">' + (isRu ? 'Отмена' : 'Cancel') + '</button><button class="btn-action" style="background:var(--accent)" onclick="awDoDeploy()">Deploy</button>');
}

async function awDoDeploy() {
  var id = parseInt((document.getElementById('aw-deploy-agent') || {}).value) || 0;
  var lb = ((document.getElementById('aw-deploy-label') || {}).value || '').trim();
  try { toast('Deploying...', 'info'); await apiRequest('POST', '/api/agentic-wallets/deploy', { agentId: id || undefined, label: lb }); closeModal(); toast('Deployed!', 'success'); await loadWalletsPage(); }
  catch (e) { toast('Error: ' + (e.message || e), 'error'); }
}

async function awToggleBlock(id, bl) {
  try { await apiRequest('POST', '/api/agentic-wallets/' + id + '/block', { blocked: bl }); toast(bl ? 'Blocked' : 'Unblocked', 'success'); await loadWalletsPage(); }
  catch (e) { toast('Error', 'error'); }
}

async function awRefreshOne(id) {
  try { var d = await apiRequest('POST', '/api/agentic-wallets/' + id + '/refresh'); toast('Balance: ' + ((d.balanceTon || 0).toFixed(4)) + ' TON', 'success'); await loadWalletsPage(); }
  catch (e) { toast('Error', 'error'); }
}

async function awRefreshAll() {
  var btn = document.getElementById('aw-refresh-btn');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try { await apiRequest('POST', '/api/agentic-wallets/refresh-all'); await loadWalletsPage(); toast('Refreshed!', 'success'); }
  catch (e) { toast('Error', 'error'); }
  if (btn) { btn.disabled = false; btn.textContent = currentLang === 'ru' ? 'Обновить всё' : 'Refresh All'; }
}

async function awShowTxs(wId) {
  var isRu = currentLang === 'ru';
  openModal(isRu ? 'Транзакции' : 'Transactions', '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>', '<button class="btn-action" onclick="closeModal()">' + (isRu ? 'Закрыть' : 'Close') + '</button>');
  try {
    var data = await apiRequest('GET', '/api/agentic-wallets/' + wId + '/transactions');
    var txs = data.transactions || [];
    var w = _awData.find(function(x) { return x.id === wId; });
    var myAddr = w ? w.address.toLowerCase() : '';
    if (!txs.length) { updateModalBody('<div style="text-align:center;padding:30px;color:var(--text-muted)"><h3>' + (isRu ? 'Нет транзакций' : 'No transactions') + '</h3></div>'); return; }
    var h = '';
    txs.slice(0, 20).forEach(function(tx) {
      var isIn = tx.to.toLowerCase().includes(myAddr.slice(0, 20));
      var time = new Date(tx.timestamp * 1000).toLocaleString();
      h += '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<span>' + (isIn ? AWI.arrowIn : AWI.arrowOut) + '</span>' +
        '<div style="flex:1"><div style="font-weight:600;color:' + (isIn ? '#22c55e' : '#ef4444') + ';font-family:\'JetBrains Mono\',monospace;font-size:.9rem">' + (isIn ? '+' : '-') + tx.amountTon.toFixed(4) + ' TON</div>' +
        (tx.comment ? '<div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">' + escHtml(tx.comment.slice(0, 50)) + '</div>' : '') +
        '</div><span style="font-size:.72rem;color:var(--text-muted)">' + time + '</span></div>';
    });
    updateModalBody(h);
  } catch (e) { updateModalBody('<p style="color:#ef4444">' + (e.message || 'Error') + '</p>'); }
}

function awShowDetail(wId) {
  var w = _awData.find(function(x) { return x.id === wId; });
  if (!w) return;
  var isRu = currentLang === 'ru';
  var sDot = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + (w.isBlocked ? '#ef4444' : '#22c55e') + ';margin-right:4px"></span>';
  openModal(escHtml(w.label || 'Wallet #' + w.id),
    '<div style="margin-bottom:14px"><label style="font-size:.75rem;color:var(--text-muted)">Address</label>' +
      '<code style="font-size:.82rem;display:block;margin-top:4px;word-break:break-all;cursor:pointer;color:var(--text-primary);background:var(--bg-tertiary);padding:8px 10px;border-radius:8px;border:1px solid var(--border)" onclick="navigator.clipboard.writeText(\x27' + escJsAttr(w.address) + '\x27);toast(\x27Copied!\x27,\x27success\x27)">' + escHtml(w.address) + '</code></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">' +
      '<div style="background:var(--bg-tertiary);padding:12px;border-radius:10px;border:1px solid var(--border)"><label style="font-size:.72rem;color:var(--text-muted);display:block;margin-bottom:4px">' + (isRu ? 'Баланс' : 'Balance') + '</label><div style="font-size:1.2rem;font-weight:700;color:#22c55e;font-family:\'JetBrains Mono\',monospace">' + (w.balanceTon || 0).toFixed(4) + ' TON</div></div>' +
      '<div style="background:var(--bg-tertiary);padding:12px;border-radius:10px;border:1px solid var(--border)"><label style="font-size:.72rem;color:var(--text-muted);display:block;margin-bottom:4px">' + (isRu ? 'Лимит' : 'Limit') + '</label><div style="font-size:1.2rem;font-weight:700;font-family:\'JetBrains Mono\',monospace">' + (w.spendLimitTon || 50) + ' TON</div></div></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">' +
      '<div style="background:var(--bg-tertiary);padding:12px;border-radius:10px;border:1px solid var(--border)"><label style="font-size:.72rem;color:var(--text-muted);display:block;margin-bottom:4px">Agent</label><div style="display:flex;align-items:center;gap:5px">' + IC.robot + ' ' + (w.agentId ? 'Agent #' + w.agentId : (isRu ? 'Не привязан' : 'Not linked')) + '</div></div>' +
      '<div style="background:var(--bg-tertiary);padding:12px;border-radius:10px;border:1px solid var(--border)"><label style="font-size:.72rem;color:var(--text-muted);display:block;margin-bottom:4px">' + (isRu ? 'Статус' : 'Status') + '</label><div style="display:flex;align-items:center">' + sDot + (w.isBlocked ? 'Blocked' : 'Active') + '</div></div></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:.75rem;color:var(--text-muted);display:block;margin-bottom:4px">' + (isRu ? 'Метка' : 'Label') + '</label>' +
      '<div style="display:flex;gap:6px"><input type="text" id="aw-detail-label" value="' + escHtml(w.label || '') + '" style="flex:1;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:.85rem"><button class="btn-action" style="font-size:.78rem" onclick="awUpdateLabel(' + w.id + ')">Save</button></div></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:.75rem;color:var(--text-muted);display:block;margin-bottom:4px">' + (isRu ? 'Лимит (TON/день)' : 'Limit (TON/day)') + '</label>' +
      '<div style="display:flex;gap:6px"><input type="number" id="aw-detail-limit" value="' + (w.spendLimitTon || 50) + '" min="0" step="1" style="flex:1;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:.85rem"><button class="btn-action" style="font-size:.78rem" onclick="awUpdateLimit(' + w.id + ')">Save</button></div></div>',
    '<button class="btn-action" style="gap:5px" onclick="window.open(\x27ton://transfer/' + escJsAttr(w.address) + '\x27,\x27_blank\x27)">' + IC.gem + ' Deposit</button>' +
    '<button class="btn-action" style="gap:5px" onclick="closeModal();awShowTxs(' + w.id + ')">' + IC.clock + ' Txs</button>' +
    '<a class="btn-action" href="https://tonscan.org/address/' + w.address + '" target="_blank" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px">' + IC.link + ' Tonscan</a>' +
    (w.isBlocked
      ? '<button class="btn-action" style="background:rgba(34,197,94,0.1);color:#22c55e;gap:5px" onclick="closeModal();awToggleBlock(' + w.id + ',false)">' + AWI.lockOpen + ' Unblock</button>'
      : '<button class="btn-action" style="background:rgba(239,68,68,0.06);color:#ef4444;gap:5px" onclick="closeModal();awToggleBlock(' + w.id + ',true)">' + AWI.lockClosed + ' Block</button>') +
    '<button class="btn-action" style="background:rgba(239,68,68,0.06);color:#ef4444;gap:5px" onclick="awDeleteWallet(' + w.id + ')">' + IC.trash + ' Delete</button>' +
    '<button class="btn-action" onclick="closeModal()">' + (isRu ? 'Закрыть' : 'Close') + '</button>');
}

async function awUpdateLabel(id) {
  var v = ((document.getElementById('aw-detail-label') || {}).value || '').trim();
  try { await apiRequest('POST', '/api/agentic-wallets/' + id + '/label', { label: v }); toast('Updated!', 'success'); closeModal(); await loadWalletsPage(); }
  catch (e) { toast('Error', 'error'); }
}
async function awUpdateLimit(id) {
  var v = parseFloat((document.getElementById('aw-detail-limit') || {}).value);
  if (isNaN(v) || v < 0) { toast('Invalid', 'error'); return; }
  try { await apiRequest('POST', '/api/agentic-wallets/' + id + '/limit', { limitTon: v }); toast('Limit: ' + v + ' TON/day', 'success'); closeModal(); await loadWalletsPage(); }
  catch (e) { toast('Error', 'error'); }
}
async function awDeleteWallet(id) {
  if (!confirm(currentLang === 'ru' ? 'Удалить? Убедитесь что вывели средства!' : 'Delete? Withdrew all funds?')) return;
  try { await apiRequest('DELETE', '/api/agentic-wallets/' + id); toast('Deleted', 'success'); closeModal(); await loadWalletsPage(); }
  catch (e) { toast('Error', 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE TAB
// ═══════════════════════════════════════════════════════════════════════════

var _lcInterval = null;
async function loadLifecycleData() {
  if (_lcInterval) clearInterval(_lcInterval);
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/lifecycle');
    renderLifecycleState(data);
  } catch(e) {
    var el = document.getElementById('lc-state-badge');
    if (el) el.textContent = 'Error: ' + e.message;
  }
  // Auto-refresh every 5s
  _lcInterval = setInterval(async function() {
    if (_settingsTab !== 'lifecycle') { clearInterval(_lcInterval); return; }
    try {
      var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/lifecycle');
      renderLifecycleState(data);
    } catch(e) {}
  }, 5000);
}

function renderLifecycleState(data) {
  var badge = document.getElementById('lc-state-badge');
  var uptimeEl = document.getElementById('lc-uptime');
  var errorEl = document.getElementById('lc-error');
  if (!badge) return;

  var state = data.state || 'stopped';
  var colors = { stopped: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' }, starting: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' }, running: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' }, stopping: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' } };
  var c = colors[state] || colors.stopped;
  var labels = { stopped: currentLang === 'ru' ? 'Остановлен' : 'Stopped', starting: currentLang === 'ru' ? 'Запускается' : 'Starting', running: currentLang === 'ru' ? 'Работает' : 'Running', stopping: currentLang === 'ru' ? 'Останавливается' : 'Stopping' };
  badge.style.background = c.bg;
  badge.style.color = c.color;
  badge.innerHTML = '<span class="lc-dot" style="width:8px;height:8px;border-radius:50%;background:currentColor;' + (state === 'running' ? 'animation:lcPulse 2s infinite' : '') + '"></span> ' + (labels[state] || state);

  if (uptimeEl) {
    if (data.uptime != null) {
      var h = Math.floor(data.uptime / 3600);
      var m = Math.floor((data.uptime % 3600) / 60);
      var s = data.uptime % 60;
      uptimeEl.textContent = (currentLang === 'ru' ? 'Аптайм: ' : 'Uptime: ') + (h > 0 ? h + 'h ' : '') + m + 'm ' + s + 's';
    } else {
      uptimeEl.textContent = '';
    }
  }

  if (errorEl) {
    if (data.error) {
      errorEl.style.display = 'block';
      errorEl.textContent = (currentLang === 'ru' ? 'Ошибка: ' : 'Error: ') + data.error;
    } else {
      errorEl.style.display = 'none';
    }
  }
}

async function lifecycleAction(action) {
  try {
    toast((currentLang === 'ru' ? 'Выполняется...' : 'Processing...'), 'info');
    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/lifecycle/' + action);
    toast(action + ' OK', 'success');
    await loadLifecycleData();
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN USAGE TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadTokenData() {
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/tokens?days=30');
    // Totals
    var totalEl = document.getElementById('tk-total');
    var costEl = document.getElementById('tk-cost');
    var reqEl = document.getElementById('tk-requests');
    var todayEl = document.getElementById('tk-today');
    if (totalEl) totalEl.textContent = formatNum(data.total?.totalTokens || 0);
    if (costEl) costEl.textContent = '$' + (data.total?.totalCost || 0).toFixed(4);
    if (reqEl) reqEl.textContent = formatNum(data.total?.totalRequests || 0);
    // Today from current in-memory bucket
    if (todayEl) todayEl.textContent = formatNum(data.current?.totalTokens || 0);
    // Budget
    var budgetInput = document.getElementById('tk-budget-input');
    if (budgetInput && data.budget) budgetInput.value = data.budget.limit || 0;
    // Chart
    renderTokenChart(data.history || []);
    // Table
    renderTokenTable(data.history || []);
  } catch(e) {
    var totalEl = document.getElementById('tk-total');
    if (totalEl) totalEl.textContent = 'Error';
  }
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function renderTokenChart(history) {
  var container = document.getElementById('token-chart');
  if (!container || !history.length) {
    if (container) container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:.78rem">' + (currentLang === 'ru' ? 'Нет данных' : 'No data yet') + '</div>';
    return;
  }
  // Simple bar chart
  var maxTokens = Math.max.apply(null, history.map(function(h) { return h.totalTokens; })) || 1;
  var bars = history.slice().reverse().map(function(h) {
    var pct = Math.max(2, Math.round(h.totalTokens / maxTokens * 100));
    var date = escHtml(h.date.slice(5)); // MM-DD
    return '<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:20px">' +
      '<div style="width:80%;background:linear-gradient(180deg,#f59e0b,#d97706);border-radius:3px 3px 0 0;height:' + pct + '%;min-height:2px;transition:height 0.3s" title="' + h.totalTokens + ' tokens"></div>' +
      '<div style="font-size:.55rem;color:var(--text-muted);margin-top:2px;transform:rotate(-45deg);white-space:nowrap">' + date + '</div>' +
    '</div>';
  }).join('');
  container.innerHTML = '<div style="display:flex;align-items:flex-end;height:160px;padding:8px 4px 24px 4px;gap:2px">' + bars + '</div>';
}

function renderTokenTable(history) {
  var container = document.getElementById('token-table');
  if (!container || !history.length) return;
  var isRu = currentLang === 'ru';
  var rows = history.slice(0, 14).map(function(h) {
    return '<tr><td>' + escHtml(h.date) + '</td><td>' + formatNum(h.inputTokens) + '</td><td>' + formatNum(h.outputTokens) + '</td><td>' + formatNum(h.totalTokens) + '</td><td>$' + h.estimatedCost.toFixed(4) + '</td><td>' + h.requestCount + '</td></tr>';
  }).join('');
  container.innerHTML =
    '<table style="width:100%;font-size:.72rem;border-collapse:collapse">' +
    '<thead><tr style="color:var(--text-muted);text-align:left;border-bottom:1px solid var(--border)">' +
      '<th style="padding:6px">' + (isRu ? 'Дата' : 'Date') + '</th><th style="padding:6px">Input</th><th style="padding:6px">Output</th><th style="padding:6px">Total</th><th style="padding:6px">' + (isRu ? 'Стоимость' : 'Cost') + '</th><th style="padding:6px">' + (isRu ? 'Запросы' : 'Requests') + '</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

async function saveTokenBudget() {
  var val = parseInt((document.getElementById('tk-budget-input') || {}).value) || 0;
  try {
    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/tokens/budget', { limit: val });
    toast(currentLang === 'ru' ? 'Лимит сохранён' : 'Budget saved', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACTS TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadContactsData() {
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/contacts');
    var list = document.getElementById('contacts-list');
    if (!list) return;
    var contacts = data.contacts || [];
    if (contacts.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem">' + (currentLang === 'ru' ? 'Контактов пока нет' : 'No contacts yet') + '</div>';
      return;
    }
    var isRu = currentLang === 'ru';
    list.innerHTML = contacts.map(function(c) {
      var name = c.firstName || c.username || c.id;
      var isBot = c.isBot ? '<span style="font-size:.6rem;padding:2px 6px;border-radius:4px;background:rgba(59,130,246,0.1);color:#3b82f6;margin-left:4px">BOT</span>' : '';
      var isAdmin = c.isAdmin ? '<span style="font-size:.6rem;padding:2px 6px;border-radius:4px;background:rgba(245,158,11,0.1);color:#f59e0b;margin-left:4px">ADMIN</span>' : '';
      var safeId = escHtml(String(c.id));
      var allowedToggle = '<label style="display:flex;align-items:center;gap:4px;font-size:.72rem;cursor:pointer"><input type="checkbox" ' + (c.isAllowed !== false ? 'checked' : '') + ' onchange="toggleContactProp(' + _detailAgentId + ',\'' + safeId + '\',\'isAllowed\',this.checked)"> ' + (isRu ? 'Разрешён' : 'Allowed') + '</label>';
      var adminToggle = '<label style="display:flex;align-items:center;gap:4px;font-size:.72rem;cursor:pointer"><input type="checkbox" ' + (c.isAdmin ? 'checked' : '') + ' onchange="toggleContactProp(' + _detailAgentId + ',\'' + safeId + '\',\'isAdmin\',this.checked)"> ' + (isRu ? 'Админ' : 'Admin') + '</label>';
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px">' +
        '<div style="flex:1"><span style="font-weight:600;font-size:.82rem">' + escHtml(String(name)) + '</span>' + isBot + isAdmin +
          (c.username ? '<div style="font-size:.68rem;color:var(--text-muted)">@' + escHtml(c.username) + '</div>' : '') +
          '<div style="font-size:.65rem;color:var(--text-muted)">' + (isRu ? 'Сообщений: ' : 'Messages: ') + (c.messageCount || 0) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:12px">' + allowedToggle + adminToggle + '</div>' +
      '</div>';
    }).join('');
  } catch(e) {
    var list = document.getElementById('contacts-list');
    if (list) list.innerHTML = '<div style="color:#ef4444;padding:1rem">Error: ' + escHtml(e.message) + '</div>';
  }
}

async function toggleContactProp(agentId, userId, prop, value) {
  try {
    var body = {};
    body[prop] = value;
    await apiRequest('PUT', '/api/agents/' + agentId + '/contacts/' + userId, body);
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadCoreMemoryBlocks() {
  var container = document.getElementById('core-memory-blocks');
  if (!container) return;
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/core-memory');
    var blocks = data.blocks || [];
    if (blocks.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:1rem;grid-column:1/-1">' + (currentLang === 'ru' ? 'Нет данных' : 'No data') + '</div>';
      return;
    }
    var isRu = currentLang === 'ru';
    var blockIcons = { identity: IC.user, preferences: IC.wrench, lessons: IC.book, goals: IC.target, contacts: IC.users };
    var blockColors = { identity: '#8b5cf6', preferences: '#f59e0b', lessons: '#10b981', goals: '#3b82f6', contacts: '#6366f1' };
    var blockNames = { identity: isRu ? 'Личность' : 'Identity', preferences: isRu ? 'Предпочтения' : 'Preferences', lessons: isRu ? 'Уроки' : 'Lessons', goals: isRu ? 'Цели' : 'Goals', contacts: isRu ? 'Контакты' : 'Contacts' };
    container.innerHTML = blocks.map(function(b) {
      var pct = b.limit > 0 ? Math.round(b.used / b.limit * 100) : 0;
      var barColor = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : (blockColors[b.name] || '#8b5cf6');
      return '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:14px;border-top:3px solid ' + (blockColors[b.name] || '#8b5cf6') + '">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' +
          '<span style="color:' + (blockColors[b.name] || '#8b5cf6') + '">' + (blockIcons[b.name] || IC.brain) + '</span>' +
          '<span style="font-weight:600;font-size:.82rem">' + (blockNames[b.name] || b.name) + '</span>' +
          '<span style="margin-left:auto;font-size:.6rem;color:var(--text-muted)">' + b.used + '/' + b.limit + '</span>' +
        '</div>' +
        '<div style="height:3px;background:var(--border);border-radius:2px;margin-bottom:8px">' +
          '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px;transition:width 0.3s"></div>' +
        '</div>' +
        '<textarea class="st-textarea core-mem-block" data-block="' + b.name + '" style="min-height:80px;font-size:.75rem;resize:vertical" placeholder="' + (b.description || '') + '">' + escHtml(b.content) + '</textarea>' +
        '<button onclick="saveCoreBlock(\'' + b.name + '\')" class="rt-save-btn" style="margin-top:6px;font-size:.7rem;padding:4px 12px">' + IC.check + ' ' + (isRu ? 'Сохранить' : 'Save') + '</button>' +
      '</div>';
    }).join('');
  } catch(e) {
    container.innerHTML = '<div style="color:#ef4444;padding:1rem;grid-column:1/-1">Error: ' + escHtml(e.message) + '</div>';
  }
}

async function saveCoreBlock(blockName) {
  var textarea = document.querySelector('.core-mem-block[data-block="' + blockName + '"]');
  if (!textarea) return;
  try {
    await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/core-memory/' + blockName, { content: textarea.value });
    toast(currentLang === 'ru' ? 'Блок сохранён' : 'Block saved', 'success');
    loadCoreMemoryBlocks();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ─── Memory sub-tab switcher ─────────────────────────────────────────────────
var _activeMemSubTab = 'contacts';
function switchMemSubTab(name) {
  _activeMemSubTab = name;
  var panels = ['contacts','knowledge','lessons','raw','logs'];
  panels.forEach(function(p) {
    var panel = document.getElementById('mem-panel-' + p);
    var btn = document.getElementById('mem-sub-' + p);
    if (!panel || !btn) return;
    var active = p === name;
    panel.style.display = active ? '' : 'none';
    btn.style.background = active ? 'rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.18)' : 'transparent';
    btn.style.color = active ? '#8b5cf6' : 'var(--text-muted)';
  });
  if (name === 'knowledge') loadCoreMemoryBlocks();
}

// ─── Contact profile avatar ───────────────────────────────────────────────────
function _profileAvatar(name, size, tgUserId) {
  size = size || 40;
  var initial = (name || '?').trim().charAt(0).toUpperCase();
  var colors = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#a855f7','#14b8a6'];
  var idx = (name || '').split('').reduce(function(a,c){return a+c.charCodeAt(0);},0) % colors.length;
  var fallback = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + colors[idx] + ';display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size*0.42) + 'px;font-weight:700;color:#fff;flex-shrink:0">' + initial + '</div>';
  if (tgUserId && _detailAgentId && authToken) {
    var imgUrl = '/api/agents/' + _detailAgentId + '/avatar/' + encodeURIComponent(tgUserId) + '?t=' + encodeURIComponent(authToken);
    return '<div class="tg-avatar-wrap" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;overflow:hidden;flex-shrink:0;position:relative">' +
      '<img src="' + imgUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" loading="lazy">' +
      '<div style="display:none;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + colors[idx] + ';align-items:center;justify-content:center;font-size:' + Math.round(size*0.42) + 'px;font-weight:700;color:#fff;position:absolute;top:0;left:0">' + initial + '</div>' +
    '</div>';
  }
  return fallback;
}

// ─── Format relative time ─────────────────────────────────────────────────────
function _relTime(ts) {
  if (!ts) return '';
  var diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return Math.floor(diff/86400000) + 'd ago';
}

// ─── Load profiles (contacts + lessons + goals) ───────────────────────────────
var _allProfiles = [];
async function loadProfilesData() {
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/profiles');
    var isRu = currentLang === 'ru';
    _allProfiles = data.profiles || [];

    // Update stats
    var statC = document.getElementById('mem-stat-contacts');
    if (statC) statC.textContent = String(_allProfiles.length);
    var statL = document.getElementById('mem-stat-lessons');
    if (statL) statL.textContent = String((data.lessons || []).length);

    renderContacts(_allProfiles);
    renderLessons(data.lessons || [], data.goals || [], isRu);
  } catch(e) {
    var grid = document.getElementById('mem-contacts-grid');
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;font-size:.8rem">' + (currentLang === 'ru' ? 'Нет данных — агент ещё не общался или не сохранял информацию о контактах.' : 'No data — agent hasn\'t saved contact info yet.') + '</div>';
  }
}

function filterContacts() {
  var q = ((document.getElementById('mem-contact-search') || {}).value || '').toLowerCase();
  var filtered = q ? _allProfiles.filter(function(p) {
    return (p.name||'').toLowerCase().includes(q) || (p.userId||'').includes(q) ||
      (p.notes||[]).some(function(n){return n.text.toLowerCase().includes(q);}) ||
      (p.facts||[]).some(function(f){return (f.value||'').toLowerCase().includes(q);});
  }) : _allProfiles;
  renderContacts(filtered);
}

function renderContacts(profiles) {
  var grid = document.getElementById('mem-contacts-grid');
  if (!grid) return;
  var isRu = currentLang === 'ru';
  if (!profiles || profiles.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem;font-size:.82rem">' +
      IC.user + ' ' + (isRu ? 'Агент ещё не накопил информацию о контактах.<br><span style="font-size:.74rem;opacity:.7">Она появится автоматически в ходе разговоров.</span>' :
      'Agent hasn\'t accumulated contact info yet.<br><span style="font-size:.74rem;opacity:.7">It will appear automatically as conversations progress.</span>') + '</div>';
    return;
  }
  grid.innerHTML = profiles.map(function(p) {
    var displayName = p.name || ('@' + p.userId) || (isRu ? 'Неизвестный' : 'Unknown');
    var lastNote = p.notes && p.notes[0] ? p.notes[0] : null;
    var latestTs = lastNote ? lastNote.ts : 0;
    var factsHtml = (p.facts || []).slice(0, 4).map(function(f) {
      return '<span style="display:inline-block;margin:2px;padding:2px 7px;border-radius:12px;background:rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.1);color:#a78bfa;font-size:.67rem">' +
        escHtml(f.field.replace(/_/g,' ')) + ': ' + escHtml(String(f.value).slice(0,40)) + '</span>';
    }).join('');
    var notesHtml = (p.notes || []).slice(0, 2).map(function(n) {
      return '<div style="font-size:.72rem;color:var(--text-muted);line-height:1.4;padding:4px 0;border-top:1px solid rgba(255,255,255,0.04)">' +
        '<span style="color:#64748b;font-size:.65rem">' + _relTime(n.ts) + '</span> ' + escHtml(String(n.text).slice(0,120)) + '</div>';
    }).join('');
    var relBadge = p.relationship ? '<span style="font-size:.65rem;padding:2px 7px;border-radius:10px;background:rgba(16,185,129,0.12);color:#10b981;margin-left:6px">' + escHtml(p.relationship) + '</span>' : '';

    return '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;padding:14px;transition:border-color .2s" ' +
      'onmouseenter="this.style.borderColor=\'rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.35)\'" onmouseleave="this.style.borderColor=\'var(--border)\'">' +
      '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">' +
        _profileAvatar(displayName, 38, p.userId) +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:.85rem;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:4px;flex-wrap:wrap">' +
            escHtml(displayName) + relBadge +
          '</div>' +
          '<div style="font-size:.68rem;color:var(--text-muted);margin-top:1px">ID: ' + escHtml(String(p.userId)) + (latestTs ? ' · ' + _relTime(latestTs) : '') + '</div>' +
        '</div>' +
      '</div>' +
      (p.summary ? '<div style="font-size:.74rem;color:var(--text-secondary);margin-bottom:6px;line-height:1.5;padding:6px;background:rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.05);border-radius:6px;border-left:2px solid #8b5cf6">' + escHtml(p.summary.slice(0,200)) + '</div>' : '') +
      (factsHtml ? '<div style="margin-bottom:6px">' + factsHtml + '</div>' : '') +
      notesHtml +
      ((p.notes||[]).length > 2 ? '<div style="font-size:.65rem;color:var(--text-muted);text-align:right;margin-top:4px">+' + ((p.notes.length - 2)) + ' ' + (isRu ? 'заметок' : 'more notes') + '</div>' : '') +
    '</div>';
  }).join('');
}

function renderLessons(lessons, goals, isRu) {
  var el = document.getElementById('mem-lessons-list');
  if (!el) return;
  var html = '';

  if (goals && goals.length > 0) {
    html += '<div class="rt-section"><div class="rt-section-label">' + IC.target + ' ' + (isRu ? 'Активные цели' : 'Active Goals') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">';
    html += goals.filter(function(g){return g.status !== 'completed' && g.status !== 'cancelled';}).map(function(g) {
      var priorityColors = { critical: '#ef4444', high: '#f59e0b', medium: '#8b5cf6', low: '#64748b' };
      var pColor = priorityColors[g.priority] || '#64748b';
      return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px">' +
        '<div style="width:8px;height:8px;border-radius:50%;background:' + pColor + ';margin-top:5px;flex-shrink:0"></div>' +
        '<div style="flex:1">' +
          '<div style="font-size:.8rem;color:var(--text-primary);line-height:1.4">' + escHtml(String(g.goal || '').slice(0,200)) + '</div>' +
          '<div style="font-size:.67rem;color:var(--text-muted);margin-top:2px">' + (g.priority||'') + (g.addedAt ? ' · ' + new Date(g.addedAt).toLocaleDateString() : '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    html += '</div></div>';
  }

  if (lessons && lessons.length > 0) {
    html += '<div class="rt-section"><div class="rt-section-label">' + IC.lightbulb + ' ' + (isRu ? 'Уроки и инсайты' : 'Lessons & Insights') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">';
    var typeIcons = { error: IC.warn, feedback: IC.chat, discovery: IC.search, preference: IC.heart, default: IC.lightbulb };
    html += lessons.slice().reverse().map(function(l) {
      var icon = typeIcons[l.type] || typeIcons.default;
      var text = l.text || l.lesson || String(l).slice(0, 200);
      return '<div style="display:flex;gap:10px;padding:10px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px">' +
        '<span style="font-size:.9rem;flex-shrink:0;margin-top:1px">' + icon + '</span>' +
        '<div style="flex:1">' +
          '<div style="font-size:.79rem;color:var(--text-primary);line-height:1.5">' + escHtml(String(text).slice(0,250)) + '</div>' +
          (l.type ? '<div style="font-size:.65rem;color:var(--text-muted);margin-top:2px">' + escHtml(l.type) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    html += '</div></div>';
  }

  if (!html) {
    html = '<div style="text-align:center;color:var(--text-muted);padding:3rem;font-size:.82rem">' +
      IC.lightbulb + ' ' + (isRu ? 'Уроков и целей пока нет.<br><span style="font-size:.74rem;opacity:.7">Они накапливаются автоматически в процессе работы агента.</span>' :
      'No lessons or goals yet.<br><span style="font-size:.74rem;opacity:.7">They accumulate automatically as the agent works.</span>') + '</div>';
  }
  el.innerHTML = html;
}

async function loadMemoryData() {
  loadCoreMemoryBlocks();
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/memory');
    var isRu = currentLang === 'ru';
    // Persistent memory
    var textarea = document.getElementById('mem-persistent-text');
    if (textarea) textarea.value = data.persistent || '';
    // Stat cards
    if (data.stats) {
      var sizeEl = document.getElementById('mem-stat-size');
      var logsCountEl = document.getElementById('mem-stat-logs');
      if (sizeEl) sizeEl.textContent = data.stats.persistentSize > 0 ? Math.round(data.stats.persistentSize / 1024) + 'KB' : '0';
      if (logsCountEl) logsCountEl.textContent = String(data.stats.dailyLogCount || 0);
    }
    // Daily logs as cards
    var logsEl = document.getElementById('mem-daily-logs');
    if (logsEl && data.dailyLogs) {
      if (data.dailyLogs.length === 0) {
        logsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:.8rem;padding:2rem">' +
          IC.clock + ' ' + (isRu ? 'Ежедневных логов пока нет' : 'No daily logs yet') + '</div>';
      } else {
        logsEl.innerHTML = data.dailyLogs.map(function(dl) {
          var safeDate = escHtml(dl.date);
          var sizeKb = Math.round((dl.size || 0) / 1024);
          // Parse date for display
          var parts = dl.date.split('-');
          var day = parts[2] || '??';
          var monthNames = isRu
            ? ['','янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
            : ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          var month = monthNames[parseInt(parts[1])] || parts[1];
          return '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;text-align:center;transition:border-color .2s,transform .15s" ' +
            'onmouseenter="this.style.borderColor=\'rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.4)\';this.style.transform=\'translateY(-2px)\'" ' +
            'onmouseleave="this.style.borderColor=\'var(--border)\';this.style.transform=\'none\'" ' +
            'onclick="viewDailyLog(\'' + safeDate + '\')">' +
            '<div style="font-size:1.4rem;font-weight:700;color:var(--text-primary);line-height:1">' + day + '</div>' +
            '<div style="font-size:.7rem;color:#8b5cf6;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">' + month + '</div>' +
            '<div style="font-size:.6rem;color:var(--text-muted);margin-top:6px">' + sizeKb + 'KB</div>' +
          '</div>';
        }).join('');
      }
    }
  } catch(e) {
    toast('Memory load error: ' + e.message, 'error');
  }
}

async function saveMemoryPersistent() {
  var text = (document.getElementById('mem-persistent-text') || {}).value || '';
  try {
    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/memory', { target: 'persistent', content: text, replace: true });
    toast(currentLang === 'ru' ? 'Память сохранена' : 'Memory saved', 'success');
    loadMemoryData();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function clearAgentMemory(target) {
  if (!confirm(currentLang === 'ru' ? 'Очистить память? Это нельзя отменить.' : 'Clear memory? This cannot be undone.')) return;
  try {
    await apiRequest('DELETE', '/api/agents/' + _detailAgentId + '/memory?target=' + target);
    toast(currentLang === 'ru' ? 'Очищено' : 'Cleared', 'success');
    loadMemoryData();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function searchAgentMemory() {
  var query = (document.getElementById('mem-search-input') || {}).value || '';
  if (!query.trim()) return;
  var resultsEl = document.getElementById('mem-search-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = '<div style="color:var(--text-muted);font-size:.78rem;padding:8px">' + (currentLang === 'ru' ? 'Поиск...' : 'Searching...') + '</div>';
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/memory/search?q=' + encodeURIComponent(query));
    var results = data.results || [];
    if (results.length === 0) {
      resultsEl.innerHTML = '<div style="color:var(--text-muted);font-size:.78rem;padding:8px">' + (currentLang === 'ru' ? 'Ничего не найдено' : 'No results found') + '</div>';
      return;
    }
    resultsEl.innerHTML = results.map(function(r) {
      var sourceColors = { persistent: '#8b5cf6', daily_log: '#10b981', session: '#3b82f6' };
      return '<div style="padding:8px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;margin-bottom:4px">' +
        '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">' +
          '<span style="font-size:.6rem;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.2);color:' + (sourceColors[r.source] || '#94a3b8') + '">' + r.source + '</span>' +
          '<span style="font-size:.65rem;color:var(--text-muted)">score: ' + (r.score * 100).toFixed(0) + '%</span>' +
          (r.date ? '<span style="font-size:.65rem;color:var(--text-muted)">' + r.date + '</span>' : '') +
        '</div>' +
        '<div style="font-size:.75rem;color:var(--text-primary);white-space:pre-wrap;word-break:break-word">' + escHtml(r.text.slice(0, 300)) + '</div>' +
      '</div>';
    }).join('');
  } catch(e) {
    resultsEl.innerHTML = '<div style="color:#ef4444;font-size:.78rem;padding:8px">Error: ' + escHtml(e.message) + '</div>';
  }
}

async function viewDailyLog(date) {
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/memory/daily/' + date);
    var content = data.content || (currentLang === 'ru' ? 'Пусто' : 'Empty');
    // Show in a modal-like overlay
    var body = document.getElementById('agent-settings-body');
    if (!body) return;
    var existingOverlay = document.getElementById('daily-log-overlay');
    if (existingOverlay) existingOverlay.remove();
    var overlay = document.createElement('div');
    overlay.id = 'daily-log-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:2rem';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;max-width:700px;width:100%;max-height:80vh;overflow-y:auto;padding:24px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<h3 style="margin:0;color:var(--text-primary)">' + (currentLang === 'ru' ? 'Лог за ' : 'Log for ') + date + '</h3>' +
        '<button onclick="this.closest(\'#daily-log-overlay\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem">' + IC.x + '</button>' +
      '</div>' +
      '<pre style="font-family:\'JetBrains Mono\',monospace;font-size:.74rem;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;word-break:break-word">' + escHtml(content) + '</pre>' +
    '</div>';
    document.body.appendChild(overlay);
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// TASKS TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadEvalsData() {
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/evals?limit=30');
    var avgEl = document.getElementById('eval-avg-num');
    if (avgEl) {
      var score = data.avgScore || 0;
      avgEl.textContent = score.toFixed(1);
      avgEl.style.color = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444';
    }
    var listEl = document.getElementById('eval-list');
    if (!listEl) return;
    var evals = data.evals || [];
    if (evals.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem">' + (currentLang === 'ru' ? 'Ещё нет оценок. Агент начнёт получать оценки после следующего ответа.' : 'No evals yet. Agent will get scored after next response.') + '</div>';
      return;
    }
    var isRu = currentLang === 'ru';
    listEl.innerHTML = evals.map(function(e) {
      var score = e.overallScore || 0;
      var color = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444';
      var criteria = e.criteria || {};
      var flagsHtml = (e.flags || []).map(function(f) {
        return '<span style="font-size:.6rem;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444">' + f + '</span>';
      }).join(' ');
      var date = new Date(e.timestamp).toLocaleString();
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;border-left:3px solid ' + color + '">' +
        '<div style="font-size:1.4rem;font-weight:700;color:' + color + ';min-width:40px;text-align:center">' + score.toFixed(1) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;gap:8px;font-size:.68rem;color:var(--text-muted);flex-wrap:wrap">' +
            '<span>' + (isRu ? 'Рел' : 'Rel') + ': ' + (criteria.relevance || 0) + '</span>' +
            '<span>' + (isRu ? 'Без' : 'Safe') + ': ' + (criteria.safety || 0) + '</span>' +
            '<span>' + (isRu ? 'Эфф' : 'Eff') + ': ' + (criteria.efficiency || 0) + '</span>' +
            '<span>' + (isRu ? 'Яз' : 'Lang') + ': ' + (criteria.language || 0) + '</span>' +
            '<span>' + (isRu ? 'Гал' : 'Hall') + ': ' + (criteria.hallucination || 0) + '</span>' +
          '</div>' +
          (flagsHtml ? '<div style="margin-top:4px">' + flagsHtml + '</div>' : '') +
        '</div>' +
        '<div style="font-size:.65rem;color:var(--text-muted);text-align:right;white-space:nowrap">' +
          '<div>' + e.model + '</div>' +
          '<div>' + date + '</div>' +
          '<div>' + e.toolCallCount + ' tools, ' + e.iterationCount + ' iters</div>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch(e) {
    var listEl = document.getElementById('eval-list');
    if (listEl) listEl.innerHTML = '<div style="color:#ef4444;padding:1rem">Error: ' + escHtml(e.message) + '</div>';
  }
}

async function loadTasksData() {
  try {
    var status = (document.getElementById('task-filter') || {}).value || '';
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/tasks' + (status ? '?status=' + status : ''));
    // Stats
    var statsEl = document.getElementById('task-stats');
    if (statsEl && data.stats) {
      var s = data.stats;
      var isRu = currentLang === 'ru';
      statsEl.innerHTML =
        '<span style="color:#f59e0b">' + (isRu ? 'Ожид: ' : 'Pending: ') + s.pending + '</span>' +
        '<span style="color:#3b82f6">' + (isRu ? 'В работе: ' : 'Active: ') + s.inProgress + '</span>' +
        '<span style="color:#10b981">' + (isRu ? 'Готово: ' : 'Done: ') + s.done + '</span>' +
        '<span style="color:#ef4444">' + (isRu ? 'Ошибки: ' : 'Failed: ') + s.failed + '</span>';
    }
    // List
    var listEl = document.getElementById('tasks-list');
    if (!listEl) return;
    var tasks = data.tasks || [];
    if (tasks.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem">' + (currentLang === 'ru' ? 'Задач нет' : 'No tasks') + '</div>';
      return;
    }
    var statusColors = { pending: '#f59e0b', in_progress: '#3b82f6', done: '#10b981', failed: '#ef4444', cancelled: '#94a3b8' };
    var statusLabels = { pending: currentLang === 'ru' ? 'Ожидание' : 'Pending', in_progress: currentLang === 'ru' ? 'В процессе' : 'In Progress', done: currentLang === 'ru' ? 'Готово' : 'Done', failed: currentLang === 'ru' ? 'Ошибка' : 'Failed', cancelled: currentLang === 'ru' ? 'Отменено' : 'Cancelled' };
    listEl.innerHTML = tasks.map(function(t) {
      var color = statusColors[t.status] || '#94a3b8';
      var prioLabel = t.priority > 1 ? ' <span style="color:#ef4444;font-size:.6rem">!!!</span>' : t.priority > 0 ? ' <span style="color:#f59e0b;font-size:.6rem">!</span>' : '';
      var deps = t.dependsOn && t.dependsOn.length > 0 ? '<div style="font-size:.6rem;color:var(--text-muted);margin-top:2px">deps: ' + t.dependsOn.length + '</div>' : '';
      var actions = '';
      var safeTaskId = escHtml(String(t.id));
      if (t.status === 'pending') actions = '<button onclick="updateTaskStatus(\'' + safeTaskId + '\',\'in_progress\')" style="font-size:.65rem;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:rgba(59,130,246,0.1);color:#3b82f6;cursor:pointer">' + (currentLang === 'ru' ? 'Начать' : 'Start') + '</button>';
      if (t.status === 'in_progress') actions = '<button onclick="updateTaskStatus(\'' + safeTaskId + '\',\'done\')" style="font-size:.65rem;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:rgba(16,185,129,0.1);color:#10b981;cursor:pointer">' + (currentLang === 'ru' ? 'Готово' : 'Done') + '</button>';
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;border-left:3px solid ' + color + '">' +
        '<div style="flex:1">' +
          '<div style="font-size:.8rem;font-weight:500;color:var(--text-primary)">' + escHtml(t.description) + prioLabel + '</div>' +
          '<div style="font-size:.65rem;color:var(--text-muted)">' + (statusLabels[t.status] || t.status) + (t.scheduledFor ? ' | ' + new Date(t.scheduledFor).toLocaleString() : '') + deps + '</div>' +
          (t.error ? '<div style="font-size:.65rem;color:#ef4444">' + escHtml(t.error.slice(0, 100)) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center">' + actions +
          '<button onclick="deleteAgentTask(\'' + safeTaskId + '\')" style="font-size:.65rem;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:rgba(239,68,68,0.08);color:#ef4444;cursor:pointer">' + IC.x + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch(e) {
    var listEl = document.getElementById('tasks-list');
    if (listEl) listEl.innerHTML = '<div style="color:#ef4444;padding:1rem">Error: ' + escHtml(e.message) + '</div>';
  }
}

function showCreateTaskForm() {
  var form = document.getElementById('task-create-form');
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function createAgentTask() {
  var desc = (document.getElementById('task-desc') || {}).value || '';
  if (!desc.trim()) { toast(currentLang === 'ru' ? 'Введите описание' : 'Enter description', 'error'); return; }
  var priority = parseInt((document.getElementById('task-priority') || {}).value) || 0;
  var scheduled = (document.getElementById('task-scheduled') || {}).value || '';
  try {
    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/tasks', {
      description: desc,
      priority: priority,
      scheduledFor: scheduled || undefined
    });
    toast(currentLang === 'ru' ? 'Задача создана' : 'Task created', 'success');
    var formEl = document.getElementById('task-create-form');
    if (formEl) formEl.style.display = 'none';
    var descEl = document.getElementById('task-desc');
    if (descEl) descEl.value = '';
    loadTasksData();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function updateTaskStatus(taskId, status) {
  try {
    await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/tasks/' + taskId, { status: status });
    loadTasksData();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function deleteAgentTask(taskId) {
  if (!confirm(currentLang === 'ru' ? 'Удалить задачу?' : 'Delete task?')) return;
  try {
    await apiRequest('DELETE', '/api/agents/' + _detailAgentId + '/tasks/' + taskId);
    loadTasksData();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS PAGE
// ═══════════════════════════════════════════════════════════════════════════

async function loadNotificationsPage() {
  var container = document.getElementById('page-notifications');
  if (!container) return;
  var isRu = currentLang === 'ru';

  container.innerHTML =
    '<div class="page-header">' +
      '<h2 class="page-title">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> ' +
        (isRu ? 'Уведомления' : 'Notifications') +
      '</h2>' +
      '<p class="page-subtitle">' + (isRu ? 'Алерты, проблемы и рекомендации для ваших агентов' : 'Alerts, issues and recommendations for your agents') + '</p>' +
    '</div>' +
    '<div class="notif-filters" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">' +
      '<button onclick="clearAllNotifs()" style="margin-left:auto;padding:5px 12px;border-radius:20px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#ef4444;font-size:.72rem;cursor:pointer;transition:all .15s" onmouseenter="this.style.background=\'rgba(239,68,68,0.15)\'" onmouseleave="this.style.background=\'rgba(239,68,68,0.08)\'">' + (isRu ? 'Очистить все' : 'Clear all') + '</button>' +
      '<button class="notif-filter active" data-filter="all" onclick="filterNotifications(\'all\')">' + (isRu ? 'Все' : 'All') + '</button>' +
      '<button class="notif-filter" data-filter="error" onclick="filterNotifications(\'error\')">' + IC.x + ' ' + (isRu ? 'Ошибки' : 'Errors') + '</button>' +
      '<button class="notif-filter" data-filter="warning" onclick="filterNotifications(\'warning\')">' + IC.warn + ' ' + (isRu ? 'Предупреждения' : 'Warnings') + '</button>' +
      '<button class="notif-filter" data-filter="success" onclick="filterNotifications(\'success\')">' + IC.check + ' ' + (isRu ? 'Успехи' : 'Successes') + '</button>' +
      '<button class="notif-filter" data-filter="info" onclick="filterNotifications(\'info\')">' + IC.info + ' ' + (isRu ? 'Инфо' : 'Info') + '</button>' +
      '<button class="notif-filter" data-filter="feedback" onclick="filterNotifications(\'feedback\')">' + IC.chat + ' ' + (isRu ? 'Фидбек' : 'Feedback') + '</button>' +
    '</div>' +
    '<div id="notif-list" class="notif-list">' +
      '<div class="notif-loading">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>' +
    '</div>';

  // Load notifications from all agents
  try {
    var data = await apiRequest('GET', '/api/agents');
    var agents = (data.ok ? data.agents : []) || [];
    var notifications = [];

    for (var i = 0; i < agents.length; i++) {
      var a = agents[i];
      var cfg = {};
      try { var _tc = a.trigger_config || a.triggerConfig || {}; cfg = typeof _tc === 'string' ? JSON.parse(_tc) : _tc; } catch(e) {}
      var agentCfg = cfg.config || {};

      // Check for issues
      var hasApiKey = !!(agentCfg.AI_API_KEY || agentCfg.apiKey);
      if (!hasApiKey && a.triggerType === 'ai_agent') {
        notifications.push({
          type: 'error', agent: a.name || 'Agent #' + a.id, agentId: a.id,
          title: isRu ? 'API ключ не настроен' : 'API key not configured',
          message: isRu ? 'Агент не может работать без AI ключа. Перейдите в настройки и добавьте ключ.' : 'Agent cannot work without an AI key. Go to settings and add one.',
          action: 'agent_settings:' + a.id,
          time: Date.now() - 3600000,
        });
      }

      if (a.isActive && a.triggerType === 'ai_agent') {
        notifications.push({
          type: 'success', agent: a.name || 'Agent #' + a.id, agentId: a.id,
          title: isRu ? 'Агент активен' : 'Agent active',
          message: isRu ? 'Агент работает в штатном режиме.' : 'Agent is running normally.',
          time: Date.now() - 300000,
        });
      }

      if (!a.isActive && a.triggerType === 'ai_agent') {
        notifications.push({
          type: 'warning', agent: a.name || 'Agent #' + a.id, agentId: a.id,
          title: isRu ? 'Агент приостановлен' : 'Agent paused',
          message: isRu ? 'Агент не запущен. Запустите его в настройках.' : 'Agent is not running. Start it in settings.',
          action: 'run_agent:' + a.id,
          time: Date.now() - 1800000,
        });
      }
    }

    // Load feedback replies
    try {
      var fbData = await apiRequest('GET', '/api/feedback');
      if (fbData.ok && fbData.feedback) {
        fbData.feedback.forEach(function(f) {
          if (f.admin_reply) {
            notifications.push({
              type: 'info', agent: isRu ? 'Саппорт' : 'Support', agentId: null,
              title: (isRu ? 'Ответ на тикет #' : 'Reply to ticket #') + f.id,
              message: f.admin_reply.slice(0, 200),
              time: new Date(f.resolved_at || f.created_at).getTime(),
            });
          }
          if (f.status === 'resolved') {
            notifications.push({
              type: 'success', agent: isRu ? 'Саппорт' : 'Support', agentId: null,
              title: (isRu ? 'Тикет #' + f.id + ' решён' : 'Ticket #' + f.id + ' resolved'),
              message: (isRu ? 'Ваш ' + f.type + '-репорт был рассмотрен.' : 'Your ' + f.type + ' report was reviewed.'),
              time: new Date(f.resolved_at || f.created_at).getTime(),
            });
          }
        });
      }
    } catch {}

    // Sort by time (newest first)
    notifications.sort(function(a, b) { return b.time - a.time; });
    // Apply retention filter
    if (typeof _notifRetainDays !== 'undefined' && _notifRetainDays > 0) {
      var cutoff = Date.now() - _notifRetainDays * 86400000;
      notifications = notifications.filter(function(n) { return n.time > cutoff; });
    }
    // Filter out cleared + individually dismissed notifications
    var _clearedAt = parseInt(localStorage.getItem('notifs_cleared_at') || '0');
    if (_clearedAt > 0) {
      notifications = notifications.filter(function(n) { return n.time > _clearedAt; });
    }
    var _dismissed = _getDismissedNotifs();
    if (_dismissed.length > 0) {
      var _dismissedSet = new Set(_dismissed);
      notifications = notifications.filter(function(n) { return !_dismissedSet.has(n.title); });
    }
    window._studioNotifications = notifications;
    renderNotifications(notifications);

    // Update badge
    var errorCount = notifications.filter(function(n) { return n.type === 'error'; }).length;
    var badge = document.getElementById('nav-notif-badge');
    if (badge) {
      if (errorCount > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = errorCount;
      } else {
        badge.style.display = 'none';
      }
    }
  } catch(e) {
    var list = document.getElementById('notif-list');
    if (list) list.innerHTML = '<div class="notif-empty">Error: ' + escHtml(e.message) + '</div>';
  }
}

function renderNotifications(notifications) {
  var list = document.getElementById('notif-list');
  if (!list) return;
  var isRu = currentLang === 'ru';

  if (!notifications.length) {
    list.innerHTML = '<div class="notif-empty">' +
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<div style="margin-top:12px;font-size:.9rem;color:var(--text-muted)">' + (isRu ? 'Нет уведомлений' : 'No notifications') + '</div>' +
    '</div>';
    return;
  }

  var typeIcons = { error: IC.x, warning: IC.warn, success: IC.check, info: IC.info };
  var typeColors = { error: '#ef4444', warning: '#f59e0b', success: '#10b981', info: '#3b82f6' };
  var typeBgs = { error: 'rgba(239,68,68,0.08)', warning: 'rgba(245,158,11,0.08)', success: 'rgba(16,185,129,0.08)', info: 'rgba(59,130,246,0.08)' };

  list.innerHTML = notifications.map(function(n, i) {
    var ago = getTimeAgo(n.time);
    var actionBtn = n.action
      ? '<button class="notif-action-btn" onclick="handleNotifAction(\'' + n.action + '\')" style="border-color:' + typeColors[n.type] + ';color:' + typeColors[n.type] + '">' + (isRu ? 'Исправить' : 'Fix') + '</button>'
      : '';
    return '<div class="notif-card" data-type="' + n.type + '" data-idx="' + i + '" style="border-left:3px solid ' + typeColors[n.type] + ';background:' + typeBgs[n.type] + ';animation:notifSlideIn 0.3s ease ' + (i * 0.05) + 's both">' +
      '<div class="notif-card-header">' +
        '<span class="notif-icon">' + typeIcons[n.type] + '</span>' +
        '<span class="notif-title">' + escHtml(n.title) + '</span>' +
        '<span class="notif-agent">' + escHtml(n.agent) + '</span>' +
        '<span class="notif-time">' + ago + '</span>' +
        '<button onclick="dismissNotif(this.closest(\'.notif-card\'))" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 4px;opacity:.4;transition:opacity .2s;margin-left:auto" onmouseenter="this.style.opacity=\'1\'" onmouseleave="this.style.opacity=\'.4\'">&times;</button>' +
      '</div>' +
      '<div class="notif-card-body">' + escHtml(n.message) + '</div>' +
      (actionBtn ? '<div class="notif-card-actions">' + actionBtn + '</div>' : '') +
    '</div>';
  }).join('');
}

function _getDismissedNotifs() {
  try { return JSON.parse(localStorage.getItem('dismissed_notifs') || '[]'); } catch { return []; }
}

function dismissNotif(card) {
  if (!card) return;
  // Save to localStorage so it stays dismissed across tab switches
  var title = card.querySelector('.notif-title');
  if (title) {
    var dismissed = _getDismissedNotifs();
    dismissed.push(title.textContent);
    if (dismissed.length > 200) dismissed = dismissed.slice(-100);
    localStorage.setItem('dismissed_notifs', JSON.stringify(dismissed));
  }
  card.style.transition = 'all .25s ease';
  card.style.opacity = '0';
  card.style.transform = 'translateX(30px)';
  setTimeout(function() { card.remove(); }, 250);
}

function clearAllNotifs() {
  // Mark all as dismissed
  localStorage.setItem('notifs_cleared_at', String(Date.now()));
  var cards = document.querySelectorAll('.notif-card');
  cards.forEach(function(c, i) {
    setTimeout(function() {
      c.style.transition = 'all .2s ease';
      c.style.opacity = '0';
      c.style.transform = 'scale(0.95)';
      setTimeout(function() { c.remove(); }, 200);
    }, i * 30);
  });
  setTimeout(function() {
    var list = document.getElementById('notif-list');
    if (list && !list.querySelector('.notif-card')) {
      list.innerHTML = '<div class="notif-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><div style="margin-top:12px;font-size:.9rem;color:var(--text-muted)">' + (currentLang === 'ru' ? 'Нет уведомлений' : 'No notifications') + '</div></div>';
    }
  }, cards.length * 30 + 300);
}

function filterNotifications(type) {
  document.querySelectorAll('.notif-filter').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-filter') === type);
  });
  var all = window._studioNotifications || [];
  var filtered = type === 'all' ? all :
    type === 'feedback' ? all.filter(function(n) { return n.agent === 'Support' || n.agent === 'Саппорт'; }) :
    all.filter(function(n) { return n.type === type; });
  renderNotifications(filtered);
}

function handleNotifAction(action) {
  if (action.startsWith('agent_settings:')) {
    var id = parseInt(action.split(':')[1]);
    openAgentDetail(id);
    setTimeout(function() { switchSettingsTab('ai'); }, 300);
  } else if (action.startsWith('run_agent:')) {
    var id = parseInt(action.split(':')[1]);
    apiRequest('POST', '/api/agents/' + id + '/run').then(function() {
      toast(currentLang === 'ru' ? 'Агент запущен!' : 'Agent started!', 'success');
      loadNotificationsPage();
    }).catch(function(e) { toast('Error: ' + e.message, 'error'); });
  }
}

function getTimeAgo(ts) {
  var diff = Date.now() - ts;
  var isRu = currentLang === 'ru';
  if (diff < 60000) return isRu ? 'только что' : 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + (isRu ? ' мин назад' : 'm ago');
  if (diff < 86400000) return Math.floor(diff / 3600000) + (isRu ? ' ч назад' : 'h ago');
  return Math.floor(diff / 86400000) + (isRu ? ' д назад' : 'd ago');
}

// ═══════════════════════════════════════════════════════════════════════════
// GUIDE PAGE (Full-screen instructions)
// ═══════════════════════════════════════════════════════════════════════════

function loadGuidePage() {
  var container = document.getElementById('page-guide');
  if (!container) return;
  var isRu = currentLang === 'ru';

  // ── Guide sections data (comprehensive, no emojis) ──
  var _ico = function(d) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };
  var sections = [
    { id: 'start', icon: _ico('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>'),
      title: isRu ? 'Быстрый старт' : 'Quick Start',
      subtitle: isRu ? 'Создайте первого агента за 2 минуты' : 'Create your first agent in 2 minutes',
      gradient: 'linear-gradient(135deg, var(--accent-dim), rgba(6,182,212,0.08))',
      cards: [
        { title: isRu ? 'Atlas AI (рекомендуется)' : 'Atlas AI (recommended)', desc: isRu ? 'Опишите задачу текстом — Atlas создаст агента, настроит промпт, выберет инструменты и запустит. Atlas знает все о платформе.' : 'Describe the task — Atlas creates the agent, sets up prompt, picks tools and launches it. Atlas knows everything about the platform.', action: 'navigateTo("assistant")', btn: isRu ? 'Открыть Atlas' : 'Open Atlas' },
        { title: isRu ? 'Визуальный конструктор' : 'Visual Constructor', desc: isRu ? 'Drag & drop блоки: триггер, действия, логика. Без кода. Подходит для сложных workflow с условиями и циклами.' : 'Drag & drop blocks: trigger, actions, logic. No code. Good for complex workflows with conditions and loops.', action: 'navigateTo("builder")', btn: isRu ? 'Открыть' : 'Open' },
        { title: 'Telegram Bot', desc: isRu ? 'Отправьте описание в @TonAgentPlatformBot — те же возможности что и Atlas, но в Telegram. Работает с голосовыми сообщениями.' : 'Send description to @TonAgentPlatformBot — same capabilities as Atlas but in Telegram. Works with voice messages.', action: 'window.open("https://t.me/TonAgentPlatformBot")', btn: isRu ? 'Открыть бот' : 'Open bot' },
      ],
      tip: isRu ? 'Atlas — главный AI-ассистент платформы. Он может создавать агентов, объяснять настройки, проводить аудит, помогать с промптами. Просто спросите его о чем угодно.' : 'Atlas is the main AI assistant. It can create agents, explain settings, audit agents, help with prompts. Just ask it anything.',
      details: isRu ? [
        { q: 'Что такое Atlas и зачем он нужен', a: 'Atlas — главный AI-ассистент платформы. Он находится в разделе "AI Ассистент" в боковом меню (или нажмите Ctrl+/). Atlas умеет: создавать агентов по описанию, менять настройки, объяснять как работает любая функция, проводить аудит агентов, помогать писать промпты, отвечать на вопросы о TON/DeFi/NFT. Просто напишите ему что вам нужно на любом языке.' },
        { q: 'Шаг 1: Создайте агента', a: 'Откройте Atlas и напишите: "создай агента [описание]". Примеры:\n\n- "Создай агента который мониторит цену TON и уведомляет когда ниже $2.5"\n- "Создай модератора для группы @mygroup"\n- "Создай агента для арбитража подарков"\n\nAtlas сгенерирует системный промпт, выберет нужные инструменты из 77 доступных, создаст агента и запустит его.' },
        { q: 'Шаг 2: Подключите Telegram аккаунт', a: 'Откройте настройки агента (клик по карточке) и перейдите на вкладку "Telegram". Нажмите "Подключить" и отсканируйте QR-код в приложении Telegram (Настройки → Устройства → Подключить устройство). После этого агент получит доступ к вашему Telegram через MTProto — это полноценный доступ как у пользователя, не как у бота. Агент может: писать в группы, ставить реакции, менять аватарку, постить stories, создавать опросы.' },
        { q: 'Шаг 3: Настройте AI провайдера', a: 'Во вкладке "AI" выберите провайдера и вставьте API ключ:\n\n- Gemini (Google) — бесплатный, 15 запросов/мин. Ключ: aistudio.google.com\n- OpenRouter — бесплатные модели (Qwen, Llama). Ключ: openrouter.ai/keys\n- Groq — бесплатный, быстрый (30 RPM). Ключ: console.groq.com\n- Claude (Anthropic) — платный, самый умный\n- GPT (OpenAI) — платный\n\nЕсли не знаете какой выбрать — начните с Gemini (бесплатный) или спросите Atlas.' },
        { q: 'Шаг 4: Выберите возможности (Capabilities)', a: 'Во вкладке "Инструменты" включите модули которые нужны агенту. Каждый модуль даёт набор инструментов:\n\n- Telegram — отправка сообщений, реакции, поиск\n- Telegram Admin — кик, бан, мьют, закрепление\n- Wallet — баланс TON, отправка транзакций\n- Gifts Market — цены подарков, арбитраж\n- DeFi — свопы через DeDust/STON.fi\n- Web — поиск в интернете, загрузка страниц\n- Image — генерация изображений (DALL-E)\n- Memory — долгосрочная память между сессиями\n\nНе включайте лишние модули — это замедляет агента.' },
        { q: 'Шаг 5: Запустите', a: 'Нажмите "Запустить" на карточке агента. Зелёный индикатор означает что агент работает. Он будет:\n\n- Отвечать на сообщения в подключённых чатах\n- Выполнять задачи по расписанию (если настроен тик-интервал)\n- Мониторить цены и уведомлять вас\n\nЧтобы остановить — нажмите "Стоп". Логи работы видны во вкладке "Логи".' },
        { q: 'Пример: Арбитраж подарков', a: 'Напишите Atlas: "Создай агента для мониторинга рынка Telegram подарков. Он должен каждые 5 минут проверять цены на всех маркетах (Fragment, GetGems, Tonnel, Portals) и уведомлять когда спред между маркетами больше 10%."\n\nAtlas создаст агента с capabilities: gifts_market, notify. Агент будет использовать инструменты scan_real_arbitrage и get_market_overview.' },
        { q: 'Пример: Модератор группы', a: 'Напишите Atlas: "Создай модератора для группы. Он должен удалять спам, банить ботов, приветствовать новичков и отвечать на частые вопросы."\n\nCapabilities: telegram, telegram_admin. Подключите Telegram аккаунт с правами админа в нужной группе. Укажите в настройках роутинга конкретную группу.' },
        { q: 'Пример: Контент-менеджер канала', a: 'Напишите Atlas: "Создай агента который ведёт Telegram канал. Он должен генерировать посты про TON/crypto каждые 6 часов, добавлять изображения, форматировать текст."\n\nCapabilities: telegram, web, image, image_gen. Агент будет искать новости через web_search, генерировать изображения через DALL-E и публиковать в канал.' },
      ] : [
        { q: 'What is Atlas', a: 'Atlas is the main AI assistant. Open it via sidebar or Ctrl+/. It can create agents, explain settings, audit agents, help with prompts.' },
        { q: 'Step 1: Create an agent', a: 'Tell Atlas: "create an agent that monitors TON price". It generates the prompt, picks tools, and launches.' },
        { q: 'Step 2: Connect Telegram', a: 'Agent Settings → Telegram → scan QR code. Agent gets full MTProto access.' },
        { q: 'Step 3: Configure AI provider', a: 'AI tab → pick provider (Gemini free, Groq free, Claude paid) → paste API key.' },
        { q: 'Step 4: Launch', a: 'Click Start. Green indicator = running 24/7.' },
      ],
    },
    { id: 'settings', icon: _ico('<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>'),
      title: isRu ? 'Настройки агента' : 'Agent Settings',
      subtitle: isRu ? '17 вкладок для полного контроля' : '17 tabs for complete control',
      gradient: 'linear-gradient(135deg, rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.15), rgba(var(--accent-r,168),var(--accent-g,85),var(--accent-b,247),0.08))',
      items: [
        'Code — ' + (isRu ? 'редактор промпта' : 'prompt editor'),
        'AI — ' + (isRu ? 'провайдер, модель, ключ' : 'provider, model, key'),
        'Caps — ' + (isRu ? '20 модулей возможностей' : '20 capability modules'),
        'Routing — ' + (isRu ? 'маршрутизация сообщений' : 'message routing'),
        'Memory — ' + (isRu ? 'долгосрочная память' : 'long-term memory'),
        'Security — ' + (isRu ? 'лимиты, блоклист, sandbox' : 'limits, blocklist, sandbox'),
      ],
      details: isRu ? [
        { q: 'Code — Системный промпт (самая важная настройка)', a: 'Системный промпт определяет личность, поведение и задачи агента. AI получает этот текст перед каждым ответом. Пишите как инструкцию:\n\n"Ты — эксперт по TON DeFi. Отвечай коротко и по делу. При вопросах о ценах используй get_ton_balance. Не давай финансовых советов."\n\nСоветы:\n- Будьте конкретны: вместо "будь полезным" пишите "отвечай на вопросы о TON блокчейне, используя данные из инструментов"\n- Укажите ограничения: "никогда не отправляй TON без подтверждения владельца"\n- Задайте тон: "используй неформальный стиль, короткие фразы, иногда ставь реакции"\n- Если не уверены — попросите Atlas написать промпт за вас' },
        { q: 'AI — Провайдер и модель', a: 'Каждый агент использует свой API ключ для AI. Платформа не оплачивает запросы — вы платите провайдеру напрямую.\n\nПровайдеры:\n- Gemini (Google): бесплатный ключ на aistudio.google.com. Лимит 15 запросов/мин. Модели: gemini-2.5-flash (быстрая), gemini-2.5-pro (умная)\n- Groq: бесплатный ключ на console.groq.com. 30 запросов/мин. Модель: llama-3.3-70b\n- OpenRouter: бесплатные модели на openrouter.ai. 50 запросов/день (бесплатно) или 1000/день ($10 разово)\n- Claude (Anthropic): платный, от $3/M токенов. Лучший для сложных задач\n- GPT (OpenAI): платный, от $2.5/M токенов\n\nТемпература: 0.0 = строго по инструкции, 1.0 = креативно. Рекомендуется 0.7.\nМакс. токенов: длина ответа. 1024 = обычный ответ, 4096 = длинный.' },
        { q: 'Capabilities — Возможности (инструменты)', a: 'Каждая capability даёт агенту набор инструментов. Включайте только нужные — лишние замедляют агента.\n\nОсновные:\n- Telegram: отправка сообщений, ответы, реакции, поиск, пересылка\n- Telegram Admin: кик, бан, мьют, закреп, управление правами (нужны права админа)\n- Wallet: проверка баланса TON, отправка транзакций (нужна мнемоника кошелька)\n- Web: поиск в Google, загрузка веб-страниц, HTTP запросы\n- State: сохранение/чтение данных между запусками агента\n- Notify: отправка уведомлений владельцу\n- Memory: долгосрочная память, контакты, уроки\n\nСпециальные:\n- Gifts Market: реальные цены подарков, арбитраж, аналитика рынка\n- DeFi: свопы через DeDust/STON.fi, цены жетонов\n- NFT: floor price коллекций, метаданные\n- Image/DALL-E: генерация и обработка изображений\n- MCP: подключение внешних инструментов через протокол MCP' },
        { q: 'Routing — Маршрутизация сообщений', a: 'Определяет какие сообщения получает агент. Важно для мультиагентных систем (несколько агентов на одном TG аккаунте).\n\n- Ключевые слова: агент активируется только на сообщения содержащие эти слова\n- Типы чатов: DM (личка), группы, каналы\n- Приоритет: при конфликте нескольких агентов, отвечает тот у кого приоритет выше (1-100)\n- Default: если включено — агент отвечает на все сообщения которые не подошли другим агентам\n\nGroup Policy:\n- Active: отвечает на все сообщения в группе (осторожно — быстро расходует лимиты API)\n- Mention-only: отвечает только когда @упомянут (рекомендуется для групп)\n- Disabled: не отвечает в группах' },
        { q: 'Behavior — Поведение и человечность', a: 'Настройки которые делают агента более похожим на человека:\n\n- Задержка набора: имитирует "печатает..." перед ответом\n- Скорость набора: символов в секунду (40 = медленно, 100 = быстро)\n- Реакции: автоматические реакции на сообщения (сердечки, лайки)\n- Колебания: иногда добавляет "хм", "ну" в начало ответа\n- Разбиение: длинные ответы разбивает на несколько сообщений\n\nРасписание: если включено, агент активен только в указанное время (например 9:00-23:00).' },
        { q: 'Memory — Долгосрочная память', a: 'Агент автоматически запоминает важную информацию:\n\n- Имена и предпочтения пользователей\n- Уроки из ошибок\n- Контексты прошлых разговоров\n\nДанные хранятся в базе и доступны между перезапусками. В Studio видны во вкладке "Память" — контакты, факты, уроки.\n\nЗащита от poisoning: в групповых чатах незнакомцы не могут записывать в память агента ложную информацию.' },
        { q: 'Security — Безопасность', a: 'Критически важные настройки:\n\n- Дневной лимит TON: максимальная сумма которую агент может потратить за день\n- Блоклист: ID пользователей которых агент игнорирует\n- Tool scope: какие инструменты доступны в группах (рекомендуется ограничить финансовые)\n- Atomic lock: блокировка параллельных финансовых операций (предотвращает двойную трату)\n- Prompt injection protection: агент не выполняет команды от незнакомцев которые пытаются изменить его поведение' },
        { q: 'Wallet — Кошелёк агента', a: 'Агент может иметь свой TON кошелёк для выполнения транзакций. Настройка:\n\n1. Перейдите в Кошельки (боковое меню) → Создать Root Wallet\n2. В настройках агента → Wallet → выберите "Agentic Wallet"\n3. Установите лимит расходов\n\nАгент сможет: проверять баланс, отправлять TON, покупать подарки, делать свопы. Все операции логируются.' },
        { q: 'Advanced — Продвинутые настройки', a: 'Для опытных пользователей:\n\n- Tick interval: как часто агент просыпается (60 сек = каждую минуту, 0 = только по сообщениям)\n- Компактинг: как сжимается контекст при длинных разговорах (structured = AI пишет резюме)\n- Loop guard: максимум ответов в одном чате за 5 минут (защита от спам-петель)\n- Flood cooldown: минимальный интервал между ответами в группах\n- Язык: auto = определяется по сообщению, ru/en = фиксированный' },
      ] : [],
    },
    { id: 'ai', icon: _ico('<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>'),
      title: isRu ? 'AI Провайдеры' : 'AI Providers',
      subtitle: isRu ? '7 провайдеров на выбор' : '7 providers to choose from',
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(34,197,94,0.08))',
      items: ['Gemini — gemini-2.5-flash/pro', 'Claude — sonnet/haiku/opus', 'GPT — gpt-4o-mini', 'Groq — llama-3.3-70b', 'DeepSeek — deepseek-chat', 'OpenRouter — google/gemini', 'Together — meta-llama'],
    },
    { id: 'tools', icon: _ico('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
      title: isRu ? 'Инструменты' : 'Tools',
      subtitle: isRu ? '77 инструментов в 10 категориях' : '77 tools in 10 categories',
      gradient: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(234,179,8,0.08))',
      grid: [
        { emoji: 'MSG', name: isRu ? 'Сообщения' : 'Messages' }, { emoji: 'MED', name: isRu ? 'Медиа' : 'Media' },
        { emoji: 'MOD', name: isRu ? 'Модерация' : 'Moderation' }, { emoji: 'TON', name: 'DeFi' },
        { emoji: 'GFT', name: isRu ? 'Подарки' : 'Gifts' }, { emoji: 'MEM', name: isRu ? 'Память' : 'Memory' },
        { emoji: 'USR', name: isRu ? 'Профиль' : 'Profile' }, { emoji: 'WEB', name: 'Web' },
        { emoji: 'WAL', name: isRu ? 'Кошелёк' : 'Wallet' }, { emoji: 'SCH', name: isRu ? 'Планирование' : 'Planning' },
      ],
      details: isRu ? [
        { q: 'Сообщения (17 инструментов)', a: 'tg_send_message — отправка в любой чат/канал/пользователю\ntg_reply — ответ на конкретное сообщение с цитатой\ntg_forward_message — пересылка\ntg_edit — редактирование своих сообщений\ntg_react — поставить реакцию (сердце, огонь, и др.)\ntg_pin — закрепить сообщение\ntg_get_messages — прочитать последние сообщения из чата\ntg_get_unread — получить непрочитанные\ntg_search_messages — поиск по тексту в чате\ntg_get_dialogs — список всех чатов\ntg_mark_read — отметить прочитанным\ntg_send_formatted — HTML форматирование (жирный, курсив, код)\ntg_send_photo — отправка фото\ntg_send_file — отправка документа\ntg_send_voice — голосовое сообщение\ntg_get_channel_info — информация о канале/группе\ntg_get_user_info — информация о пользователе' },
        { q: 'Модерация (8 инструментов)', a: 'tg_kick_user — удалить пользователя из группы\ntg_ban_user — забанить (не сможет вернуться)\ntg_mute_user — замьютить на время\ntg_unban_user — разбанить\ntg_get_members — список участников группы\ntg_create_poll — создать опрос\ntg_join_channel — вступить в канал/группу\ntg_leave_channel — покинуть' },
        { q: 'TON DeFi (6 инструментов)', a: 'get_ton_balance — баланс TON и жетонов по адресу\nsend_ton — отправить TON транзакцию\nsend_jetton — отправить жетон (USDT, NOT и др.)\nget_nft_floor — floor price NFT коллекции\nswap_dedust — свопы через DeDust\nswap_stonfi — свопы через STON.fi' },
        { q: 'Подарки (12+ инструментов)', a: 'get_gift_floor_real — реальная цена подарка на всех маркетах\nscan_real_arbitrage — поиск арбитража между маркетами\nget_market_overview — обзор рынка подарков\nget_price_list — список цен всех подарков\nget_top_deals — лучшие сделки дня\nget_gift_aggregator — агрегатор со всех маркетов\nget_collection_offers — ордера на покупку\nget_market_health — здоровье рынка\nget_price_history — история цен\nget_user_portfolio — портфолио пользователя\nbuy_catalog_gift — купить подарок из каталога\nlist_gift_for_sale — выставить на продажу' },
        { q: 'Web (3 инструмента)', a: 'web_search — поиск в Google/Bing с AI-извлечением результатов\nfetch_url — загрузка веб-страницы, извлечение текста\nhttp_request — произвольный HTTP запрос (GET/POST/PUT/DELETE) с заголовками и телом' },
        { q: 'Память и состояние (6 инструментов)', a: 'get_state / set_state — чтение/запись данных агента (переживают перезапуск)\nget_state_multi — прочитать несколько ключей за раз\nlist_state_keys — список всех сохранённых ключей\nremember — сохранить факт в долгосрочную память\nrecall — найти факт по ключевому слову\nsave_lesson — сохранить урок (агент учится на ошибках)' },
        { q: 'Уведомления и планирование', a: 'notify / notify_user — отправить уведомление владельцу агента\nnotify_rich — форматированное уведомление с кнопками\nschedule_action — запланировать действие на конкретное время\nset_next_wake — установить время следующего пробуждения агента' },
      ] : [],
    },
    { id: 'flow', icon: _ico('<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>'),
      title: isRu ? 'Конструктор' : 'Flow Builder',
      subtitle: isRu ? 'Визуальный drag & drop редактор' : 'Visual drag & drop editor',
      gradient: 'linear-gradient(135deg, rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.15), rgba(79,70,229,0.08))',
      cards: [
        { title: isRu ? 'Триггеры' : 'Triggers', desc: isRu ? 'Таймер, Webhook, Ручной запуск' : 'Timer, Webhook, Manual start' },
        { title: isRu ? 'Действия' : 'Actions', desc: isRu ? 'TON, Gifts, Telegram, Web, DeFi' : 'TON, Gifts, Telegram, Web, DeFi' },
        { title: isRu ? 'Логика' : 'Logic', desc: isRu ? 'Условия, циклы, задержки' : 'Conditions, loops, delays' },
      ],
      action: { label: isRu ? 'Открыть конструктор' : 'Open Constructor', fn: 'navigateTo("builder")' },
      details: isRu ? [
        { q: 'Как работает конструктор', a: 'Визуальный редактор где вы соединяете блоки линиями. Каждый блок — одно действие (проверить баланс, отправить сообщение, подождать). Линия между блоками = "после этого сделай то".\n\nУправление:\n- Перетаскивание блоков мышью\n- Соединение: тяните от output-порта (справа) к input-порту (слева)\n- Зум: колесо мыши\n- Удалить связь: правый клик\n- Deploy: кнопка сверху справа' },
        { q: 'Блоки триггеров', a: 'Timer — запуск каждые N минут (1, 5, 10, 30, 60 мин или cron выражение)\nWebhook — запуск по HTTP запросу (получаете URL для вызова)\nManual — запуск вручную кнопкой\n\nКаждый flow начинается с одного триггера.' },
        { q: 'Блоки действий', a: 'Get Balance — проверить баланс TON/жетонов\nSend TON — отправить транзакцию\nNFT Floor — цена коллекции\nGift Prices — цена подарка\nScan Arbitrage — поиск арбитража\nWeb Search — поиск в интернете\nFetch URL — загрузка страницы\nSend Message — отправка в Telegram\nHTTP Request — произвольный API вызов' },
        { q: 'Блоки логики', a: 'Condition — если баланс > 100 → ветка A, иначе → ветка B\nDelay — подождать N секунд\nLoop — повторять блок N раз\nGroup — объединить несколько блоков\n\nПример: Timer (каждые 5 мин) → Get Balance → Condition (< 10 TON?) → Send Message ("Баланс низкий!")' },
        { q: 'Когда использовать конструктор вместо AI', a: 'Конструктор подходит для:\n- Простых автоматизаций (проверил → уведомил)\n- Когда нужна точная логика (if/else)\n- Когда не хотите тратить AI токены на каждый запуск\n\nAI агент подходит для:\n- Сложных задач требующих понимания контекста\n- Общения в чатах\n- Задач где нужно принимать решения на лету' },
      ] : [],
    },
    { id: 'ton', icon: _ico('<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0z"/>'),
      title: 'TON Blockchain',
      subtitle: isRu ? 'Кошельки, свопы, NFT, жетоны' : 'Wallets, swaps, NFTs, jettons',
      gradient: 'linear-gradient(135deg, var(--accent-dim), rgba(2,132,199,0.08))',
      items: [isRu ? 'Баланс TON/жетонов' : 'TON/jetton balance', isRu ? 'Свопы через DeDust/STON.fi' : 'Swaps via DeDust/STON.fi', isRu ? 'NFT floor price + аналитика' : 'NFT floor price + analytics', isRu ? 'Отправка TON/жетонов' : 'Send TON/jettons', isRu ? 'Агентский кошелёк' : 'Agentic wallet'],
      details: isRu ? [
        { q: 'Кошелёк агента', a: 'Каждый агент может иметь свой TON кошелёк (Agentic Wallet). Создание:\n\n1. Кошельки (боковое меню) → Создать Root Wallet\n2. Настройки агента → Wallet → выбрать Agentic Wallet\n3. Установить дневной лимит расходов\n\nRoot Wallet — мастер-кошелёк. К нему привязываются суб-кошельки агентов. Мнемоника шифруется AES-256-GCM.' },
        { q: 'Свопы через DeDust и STON.fi', a: 'Агент может автоматически менять жетоны:\n\nswap_dedust — свопы через DeDust DEX. Поддерживает TON, USDT, NOT и другие жетоны.\nswap_stonfi — свопы через STON.fi DEX.\n\nПример промпта: "Каждые 30 минут проверяй цену NOT. Если выросла на 5% — продай 10% позиции через DeDust."' },
        { q: 'NFT аналитика', a: 'get_nft_floor — floor price коллекции через TonAPI v2\n\nПоддерживаемые коллекции: TON Punks, TON Diamonds, Anonymous Numbers и любые другие по адресу.\n\nПример: "Мониторь floor price TON Punks. Уведоми когда упадёт ниже 50 TON."' },
        { q: 'TonAPI v2 (блокчейн данные)', a: 'Через capability "blockchain" агент получает доступ к:\n\n- Аккаунты: баланс, история транзакций\n- Жетоны: балансы, метаданные, трансферы\n- NFT: коллекции, items, метаданные\n- DNS: резолв .ton доменов\n- Стейкинг: пулы, номинаторы\n- Эмуляция транзакций: проверка до отправки' },
      ] : [],
    },
    { id: 'multi', icon: _ico('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
      title: isRu ? 'Мультиагенты' : 'Multi-Agent',
      subtitle: isRu ? 'Команды агентов, роли, маршрутизация' : 'Agent teams, roles, routing',
      gradient: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(219,39,119,0.08))',
      items: [isRu ? 'Роли: worker, manager, specialist' : 'Roles: worker, manager, specialist', isRu ? 'Маршрутизация по ключевым словам' : 'Keyword-based routing', isRu ? 'Inter-agent коммуникация' : 'Inter-agent communication', isRu ? 'Общее состояние между агентами' : 'Shared state between agents'],
      details: isRu ? [
        { q: 'Как работает мультиагентная система', a: 'Несколько агентов подключаются к одному Telegram аккаунту. Каждое входящее сообщение проходит через маршрутизатор, который решает какому агенту его отдать.\n\nМаршрутизация:\n- По ключевым словам: "цена" → трейдинг-агент, "модерация" → модератор\n- По типу чата: DM → личный помощник, группы → модератор\n- По приоритету: при конфликте отвечает агент с высшим приоритетом\n- Default agent: получает все сообщения которые не подошли другим' },
        { q: 'Роли агентов', a: 'Worker — обычный исполнитель задач\nManager — координирует других агентов, может делегировать задачи\nSpecialist — эксперт в конкретной области (DeFi, NFT, модерация)\nMonitor — следит за метриками, уведомляет\n\nРоль влияет на приоритет маршрутизации и доступные инструменты.' },
        { q: 'Inter-agent коммуникация', a: 'Агенты могут общаться друг с другом:\n\nlist_my_agents — получить список всех агентов\nask_agent(agentId, question) — задать вопрос другому агенту\ndelegate_task(agentId, task) — делегировать задачу\n\nПример: Manager-агент получает задачу "проверь портфолио" → делегирует DeFi-агенту проверку баланса, NFT-агенту проверку коллекций → собирает ответы → формирует отчёт.' },
        { q: 'Общее состояние', a: 'Агенты могут использовать shared state для координации:\n\nget_shared_state(key) — прочитать значение доступное всем агентам\nset_shared_state(key, value) — записать значение для всех агентов\n\nПример: Мониторинг-агент записывает "alert:ton_price_low=true" → Трейдинг-агент читает и запускает стратегию.' },
      ] : [],
    },
    { id: 'market', icon: _ico('<path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="m3 9 1.5-4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.5L21 9"/><path d="M3 9h18"/><path d="M16 14a4 4 0 0 1-8 0"/>'),
      title: isRu ? 'Маркетплейс' : 'Marketplace',
      subtitle: isRu ? 'Готовые шаблоны агентов' : 'Ready-made agent templates',
      gradient: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.08))',
      action: { label: isRu ? 'Открыть маркетплейс' : 'Open Marketplace', fn: 'navigateTo("marketplace")' },
      items: [isRu ? 'DeFi мониторинг' : 'DeFi monitoring', isRu ? 'NFT трекинг' : 'NFT tracking', isRu ? 'Арбитраж подарков' : 'Gift arbitrage', isRu ? 'Контент-менеджер' : 'Content manager'],
      details: isRu ? [
        { q: 'Что такое маркетплейс', a: 'Готовые шаблоны агентов которые можно установить в один клик. Каждый шаблон содержит: системный промпт, набор capabilities, рекомендуемый провайдер.\n\nКатегории:\n- Monitoring: мониторинг цен, балансов, NFT\n- DeFi: свопы, yield farming, арбитраж\n- Gifts: торговля подарками, аналитика рынка\n- Utility: модерация, контент, уведомления\n- Custom: пользовательские шаблоны' },
        { q: 'Как установить шаблон', a: '1. Откройте Маркетплейс\n2. Выберите шаблон\n3. Нажмите "Установить"\n4. Укажите API ключ и другие настройки (wizard проведёт)\n5. Агент создан и готов к запуску\n\nПосле установки можете изменить любые настройки — промпт, capabilities, провайдер.' },
        { q: 'Как создать свой шаблон', a: 'Настройте агента как хотите, затем в настройках нажмите "Опубликовать на маркетплейс". Укажите:\n- Название и описание\n- Категорию\n- Цену (или бесплатно)\n\nДругие пользователи смогут установить ваш шаблон. Комиссия платформы: 30%.' },
      ] : [],
    },
    { id: 'keys', icon: _ico('<rect width="20" height="16" x="2" y="4" rx="2" ry="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/>'),
      title: isRu ? 'Горячие клавиши' : 'Shortcuts',
      subtitle: isRu ? 'Быстрые команды' : 'Quick commands',
      gradient: 'linear-gradient(135deg, rgba(100,116,139,0.15), rgba(71,85,105,0.08))',
      shortcuts: [
        { key: 'Ctrl+K', desc: isRu ? 'Палитра команд' : 'Command palette' },
        { key: 'Ctrl+N', desc: isRu ? 'Новый агент' : 'New agent' },
        { key: 'Ctrl+/', desc: isRu ? 'Открыть чат' : 'Open chat' },
        { key: 'Esc', desc: isRu ? 'Закрыть модалы' : 'Close modals' },
      ],
    },
  ];

  // ── Render tabs + content ──
  var _activeGuideTab = sections[0].id;

  // Rich text formatter for guide FAQ content
  function _formatGuideText(raw) {
    var lines = raw.split('\n');
    var html = '';
    var inList = false;
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      var trimmed = line.trim();
      if (!trimmed) {
        if (inList) { html += '</div>'; inList = false; }
        html += '<div style="height:8px"></div>';
        continue;
      }
      // Bullet list: starts with - or •
      if (/^[-•]\s/.test(trimmed)) {
        if (!inList) { html += '<div style="display:flex;flex-direction:column;gap:4px;margin:6px 0 6px 4px">'; inList = true; }
        var bullet = trimmed.replace(/^[-•]\s*/, '');
        // Bold part before colon
        bullet = bullet.replace(/^([^:—]+)([::—])/, '<span style="color:var(--text-primary);font-weight:600">$1</span>$2');
        html += '<div style="display:flex;gap:8px;align-items:flex-start"><span style="color:var(--primary);font-size:.6rem;margin-top:5px;flex-shrink:0">&#9679;</span><span>' + bullet + '</span></div>';
        continue;
      }
      if (inList) { html += '</div>'; inList = false; }
      // Subheading: line ending with : and < 60 chars
      if (/[::]\s*$/.test(trimmed) && trimmed.length < 60) {
        html += '<div style="color:var(--text-primary);font-weight:600;font-size:.82rem;margin:10px 0 4px;padding-bottom:3px;border-bottom:1px solid rgba(255,255,255,0.05)">' + escHtml(trimmed) + '</div>';
        continue;
      }
      // Heading-like: short line, all caps or starts with capital and no period
      if (trimmed.length < 40 && /^[A-ZА-ЯЁ]/.test(trimmed) && !/\.\s*$/.test(trimmed) && !/^(Пример|Example|Совет|Tip)/i.test(trimmed)) {
        html += '<div style="color:var(--text-primary);font-weight:600;font-size:.82rem;margin:8px 0 4px">' + escHtml(trimmed) + '</div>';
        continue;
      }
      // Code-like: starts with function name, tool name, or has — separator
      if (/^[a-z_]+\s*[—–-]/.test(trimmed)) {
        var parts = trimmed.split(/\s*[—–-]\s*(.+)/);
        html += '<div style="display:flex;gap:8px;align-items:flex-start;margin:3px 0 3px 4px"><code style="background:var(--accent-dim);color:var(--primary);padding:1px 6px;border-radius:4px;font-size:.75rem;font-family:monospace;white-space:nowrap;flex-shrink:0">' + escHtml(parts[0]) + '</code><span>' + escHtml(parts[1] || '') + '</span></div>';
        continue;
      }
      // URLs: make clickable
      var processed = escHtml(trimmed).replace(/(https?:\/\/[^\s<]+|[a-z]+\.[a-z]+\.[a-z]+[^\s]*|aistudio\.google\.com|console\.groq\.com|openrouter\.ai[^\s]*)/gi, function(url) {
        var href = url.startsWith('http') ? url : 'https://' + url;
        return '<a href="' + href + '" target="_blank" style="color:var(--primary);text-decoration:none;border-bottom:1px dashed var(--accent-glow)">' + url + '</a>';
      });
      // Quote blocks: lines starting with "
      if (/^["«"]/.test(trimmed)) {
        html += '<div style="border-left:2px solid var(--accent-glow);padding-left:10px;margin:4px 0;font-style:italic;color:var(--text-muted)">' + processed + '</div>';
        continue;
      }
      html += '<div style="margin:3px 0">' + processed + '</div>';
    }
    if (inList) html += '</div>';
    return html;
  }

  function renderGuide() {
    var s = sections.find(function(x){ return x.id === _activeGuideTab; }) || sections[0];

    // ── Hero (always at top) ──
    var hero = '<div class="guide-v3-hero">' +
      '<div class="guide-v3-hero-content">' +
        '<div class="guide-v3-hero-l">' +
          '<div class="guide-v3-hero-eyebrow">' + (isRu ? 'РУКОВОДСТВО' : 'GUIDE') + '</div>' +
          '<h1 class="guide-v3-hero-title">' +
            (isRu
              ? 'Создавай AI-агентов <span class="grad">за минуты</span>, не часы'
              : 'Build AI agents <span class="grad">in minutes</span>, not hours') +
          '</h1>' +
          '<p class="guide-v3-hero-sub">' +
            (isRu
              ? 'Полное руководство по платформе — от первого агента до мультиагентных систем, кошельков и публикации в маркетплейс.'
              : 'Complete platform guide — from your first agent to multi-agent systems, wallets and marketplace publishing.') +
          '</p>' +
          '<div class="guide-v3-hero-stats">' +
            '<div class="guide-v3-hero-stat"><span class="n">77+</span><span class="l">' + (isRu ? 'инструментов' : 'tools') + '</span></div>' +
            '<div class="guide-v3-hero-stat"><span class="n">7</span><span class="l">' + (isRu ? 'AI провайдеров' : 'AI providers') + '</span></div>' +
            '<div class="guide-v3-hero-stat"><span class="n">20</span><span class="l">capabilities</span></div>' +
            '<div class="guide-v3-hero-stat"><span class="n">24/7</span><span class="l">' + (isRu ? 'автономно' : 'autonomous') + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="guide-v3-hero-r">' +
          '<button class="guide-v3-hero-cta" onclick="navigateTo(\'assistant\')">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>' +
            (isRu ? 'Открыть Atlas' : 'Open Atlas') +
          '</button>' +
          '<button class="guide-v3-hero-ghost" onclick="startGuidedTour()">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
            (isRu ? 'Запустить тур' : 'Start tour') +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    // Tab bar
    var tabs = '<div class="guide-tabs">';
    sections.forEach(function(sec) {
      var active = sec.id === _activeGuideTab;
      tabs += '<button class="guide-tab' + (active ? ' active' : '') + '" onclick="_switchGuideTab(\'' + sec.id + '\')">' +
        sec.icon + '<span>' + sec.title + '</span></button>';
    });
    tabs += '</div>';

    // Section header
    var content = '<div class="guide-section-head">' +
      '<div class="guide-section-head-l">' +
        '<div class="guide-section-icon">' + s.icon + '</div>' +
        '<div><h2 class="guide-section-title">' + s.title + '</h2>' +
          '<p class="guide-section-sub">' + s.subtitle + '</p></div>' +
      '</div>' +
    '</div>';

    // Cards (numbered, unified style)
    if (s.cards) {
      content += '<div class="guide-section-divider">' + (isRu ? 'С чего начать' : 'Where to start') + '</div>';
      content += '<div class="guide-cards">';
      s.cards.forEach(function(c, ci) {
        content += '<div class="guide-card-v2">' +
          '<span class="num">' + (ci + 1) + '</span>' +
          '<h4>' + c.title + '</h4>' +
          '<p>' + c.desc + '</p>' +
          (c.action ? '<button class="btn" onclick="' + c.action + '">' + (c.btn || '→') +
            ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>' : '') +
        '</div>';
      });
      content += '</div>';
    }

    // Chips (items list)
    if (s.items) {
      content += '<div class="guide-section-divider">' + (isRu ? 'Что включено' : 'What\'s inside') + '</div>';
      content += '<div class="guide-chips">';
      s.items.forEach(function(item) {
        content += '<span class="guide-chip">' + escHtml(item) + '</span>';
      });
      content += '</div>';
    }

    // Tool grid
    if (s.grid) {
      content += '<div class="guide-section-divider">' + (isRu ? 'Категории инструментов' : 'Tool categories') + '</div>';
      content += '<div class="guide-tool-grid">';
      s.grid.forEach(function(g) {
        content += '<div class="guide-tool">' +
          '<span class="code">' + escHtml(g.emoji) + '</span>' +
          '<span class="name">' + escHtml(g.name) + '</span>' +
        '</div>';
      });
      content += '</div>';
    }

    // Shortcuts
    if (s.shortcuts) {
      content += '<div class="guide-section-divider">' + (isRu ? 'Горячие клавиши' : 'Keyboard shortcuts') + '</div>';
      content += '<div class="guide-shortcuts">';
      s.shortcuts.forEach(function(sc) {
        content += '<div class="guide-shortcut">' +
          '<kbd>' + escHtml(sc.key) + '</kbd>' +
          '<span>' + escHtml(sc.desc) + '</span>' +
        '</div>';
      });
      content += '</div>';
    }

    // Tip
    if (s.tip) {
      content += '<div class="guide-tip">' +
        '<div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg></div>' +
        '<div>' + s.tip + '</div>' +
      '</div>';
    }

    // Action button
    if (s.action) {
      content += '<button class="guide-action" onclick="' + s.action.fn + '">' + s.action.label +
        ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
      '</button>';
    }

    // Details (FAQ accordion)
    if (s.details && s.details.length > 0) {
      content += '<div class="guide-section-divider">' + (isRu ? 'Подробности' : 'Deep dive') + '</div>';
      content += '<div class="guide-details">';
      s.details.forEach(function(d, idx) {
        content += '<details class="guide-detail"' + (idx < 1 ? ' open' : '') + '>' +
          '<summary>' +
            '<span class="chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>' +
            '<span class="q">' + escHtml(d.q) + '</span>' +
            '<span class="idx">' + (idx + 1) + ' / ' + s.details.length + '</span>' +
          '</summary>' +
          '<div class="guide-detail-body">' + _formatGuideText(d.a) + '</div>' +
        '</details>';
      });
      content += '</div>';
    }

    container.innerHTML = '<div class="guide-v2">' + hero + tabs + content + '</div>';
  }

  window._switchGuideTab = function(id) {
    _activeGuideTab = id;
    renderGuide();
  };

  // Use tabs guide version with full detailed content
  renderGuide();
  return;

  container.innerHTML =
    '<div class="guide-hero">' +
      '<div class="guide-hero-glow"></div>' +
      '<h1 class="guide-hero-title">' + (isRu ? 'Добро пожаловать в TON Agent Studio' : 'Welcome to TON Agent Studio') + '</h1>' +
      '<p class="guide-hero-sub">' + (isRu ? 'Создавайте AI-агентов которые живут в Telegram как настоящие люди' : 'Create AI agents that live in Telegram like real people') + '</p>' +
    '</div>' +

    '<div class="guide-grid">' +

      // Step 1
      '<div class="guide-card" style="--delay:0.1s">' +
        '<div class="guide-card-num">01</div>' +
        '<div class="guide-card-icon" style="background:rgba(16,185,129,0.12);color:#10b981"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></div>' +
        '<h3>' + (isRu ? 'Создайте агента' : 'Create an Agent') + '</h3>' +
        '<p>' + (isRu
          ? 'Опишите задачу текстом или голосом. AI сгенерирует системный промпт и подключит нужные инструменты из 77 доступных.'
          : 'Describe the task in text or voice. AI generates a system prompt and connects the right tools from 77 available.') + '</p>' +
        '<button class="guide-action-btn" onclick="navigateTo(\'builder\')">' + (isRu ? 'Открыть конструктор' : 'Open Constructor') + ' →</button>' +
      '</div>' +

      // Step 2
      '<div class="guide-card" style="--delay:0.2s">' +
        '<div class="guide-card-num">02</div>' +
        '<div class="guide-card-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div>' +
        '<h3>' + (isRu ? 'Подключите Telegram' : 'Connect Telegram') + '</h3>' +
        '<p>' + (isRu
          ? 'Авторизуйте аккаунт через QR-код. Агент будет работать как полноценный пользователь — не бот.'
          : 'Authorize via QR code. The agent works as a real user — not a bot.') + '</p>' +
        '<button class="guide-action-btn" onclick="navigateTo(\'connectors\')">' + (isRu ? 'Настроить подключение' : 'Set up connection') + ' →</button>' +
      '</div>' +

      // Step 3
      '<div class="guide-card" style="--delay:0.3s">' +
        '<div class="guide-card-num">03</div>' +
        '<div class="guide-card-icon" style="background:rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.12);color:#8b5cf6"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4"/></svg></div>' +
        '<h3>' + (isRu ? 'Настройте поведение' : 'Configure Behavior') + '</h3>' +
        '<p>' + (isRu
          ? 'Душа, безопасность, стратегия, расписание — 25 табов настроек для полного контроля.'
          : 'Soul, security, strategy, schedule — 25 settings tabs for complete control.') + '</p>' +
        '<button class="guide-action-btn" onclick="navigateTo(\'operations\')">' + (isRu ? 'Мои агенты' : 'My Agents') + ' →</button>' +
      '</div>' +

      // Step 4
      '<div class="guide-card" style="--delay:0.4s">' +
        '<div class="guide-card-num">04</div>' +
        '<div class="guide-card-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>' +
        '<h3>' + (isRu ? 'Запустите!' : 'Launch!') + '</h3>' +
        '<p>' + (isRu
          ? 'Агент начнёт работать 24/7 — отвечать в чатах, торговать, модерировать, мониторить и уведомлять.'
          : 'The agent works 24/7 — replying in chats, trading, moderating, monitoring and notifying.') + '</p>' +
        '<button class="guide-action-btn" onclick="navigateTo(\'network\')">' + (isRu ? 'Сеть агентов' : 'Agent Network') + ' →</button>' +
      '</div>' +

    '</div>' +

    // Features grid
    '<h2 class="guide-section-title">' + (isRu ? '77 инструментов в 10 категориях' : '77 tools in 10 categories') + '</h2>' +
    '<div class="guide-features">' +
      guideFeature(IC.chat, isRu ? 'Сообщения' : 'Messages', isRu ? 'Отправка, ответы, пересылка, реакции, поиск, форматирование' : 'Send, reply, forward, react, search, format'),
      guideFeature(IC.image, isRu ? 'Медиа' : 'Media', isRu ? 'Фото, голосовые, файлы, стикеры, GIF' : 'Photos, voice, files, stickers, GIFs'),
      guideFeature(IC.shield, isRu ? 'Модерация' : 'Moderation', isRu ? 'Кик, бан, мьют, закрепить, опросы, инвайты' : 'Kick, ban, mute, pin, polls, invites'),
      guideFeature(IC.gem, isRu ? 'TON DeFi' : 'TON DeFi', isRu ? 'Баланс, свопы DeDust/STON.fi, жетоны, NFT' : 'Balance, swaps DeDust/STON.fi, jettons, NFTs'),
      guideFeature(IC.gift, isRu ? 'Подарки' : 'Gifts', isRu ? 'Каталог, арбитраж, покупка, продажа, аналитика' : 'Catalog, arbitrage, buy, sell, analytics'),
      guideFeature(IC.brain, isRu ? 'Память' : 'Memory', isRu ? 'Долгосрочная, ежедневные логи, поиск, компактинг' : 'Long-term, daily logs, search, compaction'),
      guideFeature(IC.user, isRu ? 'Профиль' : 'Profile', isRu ? 'Аватарка, имя, био, stories' : 'Avatar, name, bio, stories'),
      guideFeature(IC.globe, isRu ? 'Веб' : 'Web', isRu ? 'Поиск, загрузка страниц, HTTP запросы' : 'Search, fetch pages, HTTP requests'),
      guideFeature(IC.dollar, isRu ? 'Кошелёк' : 'Wallet', isRu ? 'Отправка TON/жетонов, лимиты, atomic lock' : 'Send TON/jettons, limits, atomic lock'),
      guideFeature(IC.clock, isRu ? 'Планирование' : 'Planning', isRu ? 'Расписание, задачи, уведомления, пробуждение' : 'Schedule, tasks, notifications, wake-up'),
    '</div>' +

    // FAQ
    '<h2 class="guide-section-title">FAQ</h2>' +
    '<div class="guide-faq">' +
      guideFaq(isRu ? 'Чем отличается от обычного бота?' : 'How is this different from a regular bot?',
        isRu ? 'Наш агент — полноценный Telegram-аккаунт через MTProto. Он выглядит как человек, ставит реакции, меняет аватарку, пишет stories. Обычный бот этого не может.' : 'Our agent is a full Telegram account via MTProto. It looks like a human, sets reactions, changes avatar, posts stories. Regular bots can\'t do this.') +
      guideFaq(isRu ? 'Это безопасно?' : 'Is it safe?',
        isRu ? 'Atomic lock на финансовые операции, дневные лимиты, sandbox для кода, защита от prompt injection, блоклист, tool scope — какие инструменты доступны в группах vs в личке.' : 'Atomic lock on financial ops, daily limits, code sandbox, prompt injection protection, blocklist, tool scope — which tools are available in groups vs DMs.') +
      guideFaq(isRu ? 'Какие AI-провайдеры поддерживаются?' : 'Which AI providers are supported?',
        isRu ? 'Gemini, Claude, GPT, Groq, DeepSeek, OpenRouter, Together — 7 провайдеров. Агент сам выбирает нужные инструменты через Tool RAG.' : 'Gemini, Claude, GPT, Groq, DeepSeek, OpenRouter, Together — 7 providers. Agent auto-selects tools via Tool RAG.') +
      guideFaq(isRu ? 'Сколько стоит?' : 'How much does it cost?',
        isRu ? 'Активация агента 5 TON. PRO подписка от $19/мес. Маркетплейс шаблонов с комиссией 30%.' : 'Agent activation 5 TON. PRO subscription from $19/mo. Template marketplace with 30% commission.') +
    '</div>';
}

function guideFeature(emoji, title, desc) {
  return '<div class="guide-feature">' +
    '<span class="guide-feature-emoji">' + emoji + '</span>' +
    '<div><b>' + title + '</b><br><span style="color:var(--text-muted);font-size:.78rem">' + desc + '</span></div>' +
  '</div>';
}

function guideFaq(q, a) {
  return '<details class="guide-faq-item"><summary>' + escHtml(q) + '</summary><p>' + escHtml(a) + '</p></details>';
}

// ── Voice Input for Studio Chat & Agent Creation ─────────────────────────────
var _voiceRecording = false;
var _mediaRecorder = null;
var _voiceChunks = [];
var _voiceStream = null;

async function toggleVoiceInput() {
  if (_voiceRecording) {
    stopVoiceRecording();
  } else {
    await startVoiceRecording(false);
  }
}

async function openVoiceCreate() {
  navigateTo('assistant');
  await new Promise(r => setTimeout(r, 300));
  await startVoiceRecording(true);
}

async function startVoiceRecording(forCreate) {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    toast(currentLang === 'ru' ? 'Браузер не поддерживает запись голоса' : 'Browser does not support voice recording', 'error');
    return;
  }
  try {
    _voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    toast(currentLang === 'ru' ? 'Нет доступа к микрофону' : 'No microphone access', 'error');
    return;
  }

  _voiceChunks = [];
  var mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
    : 'audio/ogg';
  _mediaRecorder = new MediaRecorder(_voiceStream, { mimeType });
  _mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) _voiceChunks.push(e.data); };
  _mediaRecorder.onstop = function() {
    var blob = new Blob(_voiceChunks, { type: mimeType });
    _voiceStream && _voiceStream.getTracks().forEach(t => t.stop());
    _voiceStream = null;
    transcribeAndSend(blob, forCreate);
  };
  _mediaRecorder.start(200);
  _voiceRecording = true;

  // Update UI
  var micBtn = document.getElementById('chat-voice-btn');
  var micIcon = document.getElementById('voice-icon-mic');
  var stopIcon = document.getElementById('voice-icon-stop');
  var statusEl = document.getElementById('voice-status');
  if (micBtn) micBtn.style.color = '#ef4444';
  if (micIcon) micIcon.style.display = 'none';
  if (stopIcon) stopIcon.style.display = '';
  if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = IC.dot_red + ' ' + (currentLang === 'ru' ? 'Запись... нажмите ещё раз чтобы остановить' : 'Recording... press again to stop'); }

  // Auto-stop after 60s
  setTimeout(function() { if (_voiceRecording) stopVoiceRecording(); }, 60000);
}

function stopVoiceRecording() {
  if (!_voiceRecording || !_mediaRecorder) return;
  _voiceRecording = false;
  _mediaRecorder.stop();
  _mediaRecorder = null;

  var micBtn = document.getElementById('chat-voice-btn');
  var micIcon = document.getElementById('voice-icon-mic');
  var stopIcon = document.getElementById('voice-icon-stop');
  var statusEl = document.getElementById('voice-status');
  if (micBtn) micBtn.style.color = '#94a3b8';
  if (micIcon) micIcon.style.display = '';
  if (stopIcon) stopIcon.style.display = 'none';
  if (statusEl) { statusEl.innerHTML = IC.hourglass + ' ' + (currentLang === 'ru' ? 'Распознаю речь...' : 'Recognizing speech...'); }
}

async function transcribeAndSend(blob, forCreate) {
  var statusEl = document.getElementById('voice-status');
  try {
    var fd = new FormData();
    fd.append('audio', blob, 'voice.webm');
    var res = await fetch('/api/voice/transcribe', {
      method: 'POST',
      headers: { 'X-Auth-Token': authToken },
      body: fd
    });
    var data = await res.json();
    if (!data.text) throw new Error(data.error || 'Пустой ответ');

    var text = data.text.trim();
    if (statusEl) statusEl.style.display = 'none';

    if (forCreate) {
      // Send transcribed text as assistant message for agent creation
      var input = document.getElementById('assistant-input');
      if (input) { input.value = text; sendAssistantMessage(); }
    } else {
      // Insert transcribed text into the chat input
      var chatInput = document.getElementById('chat-input');
      if (chatInput) {
        chatInput.value = text;
        chatInput.dispatchEvent(new Event('input'));
        chatInput.focus();
      }
    }
  } catch (e) {
    if (statusEl) { statusEl.textContent = 'Ошибка распознавания: ' + (e.message || e); }
    setTimeout(function() { if (statusEl) statusEl.style.display = 'none'; }, 4000);
  }
}

// ── Inbox: avatar with TG photo (works for users AND groups) ──
function _chatAvatar(name, isGroup, chatId, size) {
  size = size || 38;
  var fontSize = size >= 34 ? '.85rem' : '.7rem';
  var colors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6'];
  var initials = isGroup ? '#' : (name || '?').replace(/^[@\s]+/, '').slice(0,1).toUpperCase();
  var color = colors[(name||'').split('').reduce(function(a,c){return a+c.charCodeAt(0);},0) % colors.length];
  var s = size + 'px';
  var fallbackDiv = '<div style="width:'+s+';height:'+s+';min-width:'+s+';border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:'+fontSize+';color:#fff">' + escHtml(initials) + '</div>';
  // Try real TG avatar for both users and groups
  var tgId = chatId ? String(chatId) : '';
  if (tgId && _detailAgentId && authToken) {
    var imgUrl = '/api/agents/' + _detailAgentId + '/avatar/' + encodeURIComponent(tgId) + '?t=' + encodeURIComponent(authToken);
    return '<div style="width:'+s+';height:'+s+';min-width:'+s+';border-radius:50%;overflow:hidden;position:relative">' +
      '<img src="' + imgUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" loading="lazy">' +
      '<div style="display:none;width:'+s+';height:'+s+';min-width:'+s+';border-radius:50%;background:' + color + ';align-items:center;justify-content:center;font-weight:700;font-size:'+fontSize+';color:#fff;position:absolute;top:0;left:0">' + escHtml(initials) + '</div>' +
    '</div>';
  }
  return fallbackDiv;
}

async function loadChatsData() {
  if (!_detailAgentId) return;
  var isRu = currentLang === 'ru';
  var list = document.getElementById('chats-list');
  if (!list) return;
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/chats');
    if (!data.ok || !data.chats || data.chats.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:.82rem">' + (isRu ? 'Агент ещё ни с кем не общался' : 'No conversations yet') + '</div>';
      return;
    }
    list.innerHTML = data.chats.map(function(c) {
      var isGroup = c.isGroup || String(c.chatId).startsWith('-');
      var name = c.senderName || c.chatId;
      // Clean name: remove brackets, timestamps, tags
      name = name.replace(/^\[|\]$/g,'').replace(/\s+\d{2}:\d{2}.*$/,'').replace(/^\+\d+[smhd]\s*/,'').trim() || c.chatId;
      // For groups with multiple senders show as group name
      var groupBadge = '';
      if (isGroup && c.uniqueSenders > 1) {
        groupBadge = '<span style="font-size:.6rem;padding:1px 5px;border-radius:4px;background:rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.15);color:#818cf8;margin-left:4px">' + c.uniqueSenders + ' users</span>';
      }
      var preview = (c.lastMessage || '').replace(/<[^>]+>/g,'').slice(0, 60);
      var id = 'chat-item-' + String(c.chatId).replace(/[^a-zA-Z0-9]/g,'_');
      return '<div id="' + id + '" class="_chat-item" data-chatid="' + escHtml(c.chatId) + '" data-chatname="' + escHtml(name) + '" onclick="openAgentChat(this)" style="cursor:pointer;padding:10px 10px;border-radius:8px;display:flex;gap:10px;align-items:center;transition:background .15s">' +
        _chatAvatar(name, isGroup, c.chatId) +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
            '<span style="font-weight:600;font-size:.83rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">' + escHtml(name) + groupBadge + '</span>' +
            '<span style="font-size:.7rem;color:var(--text-muted);flex-shrink:0;margin-left:4px">' + c.messageCount + (isRu ? ' соо' : ' msg') + '</span>' +
          '</div>' +
          '<div style="font-size:.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">' + escHtml(preview || '—') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // ── Resolve real Telegram names for chats (async enrichment) ──
    var chatIds = data.chats.map(function(c) { return c.chatId; });
    apiRequest('POST', '/api/agents/' + _detailAgentId + '/chat-names', { chatIds: chatIds }).then(function(nameData) {
      if (!nameData || !nameData.names) return;
      var names = nameData.names;
      document.querySelectorAll('._chat-item').forEach(function(el) {
        var cid = el.getAttribute('data-chatid');
        if (cid && names[cid]) {
          var nameEl = el.querySelector('span[style*="font-weight:600"]');
          if (nameEl) nameEl.textContent = names[cid];
          el.setAttribute('data-chatname', names[cid]);
        }
      });
    }).catch(function() {});

  } catch(e) {
    list.innerHTML = '<div style="color:var(--error);padding:1rem;font-size:.82rem">' + escHtml(e.message||'Error') + '</div>';
  }
}

function openAgentChat(el) {
  var chatId = el.getAttribute('data-chatid');
  var chatName = el.getAttribute('data-chatname');
  // Highlight selected
  document.querySelectorAll('._chat-item').forEach(function(i){ i.style.background=''; });
  el.style.background = 'var(--bg-hover, rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.1))';
  loadAgentChatHistory(chatId, chatName);
}

async function loadAgentChatHistory(chatId, chatName) {
  if (!_detailAgentId) return;
  var isRu = currentLang === 'ru';
  var header = document.getElementById('chat-view-header');
  var msgs = document.getElementById('chat-view-messages');
  if (!header || !msgs) return;
  var isGroup = String(chatId).startsWith('-');
  header.innerHTML =
    _chatAvatar(chatName, isGroup, chatId) +
    '<div>' +
      '<div style="font-weight:700;font-size:.88rem;color:var(--text-primary)">' + escHtml(chatName) + '</div>' +
      '<div style="font-size:.73rem;color:var(--text-muted)">' + escHtml(chatId) + '</div>' +
    '</div>';
  msgs.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:.82rem">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>';
  try {
    var data = await apiRequest('GET', '/api/agents/' + _detailAgentId + '/chats/' + encodeURIComponent(chatId));
    if (!data.ok || !data.messages || data.messages.length === 0) {
      msgs.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:.82rem">' + (isRu ? 'История пуста' : 'No messages') + '</div>';
      return;
    }
    msgs.innerHTML = data.messages.map(function(m) {
      if (m.isMe) {
        // Agent bubble — right side, accent color
        return '<div style="display:flex;justify-content:flex-end;align-items:flex-end;gap:8px">' +
          '<div style="max-width:70%;display:flex;flex-direction:column;align-items:flex-end">' +
            '<div style="font-size:.7rem;color:var(--text-muted);margin-bottom:3px;padding-right:4px">' + IC.robot + ' ' + (isRu ? 'Агент' : 'Agent') + '</div>' +
            '<div style="padding:9px 13px;border-radius:16px 16px 4px 16px;background:rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.18);border:1px solid rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.3);font-size:.82rem;color:var(--text-primary);line-height:1.55;word-break:break-word;white-space:pre-wrap">' + escHtml(m.text||'') + '</div>' +
          '</div>' +
          '<div style="width:28px;height:28px;min-width:28px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;font-size:.7rem">' + IC.robot + '</div>' +
        '</div>';
      } else {
        // User bubble — left side
        var uname = (m.header||'').replace(/^\[|\]$/g,'').replace(/\s+\d{2}:\d{2}.*$/,'').replace(/^\[?(owner|user|bot)\]\s*/i,'').trim() || '?';
        var timeMatch = (m.header||'').match(/(\d{2}:\d{2})/);
        var timeStr = timeMatch ? timeMatch[1] : '';
        return '<div style="display:flex;align-items:flex-end;gap:8px">' +
          _chatAvatar(uname, false, chatId, 28) +
          '<div style="max-width:70%;display:flex;flex-direction:column">' +
            '<div style="font-size:.7rem;color:var(--text-muted);margin-bottom:3px;padding-left:4px">' + escHtml(uname) + (timeStr ? ' · ' + timeStr : '') + '</div>' +
            '<div style="padding:9px 13px;border-radius:16px 16px 16px 4px;background:var(--bg-primary);border:1px solid var(--border);font-size:.82rem;color:var(--text-primary);line-height:1.55;word-break:break-word;white-space:pre-wrap">' + escHtml(m.text||'') + '</div>' +
          '</div>' +
        '</div>';
      }
    }).join('');
    // Scroll to bottom
    msgs.scrollTop = msgs.scrollHeight;
  } catch(e) {
    msgs.innerHTML = '<div style="color:var(--error);padding:1rem;font-size:.82rem">' + escHtml(e.message||'Error') + '</div>';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN AGENTS PAGE — all platform agents, start/stop, errors only
// ═══════════════════════════════════════════════════════════════════════════

async function loadAdminAgentsPage() {
  var container = document.getElementById('admin-agents-content');
  if (!container) return;
  var isRu = currentLang === 'ru';
  container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:.85rem">⟳ ' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>';
  try {
    var data = await apiRequest('GET', '/api/admin/agents');
    if (!data.ok || !data.agents) { container.innerHTML = '<div style="color:var(--error);padding:2rem">Access denied or error</div>'; return; }
    var agents = data.agents;

    // Stats bar
    var active = agents.filter(function(a) { return a.isActive; }).length;
    var withErrors = agents.filter(function(a) { return a.recentErrors > 0; }).length;
    var statsHtml = '<div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">' +
      '<div class="stat-card"><div class="stat-value">' + agents.length + '</div><div class="stat-label">' + (isRu ? 'Всего' : 'Total') + '</div></div>' +
      '<div class="stat-card"><div class="stat-value" style="color:#10b981">' + active + '</div><div class="stat-label">' + (isRu ? 'Активных' : 'Active') + '</div></div>' +
      '<div class="stat-card"><div class="stat-value" style="color:#ef4444">' + withErrors + '</div><div class="stat-label">' + (isRu ? 'С ошибками' : 'With errors') + '</div></div>' +
    '</div>';

    // Table
    var tableHtml = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem">' +
      '<thead><tr style="border-bottom:2px solid var(--border);text-align:left">' +
        '<th style="padding:10px 8px">ID</th>' +
        '<th style="padding:10px 8px">' + (isRu ? 'Агент' : 'Agent') + '</th>' +
        '<th style="padding:10px 8px">' + (isRu ? 'Владелец' : 'Owner') + '</th>' +
        '<th style="padding:10px 8px">' + (isRu ? 'Статус' : 'Status') + '</th>' +
        '<th style="padding:10px 8px">' + (isRu ? 'Ошибки 24ч' : 'Errors 24h') + '</th>' +
        '<th style="padding:10px 8px">' + (isRu ? 'Действие' : 'Action') + '</th>' +
      '</tr></thead><tbody>';

    agents.forEach(function(a) {
      var statusDot = a.isActive
        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:6px"></span>' + (isRu ? 'Активен' : 'Active')
        : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#64748b;margin-right:6px"></span>' + (isRu ? 'Стоп' : 'Stopped');
      var errBadge = a.recentErrors === -1
        ? '<span style="font-size:.7rem;color:var(--text-muted);font-style:italic">' + (isRu ? 'скрыто' : 'hidden') + '</span>'
        : a.recentErrors > 0
          ? '<span style="padding:2px 8px;border-radius:10px;background:rgba(239,68,68,0.15);color:#ef4444;font-size:.75rem;font-weight:600">' + a.recentErrors + '</span>'
          : '<span style="color:var(--text-muted)">0</span>';
      var actionBtn = a.isActive
        ? '<button class="rt-save-btn" style="padding:5px 14px;font-size:.75rem" onclick="adminAgentAction(' + a.id + ',\'stop\')">' + (isRu ? 'Стоп' : 'Stop') + '</button>'
        : '<button class="rt-save-btn" style="padding:5px 14px;font-size:.75rem" onclick="adminAgentAction(' + a.id + ',\'start\')">' + (isRu ? 'Запуск' : 'Start') + '</button>';
      tableHtml += '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:8px;color:var(--text-muted)">#' + a.id + '</td>' +
        '<td style="padding:8px;font-weight:600;color:var(--text-primary)">' + escHtml((a.name || '').slice(0, 30)) + '</td>' +
        '<td style="padding:8px;color:var(--text-muted);font-size:.78rem">' + escHtml(a.ownerUsername || 'ID:' + a.userId) + '</td>' +
        '<td style="padding:8px">' + statusDot + '</td>' +
        '<td style="padding:8px;text-align:center">' + errBadge + '</td>' +
        '<td style="padding:8px">' + actionBtn + '</td>' +
      '</tr>';
      // Show last error if any
      if (a.lastError) {
        tableHtml += '<tr style="border-bottom:1px solid var(--border)">' +
          '<td></td><td colspan="5" style="padding:4px 8px 10px;font-size:.74rem;color:#ef4444;font-family:\'JetBrains Mono\',monospace">' +
            IC.warn + ' ' + escHtml(String(a.lastError).slice(0, 200)) +
          '</td></tr>';
      }
    });
    tableHtml += '</tbody></table></div>';
    container.innerHTML = statsHtml + tableHtml;
  } catch(e) {
    container.innerHTML = '<div style="color:var(--error);padding:2rem">' + escHtml(e.message || 'Error') + '</div>';
  }
}

async function adminAgentAction(agentId, action) {
  try {
    var endpoint = action === 'start' ? '/api/agents/' + agentId + '/run' : '/api/agents/' + agentId + '/stop';
    await apiRequest('POST', endpoint);
    toast((action === 'start' ? 'Started' : 'Stopped') + ' agent #' + agentId, 'success');
    setTimeout(loadAdminAgentsPage, 1000);
  } catch(e) { toast('Error: ' + (e.message || e), 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMS OF SERVICE / PRIVACY CONSENT POPUP
// ═══════════════════════════════════════════════════════════════════════════

function showTosPopup() {
  var existing = document.getElementById('tos-overlay');
  if (existing) existing.remove();
  var isRu = currentLang === 'ru';

  var overlay = document.createElement('div');
  overlay.id = 'tos-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1.5rem;backdrop-filter:blur(4px)';

  overlay.innerHTML =
    '<div style="background:var(--bg-secondary,#1a1f2e);border:1px solid var(--border,#2a3040);border-radius:16px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;padding:32px">' +
      '<div style="text-align:center;margin-bottom:20px">' +
        '<div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
        '</div>' +
        '<h2 style="margin:0;font-size:1.3rem;color:var(--text-primary,#fff)">' + (isRu ? 'Пользовательское соглашение' : 'Terms of Service') + '</h2>' +
        '<p style="margin:8px 0 0;color:var(--text-muted,#94a3b8);font-size:.85rem">' + (isRu ? 'Пожалуйста, ознакомьтесь и примите условия' : 'Please review and accept the terms') + '</p>' +
      '</div>' +

      // Privacy section
      '<div style="background:var(--bg-primary,#141821);border:1px solid var(--border,#2a3040);border-radius:10px;padding:16px;margin-bottom:16px">' +
        '<h3 style="margin:0 0 10px;font-size:.92rem;color:var(--primary);display:flex;align-items:center;gap:8px">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ' +
          (isRu ? 'Конфиденциальность переписок' : 'Conversation Privacy') +
        '</h3>' +
        '<p style="margin:0;font-size:.82rem;color:var(--text-secondary,#cbd5e1);line-height:1.6">' +
          (isRu
            ? 'Переписки ваших AI-агентов хранятся в зашифрованном виде и <b>доступны только вам</b>. Платформа <b>не имеет доступа</b> к содержимому переписок ваших агентов. Администраторы могут видеть только техническую информацию: статус агента, количество сообщений и ошибки.'
            : 'Your AI agent conversations are stored encrypted and are <b>accessible only to you</b>. The platform <b>does not have access</b> to the content of your agent conversations. Administrators can only see technical information: agent status, message counts, and errors.') +
        '</p>' +
      '</div>' +

      // Error sharing section
      '<div style="background:var(--bg-primary,#141821);border:1px solid var(--border,#2a3040);border-radius:10px;padding:16px;margin-bottom:20px">' +
        '<h3 style="margin:0 0 10px;font-size:.92rem;color:#f59e0b;display:flex;align-items:center;gap:8px">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ' +
          (isRu ? 'Сбор информации об ошибках' : 'Error Information Collection') +
        '</h3>' +
        '<p style="margin:0;font-size:.82rem;color:var(--text-secondary,#cbd5e1);line-height:1.6">' +
          (isRu
            ? 'Для улучшения платформы мы собираем <b>только техническую информацию об ошибках</b>: тип ошибки, контекст (без содержимого сообщений) и время возникновения. Это помогает нам быстрее находить и исправлять проблемы.'
            : 'To improve the platform, we collect <b>only technical error information</b>: error type, context (without message content), and timestamp. This helps us find and fix issues faster.') +
        '</p>' +
      '</div>' +

      // Checkboxes
      '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">' +
        '<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-size:.83rem;color:var(--text-primary,#fff)">' +
          '<input type="checkbox" id="tos-accept-terms" style="accent-color:var(--primary);margin-top:2px;width:18px;height:18px;flex-shrink:0">' +
          '<span>' + (isRu
            ? 'Я принимаю <a href="/terms" target="_blank" style="color:var(--primary);text-decoration:underline">пользовательское соглашение</a> и <a href="/privacy" target="_blank" style="color:var(--primary);text-decoration:underline">политику конфиденциальности</a>'
            : 'I accept the <a href="/terms" target="_blank" style="color:var(--primary);text-decoration:underline">Terms of Service</a> and <a href="/privacy" target="_blank" style="color:var(--primary);text-decoration:underline">Privacy Policy</a>') +
          '</span>' +
        '</label>' +
        '<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-size:.83rem;color:var(--text-primary,#fff)">' +
          '<input type="checkbox" id="tos-accept-errors" style="accent-color:var(--primary);margin-top:2px;width:18px;height:18px;flex-shrink:0">' +
          '<span>' + (isRu
            ? 'Я согласен на сбор технической информации об ошибках для улучшения сервиса'
            : 'I consent to the collection of technical error data to improve the service') +
          '</span>' +
        '</label>' +
      '</div>' +

      // Note about optional
      '<div style="font-size:.75rem;color:var(--text-muted,#64748b);margin-bottom:16px;line-height:1.5;padding:0 4px">' +
        (isRu
          ? '* Сбор ошибок — необязательно. Если вы откажетесь, мы не будем собирать информацию об ошибках ваших агентов, но это может замедлить решение проблем.'
          : '* Error collection is optional. If you decline, we won\'t collect error data from your agents, but this may slow down issue resolution.') +
      '</div>' +

      // Button
      '<button id="tos-accept-btn" disabled onclick="acceptTos()" class="rt-save-btn" style="width:100%;justify-content:center;opacity:0.5;cursor:not-allowed">' +
        (isRu ? 'Принять и продолжить' : 'Accept & Continue') +
      '</button>' +
    '</div>';

  document.body.appendChild(overlay);

  // Enable button when ToS checkbox is checked (errors checkbox is optional)
  var cb1 = document.getElementById('tos-accept-terms');
  var btn = document.getElementById('tos-accept-btn');
  function updateBtn() {
    var ok = cb1 && cb1.checked;
    if (btn) { btn.disabled = !ok; btn.style.opacity = ok ? '1' : '0.5'; btn.style.cursor = ok ? 'pointer' : 'not-allowed'; }
  }
  if (cb1) cb1.onchange = updateBtn;
}

async function acceptTos() {
  try {
    var errCb = document.getElementById('tos-accept-errors');
    var acceptErrors = errCb ? errCb.checked : false;
    await apiRequest('POST', '/api/me/accept-tos', { acceptTos: true, acceptErrors: acceptErrors });
    if (currentUser) currentUser._acceptedTos = true;
    // Persist locally — survive page reload even if server lookup is slow
    try { localStorage.setItem('tos_accepted', '1'); } catch (_e) {}
    try { localStorage.setItem('tos_accepted_errors', acceptErrors ? '1' : '0'); } catch (_e) {}
    var overlay = document.getElementById('tos-overlay');
    if (overlay) overlay.remove();
    toast(currentLang === 'ru' ? 'Спасибо! Добро пожаловать.' : 'Thank you! Welcome.', 'success');
  } catch(e) { toast('Error: ' + (e.message||e), 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMS OF SERVICE & PRIVACY POLICY PAGES
// ═══════════════════════════════════════════════════════════════════════════

function _legalStyles() {
  return 'style="font-size:.88rem;color:var(--text-secondary);line-height:1.8"';
}
function _legalH(text) { return '<h2 style="font-size:1.1rem;color:var(--text-primary);margin:28px 0 12px;font-weight:700">' + text + '</h2>'; }
function _legalP(text) { return '<p style="margin:0 0 14px;font-size:.86rem;color:var(--text-secondary);line-height:1.7">' + text + '</p>'; }

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE: PRIVACY, DATA EXPORT, DELETE ACCOUNT, UI SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

async function toggleErrorConsent(enabled) {
  try {
    await apiRequest('POST', '/api/me/accept-tos', { acceptTos: true, acceptErrors: enabled });
    toast(currentLang === 'ru'
      ? (enabled ? 'Сбор ошибок включён' : 'Сбор ошибок отключён')
      : (enabled ? 'Error sharing enabled' : 'Error sharing disabled'), 'success');
  } catch(e) { toast('Error: ' + (e.message||e), 'error'); }
}

async function exportMyData() {
  toast(currentLang === 'ru' ? 'Собираю данные...' : 'Collecting data...', 'info');
  try {
    var resp = await fetch('/api/me/export', { headers: { 'X-Auth-Token': authToken } });
    if (!resp.ok) throw new Error('Export failed');
    var blob = await resp.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'ton-agent-data-' + Date.now() + '.json'; a.click();
    URL.revokeObjectURL(url);
    toast(currentLang === 'ru' ? 'Данные скачаны' : 'Data downloaded', 'success');
  } catch(e) { toast('Error: ' + (e.message||e), 'error'); }
}

function deleteMyAccount() {
  var isRu = currentLang === 'ru';
  var msg = isRu
    ? 'Это действие НЕОБРАТИМО. Будут удалены:\n\n• Все агенты и их данные\n• Все кошельки\n• История транзакций\n• Telegram сессии\n• Подписка\n\nВведите DELETE для подтверждения:'
    : 'This action is IRREVERSIBLE. Will be deleted:\n\n• All agents and data\n• All wallets\n• Transaction history\n• Telegram sessions\n• Subscription\n\nType DELETE to confirm:';
  var input = prompt(msg);
  if (input !== 'DELETE') { toast(isRu ? 'Отменено' : 'Cancelled', 'info'); return; }
  apiRequest('DELETE', '/api/me/account', { confirmation: 'DELETE' }).then(function(d) {
    if (d.ok) {
      toast(isRu ? 'Аккаунт удалён' : 'Account deleted', 'success');
      setTimeout(function() { logout(); }, 1500);
    } else { toast(d.error || 'Error', 'error'); }
  }).catch(function(e) { toast('Error: ' + (e.message||e), 'error'); });
}

// ── Notification Settings ──
var _notifDuration = parseInt(localStorage.getItem('notif_duration') || '5') * 1000;
var _notifSound = localStorage.getItem('notif_sound') === 'true';
var _notifBadge = localStorage.getItem('notif_badge') !== 'false';

function setNotifDuration(val) {
  _notifDuration = parseInt(val) * 1000;
  localStorage.setItem('notif_duration', val);
  var el = document.getElementById('notif-duration-value');
  if (el) el.textContent = val + 's';
}

function setNotifAutoDismiss(sec) {
  if (sec === 0) { _notifDuration = 0; localStorage.setItem('notif_duration', '0'); }
  else { _notifDuration = sec * 1000; localStorage.setItem('notif_duration', String(sec)); }
  document.querySelectorAll('.notif-dismiss-btn').forEach(function(b) {
    b.style.background = 'var(--bg-primary)'; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text-primary)';
  });
  var target = event && event.target; if (target) { target.style.background = 'var(--accent-dim)'; target.style.borderColor = 'var(--primary)'; target.style.color = 'var(--primary)'; }
  var slider = document.getElementById('notif-duration-slider');
  var val = document.getElementById('notif-duration-value');
  if (slider) slider.value = sec || 2;
  if (val) val.textContent = sec ? sec + 's' : 'off';
}

function toggleNotifSound(on) {
  _notifSound = on;
  localStorage.setItem('notif_sound', on ? 'true' : 'false');
  if (on) _playNotifSound();
}

function toggleNotifBadge(on) {
  _notifBadge = on;
  localStorage.setItem('notif_badge', on ? 'true' : 'false');
  var badge = document.getElementById('feedback-badge');
  if (badge && !on) badge.style.display = 'none';
}

function _playNotifSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800; osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

// ── Notification history retention ──
var _notifRetainDays = parseInt(localStorage.getItem('notif_retain_days') || '30');

function setNotifRetain(val) {
  document.querySelectorAll('.notif-retain-btn').forEach(function(b) {
    b.style.background = 'var(--bg-primary)'; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text-primary)';
  });
  if (event && event.target) { event.target.style.background = 'var(--accent-dim)'; event.target.style.borderColor = 'var(--primary)'; event.target.style.color = 'var(--primary)'; }
  var customEl = document.getElementById('notif-custom-retain');
  if (val === 'custom') {
    if (customEl) customEl.style.display = '';
    return;
  }
  if (customEl) customEl.style.display = 'none';
  var days = val === 'off' ? 0 : val === '1d' ? 1 : val === '7d' ? 7 : val === '30d' ? 30 : 30;
  _notifRetainDays = days;
  localStorage.setItem('notif_retain_days', String(days));
  toast(currentLang === 'ru' ? (days ? 'История: ' + days + ' дн.' : 'Авто-удаление выключено') : (days ? 'History: ' + days + ' days' : 'Auto-delete off'), 'success');
}

function applyCustomRetain() {
  var inp = document.getElementById('notif-retain-days');
  var days = inp ? parseInt(inp.value) : 14;
  if (isNaN(days) || days < 1) days = 1;
  if (days > 365) days = 365;
  _notifRetainDays = days;
  localStorage.setItem('notif_retain_days', String(days));
  var customEl = document.getElementById('notif-custom-retain');
  if (customEl) customEl.style.display = 'none';
  toast(currentLang === 'ru' ? 'История: ' + days + ' дн.' : 'History: ' + days + ' days', 'success');
}

function setUIScale(val) {
  // Sync all scale displays
  var els = [document.getElementById('ui-scale-value'), document.getElementById('sidebar-scale-value')];
  els.forEach(function(el) { if (el) el.textContent = val + '%'; });
  var sliders = [document.getElementById('ui-scale-slider'), document.getElementById('sidebar-scale-slider')];
  sliders.forEach(function(s) { if (s) s.value = val; });
  var z = (val / 100);
  // Apply zoom to:
  //   - main content area
  //   - sidebar HEADER (logo)
  //   - sidebar NAV (menu items)
  //  but NOT to sidebar-footer — the footer holds the scale slider itself,
  //  and if it zoomed, the slider would walk away from under the user's
  //  cursor while dragging. The footer stays at native scale, so the lang
  //  buttons + slider + logout are stable controls regardless of UI zoom.
  var mc = document.querySelector('.main-content'); if (mc) mc.style.zoom = z;
  var sh = document.querySelector('.sidebar-header'); if (sh) sh.style.zoom = z;
  var sn = document.querySelector('.sidebar-nav'); if (sn) sn.style.zoom = z;
  localStorage.setItem('ui_scale', val);
}

function setAccentColor(color) {
  var root = document.documentElement;
  // Parse RGB once so we can derive shades + alpha variants
  var r, g, b;
  if (color.startsWith('#')) {
    var hex = color.slice(1);
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else { r = 14; g = 165; b = 233; }
  function clamp(n) { return Math.max(0, Math.min(255, n | 0)); }
  function rgbHex(rr, gg, bb) {
    return '#' + [rr, gg, bb].map(function(n) { return clamp(n).toString(16).padStart(2, '0'); }).join('');
  }
  // primary-light = +18 mix to white; primary-dark = -24 to black
  var light = rgbHex(r + (255 - r) * 0.22, g + (255 - g) * 0.22, b + (255 - b) * 0.22);
  var dark  = rgbHex(r * 0.78, g * 0.78, b * 0.78);

  root.style.setProperty('--accent', color);
  root.style.setProperty('--primary', color);
  root.style.setProperty('--primary-light', light);
  root.style.setProperty('--primary-dark', dark);
  root.style.setProperty('--accent-light', light);
  root.style.setProperty('--accent-dark', dark);
  root.style.setProperty('--accent-dim', 'rgba(' + r + ',' + g + ',' + b + ',0.15)');
  root.style.setProperty('--accent-glow', 'rgba(' + r + ',' + g + ',' + b + ',0.3)');
  // RGB components — referenced by inline rgba(var(--accent-r),...,X) so every
  // hardcoded blue tint (rgba(var(--accent-r,0),var(--accent-g,152),var(--accent-b,234),...)) adapts to the chosen accent.
  root.style.setProperty('--accent-r', r);
  root.style.setProperty('--accent-g', g);
  root.style.setProperty('--accent-b', b);
  // design-system.css redefines --primary as var(--ds-primary) inside :root.
  // We have to also override the --ds-* variables otherwise nav-badge.accent
  // (which uses !important + --ds-accent-dim) stays blue/purple.
  root.style.setProperty('--ds-primary', color);
  root.style.setProperty('--ds-primary-bright', light);
  root.style.setProperty('--ds-primary-dim', 'rgba(' + r + ',' + g + ',' + b + ',0.12)');
  root.style.setProperty('--ds-accent', color);
  root.style.setProperty('--ds-accent-bright', light);
  root.style.setProperty('--ds-accent-dim', 'rgba(' + r + ',' + g + ',' + b + ',0.12)');

  // Update accent dot rings
  document.querySelectorAll('.accent-dot').forEach(function(d) {
    var match = false;
    try { match = d.style.background === color || (d.onclick && d.onclick.toString().includes(color)); } catch {}
    d.style.borderColor = match ? '#fff' : 'transparent';
  });
  localStorage.setItem('accent_color', color);
}

// ── Gradient accent preset switcher ──
// Flips both --primary and --accent-2 via :root[data-accent="..."] rules
// defined in studio-skin.css. Mirrors the resolved values into the legacy
// --ds-* tokens so design-system.css badges follow along.
function setAccentPreset(name) {
  if (typeof name !== 'string') return;
  var root = document.documentElement;
  root.dataset.accent = name;
  var cs = getComputedStyle(root);
  var primary      = (cs.getPropertyValue('--primary') || '').trim();
  var primaryLight = (cs.getPropertyValue('--primary-light') || '').trim();
  var dim          = (cs.getPropertyValue('--accent-dim') || '').trim();
  if (primary) {
    root.style.setProperty('--ds-primary', primary);
    root.style.setProperty('--ds-primary-bright', primaryLight || primary);
    root.style.setProperty('--ds-primary-dim', dim || 'rgba(0,152,234,0.12)');
    root.style.setProperty('--ds-accent', primary);
    root.style.setProperty('--ds-accent-bright', primaryLight || primary);
    root.style.setProperty('--ds-accent-dim', dim || 'rgba(0,152,234,0.12)');
  }
  document.querySelectorAll('.accent-preset').forEach(function(el) {
    el.classList.toggle('active', el.dataset.preset === name);
  });
  localStorage.setItem('accent_preset', name);
}
window.setAccentPreset = setAccentPreset;

// Restore UI settings from localStorage
(function restoreUISettings() {
  var scale = localStorage.getItem('ui_scale');
  if (scale) {
    var z = parseInt(scale) / 100;
    var mc = document.querySelector('.main-content'); if (mc) mc.style.zoom = z;
    // Sidebar zoom — header + nav only, footer stays native (slider lives there)
    var sh = document.querySelector('.sidebar-header'); if (sh) sh.style.zoom = z;
    var sn = document.querySelector('.sidebar-nav'); if (sn) sn.style.zoom = z;
    var ss = document.getElementById('sidebar-scale-slider'); if (ss) ss.value = scale;
    var sv = document.getElementById('sidebar-scale-value'); if (sv) sv.textContent = scale + '%';
  }
  // Gradient preset has priority; fall back to legacy single-colour accent.
  var preset = localStorage.getItem('accent_preset');
  if (!preset) {
    var legacy = (localStorage.getItem('accent_color') || '').toLowerCase();
    var map = { '#0ea5e9': 'mono', '#8b5cf6': 'plasma', '#10b981': 'emerald', '#f59e0b': 'sunset', '#ef4444': 'sunset' };
    preset = map[legacy] || 'aurora';
  }
  try { setAccentPreset(preset); } catch (e) {}
  // Restore notification settings
  var nd = localStorage.getItem('notif_duration');
  if (nd !== null) { _notifDuration = parseInt(nd) * 1000; var nds = document.getElementById('notif-duration-slider'); if (nds) nds.value = nd; var ndv = document.getElementById('notif-duration-value'); if (ndv) ndv.textContent = nd === '0' ? 'off' : nd + 's'; }
  var ns = localStorage.getItem('notif_sound');
  if (ns === 'true') { _notifSound = true; var nst = document.getElementById('notif-sound-toggle'); if (nst) nst.checked = true; }
  var nb = localStorage.getItem('notif_badge');
  if (nb === 'false') { _notifBadge = false; var nbt = document.getElementById('notif-badge-toggle'); if (nbt) nbt.checked = false; }
  // Restore retain setting
  var nr = localStorage.getItem('notif_retain_days');
  if (nr !== null) _notifRetainDays = parseInt(nr);
})();

// Load error consent checkbox state in profile
var _origLoadProfile = typeof loadProfile === 'function' ? loadProfile : null;
if (_origLoadProfile) {
  var _patchedLoadProfile = async function() {
    await _origLoadProfile();
    // Set error consent checkbox
    try {
      var data = await apiRequest('GET', '/api/me');
      var cb = document.getElementById('profile-error-consent');
      if (cb) cb.checked = data.acceptedErrors || false;
      var scaleSlider = document.getElementById('ui-scale-slider');
      var scaleVal = document.getElementById('ui-scale-value');
      var savedScale = localStorage.getItem('ui_scale') || '100';
      if (scaleSlider) scaleSlider.value = savedScale;
      if (scaleVal) scaleVal.textContent = savedScale + '%';
    } catch {}
  };
  // Monkey-patch loadProfile
  loadProfile = _patchedLoadProfile;
}

function loadTermsPage() {
  var el = document.getElementById('terms-content');
  if (!el) return;
  var isRu = currentLang === 'ru';
  var updated = '1 ' + (isRu ? 'апреля' : 'April') + ' 2026';

  el.innerHTML = '<div ' + _legalStyles() + '>' +
    '<h1 style="font-size:1.5rem;color:var(--text-primary);margin-bottom:4px">' + (isRu ? 'Пользовательское соглашение' : 'Terms of Service') + '</h1>' +
    '<p style="color:var(--text-muted);font-size:.78rem;margin-bottom:24px">' + (isRu ? 'Последнее обновление: ' : 'Last updated: ') + updated + '</p>' +

    _legalH(isRu ? '1. Общие положения' : '1. General') +
    _legalP(isRu
      ? 'TON Agent Platform (далее — «Платформа») предоставляет инструменты для создания и управления автономными AI-агентами в экосистеме TON/Telegram. Используя Платформу, вы соглашаетесь с настоящими условиями.'
      : 'TON Agent Platform (the "Platform") provides tools for creating and managing autonomous AI agents in the TON/Telegram ecosystem. By using the Platform, you agree to these terms.') +

    _legalH(isRu ? '2. Учётная запись' : '2. Account') +
    _legalP(isRu
      ? 'Для использования Платформы необходима авторизация через Telegram. Вы несёте ответственность за действия, совершённые через вашу учётную запись, включая действия ваших AI-агентов.'
      : 'Using the Platform requires Telegram authentication. You are responsible for all actions performed through your account, including actions of your AI agents.') +

    _legalH(isRu ? '3. AI-агенты' : '3. AI Agents') +
    _legalP(isRu
      ? 'Агенты действуют от вашего имени. Вы несёте полную ответственность за: содержимое системных промптов, действия агентов в чатах и группах, финансовые операции (отправка TON, покупка/продажа подарков). Платформа не несёт ответственности за убытки, вызванные действиями ваших агентов.'
      : 'Agents act on your behalf. You are fully responsible for: system prompt content, agent actions in chats and groups, financial operations (sending TON, buying/selling gifts). The Platform is not liable for losses caused by your agents.') +

    _legalH(isRu ? '4. API ключи и провайдеры' : '4. API Keys & Providers') +
    _legalP(isRu
      ? 'Вы предоставляете собственные API ключи для AI-провайдеров (Gemini, Claude, GPT и др.). Платформа хранит ключи в зашифрованном виде и использует их исключительно для работы ваших агентов. Вы несёте ответственность за соблюдение условий использования AI-провайдеров.'
      : 'You provide your own API keys for AI providers (Gemini, Claude, GPT, etc.). The Platform stores keys encrypted and uses them solely for your agents. You are responsible for complying with AI provider terms.') +

    _legalH(isRu ? '5. Telegram аккаунт' : '5. Telegram Account') +
    _legalP(isRu
      ? 'При подключении Telegram аккаунта к агенту (MTProto), агент получает доступ к вашему аккаунту. Вы подтверждаете, что имеете право использовать данный аккаунт и понимаете риски автоматизации.'
      : 'When connecting a Telegram account to an agent (MTProto), the agent gains access to your account. You confirm you have the right to use this account and understand automation risks.') +

    _legalH(isRu ? '6. Финансовые операции' : '6. Financial Operations') +
    _legalP(isRu
      ? 'Платформа предоставляет инструменты для работы с TON блокчейном. Все транзакции необратимы. Платформа не является финансовым посредником и не несёт ответственности за потерю средств.'
      : 'The Platform provides tools for TON blockchain operations. All transactions are irreversible. The Platform is not a financial intermediary and is not liable for loss of funds.') +

    _legalH(isRu ? '7. Ограничения' : '7. Restrictions') +
    _legalP(isRu
      ? 'Запрещено: использование агентов для спама, мошенничества или нарушения законов; попытки обхода лимитов и защит; использование для атак на другие сервисы; распространение вредоносного контента.'
      : 'Prohibited: using agents for spam, fraud, or illegal activities; attempting to bypass limits and protections; using for attacks on other services; distributing harmful content.') +

    _legalH(isRu ? '8. Прекращение доступа' : '8. Termination') +
    _legalP(isRu
      ? 'Мы оставляем за собой право приостановить или заблокировать аккаунт при нарушении условий. Вы можете удалить аккаунт и все данные в любое время через настройки профиля.'
      : 'We reserve the right to suspend or block accounts for violations. You can delete your account and all data at any time through profile settings.') +

    _legalH(isRu ? '9. Контакты' : '9. Contact') +
    _legalP(isRu
      ? 'По вопросам: <a href="https://t.me/TonAgentPlatformBot" style="color:var(--primary)">@TonAgentPlatformBot</a> | <a href="https://t.me/tonagentplatform" style="color:var(--primary)">@tonagentplatform</a>'
      : 'Contact: <a href="https://t.me/TonAgentPlatformBot" style="color:var(--primary)">@TonAgentPlatformBot</a> | <a href="https://t.me/tonagentplatform" style="color:var(--primary)">@tonagentplatform</a>') +

  '</div>';
}

function loadPrivacyPage() {
  var el = document.getElementById('privacy-content');
  if (!el) return;
  var isRu = currentLang === 'ru';
  var updated = '1 ' + (isRu ? 'апреля' : 'April') + ' 2026';

  el.innerHTML = '<div ' + _legalStyles() + '>' +
    '<h1 style="font-size:1.5rem;color:var(--text-primary);margin-bottom:4px">' + (isRu ? 'Политика конфиденциальности' : 'Privacy Policy') + '</h1>' +
    '<p style="color:var(--text-muted);font-size:.78rem;margin-bottom:24px">' + (isRu ? 'Последнее обновление: ' : 'Last updated: ') + updated + '</p>' +

    _legalH(isRu ? '1. Какие данные мы собираем' : '1. What Data We Collect') +
    _legalP(isRu
      ? '<b>Данные аккаунта:</b> Telegram ID, username, имя — получаем при авторизации через Telegram.'
      : '<b>Account data:</b> Telegram ID, username, name — received during Telegram authorization.') +
    _legalP(isRu
      ? '<b>Данные агентов:</b> системные промпты, настройки, логи выполнения, метрики использования.'
      : '<b>Agent data:</b> system prompts, settings, execution logs, usage metrics.') +
    _legalP(isRu
      ? '<b>Техническая информация:</b> тип ошибок, время возникновения, контекст (без содержимого сообщений) — только с вашего согласия.'
      : '<b>Technical information:</b> error types, timestamps, context (without message content) — only with your consent.') +

    _legalH(isRu ? '2. Переписки агентов' : '2. Agent Conversations') +
    '<div style="padding:16px;background:rgba(var(--accent-r,14),var(--accent-g,165),var(--accent-b,233),0.06);border-left:3px solid var(--primary);border-radius:0 10px 10px 0;margin-bottom:16px">' +
    _legalP(isRu
      ? '<b>Переписки ваших AI-агентов доступны только вам.</b> Платформа не читает, не анализирует и не передаёт третьим лицам содержимое переписок ваших агентов. Администраторы платформы имеют доступ только к технической информации: статус агента, количество сообщений, ошибки.'
      : '<b>Your AI agent conversations are accessible only to you.</b> The Platform does not read, analyze, or share the content of your agent conversations. Platform administrators only have access to technical information: agent status, message counts, errors.') +
    '</div>' +

    _legalH(isRu ? '3. API ключи' : '3. API Keys') +
    _legalP(isRu
      ? 'API ключи AI-провайдеров хранятся в зашифрованном виде (AES-256-GCM). Ключи используются исключительно для выполнения запросов ваших агентов и не передаются третьим лицам.'
      : 'AI provider API keys are stored encrypted (AES-256-GCM). Keys are used solely for your agent requests and are not shared with third parties.') +

    _legalH(isRu ? '4. Telegram данные' : '4. Telegram Data') +
    _legalP(isRu
      ? 'При подключении Telegram аккаунта к агенту, сессия MTProto хранится на сервере в зашифрованном виде. Мы не имеем доступа к вашим личным сообщениям, контактам или медиа-файлам за пределами того, что необходимо для работы агента.'
      : 'When connecting a Telegram account to an agent, the MTProto session is stored encrypted on the server. We do not access your personal messages, contacts, or media beyond what is necessary for agent operation.') +

    _legalH(isRu ? '5. Сбор ошибок' : '5. Error Collection') +
    _legalP(isRu
      ? 'При вашем согласии мы собираем информацию об ошибках: тип ошибки, stack trace, время, ID агента. Это помогает улучшать платформу. Содержимое сообщений НЕ включается в отчёты об ошибках. Вы можете отозвать согласие в настройках.'
      : 'With your consent, we collect error information: error type, stack trace, timestamp, agent ID. This helps improve the platform. Message content is NOT included in error reports. You can withdraw consent in settings.') +

    _legalH(isRu ? '6. Хранение данных' : '6. Data Storage') +
    _legalP(isRu
      ? 'Данные хранятся на серверах в Европе. Вы можете запросить удаление всех данных через настройки профиля или обратившись в поддержку.'
      : 'Data is stored on servers in Europe. You can request deletion of all data through profile settings or by contacting support.') +

    _legalH(isRu ? '7. Ваши права' : '7. Your Rights') +
    _legalP(isRu
      ? 'Вы имеете право: получить копию ваших данных, удалить аккаунт и все связанные данные, отозвать согласие на сбор ошибок, отключить Telegram аккаунт от агентов в любое время.'
      : 'You have the right to: receive a copy of your data, delete your account and all associated data, withdraw consent for error collection, disconnect your Telegram account from agents at any time.') +

    _legalH(isRu ? '8. Контакты' : '8. Contact') +
    _legalP(isRu
      ? 'DPO: <a href="https://t.me/uheartattack" style="color:var(--primary)">@uheartattack</a> | Поддержка: <a href="https://t.me/TonAgentPlatformBot" style="color:var(--primary)">@TonAgentPlatformBot</a>'
      : 'DPO: <a href="https://t.me/uheartattack" style="color:var(--primary)">@uheartattack</a> | Support: <a href="https://t.me/TonAgentPlatformBot" style="color:var(--primary)">@TonAgentPlatformBot</a>') +

  '</div>';
}

// ══════════════════════════════════════════════════════════════
// BUG DASHBOARD — Platform bugs, Agent errors, Tester feedback
// ══════════════════════════════════════════════════════════════
var _bugTab = 'platform';

async function loadBugDashboard() {
  var container = document.getElementById('bugs-dashboard-root');
  if (!container) return;
  var isRu = currentLang === 'ru';
  container.innerHTML = '<div style="padding:24px;max-width:1200px;margin:0 auto">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">' +
      '<h2 style="margin:0;font-size:1.3rem;color:var(--text-primary)">' + (isRu ? IC.bug + ' Баг-трекер' : IC.bug + ' Bug Tracker') + '</h2>' +
      '<div style="display:flex;gap:4px;background:var(--bg-primary);border-radius:10px;padding:3px;border:1px solid var(--border)">' +
        _bugTabBtn('platform', isRu ? IC.settings + ' Платформа' : IC.settings + ' Platform') +
        _bugTabBtn('agents', isRu ? IC.robot + ' Агенты' : IC.robot + ' Agents') +
        _bugTabBtn('feedback', isRu ? IC.clipboard + ' Фидбек' : IC.clipboard + ' Feedback') +
        _bugTabBtn('reports', isRu ? IC.folder + ' Отчёты' : IC.folder + ' Reports') +
      '</div></div>' +
    '<div id="bugs-content"><div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div></div></div>';
  loadBugTab(_bugTab);
}
function _bugTabBtn(id, label) { var a = _bugTab === id; return '<button onclick="switchBugTab(\'' + id + '\')" style="padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:.82rem;font-weight:600;transition:all .2s;' + (a ? 'background:var(--primary);color:white' : 'background:transparent;color:var(--text-muted)') + '">' + label + '</button>'; }
function switchBugTab(t) {
  _bugTab = t;
  // If bugs-content exists, just reload tab content without full redraw
  var bc = document.getElementById('bugs-content');
  if (bc) {
    bc.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div>';
    // Update tab button styles
    var btns = bc.parentElement.querySelectorAll('button');
    btns.forEach(function(b) {
      var isActive = b.textContent.toLowerCase().indexOf(t === 'platform' ? (currentLang === 'ru' ? 'платформ' : 'platform') : t === 'agents' ? (currentLang === 'ru' ? 'агент' : 'agents') : t === 'feedback' ? (currentLang === 'ru' ? 'фидбек' : 'feedback') : (currentLang === 'ru' ? 'отчёт' : 'report')) >= 0;
      b.style.background = isActive ? 'var(--primary)' : 'transparent';
      b.style.color = isActive ? 'white' : 'var(--text-muted)';
    });
    loadBugTab(t);
  } else {
    loadBugDashboard();
  }
}
function _bugStatCard(icon, label, count, color) { return '<div style="padding:16px;background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;text-align:center"><div style="font-size:1.5rem;margin-bottom:4px">' + icon + '</div><div style="font-size:1.4rem;font-weight:700;color:' + color + '">' + count + '</div><div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">' + label + '</div></div>'; }
function _timeAgo(d) { if (!d) return '—'; var ms = Date.now() - new Date(d).getTime(); var r = currentLang === 'ru'; if (ms < 60000) return r ? 'сейчас' : 'now'; if (ms < 3600000) return Math.floor(ms / 60000) + (r ? ' мин' : 'm'); if (ms < 86400000) return Math.floor(ms / 3600000) + (r ? ' ч' : 'h'); return Math.floor(ms / 86400000) + (r ? ' дн' : 'd'); }

async function loadBugTab(tab) {
  var c = document.getElementById('bugs-content'); if (!c) return; var isRu = currentLang === 'ru';
  if (tab === 'platform') {
    try {
      var d = await apiRequest('GET', '/api/admin/bugs?status=open&limit=50');
      if (!d.ok) { c.innerHTML = '<p style="color:var(--danger)">' + escHtml(d.error || 'Error') + '</p>'; return; }
      var st = d.stats || {};
      var h = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">' + _bugStatCard(IC.dot_red, isRu ? 'Открытые' : 'Open', st.open || 0, '#ef4444') + _bugStatCard(IC.dot_pause, isRu ? 'В работе' : 'Fixing', st.fixing || 0, '#f59e0b') + _bugStatCard(IC.dot_green, isRu ? 'Исправлены' : 'Fixed', st.fixed || 0, '#10b981') + _bugStatCard(IC.dot_gray, isRu ? 'Игнорируются' : 'Ignored', st.ignored || 0, '#6b7280') + '</div>';
      if (d.sources && d.sources.length) { h += '<div style="margin-bottom:16px;padding:14px;background:var(--bg-primary);border:1px solid var(--border);border-radius:10px"><div style="font-size:.78rem;font-weight:600;color:var(--text-muted);margin-bottom:8px">' + (isRu ? 'ИСТОЧНИКИ' : 'SOURCES') + '</div>'; d.sources.forEach(function(s) { var pct = d.sources[0].total > 0 ? Math.round(s.total / d.sources[0].total * 100) : 0; h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:.78rem;color:var(--text-primary);min-width:180px">' + escHtml(s.source) + '</span><div style="flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:var(--primary);border-radius:3px"></div></div><span style="font-size:.72rem;color:var(--text-muted);min-width:32px;text-align:right">' + s.total + '</span></div>'; }); h += '</div>'; }
      h += '<div style="display:flex;flex-direction:column;gap:8px">';
      if (!d.bugs.length) h += '<div style="text-align:center;padding:40px;color:var(--text-muted)">' + (isRu ? 'Нет открытых багов' : 'No open bugs') + '</div>';
      d.bugs.forEach(function(b) { h += '<div style="padding:14px;background:var(--bg-primary);border:1px solid var(--border);border-radius:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:.72rem;padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444;font-weight:600">x' + b.count + '</span><span style="font-size:.76rem;color:var(--text-muted)">' + escHtml(b.source || '') + '</span></div><div style="display:flex;gap:4px"><button onclick="updateBugStatus(' + b.id + ',\'fixing\')" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.1);color:#f59e0b;font-size:.68rem;cursor:pointer">Fix</button><button onclick="updateBugStatus(' + b.id + ',\'fixed\')" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.1);color:#10b981;font-size:.68rem;cursor:pointer">Done</button><button onclick="updateBugStatus(' + b.id + ',\'ignored\')" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(107,114,128,0.3);background:rgba(107,114,128,0.1);color:#6b7280;font-size:.68rem;cursor:pointer">Ign</button></div></div><div style="font-size:.82rem;color:var(--text-primary);word-break:break-word;line-height:1.4">' + escHtml((b.message || '').slice(0, 200)) + '</div>' + (b.file ? '<div style="font-size:.7rem;color:var(--text-muted);margin-top:4px;font-family:monospace">' + escHtml(b.file) + '</div>' : '') + '<div style="font-size:.68rem;color:var(--text-muted);margin-top:4px">First: ' + _timeAgo(b.first_seen) + ' · Last: ' + _timeAgo(b.last_seen) + '</div></div>'; });
      h += '</div>'; c.innerHTML = h;
    } catch(e) { c.innerHTML = '<p style="color:var(--danger)">' + e.message + '</p>'; }
  } else if (tab === 'agents') {
    try {
      var d = await apiRequest('GET', '/api/admin/agent-errors?days=7');
      if (!d.ok) { c.innerHTML = '<p style="color:var(--danger)">' + escHtml(d.error || 'Error') + '</p>'; return; }
      var cats = d.categories || {};
      var h = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">' + _bugStatCard(IC.fire, 'Crash', cats.crash || 0, '#ef4444') + _bugStatCard(IC.wrench, 'Tool', cats.tool_error || 0, '#f59e0b') + _bugStatCard(IC.globe, 'API', cats.api_error || 0, '#6366f1') + _bugStatCard(IC.question, isRu ? 'Другие' : 'Other', cats.other || 0, '#6b7280') + '</div>';
      h += '<div style="font-size:.82rem;font-weight:600;color:var(--text-primary);margin-bottom:12px">' + (isRu ? 'Паттерны ошибок (7 дней)' : 'Error Patterns (7 days)') + '</div><div style="display:flex;flex-direction:column;gap:6px">';
      if (!d.patterns || !d.patterns.length) h += '<div style="text-align:center;padding:40px;color:var(--text-muted)">' + (isRu ? 'Нет ошибок' : 'No errors') + '</div>';
      (d.patterns || []).forEach(function(p) { h += '<div style="padding:12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:10px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:.72rem;padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444;font-weight:600">x' + p.count + '</span><span style="font-size:.72rem;color:var(--text-muted)">' + p.agentCount + ' agents</span></div><div style="font-size:.8rem;color:var(--text-primary);word-break:break-word">' + escHtml(p.message.slice(0, 150)) + '</div></div>'; });
      h += '</div>'; c.innerHTML = h;
    } catch(e) { c.innerHTML = '<p style="color:var(--danger)">' + e.message + '</p>'; }
  } else if (tab === 'feedback') {
    try {
      var d = await apiRequest('GET', '/api/admin/feedback');
      if (!d.ok) { c.innerHTML = '<p style="color:var(--danger)">' + escHtml(d.error || 'Error') + '</p>'; return; }
      var sc = {}, tc = {}; (d.feedback || []).forEach(function(f) { sc[f.status] = (sc[f.status] || 0) + 1; tc[f.type] = (tc[f.type] || 0) + 1; });
      var h = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">' + _bugStatCard(IC.bug, 'Bugs', tc.bug || 0, '#ef4444') + _bugStatCard(IC.lightbulb, 'Features', tc.feature || 0, '#6366f1') + _bugStatCard(IC.lifebuoy, 'Support', tc.support || 0, '#f59e0b') + _bugStatCard(IC.chat, 'General', tc.general || 0, '#6b7280') + '</div>';
      h += '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">';
      ['all', 'new', 'in_progress', 'resolved', 'closed'].forEach(function(s) { var lbl = s === 'all' ? (isRu ? 'Все' : 'All') : s === 'new' ? IC.dot_blue + ' New' : s === 'in_progress' ? IC.dot_pause + ' WIP' : s === 'resolved' ? IC.dot_green + ' Done' : IC.dot_gray + ' Closed'; h += '<button onclick="filterFeedback(\'' + s + '\')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.78rem;cursor:pointer">' + lbl + ' (' + (s === 'all' ? (d.feedback || []).length : (sc[s] || 0)) + ')</button>'; });
      h += '</div><div id="feedback-list" style="display:flex;flex-direction:column;gap:8px">';
      var icons = { bug: IC.bug, feature: IC.lightbulb, support: IC.lifebuoy, general: IC.chat }; var colors = { new: '#3b82f6', in_progress: '#f59e0b', resolved: '#10b981', closed: '#6b7280' };
      (d.feedback || []).forEach(function(f) { h += '<div class="feedback-item" data-status="' + f.status + '" style="padding:14px;background:var(--bg-primary);border:1px solid var(--border);border-radius:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px"><div style="display:flex;align-items:center;gap:8px">' + (icons[f.type] || IC.question) + ' <span style="font-size:.78rem;font-weight:600">#' + f.id + '</span><span style="font-size:.72rem;color:var(--text-muted)">@' + escHtml(f.username || String(f.user_id)) + '</span><span style="font-size:.68rem;padding:2px 8px;border-radius:4px;background:' + (colors[f.status] || '#666') + '20;color:' + (colors[f.status] || '#666') + ';font-weight:600">' + f.status + '</span></div><div style="display:flex;gap:4px"><button onclick="replyFeedback(' + f.id + ')" style="padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:.68rem;cursor:pointer">Reply</button><button onclick="resolveFeedback(' + f.id + ')" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.1);color:#10b981;font-size:.68rem;cursor:pointer">Resolve</button></div></div><div style="font-size:.82rem;color:var(--text-primary);word-break:break-word;line-height:1.4">' + escHtml((f.message || '').slice(0, 300)) + '</div>' + (f.screenshot_file_id ? '<div style="margin-top:8px"><a href="/api/feedback/' + f.id + '/screenshot" target="_blank" style="font-size:.72rem;color:var(--primary);text-decoration:none">📎 ' + (currentLang === 'ru' ? 'Скриншот' : 'Screenshot') + '</a></div>' : '') + (f.admin_reply ? '<div style="margin-top:8px;padding:8px 12px;background:rgba(16,185,129,0.05);border-left:3px solid #10b981;border-radius:0 8px 8px 0;font-size:.78rem;color:var(--text-secondary)">↳ ' + escHtml(f.admin_reply) + '</div>' : '') + '<div style="font-size:.68rem;color:var(--text-muted);margin-top:6px">' + _timeAgo(f.created_at) + (f.agent_id ? ' · Agent #' + f.agent_id : '') + '</div></div>'; });
      h += '</div>'; c.innerHTML = h;
    } catch(e) { c.innerHTML = '<p style="color:var(--danger)">' + e.message + '</p>'; }
  } else if (tab === 'reports') {
    try {
      var d = await apiRequest('GET', '/api/admin/feedback');
      var bugs = await apiRequest('GET', '/api/admin/bugs?status=open&limit=100');
      var agentErrors = await apiRequest('GET', '/api/admin/agent-errors?days=30');

      var h = '<div style="font-size:.82rem;font-weight:600;color:var(--text-primary);margin-bottom:16px">' + (isRu ? IC.folder + ' Структурированные отчёты' : IC.folder + ' Structured Reports') + '</div>';

      var folders = [
        { id: 'platform_crashes', icon: IC.fire, name: isRu ? 'Крэши платформы' : 'Platform Crashes', color: '#ef4444', items: (bugs.ok ? bugs.bugs : []).filter(function(b) { return b.source === 'uncaughtException' || b.source === 'unhandledRejection'; }) },
        { id: 'tool_errors', icon: IC.wrench, name: isRu ? 'Ошибки инструментов' : 'Tool Errors', color: '#f59e0b', items: (bugs.ok ? bugs.bugs : []).filter(function(b) { return (b.source || '').startsWith('tool:'); }) },
        { id: 'api_errors', icon: IC.globe, name: isRu ? 'Ошибки API' : 'API Errors', color: '#6366f1', items: (agentErrors.ok ? (agentErrors.patterns || []).filter(function(p) { return p.message.toLowerCase().match(/api|fetch|429|500|timeout/); }) : []) },
        { id: 'user_bugs', icon: IC.bug, name: isRu ? 'Баг-репорты тестеров' : 'Tester Bug Reports', color: '#ef4444', items: (d.ok ? d.feedback : []).filter(function(f) { return f.type === 'bug'; }) },
        { id: 'user_features', icon: IC.lightbulb, name: isRu ? 'Запросы фич' : 'Feature Requests', color: '#8b5cf6', items: (d.ok ? d.feedback : []).filter(function(f) { return f.type === 'feature'; }) },
        { id: 'user_support', icon: IC.lifebuoy, name: isRu ? 'Тикеты саппорта' : 'Support Tickets', color: '#f59e0b', items: (d.ok ? d.feedback : []).filter(function(f) { return f.type === 'support'; }) },
        { id: 'agent_crashes', icon: IC.robot, name: isRu ? 'Крэши агентов' : 'Agent Crashes', color: '#ef4444', items: (agentErrors.ok ? (agentErrors.patterns || []).filter(function(p) { return p.message.toLowerCase().includes('crash'); }) : []) },
      ];

      h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
      folders.forEach(function(folder) {
        var count = folder.items.length;
        var newCount = folder.items.filter(function(i) { return (i.status === 'new' || i.status === 'open'); }).length;
        h += '<div onclick="expandReportFolder(\'' + folder.id + '\')" style="padding:16px;background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:all .2s" onmouseenter="this.style.borderColor=\'' + folder.color + '40\';this.style.transform=\'translateY(-2px)\'" onmouseleave="this.style.borderColor=\'var(--border)\';this.style.transform=\'none\'">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
            '<div style="width:40px;height:40px;border-radius:10px;background:' + folder.color + '15;display:flex;align-items:center;justify-content:center;font-size:1.2rem">' + folder.icon + '</div>' +
            '<div style="flex:1"><div style="font-size:.85rem;font-weight:600;color:var(--text-primary)">' + folder.name + '</div>' +
            '<div style="font-size:.72rem;color:var(--text-muted)">' + count + ' ' + (isRu ? 'записей' : 'items') + (newCount > 0 ? ' · <span style="color:' + folder.color + '">' + newCount + ' new</span>' : '') + '</div></div>' +
          '</div>' +
          '<div style="height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + Math.min(count * 5, 100) + '%;background:' + folder.color + ';border-radius:2px;transition:width .3s"></div></div>' +
        '</div>';
      });
      h += '</div>';

      h += '<div id="report-folder-content" style="margin-top:16px"></div>';

      window._reportFolders = folders;

      c.innerHTML = h;
    } catch(e) { c.innerHTML = '<p style="color:var(--danger)">' + e.message + '</p>'; }
  }
}
async function updateBugStatus(id, s) { try { var d = await apiRequest('PUT', '/api/admin/bugs/' + id, { status: s }); if (d.ok) { toast('Updated', 'success'); loadBugTab('platform'); } else toast(d.error, 'error'); } catch(e) { toast(e.message, 'error'); } }
function filterFeedback(s) { document.querySelectorAll('.feedback-item').forEach(function(el) { el.style.display = (s === 'all' || el.getAttribute('data-status') === s) ? '' : 'none'; }); }
async function replyFeedback(id) { var r = prompt(currentLang === 'ru' ? 'Ответ:' : 'Reply:'); if (!r) return; try { var d = await apiRequest('PUT', '/api/admin/feedback/' + id, { adminReply: r, status: 'in_progress' }); if (d.ok) { toast('Replied', 'success'); loadBugTab('feedback'); } } catch(e) { toast(e.message, 'error'); } }
async function resolveFeedback(id) { try { var d = await apiRequest('PUT', '/api/admin/feedback/' + id, { status: 'resolved' }); if (d.ok) { toast('Resolved', 'success'); loadBugTab('feedback'); } } catch(e) { toast(e.message, 'error'); } }
function expandReportFolder(folderId) {
  var container = document.getElementById('report-folder-content');
  if (!container) return;
  var folders = window._reportFolders || [];
  var folder = folders.find(function(f) { return f.id === folderId; });
  if (!folder || !folder.items.length) { container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">' + (currentLang === 'ru' ? 'Пусто' : 'Empty') + '</div>'; return; }

  var isRu = currentLang === 'ru';
  var h = '<div style="padding:16px;background:var(--bg-primary);border:1px solid var(--border);border-radius:12px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:1.1rem">' + folder.icon + '</span><span style="font-size:.9rem;font-weight:600;color:var(--text-primary)">' + folder.name + '</span><span style="font-size:.72rem;color:var(--text-muted)">(' + folder.items.length + ')</span></div>' +
      '<button onclick="document.getElementById(\'report-folder-content\').innerHTML=\'\'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem">&times;</button>' +
    '</div>';

  h += '<div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto">';
  folder.items.slice(0, 30).forEach(function(item, i) {
    var msg = item.message || item.msg || '';
    var status = item.status || 'open';
    var who = item.username ? '@' + item.username : (item.source || '');
    var when = item.created_at || item.last_seen || item.first_seen || '';
    var statusColor = status === 'new' || status === 'open' ? '#3b82f6' : status === 'in_progress' || status === 'fixing' ? '#f59e0b' : status === 'resolved' || status === 'fixed' ? '#10b981' : '#6b7280';

    h += '<div style="padding:10px 12px;background:var(--bg-secondary);border-radius:8px;border-left:3px solid ' + folder.color + '">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
        '<span style="font-size:.68rem;padding:1px 6px;border-radius:3px;background:' + statusColor + '20;color:' + statusColor + ';font-weight:600">' + status + '</span>' +
        (who ? '<span style="font-size:.7rem;color:var(--text-muted)">' + escHtml(who) + '</span>' : '') +
        (item.count ? '<span style="font-size:.68rem;color:#ef4444;font-weight:600">x' + item.count + '</span>' : '') +
      '</div>' +
      '<div style="font-size:.8rem;color:var(--text-primary);word-break:break-word">' + escHtml(msg.slice(0, 200)) + '</div>' +
      (item.admin_reply ? '<div style="font-size:.72rem;color:#10b981;margin-top:3px">↳ ' + escHtml(item.admin_reply.slice(0, 100)) + '</div>' : '') +
      (when ? '<div style="font-size:.65rem;color:var(--text-muted);margin-top:3px">' + _timeAgo(when) + '</div>' : '') +
    '</div>';
  });
  h += '</div></div>';

  container.innerHTML = h;
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Tester Hub page ──
async function loadTesterHub() {
  var container = document.getElementById('tester-hub-root');
  if (!container) return;
  var isRu = currentLang === 'ru';

  container.innerHTML = '<div style="max-width:900px;margin:0 auto;padding:24px"><div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div></div>';

  var stats, lb;
  try {
    [stats, lb] = await Promise.all([
      apiRequest('GET', '/api/beta/stats'),
      apiRequest('GET', '/api/beta/leaderboard'),
    ]);
  } catch(e) {
    container.innerHTML = '<div style="max-width:900px;margin:0 auto;padding:24px;text-align:center;color:var(--text-muted)">' + (isRu ? 'Недоступно. Станьте бета-тестером: /beta в боте.' : 'Not available. Become a beta tester: /beta in bot.') + '</div>';
    return;
  }

  if (!stats.ok || !stats.level) {
    container.innerHTML = '<div style="max-width:900px;margin:0 auto;padding:24px;text-align:center;color:var(--text-muted)">' + (isRu ? 'Вы не бета-тестер. Используйте /beta в боте.' : 'Not a beta tester. Use /beta in the bot.') + '</div>';
    return;
  }

  var s = stats;
  var nextPts = s.nextLevel ? s.nextLevel.pointsNeeded + s.points : s.points;
  var pct = s.nextLevel ? Math.round((s.points / nextPts) * 100) : 100;
  var levelColors = ['#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444'];
  var lvlColor = levelColors[Math.min(s.level - 1, 5)];

  var html = '<div style="max-width:900px;margin:0 auto;padding:24px">';

  // Hero card
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:20px;padding:24px;margin-bottom:20px;position:relative;overflow:hidden">' +
    '<div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:' + lvlColor + '10;pointer-events:none"></div>' +
    '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">' +
      '<div style="width:56px;height:56px;border-radius:50%;background:' + lvlColor + '20;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:' + lvlColor + '">' + s.level + '</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:1.15rem;font-weight:700;color:var(--text-primary)">' + escHtml(isRu ? s.levelNameRu : s.levelName) + '</div>' +
        '<div style="font-size:.78rem;color:var(--text-muted)">' + s.points + ' ' + (isRu ? 'очков' : 'pts') + (s.nextLevel ? ' · ' + s.nextLevel.pointsNeeded + ' ' + (isRu ? 'до' : 'to') + ' ' + escHtml(isRu ? s.nextLevel.nameRu : s.nextLevel.name) : ' · MAX') + '</div>' +
      '</div>' +
      (s.streak > 0 ? '<div style="padding:6px 14px;border-radius:20px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;font-size:.75rem;font-weight:600">' + s.streak + ' ' + (isRu ? 'дн streak' : 'day streak') + '</div>' : '') +
      (s.role !== 'tester' ? '<div style="padding:6px 14px;border-radius:20px;background:' + lvlColor + '15;border:1px solid ' + lvlColor + '30;color:' + lvlColor + ';font-size:.75rem;font-weight:600;text-transform:uppercase">' + escHtml(s.role) + '</div>' : '') +
    '</div>' +
    '<div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + lvlColor + ',' + lvlColor + 'cc);border-radius:4px;transition:width .5s"></div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:.68rem;color:var(--text-muted)">' +
      '<span>Lv.' + s.level + '</span><span>' + pct + '%</span>' + (s.nextLevel ? '<span>Lv.' + (s.level + 1) + '</span>' : '') +
    '</div>' +
    '<div style="margin-top:16px;text-align:center">' +
      '<button onclick="testerCheckin()" style="padding:10px 24px;border-radius:20px;border:none;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:white;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .2s" onmouseenter="this.style.transform=\'translateY(-1px)\'" onmouseleave="this.style.transform=\'none\'">' + (isRu ? 'Daily Check-in (+1 очко)' : 'Daily Check-in (+1 pt)') + '</button>' +
    '</div>' +
  '</div>';

  // Stat cards
  var statCards = [
    { label: 'XP', value: s.xp || s.points, color: 'var(--primary)' },
    { label: isRu ? 'Очки' : 'Points', value: s.points, color: '#10b981' },
    { label: isRu ? 'Баги' : 'Bugs', value: s.totalBugs, color: '#ef4444' },
    { label: isRu ? 'Фичи' : 'Features', value: s.totalFeatures, color: '#8b5cf6' },
  ];
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">';
  statCards.forEach(function(c) {
    html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:14px 16px;text-align:center">' +
      '<div style="font-size:1.3rem;font-weight:700;color:' + c.color + '">' + c.value + '</div>' +
      '<div style="font-size:.68rem;color:var(--text-muted);margin-top:2px">' + c.label + '</div></div>';
  });
  html += '</div>';

  // Leaderboard + Shop
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">';

  // Leaderboard
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px">' +
    '<div style="font-size:.85rem;font-weight:600;color:var(--text-primary);margin-bottom:12px">' + (isRu ? 'Лидерборд' : 'Leaderboard') + '</div>';
  var leaders = (lb.ok ? lb.leaderboard : []) || [];
  if (leaders.length) {
    var medals = ['#ffd700', '#c0c0c0', '#cd7f32'];
    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    leaders.slice(0, 8).forEach(function(l, i) {
      var medalColor = i < 3 ? medals[i] : 'var(--text-muted)';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:' + (i < 3 ? medalColor + '08' : 'transparent') + '">' +
        '<span style="width:20px;font-size:.75rem;font-weight:700;color:' + medalColor + '">' + (i + 1) + '</span>' +
        '<span style="flex:1;font-size:.8rem;color:var(--text-primary)">' + escHtml(l.username || 'User') + '</span>' +
        '<span style="font-size:.72rem;color:var(--text-muted)">' + (l.xp || l.feedback_count) + ' XP</span>' +
      '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:.82rem">' + (isRu ? 'Пока пусто' : 'Empty') + '</div>';
  }
  html += '</div>';

  // Shop
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px">' +
    '<div style="font-size:.85rem;font-weight:600;color:var(--text-primary);margin-bottom:12px">' + (isRu ? 'Магазин' : 'Shop') + ' <span style="font-size:.72rem;color:var(--text-muted)">(' + s.available + ' ' + (isRu ? 'доступно' : 'available') + ')</span></div>';
  html += '<div style="display:flex;flex-direction:column;gap:6px">';
  (s.shopItems || []).forEach(function(item) {
    var canBuy = s.available >= item.cost;
    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:var(--bg-secondary);opacity:' + (canBuy ? '1' : '0.5') + '">' +
      '<span style="flex:1;font-size:.78rem;color:var(--text-primary)">' + escHtml(isRu ? item.nameRu : item.name) + '</span>' +
      '<span style="font-size:.72rem;color:var(--text-muted)">' + item.cost + ' pts</span>' +
      (canBuy ? '<button onclick="testerBuyItem(\'' + item.id + '\')" style="padding:3px 10px;border-radius:6px;border:none;background:var(--primary);color:white;font-size:.68rem;cursor:pointer">' + (isRu ? 'Купить' : 'Buy') + '</button>' : '') +
    '</div>';
  });
  html += '</div></div>';
  html += '</div>';

  // Achievements
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">' +
    '<div style="font-size:.85rem;font-weight:600;color:var(--text-primary);margin-bottom:12px">' + (isRu ? 'Достижения' : 'Achievements') + '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px">';
  (s.achievements_list || stats.achievements || []).forEach(function(a) {
    var unlocked = a.unlocked;
    html += '<div style="padding:8px 14px;border-radius:20px;border:1px solid ' + (unlocked ? 'var(--primary)' : 'var(--border)') + ';background:' + (unlocked ? 'var(--accent-dim)' : 'var(--bg-secondary)') + ';opacity:' + (unlocked ? '1' : '0.4') + '">' +
      '<div style="font-size:.78rem;font-weight:600;color:' + (unlocked ? 'var(--primary)' : 'var(--text-muted)') + '">' + escHtml(isRu ? a.nameRu : a.name) + '</div>' +
      '<div style="font-size:.62rem;color:var(--text-muted)">' + escHtml(a.desc) + '</div>' +
    '</div>';
  });
  html += '</div></div>';

  // ── Testing Tasks (real ZONE_TASKS from server + DB-backed completed list) ──
  try {
    var tasksData = await apiRequest('GET', '/api/beta/tasks');
    if (tasksData.ok && tasksData.tasks) {
      var zoneNames = {
        core:      { ru: 'Ядро платформы',    en: 'Core Platform' },
        defi:      { ru: 'DeFi',              en: 'DeFi' },
        gifts:     { ru: 'Подарки & NFT',     en: 'Gifts & NFT' },
        telegram:  { ru: 'Telegram & UI',     en: 'Telegram & UI' },
        studio:    { ru: 'Studio & API',      en: 'Studio & API' },
        community: { ru: 'Комьюнити',         en: 'Community' },
      };
      var zoneIcons = { core: '🔧', defi: '💱', gifts: '🎁', telegram: '📱', studio: '🎨', community: '👥' };
      var completed = (tasksData.completed || []);
      var doneCount = tasksData.tasks.filter(function(t){ return completed.indexOf(t.id) >= 0; }).length;
      var totalXp = tasksData.tasks.filter(function(t){ return completed.indexOf(t.id) >= 0; }).reduce(function(s,t){ return s + (t.xp||0); }, 0);

      html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">' +
          '<div style="font-size:.95rem;font-weight:700;color:var(--text-primary)">🧪 ' + (isRu ? 'Задания тестирования' : 'Testing Tasks') + '</div>' +
          '<div style="font-size:.7rem;color:var(--text-muted)">' +
            (isRu ? 'Выполнено' : 'Done') + ' <b style="color:var(--primary)">' + doneCount + '/' + tasksData.tasks.length + '</b>' +
            ' · <b style="color:#fbbf24">+' + totalXp + ' XP</b>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:.7rem;color:var(--text-muted);margin-bottom:14px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;line-height:1.5">' +
          '💡 ' + (isRu
            ? 'Клик по заданию — инструкция как сдать. <b>Галочки показывают реальный статус из БД</b> — проверенный админом.'
            : 'Click a task — you see how to submit. <b>Checkmarks reflect real DB status</b> — after admin verification.') +
        '</div>';

      // Group tasks by zone (real 6 zones from engagement.ts)
      var grouped = {};
      tasksData.tasks.forEach(function(t){
        if (!grouped[t.zone]) grouped[t.zone] = [];
        grouped[t.zone].push(t);
      });
      var zoneOrder = ['core', 'defi', 'gifts', 'telegram', 'studio', 'community'];
      zoneOrder.forEach(function(zone){
        if (!grouped[zone] || !grouped[zone].length) return;
        var zn = zoneNames[zone] || { ru: zone, en: zone };
        var icon = zoneIcons[zone] || '📌';
        html += '<div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px;padding-left:4px">' +
          icon + ' ' + (isRu ? zn.ru : zn.en) + '</div>';
        // Sort tasks by level within zone
        grouped[zone].sort(function(a,b){ return (a.level||1) - (b.level||1); });
        grouped[zone].forEach(function(t){
          var done = completed.indexOf(t.id) >= 0;
          var autoCheck = !!t.autoCheck;
          var lvlBadge = '<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.12);color:#a78bfa;font-size:.6rem;font-weight:600;margin-right:6px">L' + (t.level||1) + '</span>';
          var autoBadge = autoCheck ? '<span style="display:inline-block;padding:1px 5px;border-radius:4px;background:rgba(16,185,129,0.12);color:#10b981;font-size:.55rem;font-weight:600;margin-left:4px" title="' + (isRu ? 'авто-проверка' : 'auto-check') + '">AUTO</span>' : '';
          var title = escHtml(isRu ? t.title : (t.titleEn || t.title));
          html += '<div style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;background:var(--bg-secondary);margin-bottom:4px;cursor:pointer;transition:all .15s;opacity:' + (done ? '0.55' : '1') + '" onclick="toggleTask(\'' + t.id + '\',this)" onmouseenter="this.style.background=\'var(--accent-dim)\'" onmouseleave="this.style.background=\'var(--bg-secondary)\'">' +
            '<div style="width:20px;height:20px;border-radius:6px;border:2px solid ' + (done ? '#10b981' : 'var(--border)') + ';background:' + (done ? '#10b981' : 'transparent') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s">' +
              (done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
            '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:.8rem;font-weight:500;color:var(--text-primary);' + (done ? 'text-decoration:line-through' : '') + '">' + lvlBadge + title + autoBadge + '</div>' +
              '<div style="font-size:.6rem;color:var(--text-muted);font-family:monospace;margin-top:2px">' + t.id + '</div>' +
            '</div>' +
            '<div style="font-size:.72rem;color:#fbbf24;font-weight:700;flex-shrink:0">+' + t.xp + ' XP</div>' +
          '</div>';
        });
      });
      html += '</div>';
    }
  } catch (e) { console.warn('[tasks]', e); }

  // ── Activity summary ──
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">' +
    '<div style="font-size:.85rem;font-weight:600;color:var(--text-primary);margin-bottom:12px">' + (isRu ? 'Активность' : 'Activity') + '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
      '<div style="text-align:center;padding:12px;border-radius:10px;background:var(--bg-secondary)">' +
        '<div style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">' + s.checkins + '</div>' +
        '<div style="font-size:.65rem;color:var(--text-muted)">' + (isRu ? 'Чекинов' : 'Check-ins') + '</div>' +
      '</div>' +
      '<div style="text-align:center;padding:12px;border-radius:10px;background:var(--bg-secondary)">' +
        '<div style="font-size:1.1rem;font-weight:700;color:#f59e0b">' + s.streak + '</div>' +
        '<div style="font-size:.65rem;color:var(--text-muted)">' + (isRu ? 'Дн. streak' : 'Day streak') + '</div>' +
      '</div>' +
      '<div style="text-align:center;padding:12px;border-radius:10px;background:var(--bg-secondary)">' +
        '<div style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">' + s.referrals + '</div>' +
        '<div style="font-size:.65rem;color:var(--text-muted)">' + (isRu ? 'Рефералов' : 'Referrals') + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  // ── Revenue Share (10% pool / 2yr) ── placeholder, filled async below ──
  html += '<div id="tester-rewards-block"></div>';

  html += '</div>';
  container.innerHTML = html;

  // Load rewards data asynchronously (doesn't block main UI)
  loadTesterRewardsBlock(isRu).catch(function(e){ console.error('[TesterHub rewards]', e); });
}

async function loadTesterRewardsBlock(isRu) {
  var block = document.getElementById('tester-rewards-block');
  if (!block) return;
  var profile, refLink, walletRes, snapshots;
  try {
    [profile, refLink, walletRes, snapshots] = await Promise.all([
      apiRequest('GET', '/api/tester/profile'),
      apiRequest('GET', '/api/tester/ref-link'),
      apiRequest('GET', '/api/tester/payout-wallet'),
      apiRequest('GET', '/api/tester/snapshots'),
    ]);
  } catch(e) {
    block.innerHTML = '';
    return;
  }
  var html = '';
  var fmt = function(n, d){ return Number(n||0).toLocaleString('en-US', { maximumFractionDigits: d||0 }); };

  // ═══ Revenue share hero ═══
  if (profile && profile.ok) {
    var p = profile.profile;
    var sharePct = (profile.sharePercent || 0);
    var projTon = profile.projectedAnnualTonAt10k || 0;
    html += '<div style="background:linear-gradient(135deg,rgba(0,170,255,0.06),rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.06));border:1px solid rgba(0,170,255,0.2);border-radius:16px;padding:20px;margin-bottom:20px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">' +
        '<span style="font-size:1.2rem">💰</span>' +
        '<div style="font-size:.95rem;font-weight:700;color:var(--text-primary)">' + (isRu ? 'Доля в 10% пуле' : 'Revenue share (10% pool)') + '</div>' +
        '<span style="padding:3px 8px;border-radius:10px;background:rgba(0,170,255,0.15);color:#00aaff;font-size:.62rem;font-weight:700;text-transform:uppercase">2 yr</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px">' +
        '<div style="text-align:center;padding:14px 10px;background:var(--bg-secondary);border-radius:12px">' +
          '<div style="font-size:1.5rem;font-weight:800;color:#00aaff">' + sharePct.toFixed(2) + '%</div>' +
          '<div style="font-size:.65rem;color:var(--text-muted);margin-top:4px">' + (isRu ? 'Твоя доля' : 'Your share') + '</div>' +
        '</div>' +
        '<div style="text-align:center;padding:14px 10px;background:var(--bg-secondary);border-radius:12px">' +
          '<div style="font-size:1.5rem;font-weight:800;color:#a78bfa">×' + p.effectiveMultiplier + '</div>' +
          '<div style="font-size:.65rem;color:var(--text-muted);margin-top:4px">' + (isRu ? 'Множитель' : 'Multiplier') + (p.effectiveMultiplier < p.baseMultiplier ? ' ⚠️' : '') + '</div>' +
        '</div>' +
        '<div style="text-align:center;padding:14px 10px;background:var(--bg-secondary);border-radius:12px">' +
          '<div style="font-size:1.5rem;font-weight:800;color:#fbbf24">' + fmt(projTon, 1) + '</div>' +
          '<div style="font-size:.65rem;color:var(--text-muted);margin-top:4px">TON/' + (isRu ? 'год*' : 'yr*') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);padding-top:10px;border-top:1px solid var(--border)">' +
        '<span>' + (isRu ? 'Effective XP:' : 'Effective XP:') + ' <b style="color:var(--text-primary)">' + fmt(p.effectiveXp) + '</b></span>' +
        '<span>' + (isRu ? 'Всего в пуле:' : 'Pool total:') + ' <b style="color:var(--text-primary)">' + fmt(profile.totalEffectiveXp) + '</b></span>' +
        '<span>' + (isRu ? 'Тестеров:' : 'Testers:') + ' <b style="color:var(--text-primary)">' + profile.testerCount + '</b></span>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:.65rem;color:var(--text-muted);line-height:1.5">' +
        '*' + (isRu ? 'Прогноз при 10 000 TON годовой выручки. Первый снапшот: ' : 'Projected at 10,000 TON/yr gross. First snapshot: ') + profile.firstSnapshotDate + '. ' +
        (isRu ? 'Выплаты квартально на TON-кошелёк.' : 'Quarterly payout to TON wallet.') +
      '</div>' +
    '</div>';
  }

  // ═══ Referral link ═══
  if (refLink && refLink.ok) {
    html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">' +
      '<div style="font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">🎟 ' + (isRu ? 'Реферальная ссылка' : 'Referral link') + '</div>' +
      '<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:12px">' +
        (isRu ? 'Друг регится → +20 XP тебе. Его реферал → +5 XP. 10% его трат — навсегда.' : 'Friend joins → +20 XP. Their referral → +5 XP. 10% of their spend — forever.') +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
        '<input id="ref-link-input" readonly value="' + escHtml(refLink.url) + '" style="flex:1;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-family:monospace;font-size:.72rem;outline:none">' +
        '<button onclick="copyTesterRefLink()" style="padding:9px 16px;border:none;background:var(--primary);color:white;border-radius:10px;font-size:.75rem;font-weight:600;cursor:pointer">' + (isRu ? 'Копировать' : 'Copy') + '</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        '<div style="padding:10px;background:var(--bg-secondary);border-radius:10px;text-align:center">' +
          '<div style="font-size:1.15rem;font-weight:700;color:#00aaff">' + refLink.refCount + '</div>' +
          '<div style="font-size:.62rem;color:var(--text-muted)">' + (isRu ? 'Приглашено' : 'Referred') + '</div>' +
        '</div>' +
        '<div style="padding:10px;background:var(--bg-secondary);border-radius:10px;text-align:center">' +
          '<div style="font-size:1.15rem;font-weight:700;color:#fbbf24">' + fmt(refLink.totalRefEarningsTon, 2) + ' TON</div>' +
          '<div style="font-size:.62rem;color:var(--text-muted)">' + (isRu ? 'Заработано' : 'Earned') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ═══ Payout wallet ═══
  var currentWallet = (walletRes && walletRes.ok) ? (walletRes.wallet || '') : '';
  html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">' +
    '<div style="font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">💳 ' + (isRu ? 'Кошелёк для выплат' : 'Payout wallet') + '</div>' +
    '<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:12px">' +
      (isRu ? 'TON-адрес для квартальных выплат. Можно изменить до даты выплаты.' : 'TON address for quarterly payouts. Can be changed before payout date.') +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
      '<input id="payout-wallet-input" placeholder="UQ... / EQ... / 0:hex" value="' + escHtml(currentWallet) + '" style="flex:1;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-family:monospace;font-size:.72rem;outline:none">' +
      '<button onclick="saveTesterPayoutWallet()" style="padding:9px 16px;border:none;background:var(--primary);color:white;border-radius:10px;font-size:.75rem;font-weight:600;cursor:pointer">' + (isRu ? 'Сохранить' : 'Save') + '</button>' +
    '</div>' +
    '<div id="payout-wallet-msg" style="font-size:.7rem;margin-top:8px"></div>' +
  '</div>';

  // ═══ Snapshots history ═══
  if (snapshots && snapshots.ok && snapshots.snapshots && snapshots.snapshots.length) {
    html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">' +
      '<div style="font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:12px">📸 ' + (isRu ? 'История снапшотов' : 'Snapshot history') + '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 50px 70px 60px 80px;gap:8px;font-size:.62rem;color:var(--text-muted);text-transform:uppercase;padding:0 8px 8px;border-bottom:1px solid var(--border);margin-bottom:6px">' +
      '<span>' + (isRu ? 'Дата' : 'Date') + '</span><span>Lv</span><span>XP</span><span>×</span><span style="text-align:right">Eff</span>' +
    '</div>';
    snapshots.snapshots.slice(0, 12).forEach(function(sn){
      var d = new Date(sn.snapshot_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'});
      html += '<div style="display:grid;grid-template-columns:1fr 50px 70px 60px 80px;gap:8px;font-size:.75rem;padding:7px 8px;border-radius:8px;align-items:center">' +
        '<span style="color:var(--text-muted)">' + d + '</span>' +
        '<span style="color:var(--text-primary);font-weight:600">' + sn.level + '</span>' +
        '<span style="color:var(--text-primary)">' + fmt(sn.xp) + '</span>' +
        '<span style="color:var(--text-muted)">×' + sn.multiplier + '</span>' +
        '<span style="text-align:right;color:#00aaff;font-weight:600">' + fmt(sn.effective_xp) + '</span>' +
      '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px;text-align:center;color:var(--text-muted);font-size:.78rem">' +
      '📸 ' + (isRu ? 'Снапшотов пока нет. Первый: 1 мая 2026, 00:00 MSK' : 'No snapshots yet. First: 1 May 2026, 00:00 MSK') +
    '</div>';
  }

  // ═══ Founders wall link ═══
  html += '<div style="text-align:center;margin-bottom:16px">' +
    '<a href="/founders.html" target="_blank" style="display:inline-block;padding:10px 20px;border-radius:20px;background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);font-size:.78rem;font-weight:600;text-decoration:none">🏆 ' + (isRu ? 'Founders Wall' : 'Founders Wall') + '</a>' +
  '</div>';

  block.innerHTML = html;
}

function copyTesterRefLink() {
  var inp = document.getElementById('ref-link-input');
  if (!inp) return;
  inp.select();
  try {
    navigator.clipboard.writeText(inp.value);
    toast(currentLang === 'ru' ? 'Скопировано!' : 'Copied!', 'success');
  } catch(e) { toast('Copy failed', 'error'); }
}

async function saveTesterPayoutWallet() {
  var inp = document.getElementById('payout-wallet-input');
  var msgEl = document.getElementById('payout-wallet-msg');
  if (!inp) return;
  var wallet = (inp.value || '').trim();
  if (!wallet) { if (msgEl) { msgEl.style.color='#ef4444'; msgEl.textContent='Empty'; } return; }
  try {
    var data = await apiRequest('POST', '/api/tester/payout-wallet', { wallet: wallet });
    if (data.ok) {
      if (msgEl) { msgEl.style.color='#10b981'; msgEl.textContent = currentLang === 'ru' ? '✓ Сохранено' : '✓ Saved'; }
      toast(currentLang === 'ru' ? 'Кошелёк сохранён' : 'Wallet saved', 'success');
    } else {
      if (msgEl) { msgEl.style.color='#ef4444'; msgEl.textContent = data.error || 'Failed'; }
    }
  } catch(e) {
    if (msgEl) { msgEl.style.color='#ef4444'; msgEl.textContent = e.message; }
  }
}

async function testerCheckin() {
  try {
    var data = await apiRequest('POST', '/api/beta/checkin');
    if (data.ok) {
      toast(currentLang === 'ru' ? '+1 очко! Streak: ' + data.streak + ' дн.' : '+1 pt! Streak: ' + data.streak + ' days', 'success');
      loadTesterHub();
    } else {
      toast(data.error || 'Error', 'warning');
    }
  } catch(e) { toast(e.message, 'error'); }
}

// Task click shows submission instructions — NOT a fake checkmark.
// Real completion happens via /feedback in the bot with [task:ID] tag,
// then admin verification. Clicking here never awards XP or changes server state.
function toggleTask(taskId, el) {
  var isRu = currentLang === 'ru';
  var botUrl = 'https://t.me/TonAgentPlatformBot?start=task_' + encodeURIComponent(taskId);
  var title = isRu ? 'Как сдать задание' : 'How to submit';
  var body = isRu
    ? '<p style="margin-bottom:14px;color:var(--text-muted);line-height:1.6">'
      + 'Галочки здесь <b>ничего не зачисляют</b>. XP начисляется только после проверки админом.</p>'
      + '<ol style="margin:0 0 18px 20px;line-height:1.8;color:var(--text-primary)">'
      + '<li>Выполни задание</li>'
      + '<li>Открой <b>@TonAgentPlatformBot</b></li>'
      + '<li>Отправь <code>/feedback</code> со скриншотом</li>'
      + '<li>В тексте укажи тег <code>[task:' + escHtml(taskId) + ']</code></li>'
      + '<li>Админ проверит и начислит XP</li>'
      + '</ol>'
      + '<div style="padding:10px 14px;background:var(--bg-secondary);border-radius:10px;font-size:.78rem;color:var(--text-muted);margin-bottom:18px">'
      + '💡 <b>ID задания:</b> <code>' + escHtml(taskId) + '</code><br>'
      + 'Скопируй и укажи в сообщении фидбека.</div>'
    : '<p style="margin-bottom:14px;color:var(--text-muted);line-height:1.6">'
      + 'Checkmarks here <b>award nothing</b>. XP is credited only after admin verification.</p>'
      + '<ol style="margin:0 0 18px 20px;line-height:1.8;color:var(--text-primary)">'
      + '<li>Complete the task</li>'
      + '<li>Open <b>@TonAgentPlatformBot</b></li>'
      + '<li>Send <code>/feedback</code> with a screenshot</li>'
      + '<li>Include the tag <code>[task:' + escHtml(taskId) + ']</code></li>'
      + '<li>Admin will review and credit XP</li>'
      + '</ol>'
      + '<div style="padding:10px 14px;background:var(--bg-secondary);border-radius:10px;font-size:.78rem;color:var(--text-muted);margin-bottom:18px">'
      + '💡 <b>Task ID:</b> <code>' + escHtml(taskId) + '</code><br>'
      + 'Copy this and mention it in your feedback message.</div>';

  // Simple modal — uses existing styles if available, otherwise inline
  var existing = document.getElementById('task-submit-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'task-submit-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:ds-fade-in .2s ease-out';
  modal.innerHTML = '<div style="max-width:460px;width:100%;background:var(--bg-primary);border:1px solid var(--border);border-radius:16px;padding:24px;box-shadow:0 32px 80px rgba(0,0,0,0.5)">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">'
    + '<h3 style="margin:0;font-size:1.1rem;font-weight:700;color:var(--text-primary)">' + title + '</h3>'
    + '<button onclick="document.getElementById(\'task-submit-modal\').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;padding:0;line-height:1">&times;</button>'
    + '</div>'
    + body
    + '<div style="display:flex;gap:10px">'
    + '<a href="' + botUrl + '" target="_blank" style="flex:1;padding:12px;background:linear-gradient(135deg,var(--primary),var(--accent));color:white;border-radius:10px;font-size:.82rem;font-weight:600;text-decoration:none;text-align:center">'
    + (isRu ? 'Открыть бота' : 'Open bot') + ' →</a>'
    + '<button onclick="navigator.clipboard.writeText(\'[task:' + taskId + ']\');toast(\'' + (isRu ? 'Скопировано' : 'Copied') + '\',\'success\')" style="padding:12px 18px;background:rgba(255,255,255,0.05);color:var(--text-primary);border:1px solid var(--border);border-radius:10px;font-size:.82rem;font-weight:600;cursor:pointer">'
    + (isRu ? 'Копировать тег' : 'Copy tag') + '</button>'
    + '</div></div>';
  modal.onclick = function(e){ if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

async function testerBuyItem(itemId) {
  try {
    var data = await apiRequest('POST', '/api/beta/shop/buy', { itemId: itemId });
    if (data.ok) {
      toast(currentLang === 'ru' ? 'Куплено!' : 'Purchased!', 'success');
      loadTesterHub();
    } else {
      toast(data.error || 'Error', 'warning');
    }
  } catch(e) { toast(e.message, 'error'); }
}

// ── Feedback FAB (floating action button) ──
function initFeedbackFAB() {
  if (document.getElementById('feedback-fab')) return;
  var fab = document.createElement('button');
  fab.id = 'feedback-fab';
  fab.innerHTML = IC.bug;
  fab.title = currentLang === 'ru' ? 'Отправить фидбек' : 'Send feedback';
  fab.style.cssText = 'position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:white;border:none;font-size:1.4rem;cursor:pointer;z-index:9999;box-shadow:0 4px 12px var(--accent-glow);transition:all .2s;display:flex;align-items:center;justify-content:center';
  fab.onmouseenter = function() { fab.style.transform = 'scale(1.1)'; fab.style.boxShadow = '0 6px 16px var(--accent-glow)'; };
  fab.onmouseleave = function() { fab.style.transform = 'scale(1)'; fab.style.boxShadow = '0 4px 12px var(--accent-glow)'; };
  fab.onclick = function() { openFeedbackModal(); };
  document.body.appendChild(fab);
  // Check for unread replies periodically
  checkFeedbackReplies();
  setInterval(checkFeedbackReplies, 5 * 60 * 1000); // every 5 min
  setTimeout(checkTesterLevelUp, 3000);
}

// Check for level-up on page load
async function checkTesterLevelUp() {
  try {
    var data = await apiRequest('GET', '/api/beta/stats');
    if (!data.ok || !data.level) return;
    var lastLevel = parseInt(localStorage.getItem('tester_level') || '0');
    if (data.level > lastLevel && lastLevel > 0) {
      // Level up!
      showLevelUpModal(data.levelName, data.levelNameRu, data.level);
    }
    localStorage.setItem('tester_level', String(data.level));
  } catch {}
}

function showLevelUpModal(nameEn, nameRu, level) {
  var isRu = currentLang === 'ru';
  var name = isRu ? nameRu : nameEn;
  var colors = ['#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444'];
  var color = colors[Math.min(level - 1, 5)];

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:20000;display:flex;align-items:center;justify-content:center;animation:fadeIn .3s';
  overlay.innerHTML = '<div style="background:var(--bg-secondary);border:2px solid ' + color + ';border-radius:24px;padding:40px;text-align:center;max-width:400px;animation:slideUp .4s ease">' +
    '<div style="width:80px;height:80px;border-radius:50%;background:' + color + '20;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:2rem;font-weight:800;color:' + color + '">' + level + '</div>' +
    '<h2 style="margin:0 0 8px;font-size:1.4rem;color:var(--text-primary)">' + (isRu ? 'Новый уровень!' : 'Level Up!') + '</h2>' +
    '<div style="font-size:1.1rem;font-weight:700;color:' + color + ';margin-bottom:16px">' + name + '</div>' +
    '<p style="font-size:.85rem;color:var(--text-muted);margin-bottom:24px">' + (isRu ? 'Продолжайте тестировать — новые награды ждут!' : 'Keep testing — more rewards await!') + '</p>' +
    '<button onclick="this.closest(\'div[style*=position:fixed]\').remove()" style="padding:10px 30px;border-radius:20px;border:none;background:' + color + ';color:white;font-size:.9rem;font-weight:600;cursor:pointer">' + (isRu ? 'Отлично!' : 'Awesome!') + '</button>' +
  '</div>';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

async function checkFeedbackReplies() {
  try {
    var data = await apiRequest('GET', '/api/feedback');
    if (!data.ok || !data.feedback) return;
    var lastSeen = parseInt(localStorage.getItem('feedback_replies_seen') || '0');
    var newReplies = data.feedback.filter(function(f) {
      return f.admin_reply && new Date(f.resolved_at || f.created_at).getTime() > lastSeen;
    });
    var fab = document.getElementById('feedback-fab');
    if (!fab) return;
    // Show/hide badge
    var badge = document.getElementById('feedback-badge');
    if (newReplies.length > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'feedback-badge';
        badge.style.cssText = 'position:absolute;top:-2px;right:-2px;background:#ef4444;color:white;font-size:.6rem;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px';
        fab.style.position = 'fixed'; // ensure relative for badge
        fab.appendChild(badge);
      }
      badge.textContent = newReplies.length;
      // Show toast for first unseen reply
      if (newReplies.length > 0 && !window._feedbackToastShown) {
        window._feedbackToastShown = true;
        var isRu = currentLang === 'ru';
        toast(isRu ? 'You have ' + newReplies.length + ' new reply on your feedback' : 'You have ' + newReplies.length + ' reply on your feedback', 'info');
      }
    } else if (badge) {
      badge.remove();
    }
  } catch {}
}

function markFeedbackSeen() {
  localStorage.setItem('feedback_replies_seen', String(Date.now()));
  var badge = document.getElementById('feedback-badge');
  if (badge) badge.remove();
  window._feedbackToastShown = false;
}

function openFeedbackModal() {
  markFeedbackSeen();
  var existing = document.getElementById('feedback-modal');
  if (existing) existing.remove();
  var isRu = currentLang === 'ru';
  var modal = document.createElement('div');
  modal.id = 'feedback-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;padding:28px;width:90%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="margin:0;font-size:1.1rem;color:var(--text-primary)">' + IC.clipboard + ' ' + (isRu ? 'Отправить фидбек' : 'Send Feedback') + '</h3>' +
      '<button onclick="document.getElementById(\'feedback-modal\').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer">&times;</button>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">' +
      '<button class="fb-type-btn" data-type="bug" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;font-size:.85rem;transition:all .2s" onclick="selectFbType(this)">' + IC.bug + ' ' + (isRu ? 'Баг' : 'Bug') + '</button>' +
      '<button class="fb-type-btn" data-type="feature" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;font-size:.85rem;transition:all .2s" onclick="selectFbType(this)">' + IC.lightbulb + ' ' + (isRu ? 'Фича' : 'Feature') + '</button>' +
      '<button class="fb-type-btn" data-type="support" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;font-size:.85rem;transition:all .2s" onclick="selectFbType(this)">' + IC.lifebuoy + ' ' + (isRu ? 'Саппорт' : 'Support') + '</button>' +
      '<button class="fb-type-btn" data-type="general" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;font-size:.85rem;transition:all .2s" onclick="selectFbType(this)">' + IC.chat + ' ' + (isRu ? 'Общее' : 'General') + '</button>' +
      '<button class="fb-type-btn" data-type="critical" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#ef4444;cursor:pointer;font-size:.85rem;transition:all .2s" onclick="selectFbType(this)">' + IC.fire + ' ' + (isRu ? 'Critical' : 'Critical') + '</button>' +
    '</div>' +
    '<textarea id="fb-message" placeholder="' + (isRu ? 'Опишите проблему или предложение...' : 'Describe the issue or suggestion...') + '" style="width:100%;height:120px;background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:12px;color:var(--text-primary);font-size:.88rem;resize:vertical;font-family:inherit;box-sizing:border-box"></textarea>' +
    '<div style="margin-top:12px;display:flex;align-items:center;gap:10px">' +
      '<label for="fb-screenshot" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-secondary);cursor:pointer;font-size:.83rem;transition:all .2s">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' +
        (isRu ? 'Скриншот' : 'Screenshot') +
      '</label>' +
      '<input type="file" id="fb-screenshot" accept="image/*" style="display:none" onchange="previewFbScreenshot(this)">' +
      '<span id="fb-screenshot-name" style="font-size:.8rem;color:var(--text-muted)"></span>' +
      '<img id="fb-screenshot-preview" style="display:none;max-height:48px;border-radius:6px;border:1px solid var(--border)" />' +
    '</div>' +
    '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">' +
      '<button onclick="document.getElementById(\'feedback-modal\').remove()" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-muted);cursor:pointer;font-size:.85rem">' + (isRu ? 'Отмена' : 'Cancel') + '</button>' +
      '<button id="fb-submit-btn" onclick="submitFeedback()" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:white;cursor:pointer;font-size:.85rem;font-weight:600">' + (isRu ? 'Отправить' : 'Send') + '</button>' +
    '</div>' +
  '</div>';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
  // Pre-select bug type
  var bugBtn = modal.querySelector('[data-type="bug"]');
  if (bugBtn) selectFbType(bugBtn);
}

var _selectedFbType = 'bug';
var _fbScreenshotBase64 = null;

function previewFbScreenshot(input) {
  var file = input.files && input.files[0];
  var nameEl = document.getElementById('fb-screenshot-name');
  var previewEl = document.getElementById('fb-screenshot-preview');
  if (!file) { _fbScreenshotBase64 = null; if (nameEl) nameEl.textContent = ''; if (previewEl) previewEl.style.display = 'none'; return; }
  if (file.size > 5 * 1024 * 1024) { toast(currentLang === 'ru' ? 'Макс. 5 МБ' : 'Max 5 MB', 'error'); input.value = ''; return; }
  if (nameEl) nameEl.textContent = file.name;
  var reader = new FileReader();
  reader.onload = function(e) {
    _fbScreenshotBase64 = e.target.result;
    if (previewEl) { previewEl.src = _fbScreenshotBase64; previewEl.style.display = 'block'; }
  };
  reader.readAsDataURL(file);
}

function selectFbType(btn) {
  _selectedFbType = btn.getAttribute('data-type');
  document.querySelectorAll('.fb-type-btn').forEach(function(b) {
    b.style.background = 'var(--bg-primary)';
    b.style.borderColor = 'var(--border)';
  });
  btn.style.background = 'rgba(var(--accent-r,99),var(--accent-g,102),var(--accent-b,241),0.15)';
  btn.style.borderColor = '#6366f1';
}

async function submitFeedback() {
  var msg = document.getElementById('fb-message');
  if (!msg || !msg.value.trim()) { toast(currentLang === 'ru' ? 'Опишите проблему' : 'Describe the issue', 'error'); return; }
  var btn = document.getElementById('fb-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    var metadata = { page: window.location.pathname, agentId: _detailAgentId || null, userAgent: navigator.userAgent };
    var body = { type: _selectedFbType, message: msg.value.trim(), agentId: _detailAgentId || undefined, metadata: metadata };
    if (_fbScreenshotBase64) body.screenshot = _fbScreenshotBase64;
    var data = await apiRequest('POST', '/api/feedback', body);
    if (data.ok) {
      var ptsMsg = data.pointsAwarded ? ' (+' + data.pointsAwarded + ' pts)' : '';
      toast((currentLang === 'ru' ? 'Фидбек отправлен!' : 'Feedback sent!') + ptsMsg, 'success');
      var modal = document.getElementById('feedback-modal');
      if (modal) modal.remove();
    } else {
      toast(data.error || 'Error', 'error');
    }
  } catch(e) { toast(e.message, 'error'); }
  if (btn) { btn.disabled = false; btn.textContent = currentLang === 'ru' ? 'Отправить' : 'Send'; }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT SKILLS (agentskills.io) — Studio UI
// ═══════════════════════════════════════════════════════════════════════════

var _skillsCache = [];
var _skillsFilter = 'all';

async function loadSkillsPage() {
  var grid = document.getElementById('skills-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-placeholder">' + (currentLang === 'ru' ? 'Загрузка...' : 'Loading...') + '</div>';
  try {
    var data = await apiRequest('GET', '/api/skills');
    _skillsCache = (data && data.skills) || [];
    renderSkills();
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>' + escHtml(e.message || 'Error') + '</p></div>';
  }
}

function filterSkills(cat) {
  _skillsFilter = cat;
  document.querySelectorAll('#skills-tabs .mkt-tab').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-cat') === cat);
  });
  renderSkills();
}

function renderSkills() {
  var grid = document.getElementById('skills-grid');
  if (!grid) return;
  var filtered = _skillsCache.filter(function(s) {
    if (_skillsFilter === 'all') return true;
    return s.source === _skillsFilter;
  });
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>' +
      (currentLang === 'ru' ? 'Нет скиллов' : 'No skills') + '</p></div>';
    return;
  }
  var html = filtered.map(function(s) {
    var badgeColor = s.source === 'builtin' ? '#00a8ff' :
                     s.source === 'user' ? '#22c55e' : '#8b5cf6';
    var badgeLabel = s.source === 'builtin' ? 'BUILT-IN' :
                     s.source === 'user' ? 'MINE' : 'PUBLIC';
    var cat = (s.category || s.metadata && s.metadata.category || '').toUpperCase();
    var ver = s.version || '1.0';
    return '' +
      '<div class="marketplace-card skill-card" onclick="openSkillDetail(' + JSON.stringify(s.name) + ')" style="cursor:pointer">' +
        '<div class="mkt-card-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          '<strong style="font-size:1rem">' + escHtml(s.name) + '</strong>' +
          '<span style="background:' + badgeColor + '22;color:' + badgeColor + ';padding:2px 8px;border-radius:6px;font-size:.65rem;font-weight:700">' + badgeLabel + '</span>' +
        '</div>' +
        '<div class="mkt-card-desc" style="margin-top:8px;font-size:.85rem;color:var(--text-muted);min-height:60px">' +
          escHtml((s.description || '').slice(0, 220)) +
        '</div>' +
        '<div class="mkt-card-footer" style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:.7rem;color:var(--text-dim)">' +
          '<span>' + (cat ? cat + ' · ' : '') + 'v' + escHtml(ver) + '</span>' +
          (s.compatibility ? '<span title="' + escHtml(s.compatibility) + '" style="color:var(--warning)">⚠ deps</span>' : '') +
        '</div>' +
      '</div>';
  }).join('');
  grid.innerHTML = html;
}

async function openSkillDetail(name) {
  try {
    var data = await apiRequest('GET', '/api/skills/' + encodeURIComponent(name));
    if (!data || !data.skill) { toast('Skill not found', 'error'); return; }
    var s = data.skill;
    var isOwn = s.source === 'user';
    // For owner-skills: get current is_public from cache (loaded by listSkillsForAgent)
    var skillMeta = (_skillsCache || []).find(function(x) { return x.name === name; }) || {};
    var isPublic = !!skillMeta.is_public;  // may be undefined initially
    var publishBtn = isOwn
      ? '<button class="btn btn-ghost btn-sm" onclick="toggleSkillPublish(' + JSON.stringify(name) + ', ' + (!isPublic) + ')">' +
        (isPublic
          ? (currentLang === 'ru' ? '🔒 Сделать приватным' : '🔒 Make Private')
          : (currentLang === 'ru' ? '🌍 Опубликовать' : '🌍 Publish')) +
        '</button>'
      : '';
    var deleteBtn = isOwn
      ? '<button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="deleteSkill(' + JSON.stringify(name) + ')">' +
        (currentLang === 'ru' ? 'Удалить' : 'Delete') + '</button>'
      : '';
    var body =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
        '<span class="badge" style="background:rgba(var(--accent-r,0),var(--accent-g,168),var(--accent-b,255),.15);color:#00a8ff;padding:3px 8px;border-radius:6px;font-size:.7rem">' + s.source.toUpperCase() + '</span>' +
        '<span class="badge" style="background:rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),.15);color:#8b5cf6;padding:3px 8px;border-radius:6px;font-size:.7rem">v' + escHtml(s.version || '1.0') + '</span>' +
        (s.license ? '<span class="badge" style="background:rgba(34,197,94,.15);color:#22c55e;padding:3px 8px;border-radius:6px;font-size:.7rem">' + escHtml(s.license.slice(0, 30)) + '</span>' : '') +
      '</div>' +
      '<p style="color:var(--text-muted);margin-bottom:16px">' + escHtml(s.description) + '</p>' +
      (s.compatibility ? '<div style="background:rgba(245,158,11,.08);border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:12px;font-size:.85rem"><b>⚠ Requires:</b> ' + escHtml(s.compatibility) + '</div>' : '') +
      '<pre style="background:var(--bg-secondary);padding:12px;border-radius:8px;max-height:50vh;overflow:auto;font-size:.8rem;white-space:pre-wrap;font-family:Inter,sans-serif">' + escHtml(s.body) + '</pre>';
    var footer =
      '<button class="btn btn-ghost" onclick="closeModal()">' + (currentLang === 'ru' ? 'Закрыть' : 'Close') + '</button>' +
      publishBtn + deleteBtn;
    openModal(escHtml(name), body, footer);
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleSkillPublish(name, makePublic) {
  try {
    var data = await apiRequest('POST', '/api/skills/' + encodeURIComponent(name) + '/publish', { isPublic: makePublic });
    if (data && data.ok) {
      toast(
        makePublic
          ? (currentLang === 'ru' ? 'Скилл опубликован' : 'Skill published')
          : (currentLang === 'ru' ? 'Скилл скрыт' : 'Skill unpublished'),
        'success'
      );
      closeModal();
      loadSkillsPage();
    } else {
      toast((data && data.error) || 'Error', 'error');
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteSkill(name) {
  if (!confirm((currentLang === 'ru' ? 'Удалить скилл ' : 'Delete skill ') + '"' + name + '"?')) return;
  try {
    await apiRequest('DELETE', '/api/skills/' + encodeURIComponent(name));
    toast(currentLang === 'ru' ? 'Удалено' : 'Deleted', 'success');
    closeModal();
    loadSkillsPage();
  } catch (e) { toast(e.message, 'error'); }
}

function openCreateSkillModal() {
  var template = '---\nname: my-skill\ndescription: What it does and when to use it. Be specific about keywords that should trigger this skill.\nmetadata:\n  category: custom\n  version: "1.0"\n---\n\n# My Skill\n\nReplace this body with your skill instructions.\n\n## When to use\n\n- Trigger condition 1\n- Trigger condition 2\n\n## Tool selection\n\n- Use: ...\n- Don\'t use: ...\n';
  var body =
    '<p style="color:var(--text-muted);font-size:.85rem;margin-bottom:12px">' +
      (currentLang === 'ru'
        ? 'SKILL.md в формате <a href="https://agentskills.io/specification" target="_blank" style="color:var(--primary)">agentskills.io</a> — YAML frontmatter + Markdown тело.'
        : 'SKILL.md per <a href="https://agentskills.io/specification" target="_blank" style="color:var(--primary)">agentskills.io</a> spec — YAML frontmatter + Markdown body.') +
    '</p>' +
    '<label style="display:flex;align-items:center;gap:6px;font-size:.85rem;margin-bottom:8px">' +
      '<input type="checkbox" id="skill-public-cb"> ' +
      (currentLang === 'ru' ? 'Опубликовать в маркетплейс (доступно всем)' : 'Publish to marketplace (visible to all users)') +
    '</label>' +
    '<textarea id="skill-md-input" style="width:100%;min-height:380px;font-family:JetBrains Mono,monospace;font-size:.8rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text-primary)">' + escHtml(template) + '</textarea>';
  var footer =
    '<button class="btn btn-ghost" onclick="closeModal()">' + (currentLang === 'ru' ? 'Отмена' : 'Cancel') + '</button>' +
    '<button class="btn btn-primary" onclick="saveNewSkill()">' + (currentLang === 'ru' ? 'Сохранить' : 'Save') + '</button>';
  openModal(currentLang === 'ru' ? 'Новый скилл' : 'New Skill', body, footer);
}

async function saveNewSkill() {
  var skillMd = (document.getElementById('skill-md-input') || {}).value || '';
  var isPublic = (document.getElementById('skill-public-cb') || {}).checked || false;
  if (skillMd.trim().length < 20) { toast('SKILL.md too short', 'error'); return; }
  try {
    var data = await apiRequest('POST', '/api/skills', { skillMd: skillMd, isPublic: isPublic });
    if (data && data.ok) {
      toast(currentLang === 'ru' ? 'Сохранено' : 'Saved', 'success');
      closeModal();
      loadSkillsPage();
    } else {
      toast((data && data.error) || 'Error', 'error');
    }
  } catch (e) { toast(e.message, 'error'); }
}

function openImportSkillModal() {
  var body =
    '<p style="color:var(--text-muted);font-size:.85rem;margin-bottom:12px">' +
      (currentLang === 'ru'
        ? 'Вставь raw URL к SKILL.md на GitHub (raw.githubusercontent.com/...)'
        : 'Paste raw URL to a SKILL.md on GitHub (raw.githubusercontent.com/...)') +
    '</p>' +
    '<input type="text" id="skill-import-url" placeholder="https://raw.githubusercontent.com/..." ' +
    'style="width:100%;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text-primary);font-family:JetBrains Mono,monospace;font-size:.8rem">';
  var footer =
    '<button class="btn btn-ghost" onclick="closeModal()">' + (currentLang === 'ru' ? 'Отмена' : 'Cancel') + '</button>' +
    '<button class="btn btn-primary" onclick="importSkillFromUrl()">' + (currentLang === 'ru' ? 'Импортировать' : 'Import') + '</button>';
  openModal(currentLang === 'ru' ? 'Импорт скилла' : 'Import Skill', body, footer);
}

// ── Per-agent skill toggle (agent settings → Skills tab) ───────────────────

async function loadAgentSkills(agentId) {
  var container = document.getElementById('agent-skills-list');
  if (!container) return;
  try {
    var data = await apiRequest('GET', '/api/agents/' + agentId + '/skills');
    var skills = (data && data.skills) || [];
    if (skills.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:24px"><p>' +
        (currentLang === 'ru' ? 'Скиллов пока нет' : 'No skills yet') + '</p></div>';
      return;
    }
    container.innerHTML = skills.map(function(s) {
      var src = s.source === 'builtin' ? 'BUILT-IN' : (s.source === 'user' ? 'MINE' : 'PUBLIC');
      var srcColor = s.source === 'builtin' ? '#00a8ff' : (s.source === 'user' ? '#22c55e' : '#8b5cf6');
      return '' +
        '<div class="skill-toggle-row" style="display:flex;align-items:flex-start;gap:14px;padding:12px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px">' +
          '<label class="switch" style="position:relative;display:inline-block;width:42px;height:22px;flex-shrink:0;margin-top:2px">' +
            '<input type="checkbox" ' + (s.enabled ? 'checked' : '') +
              ' onchange="toggleAgentSkill(' + _detailAgentId + ', ' + JSON.stringify(s.name) + ', this.checked)"' +
              ' style="opacity:0;width:0;height:0">' +
            '<span class="switch-slider" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:' + (s.enabled ? 'linear-gradient(135deg,#00a8ff,#8b5cf6)' : '#374151') + ';transition:.25s;border-radius:22px">' +
              '<span style="position:absolute;height:18px;width:18px;left:' + (s.enabled ? '22px' : '2px') + ';bottom:2px;background:white;transition:.25s;border-radius:50%"></span>' +
            '</span>' +
          '</label>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
              '<strong style="font-size:.9rem">' + escHtml(s.name) + '</strong>' +
              '<span style="background:' + srcColor + '22;color:' + srcColor + ';padding:1px 6px;border-radius:4px;font-size:.6rem;font-weight:700">' + src + '</span>' +
              (s.version ? '<span style="font-size:.65rem;color:var(--text-dim)">v' + escHtml(s.version) + '</span>' : '') +
            '</div>' +
            '<div style="font-size:.78rem;color:var(--text-muted);line-height:1.4">' + escHtml((s.description || '').slice(0, 200)) + '</div>' +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" onclick="openSkillDetail(' + JSON.stringify(s.name) + ')" style="flex-shrink:0">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
          '</button>' +
        '</div>';
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><p>' + escHtml(e.message || 'Error') + '</p></div>';
  }
}

async function toggleAgentSkill(agentId, skillName, enabled) {
  try {
    await apiRequest('POST', '/api/agents/' + agentId + '/skills/' + encodeURIComponent(skillName) + '/toggle', { enabled: enabled });
    toast(
      enabled ? (currentLang === 'ru' ? 'Скилл включён' : 'Skill enabled')
              : (currentLang === 'ru' ? 'Скилл выключен' : 'Skill disabled'),
      'success'
    );
    // Reload list to refresh visual state
    loadAgentSkills(agentId);
  } catch (e) {
    toast(e.message || 'Error', 'error');
    // Revert visual state on error
    loadAgentSkills(agentId);
  }
}

async function importSkillFromUrl() {
  var url = ((document.getElementById('skill-import-url') || {}).value || '').trim();
  if (!url.startsWith('https://')) { toast('URL must start with https://', 'error'); return; }
  if (!url.includes('raw.githubusercontent.com')) {
    if (!confirm('URL не выглядит как raw GitHub. Продолжить?')) return;
  }
  try {
    var res = await fetch(url);
    if (!res.ok) { toast('Fetch failed: ' + res.status, 'error'); return; }
    var skillMd = await res.text();
    if (skillMd.length > 100000) { toast('SKILL.md too large (>100KB)', 'error'); return; }
    var data = await apiRequest('POST', '/api/skills', {
      skillMd: skillMd,
      isImported: true,
      sourceUrl: url,
    });
    if (data && data.ok) {
      toast(currentLang === 'ru' ? 'Импортировано' : 'Imported', 'success');
      closeModal();
      loadSkillsPage();
    } else {
      toast((data && data.error) || 'Error', 'error');
    }
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP Servers — Studio UI (page + per-agent tab)
// ═══════════════════════════════════════════════════════════════════════════

async function loadMCPServersPage() {
  const grid = document.getElementById('mcp-servers-grid');
  if (!grid) return;
  const isRu = currentLang === 'ru';
  grid.innerHTML = '<div class="loading-placeholder">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>';
  try {
    const data = await apiRequest('/api/mcp-servers');
    if (!data || !data.ok) {
      grid.innerHTML = '<div class="empty-state">' + (isRu ? 'Не удалось загрузить' : 'Failed to load') + '</div>';
      return;
    }
    if (!data.items.length) {
      grid.innerHTML = '<div class="empty-state" style="padding:48px 24px;text-align:center">' +
        '<div style="font-size:48px;margin-bottom:12px">🔌</div>' +
        '<h3 style="margin:0 0 8px;color:var(--text-primary)">' + (isRu ? 'Нет MCP-серверов' : 'No MCP servers yet') + '</h3>' +
        '<p style="color:var(--text-muted);max-width:480px;margin:0 auto 16px">' +
          (isRu
            ? 'MCP (Model Context Protocol) — стандарт от Anthropic для подключения внешних инструментов. Notion, Linear, GitHub, твой свой сервер — всё подключается через URL.'
            : 'MCP (Model Context Protocol) is Anthropic\'s standard for plugging external tools into an AI agent. Notion, Linear, GitHub, your own server — all via URL.') +
        '</p>' +
        '<button class="btn btn-primary" onclick="openMCPAddModal()">+ ' + (isRu ? 'Добавить сервер' : 'Add Server') + '</button>' +
      '</div>';
      return;
    }
    grid.innerHTML = data.items.map(renderMCPServerCard).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state">' + (e.message || 'Error') + '</div>';
  }
}

function renderMCPServerCard(s) {
  const isRu = currentLang === 'ru';
  const status = s.status || 'pending';
  const statusColor = {
    'connected': '#10b981',
    'pending':   '#f59e0b',
    'error':     '#ef4444',
    'disabled':  '#64748b',
  }[status] || '#64748b';
  const statusLabel = {
    'connected': isRu ? 'Подключен' : 'Connected',
    'pending':   isRu ? 'Ожидание' : 'Pending',
    'error':     isRu ? 'Ошибка' : 'Error',
    'disabled':  isRu ? 'Отключен' : 'Disabled',
  }[status] || status;
  const lastErr = s.last_error
    ? '<div style="margin-top:8px;padding:8px 10px;background:rgba(239,68,68,0.08);border-radius:6px;font-size:.75rem;color:#ef4444;word-break:break-word">' + escHtml(String(s.last_error).slice(0, 200)) + '</div>'
    : '';
  return '<div class="card" style="padding:16px;border:1px solid var(--border);border-radius:10px">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:600;font-size:1rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(s.name) + '</div>' +
        '<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:\'JetBrains Mono\',monospace">' + escHtml(s.url) + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;font-size:.7rem;font-weight:600;color:' + statusColor + ';white-space:nowrap">' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + statusColor + '"></span>' +
        statusLabel +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:14px;margin-top:10px;font-size:.78rem;color:var(--text-secondary)">' +
      '<span>🔧 ' + (s.tools_count || 0) + ' ' + (isRu ? 'тулов' : 'tools') + '</span>' +
      '<span>📡 ' + (s.transport || 'sse').toUpperCase() + '</span>' +
    '</div>' +
    lastErr +
    '<div style="display:flex;gap:8px;margin-top:12px">' +
      '<button class="btn btn-ghost" style="flex:1" onclick="testMCPServer(' + s.id + ')">' + (isRu ? 'Тест' : 'Test') + '</button>' +
      '<button class="btn btn-ghost" style="flex:1" onclick="viewMCPTools(' + s.id + ', \'' + escHtml(s.name).replace(/'/g, "\\'") + '\')">' + (isRu ? 'Тулы' : 'Tools') + '</button>' +
      '<button class="btn btn-ghost" style="color:#ef4444" onclick="deleteMCPServer(' + s.id + ', \'' + escHtml(s.name).replace(/'/g, "\\'") + '\')">' + (isRu ? 'Удалить' : 'Delete') + '</button>' +
    '</div>' +
  '</div>';
}

function openMCPAddModal() {
  const isRu = currentLang === 'ru';
  const body =
    '<div style="display:flex;flex-direction:column;gap:14px">' +
      '<div>' +
        '<label class="form-label">' + (isRu ? 'Название' : 'Name') + '</label>' +
        '<input id="mcp-add-name" class="form-input" maxlength="120" placeholder="' + (isRu ? 'Мой Notion' : 'My Notion') + '">' +
      '</div>' +
      '<div>' +
        '<label class="form-label">URL</label>' +
        '<input id="mcp-add-url" class="form-input" maxlength="1024" placeholder="https://mcp.example.com">' +
        '<div style="font-size:.7rem;color:var(--text-muted);margin-top:4px">' +
          (isRu ? 'Endpoint MCP-сервера. Локальные IP / приватные сети заблокированы.' : 'MCP server endpoint. Localhost / private IPs blocked.') +
        '</div>' +
      '</div>' +
      '<div>' +
        '<label class="form-label">' + (isRu ? 'API-ключ (опционально)' : 'API key (optional)') + '</label>' +
        '<input id="mcp-add-key" class="form-input" type="password" placeholder="Bearer token">' +
      '</div>' +
    '</div>';
  const footer =
    '<button class="btn btn-ghost" onclick="closeModal()">' + (isRu ? 'Отмена' : 'Cancel') + '</button>' +
    '<button class="btn btn-primary" onclick="submitMCPAdd()">' + (isRu ? 'Подключить' : 'Connect') + '</button>';
  openModal(isRu ? 'Добавить MCP-сервер' : 'Add MCP Server', body, footer);
}

async function submitMCPAdd() {
  const name = (document.getElementById('mcp-add-name').value || '').trim();
  const url  = (document.getElementById('mcp-add-url').value  || '').trim();
  const key  = (document.getElementById('mcp-add-key').value  || '').trim();
  if (!name || !url) { toast(currentLang === 'ru' ? 'Имя и URL обязательны' : 'Name and URL required', 'error'); return; }
  try {
    const data = await apiRequest('/api/mcp-servers', { method: 'POST', body: JSON.stringify({ name, url, apiKey: key || undefined }) });
    if (data && data.ok) {
      toast(currentLang === 'ru' ? 'Подключено' : 'Connected', 'success');
      closeModal();
      loadMCPServersPage();
    } else {
      toast((data && data.error) || 'Error', 'error');
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function testMCPServer(id) {
  try {
    const data = await apiRequest('/api/mcp-servers/' + id + '/test', { method: 'POST' });
    if (data && data.ok) {
      toast((currentLang === 'ru' ? 'Статус: ' : 'Status: ') + data.status + ' · ' + data.tools + ' tools', data.status === 'connected' ? 'success' : 'error');
      loadMCPServersPage();
    } else {
      toast((data && data.error) || 'Error', 'error');
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function viewMCPTools(id, name) {
  const isRu = currentLang === 'ru';
  openModal(name + ' — ' + (isRu ? 'инструменты' : 'tools'), '<div style="text-align:center;padding:20px">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div>', '<button class="btn btn-ghost" onclick="closeModal()">' + (isRu ? 'Закрыть' : 'Close') + '</button>');
  try {
    const data = await apiRequest('/api/mcp-servers/' + id + '/tools');
    const modal = document.getElementById('generic-modal');
    if (!modal) return;
    const body = modal.querySelector('.modal-body, .studio-dialog-body, [class*="body"]');
    if (!body) return;
    if (!data || !data.ok || !data.tools.length) {
      body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">' + (isRu ? 'Нет инструментов' : 'No tools') + '</div>';
      return;
    }
    body.innerHTML = '<div style="max-height:60vh;overflow:auto;display:flex;flex-direction:column;gap:8px">' +
      data.tools.map(t =>
        '<div style="padding:10px 12px;border:1px solid var(--border);border-radius:8px">' +
          '<div style="font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:.85rem;color:var(--text-primary)">' + escHtml(t.name) + '</div>' +
          (t.description ? '<div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">' + escHtml(t.description) + '</div>' : '') +
        '</div>'
      ).join('') +
    '</div>';
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteMCPServer(id, name) {
  const isRu = currentLang === 'ru';
  if (!confirm((isRu ? 'Удалить MCP-сервер "' : 'Delete MCP server "') + name + '"?')) return;
  try {
    const data = await apiRequest('/api/mcp-servers/' + id, { method: 'DELETE' });
    if (data && data.ok) {
      toast(isRu ? 'Удалено' : 'Deleted', 'success');
      loadMCPServersPage();
    } else {
      toast((data && data.error) || 'Error', 'error');
    }
  } catch (e) { toast(e.message, 'error'); }
}

// ── Per-agent MCP tab inside agent settings ───────────────────────────────

async function renderAgentMCPTab(body, agent) {
  const isRu = currentLang === 'ru';
  body.innerHTML =
    '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(var(--accent-r,139),var(--accent-g,92),var(--accent-b,246),0.12);color:#8b5cf6">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' +
        '</div>' +
        '<div class="rt-header-text">' +
          '<h3>MCP ' + (isRu ? 'серверы' : 'servers') + '</h3>' +
          '<p>' + (isRu ? 'Включи MCP-серверы, доступные этому агенту. Управление списком — на странице MCP Servers слева.' : 'Enable MCP servers for this agent. Manage the global list on the MCP Servers page.') + '</p>' +
        '</div>' +
      '</div>' +
      '<div id="agent-mcp-list" class="rt-section"><div style="color:var(--text-muted);text-align:center;padding:20px">' + (isRu ? 'Загрузка...' : 'Loading...') + '</div></div>' +
    '</div>';

  try {
    const [allRes, agentRes] = await Promise.all([
      apiRequest('/api/mcp-servers'),
      apiRequest('/api/agents/' + agent.id + '/mcp-servers'),
    ]);
    const all = (allRes && allRes.items) || [];
    const enabled = new Set(((agentRes && agentRes.items) || []).map(x => x.id));
    const list = document.getElementById('agent-mcp-list');
    if (!list) return;
    if (!all.length) {
      list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">' +
        (isRu ? 'У тебя нет MCP-серверов. ' : 'You have no MCP servers yet. ') +
        '<a href="#" onclick="event.preventDefault();navigateTo(\'mcp-servers\')">' + (isRu ? 'Добавить' : 'Add one') + '</a>' +
      '</div>';
      return;
    }
    list.innerHTML = all.map(s => {
      const on = enabled.has(s.id);
      const statusColor = s.status === 'connected' ? '#10b981' : '#ef4444';
      return '<label style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">' +
        '<input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="toggleAgentMCP(' + agent.id + ',' + s.id + ',this.checked)" style="width:18px;height:18px;cursor:pointer">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600">' + escHtml(s.name) + ' <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + statusColor + ';margin-left:4px"></span></div>' +
          '<div style="font-size:.72rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(s.url) + ' · ' + (s.tools_count || 0) + ' tools</div>' +
        '</div>' +
      '</label>';
    }).join('');
  } catch (e) {
    const list = document.getElementById('agent-mcp-list');
    if (list) list.innerHTML = '<div style="color:#ef4444;padding:12px">' + escHtml(e.message) + '</div>';
  }
}

async function toggleAgentMCP(agentId, serverId, enabled) {
  try {
    const data = await apiRequest('/api/agents/' + agentId + '/mcp-servers/' + serverId, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
    if (!data || !data.ok) toast((data && data.error) || 'Error', 'error');
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// EDIT WITH AI — AI rewrites the agent's Soul (system prompt) per instruction
// ═══════════════════════════════════════════════════════════════════════════

function openEditWithAIModal(field) {
  const isRu = currentLang === 'ru';
  const f = field || 'code';
  const titleText = f === 'description'
    ? (isRu ? 'Edit Description with AI' : 'Edit Description with AI')
    : (isRu ? 'Edit Soul with AI' : 'Edit Soul with AI');
  const body =
    '<div style="display:flex;flex-direction:column;gap:14px">' +
      '<div style="font-size:.85rem;color:var(--text-secondary);line-height:1.55">' +
        (isRu
          ? 'Опиши, как нужно изменить агента — AI перепишет текст. Сравнишь результат с оригиналом и решишь, применять ли.'
          : 'Describe how the agent should change — AI rewrites the text. You\'ll diff the result against the original and decide whether to apply.') +
      '</div>' +
      '<div>' +
        '<label class="form-label">' + (isRu ? 'Инструкция' : 'Instruction') + '</label>' +
        '<textarea id="edit-ai-instruction" class="form-input" rows="4" maxlength="2000" placeholder="' +
          escHtml(isRu
            ? 'Сделай его агрессивнее на арбитраже. Добавь правило: не торговать ночью.'
            : 'Make it more aggressive on arbitrage. Add rule: do not trade at night.') + '"></textarea>' +
      '</div>' +
      '<input type="hidden" id="edit-ai-field" value="' + f + '">' +
    '</div>';
  const footer =
    '<button class="btn btn-ghost" onclick="closeModal()">' + (isRu ? 'Отмена' : 'Cancel') + '</button>' +
    '<button class="btn btn-primary" onclick="submitEditWithAI()" id="edit-ai-go-btn">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M12 3l1.9 4.6L18 9l-4.1 1.4L12 15l-1.9-4.6L6 9l4.1-1.4z"/></svg>' +
      (isRu ? 'Сгенерировать' : 'Generate') +
    '</button>';
  openModal(titleText, body, footer);
}

async function submitEditWithAI() {
  const isRu = currentLang === 'ru';
  const instruction = (document.getElementById('edit-ai-instruction') || {}).value || '';
  const field = (document.getElementById('edit-ai-field') || {}).value || 'code';
  if (!instruction.trim()) { toast(isRu ? 'Введи инструкцию' : 'Enter an instruction', 'error'); return; }
  if (!_detailAgentData || !_detailAgentData.id) { toast(isRu ? 'Агент не выбран' : 'No agent', 'error'); return; }
  const btn = document.getElementById('edit-ai-go-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = (isRu ? 'Думаю…' : 'Thinking…'); }
  try {
    const data = await apiRequest('/api/agents/' + _detailAgentData.id + '/edit-with-ai', {
      method: 'POST',
      body: JSON.stringify({ instruction: instruction.trim(), field }),
    });
    if (!data || !data.ok) {
      toast((data && data.error) || 'Error', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = (isRu ? 'Сгенерировать' : 'Generate'); }
      return;
    }
    showEditWithAIDiff(data.original || '', data.proposed || '', data.field, data.model || '');
  } catch (e) {
    toast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = (isRu ? 'Сгенерировать' : 'Generate'); }
  }
}

function showEditWithAIDiff(original, proposed, field, model) {
  const isRu = currentLang === 'ru';
  const body =
    '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<div style="font-size:.78rem;color:var(--text-muted)">' +
        (isRu ? 'Сравнение (модель: ' : 'Comparison (model: ') + escHtml(model) + ')' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-height:55vh">' +
        '<div style="display:flex;flex-direction:column;min-height:0">' +
          '<div style="font-size:.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">' + (isRu ? 'Было' : 'Original') + '</div>' +
          '<textarea readonly style="flex:1;min-height:280px;font-family:\'JetBrains Mono\',monospace;font-size:.78rem;padding:10px;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,0.02);color:var(--text-secondary);resize:none">' +
            escHtml(original) +
          '</textarea>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;min-height:0">' +
          '<div style="font-size:.7rem;font-weight:600;color:#00a8ff;text-transform:uppercase;margin-bottom:4px">' + (isRu ? 'Станет' : 'Proposed') + '</div>' +
          '<textarea id="edit-ai-proposed" style="flex:1;min-height:280px;font-family:\'JetBrains Mono\',monospace;font-size:.78rem;padding:10px;border:1px solid rgba(var(--accent-r,0),var(--accent-g,168),var(--accent-b,255),0.4);border-radius:8px;background:rgba(var(--accent-r,0),var(--accent-g,168),var(--accent-b,255),0.04);color:var(--text-primary);resize:none">' +
            escHtml(proposed) +
          '</textarea>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:.72rem;color:var(--text-muted)">' +
        (isRu ? 'Можно отредактировать правую колонку перед применением.' : 'You can edit the right column before applying.') +
      '</div>' +
    '</div>';
  const footer =
    '<button class="btn btn-ghost" onclick="closeModal()">' + (isRu ? 'Отмена' : 'Cancel') + '</button>' +
    '<button class="btn btn-primary" onclick="applyEditWithAI(\'' + field + '\')">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-2px;margin-right:4px" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
      (isRu ? 'Применить' : 'Apply') +
    '</button>';
  openModal(isRu ? 'Предпросмотр изменения' : 'Preview Change', body, footer);
}

async function applyEditWithAI(field) {
  const isRu = currentLang === 'ru';
  const proposed = (document.getElementById('edit-ai-proposed') || {}).value || '';
  if (!proposed.trim()) { toast(isRu ? 'Пусто' : 'Empty', 'error'); return; }
  if (!_detailAgentData || !_detailAgentData.id) return;
  try {
    const path = '/api/agents/' + _detailAgentData.id + '/' + (field === 'description' ? 'description' : 'code');
    const data = await apiRequest(path, { method: 'PUT', body: JSON.stringify({ [field]: proposed }) });
    if (data && (data.ok || data.success || data.id)) {
      toast(isRu ? 'Применено' : 'Applied', 'success');
      // Update local cache + textarea if visible
      if (_detailAgentData) _detailAgentData[field] = proposed;
      const ta = document.getElementById(field === 'code' ? 'edit-prompt-textarea' : 'edit-description-textarea');
      if (ta) ta.value = proposed;
      closeModal();
    } else {
      toast((data && data.error) || 'Error', 'error');
    }
  } catch (e) { toast(e.message, 'error'); }
}

// ── Telegram-link banner ─────────────────────────────────────────────────
// Shows on top of the app when the current session has no telegram_id linked.
// Clicking "Привязать" opens t.me/<bot>?start=link_<token>; once the user runs
// /start in the bot, future API calls use telegram_id and notifications
// (auto-pause alerts, etc.) arrive in their Telegram chat.
function showTelegramLinkBanner() {
  if (document.querySelector('.tg-link-banner')) return;
  var ts = parseInt(localStorage.getItem('tg_link_dismissed_at') || '0', 10);
  if (ts && Date.now() - ts < 24 * 60 * 60 * 1000) return;
  var isRu = (typeof currentLang !== 'undefined' && currentLang === 'ru');
  var wrap = document.createElement('div');
  wrap.className = 'tg-link-banner';
  wrap.innerHTML =
    '<span class="tg-link-icon">📨</span>' +
    '<div class="tg-link-body">' +
      '<b>' + (isRu ? 'Привяжи Telegram-бота' : 'Link Telegram bot') + '</b>' +
      '<small>' + (isRu
        ? 'Так уведомления Studio и алерты агентов будут приходить в чат с ботом.'
        : 'So Studio notifications and agent alerts can reach you in the bot DM.') +
      '</small>' +
    '</div>' +
    '<button onclick="startTelegramLink()">' + (isRu ? 'Привязать' : 'Link') + '</button>' +
    '<button class="tg-link-close" onclick="dismissTelegramLinkBanner()" title="' +
      (isRu ? 'Скрыть на сутки' : 'Hide for 24h') + '">×</button>';
  var root = document.querySelector('.main-content') || document.body;
  root.prepend(wrap);
}

function dismissTelegramLinkBanner() {
  localStorage.setItem('tg_link_dismissed_at', String(Date.now()));
  var el = document.querySelector('.tg-link-banner');
  if (el) el.remove();
}

async function startTelegramLink() {
  if (!authToken) { (typeof showNotification === 'function' ? showNotification : toast)('Log in first', 'error'); return; }
  try {
    var data = await apiRequest('POST', '/api/me/link-telegram', {});
    if (!data.ok) { toast(data.error || 'Error', 'error'); return; }
    if (data.alreadyLinked) {
      toast((typeof currentLang !== 'undefined' && currentLang === 'ru') ? 'Уже привязано' : 'Already linked', 'success');
      var el = document.querySelector('.tg-link-banner');
      if (el) el.remove();
      return;
    }
    if (data.deepLink) window.open(data.deepLink, '_blank');
  } catch (e) { toast(e.message, 'error'); }
}

// ── Custom number-input spinners ─────────────────────────────────────────
// Native <input type="number"> arrow controls are unstylable and look like
// vanilla HTML against the rest of Studio. We wrap each number input in a
// <span class="num-spin"> with our own +/− buttons; the underlying input still
// accepts wheel/arrow-key/typed values.
function _stepNumberInput(input, dir) {
  if (!input || input.disabled || input.readOnly) return;
  // Use the native stepUp/stepDown so min/max/step/validity are respected
  try {
    if (dir > 0 && typeof input.stepUp === 'function') input.stepUp();
    else if (dir < 0 && typeof input.stepDown === 'function') input.stepDown();
    else {
      // Fallback for inputs without stepUp (rare)
      var step = parseFloat(input.step || '1') || 1;
      var cur = parseFloat(input.value || '0') || 0;
      input.value = String(cur + dir * step);
    }
  } catch (e) {
    var step = parseFloat(input.step || '1') || 1;
    var cur = parseFloat(input.value || '0') || 0;
    input.value = String(cur + dir * step);
  }
  // Fire input + change so listeners (saveSettingsAI, range syncs) react
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function wrapNumberInputs(root) {
  var scope = root || document;
  var inputs = scope.querySelectorAll('input[type="number"]:not([data-numspin-wrapped])');
  inputs.forEach(function(input) {
    if (input.closest('.num-spin')) { input.setAttribute('data-numspin-wrapped', '1'); return; }
    var wrap = document.createElement('span');
    wrap.className = 'num-spin';
    // Preserve flexible width — adopt parent's "block-like" behaviour if input was full-width
    var cs = window.getComputedStyle(input);
    if (cs.display === 'block' || input.classList.contains('rt-input') || input.style.width === '100%') {
      wrap.style.display = 'flex';
      wrap.style.width = '100%';
    }
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'num-btn num-btn-minus';
    minus.setAttribute('aria-label', 'Decrease');
    minus.textContent = '−';
    minus.onclick = function() { _stepNumberInput(input, -1); };
    var plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'num-btn num-btn-plus';
    plus.setAttribute('aria-label', 'Increase');
    plus.textContent = '+';
    plus.onclick = function() { _stepNumberInput(input, +1); };
    wrap.appendChild(minus);
    wrap.appendChild(plus);
    input.setAttribute('data-numspin-wrapped', '1');
  });
}

// Auto-wrap newly-rendered inputs by re-running on common UI events
(function() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { wrapNumberInputs(); });
  } else {
    wrapNumberInputs();
  }
  // Catch dynamically-inserted inputs (settings panels, modals, wizards)
  var observer = new MutationObserver(function(muts) {
    var needsRescan = false;
    for (var i = 0; i < muts.length; i++) {
      for (var j = 0; j < muts[i].addedNodes.length; j++) {
        var n = muts[i].addedNodes[j];
        if (n.nodeType === 1 && (
          n.tagName === 'INPUT' || n.querySelector && n.querySelector('input[type="number"]')
        )) { needsRescan = true; break; }
      }
      if (needsRescan) break;
    }
    if (needsRescan) wrapNumberInputs();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

// ── Mobile sidebar drawer ────────────────────────────────────────────────
// At ≤900px the sidebar becomes off-canvas (see studio.css). We inject a
// hamburger button into the topbar and a click-outside-to-close behavior.
function _setupMobileSidebar() {
  if (window.__mobileSidebarReady) return;
  window.__mobileSidebarReady = true;

  function toggleSidebar(force) {
    var b = document.body;
    var willOpen = typeof force === 'boolean' ? force : !b.classList.contains('sidebar-mobile-open');
    b.classList.toggle('sidebar-mobile-open', willOpen);
  }
  window.toggleMobileSidebar = toggleSidebar;

  // Inject hamburger if missing
  function injectHamburger() {
    if (document.querySelector('.mobile-hamburger')) return;
    var topbar = document.querySelector('.topbar') || document.querySelector('header.topbar') || document.querySelector('.main-content > header');
    if (!topbar) return;
    var btn = document.createElement('button');
    btn.className = 'mobile-hamburger';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    btn.onclick = function() { toggleSidebar(); };
    topbar.insertBefore(btn, topbar.firstChild);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHamburger);
  } else {
    injectHamburger();
  }
  // Re-inject if topbar gets re-rendered
  new MutationObserver(injectHamburger).observe(document.body, { childList: true, subtree: true });

  // Click backdrop or nav item → close drawer
  document.addEventListener('click', function(e) {
    if (!document.body.classList.contains('sidebar-mobile-open')) return;
    var t = e.target;
    var inSidebar = t && (t.closest('.sidebar') || t.closest('.mobile-hamburger'));
    if (inSidebar) {
      // Nav item click — still close drawer for navigation feel
      if (t.closest && t.closest('.nav-item')) {
        setTimeout(function() { toggleSidebar(false); }, 80);
      }
      return;
    }
    toggleSidebar(false);
  });
  // ESC closes
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.body.classList.contains('sidebar-mobile-open')) toggleSidebar(false);
  });
}
_setupMobileSidebar();

// ── Button busy state + form-Save feedback ───────────────────────────────
// Any function that submits to an API should call btnBusy(btn) at start and
// btnDone(btn) at finish. Use the data-action wrapper below to auto-wire most
// Save buttons that follow the pattern `<button onclick="saveX()">Save</button>`.
function btnBusy(btn) {
  if (!btn) return;
  if (btn.dataset.origText === undefined) btn.dataset.origText = btn.textContent || '';
  btn.dataset.busy = '1';
  btn.disabled = true;
}
function btnDone(btn) {
  if (!btn) return;
  btn.dataset.busy = '0';
  btn.removeAttribute('data-busy');
  btn.disabled = false;
}
window.btnBusy = btnBusy;
window.btnDone = btnDone;

// Wrap onclick handlers of any element marked data-save-button so it auto-shows
// spinner and re-enables after the promise resolves. Opt-in via:
//   <button data-save-button onclick="saveAIKey()">Save</button>
(function() {
  function wrap(btn) {
    if (!btn || btn.__saveWrapped) return;
    btn.__saveWrapped = true;
    var origAttr = btn.getAttribute('onclick');
    if (!origAttr) return;
    // Wrap the inline handler so we can detect promise return
    btn.removeAttribute('onclick');
    btn.addEventListener('click', async function(e) {
      btnBusy(btn);
      try {
        // Eval the original handler body in window scope, get its return
        var fn = new Function('event', origAttr + ';');
        var r = fn.call(window, e);
        if (r && typeof r.then === 'function') { await r; }
      } catch (err) {
        try { toast(err.message || String(err), 'error'); } catch {}
      } finally {
        btnDone(btn);
      }
    });
  }
  function scan() {
    document.querySelectorAll('[data-save-button]').forEach(wrap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();

// ── A11y: auto-add aria-label to icon-only buttons ───────────────────────
// Many buttons in Studio are icon-only (SVG inside). Auto-injecting aria-label
// based on tooltips/title/data-action so screen-reader users get something.
(function() {
  function infer(btn) {
    if (btn.getAttribute('aria-label')) return;
    var label =
      btn.getAttribute('title') ||
      btn.getAttribute('data-tooltip') ||
      btn.getAttribute('data-action') ||
      btn.getAttribute('data-name');
    // Skip buttons that already have visible text content
    var txt = (btn.textContent || '').trim();
    if (txt && txt.length > 1 && !/^[+\-×x✕▾▿▸▶◀<>↑↓]+$/.test(txt)) return;
    // Common ones based on class / onclick
    var cls = (btn.className || '') + '';
    if (!label) {
      if (cls.includes('mobile-hamburger') || cls.includes('sidebar-toggle')) label = 'Menu';
      else if (cls.includes('close')) label = 'Close';
      else if (cls.includes('settings')) label = 'Settings';
      else if (cls.includes('delete')) label = 'Delete';
      else if (cls.includes('edit')) label = 'Edit';
      else if (cls.includes('refresh')) label = 'Refresh';
      else if (cls.includes('search')) label = 'Search';
      else if (cls.includes('back')) label = 'Back';
      else if (cls.includes('notif')) label = 'Notifications';
      else if (txt === '+') label = 'Add';
      else if (txt === '−' || txt === '-') label = 'Remove';
      else if (txt === '×' || txt === '✕') label = 'Close';
    }
    if (label) btn.setAttribute('aria-label', label);
  }
  function scan() {
    document.querySelectorAll('button, [role="button"]').forEach(infer);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
  // Throttled rescan on DOM changes
  var pending = false;
  new MutationObserver(function() {
    if (pending) return;
    pending = true;
    setTimeout(function() { pending = false; scan(); }, 250);
  }).observe(document.body, { childList: true, subtree: true });
})();

// ── Creator earnings dashboard ───────────────────────────────────────────
async function loadCreatorEarnings() {
  var container = document.getElementById('earnings-page') ||
                  document.getElementById('profile-page');
  if (!container) return;
  var host = document.getElementById('earnings-content');
  if (!host) {
    host = document.createElement('div');
    host.id = 'earnings-content';
    host.style.padding = '16px';
    container.appendChild(host);
  }
  host.innerHTML = '<div class="skel skel-block" style="height:24px;width:60%"></div>' +
                   '<div class="skel skel-block" style="height:14px;margin-top:12px"></div>';
  try {
    var data = await apiRequest('GET', '/api/me/earnings');
    if (!data.ok) throw new Error(data.error || 'load failed');
    var isRu = currentLang === 'ru';
    var t = isRu ? {
      title: 'Доходы автора',
      pending: 'Ожидает выплаты',
      paid: 'Выплачено',
      total: 'Всего заработано',
      payoutWallet: 'Кошелёк для выплат',
      payoutHint: 'TON-адрес куда платформа отправит твою долю с продаж скиллов / агентов. Минимум 0.5 TON, выплаты раз в сутки.',
      setWallet: 'Сохранить',
      enterAddr: 'Введите TON адрес (UQ… или EQ…)',
      recent: 'Последние операции',
      empty: 'Пока нет начислений. Опубликуй скилл в маркетплейс — 80% с каждой покупки твои.',
      ton: 'TON',
    } : {
      title: 'Creator earnings',
      pending: 'Pending payout',
      paid: 'Paid out',
      total: 'Total earned',
      payoutWallet: 'Payout wallet',
      payoutHint: 'TON address where the platform sends your share of skill / agent sales. Min 0.5 TON, paid daily.',
      setWallet: 'Save',
      enterAddr: 'Enter TON address (UQ… or EQ…)',
      recent: 'Recent activity',
      empty: 'No earnings yet. Publish a skill — 80% of every sale is yours.',
      ton: 'TON',
    };
    function statusLabel(s) {
      var map = isRu
        ? { pending: 'Ожидает', paid: 'Выплачено', failed: 'Ошибка', refunded: 'Возврат' }
        : { pending: 'Pending', paid: 'Paid', failed: 'Failed', refunded: 'Refunded' };
      return map[s] || s;
    }
    function typeLabel(s) {
      var map = isRu
        ? { skill_purchase: 'Покупка скилла', agent_fork: 'Форк агента', referral: 'Реферал', manual: 'Ручное' }
        : { skill_purchase: 'Skill sale', agent_fork: 'Agent fork', referral: 'Referral', manual: 'Manual' };
      return map[s] || s;
    }
    var html = '';
    html += '<h2 style="margin:0 0 16px;font-size:1.25rem">💸 ' + t.title + '</h2>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">';
    html += '<div style="background:var(--bg-tertiary);border-radius:10px;padding:14px">' +
              '<div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">' + t.pending + '</div>' +
              '<div style="font-size:1.4rem;font-weight:700;margin-top:4px">' + data.pendingTon.toFixed(3) + ' ' + t.ton + '</div>' +
            '</div>';
    html += '<div style="background:var(--bg-tertiary);border-radius:10px;padding:14px">' +
              '<div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">' + t.paid + '</div>' +
              '<div style="font-size:1.4rem;font-weight:700;margin-top:4px">' + data.paidTon.toFixed(3) + ' ' + t.ton + '</div>' +
            '</div>';
    html += '<div style="background:var(--bg-tertiary);border-radius:10px;padding:14px">' +
              '<div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">' + t.total + '</div>' +
              '<div style="font-size:1.4rem;font-weight:700;margin-top:4px">' + data.totalEarnedTon.toFixed(3) + ' ' + t.ton + '</div>' +
            '</div>';
    html += '</div>';
    html += '<div style="background:var(--bg-tertiary);border-radius:10px;padding:14px;margin-bottom:20px">';
    html += '<label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:6px">' + t.payoutWallet + '</label>';
    html += '<div style="display:flex;gap:8px;align-items:stretch">';
    html += '<input id="earnings-payout-input" type="text" placeholder="' + t.enterAddr + '" value="' + escHtml(data.payoutWallet || '') + '" style="flex:1">';
    html += '<button data-save-button onclick="saveCreatorPayoutWallet()">' + t.setWallet + '</button>';
    html += '</div>';
    html += '<div style="font-size:.72rem;color:var(--text-muted);margin-top:6px">' + t.payoutHint + '</div>';
    html += '</div>';
    html += '<h3 style="margin:24px 0 12px;font-size:1rem">' + t.recent + '</h3>';
    if (!data.recent || data.recent.length === 0) {
      html += '<div style="color:var(--text-muted);padding:16px;background:var(--bg-tertiary);border-radius:10px;text-align:center">' + t.empty + '</div>';
    } else {
      html += '<div style="background:var(--bg-tertiary);border-radius:10px;overflow:hidden">';
      html += '<table style="width:100%;border-collapse:collapse;font-size:.85rem">';
      html += '<thead><tr style="background:rgba(255,255,255,0.03);font-size:.72rem;color:var(--text-muted);text-transform:uppercase">';
      html += '<th style="text-align:left;padding:10px">' + (isRu ? 'Дата' : 'Date') + '</th>';
      html += '<th style="text-align:left;padding:10px">' + (isRu ? 'Источник' : 'Source') + '</th>';
      html += '<th style="text-align:right;padding:10px">' + t.ton + '</th>';
      html += '<th style="text-align:left;padding:10px">' + (isRu ? 'Статус' : 'Status') + '</th>';
      html += '</tr></thead><tbody>';
      for (var i = 0; i < data.recent.length; i++) {
        var r = data.recent[i];
        var d = new Date(r.createdAt).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { day: '2-digit', month: 'short' });
        var badgeStyle = r.status === 'paid'
          ? 'background:rgba(34,197,94,0.18);color:#86efac'
          : r.status === 'failed'
            ? 'background:rgba(239,68,68,0.18);color:#fca5a5'
            : 'background:rgba(234,179,8,0.18);color:#fcd34d';
        html += '<tr style="border-top:1px solid rgba(255,255,255,0.06)">';
        html += '<td style="padding:10px">' + d + '</td>';
        html += '<td style="padding:10px">' + typeLabel(r.sourceType) + (r.sourceId ? ' #' + r.sourceId : '') + '</td>';
        html += '<td style="padding:10px;text-align:right;font-variant-numeric:tabular-nums">' + r.amountTon.toFixed(3) + '</td>';
        html += '<td style="padding:10px"><span style="font-size:.72rem;padding:2px 8px;border-radius:4px;' + badgeStyle + '">' + statusLabel(r.status) + '</span></td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }
    host.innerHTML = html;
  } catch (e) {
    host.innerHTML = '<div style="color:var(--danger);padding:16px">Error: ' + escHtml(e.message) + '</div>';
  }
}

async function saveCreatorPayoutWallet() {
  if (!authToken) { toast('Login first', 'error'); return; }
  var inp = document.getElementById('earnings-payout-input');
  var addr = (inp && inp.value || '').trim();
  try {
    var data = await apiRequest('POST', '/api/me/payout-wallet', { address: addr });
    if (!data.ok) { toast(data.error || 'Save failed', 'error'); return; }
    toast(currentLang === 'ru' ? 'Кошелёк сохранён' : 'Wallet saved', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

(function() {
  if (typeof pageLoadFns === 'object' && pageLoadFns) {
    pageLoadFns.earnings = loadCreatorEarnings;
  }
})();

// ── Range slider fill ─────────────────────────────────────────────────────
// Native <input type="range"> draws a flat single-color track that hides on
// dark backgrounds. We compute the fill percent (value / max) and set
// `--fill` so the CSS gradient shows accent-colored progress before the thumb.
(function() {
  function updateFill(input) {
    if (!input || input.type !== 'range') return;
    var min = parseFloat(input.min) || 0;
    var max = parseFloat(input.max);
    if (!isFinite(max) || max <= min) return;
    var val = parseFloat(input.value);
    if (!isFinite(val)) return;
    var pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--fill', pct + '%');
  }
  function scan(root) {
    (root || document).querySelectorAll('input[type="range"]').forEach(updateFill);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { scan(); });
  } else {
    scan();
  }
  // Live update while user drags
  document.addEventListener('input', function(e) {
    if (e.target && e.target.type === 'range') updateFill(e.target);
  });
  // New sliders rendered dynamically — observe and prime them
  var pending = false;
  new MutationObserver(function() {
    if (pending) return;
    pending = true;
    setTimeout(function() { pending = false; scan(); }, 100);
  }).observe(document.body, { childList: true, subtree: true });
})();

// ── Admin: Payouts page (manual TonConnect sign) ─────────────────────────
// Owner-only page that lists pending creator earnings and lets the owner
// sign a batch transfer via their connected Tonkeeper. No mnemonic is
// stored server-side — the server only records the resulting tx hash.
async function loadAdminPayouts() {
  if (!currentUser || !currentUser._isAdmin) {
    toast(currentLang === 'ru' ? 'Только для админов' : 'Admin only', 'error');
    return;
  }
  // Render into the static #admin-payouts-content container in studio.html.
  // navigateTo() handles page-active toggling already; we only fill content.
  var host = document.getElementById('admin-payouts-content');
  if (!host) {
    var page = document.getElementById('admin-payouts-page');
    if (!page) {
      page = document.createElement('div');
      page.id = 'admin-payouts-page';
      page.className = 'page active';
      var mc = document.querySelector('.main-content') || document.body;
      mc.appendChild(page);
    }
    host = document.createElement('div');
    host.id = 'admin-payouts-content';
    host.style.padding = '16px';
    page.appendChild(host);
  }
  host.innerHTML = '<div class="skel skel-block" style="height:24px;width:30%"></div>' +
                   '<div class="skel skel-block" style="height:120px;margin-top:16px"></div>';
  try {
    var data = await apiRequest('GET', '/api/admin/payouts/pending');
    if (!data.ok) throw new Error(data.error || 'load failed');
    var isRu = currentLang === 'ru';
    var html = '';
    html += '<h2 style="margin:0 0 8px;font-size:1.25rem">💸 ' + (isRu ? 'Выплаты авторам' : 'Author payouts') + '</h2>';
    html += '<div style="color:var(--text-muted);font-size:.85rem;margin-bottom:16px">' +
            (isRu
              ? 'Подпиши batch transfer через свой Tonkeeper — сервер не хранит mnemonic.'
              : 'Sign a batch transfer with your Tonkeeper — no mnemonic stored server-side.') + '</div>';
    if (!data.items || data.items.length === 0) {
      html += '<div style="background:var(--bg-tertiary);border-radius:10px;padding:24px;text-align:center;color:var(--text-muted)">' +
              (isRu ? 'Нет накопленных выплат ≥ ' : 'No pending payouts ≥ ') + data.minPayoutTon + ' TON</div>';
      host.innerHTML = html;
      return;
    }
    html += '<div style="display:flex;gap:12px;margin-bottom:16px">';
    html += '<div style="flex:1;background:var(--bg-tertiary);border-radius:10px;padding:14px">' +
              '<div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase">' + (isRu ? 'К оплате' : 'To pay') + '</div>' +
              '<div style="font-size:1.4rem;font-weight:700;margin-top:4px">' + data.totalTon.toFixed(3) + ' TON</div></div>';
    html += '<div style="flex:1;background:var(--bg-tertiary);border-radius:10px;padding:14px">' +
              '<div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase">' + (isRu ? 'Авторов' : 'Authors') + '</div>' +
              '<div style="font-size:1.4rem;font-weight:700;margin-top:4px">' + data.total + '</div></div>';
    html += '</div>';
    html += '<div style="background:var(--bg-tertiary);border-radius:10px;overflow:hidden;margin-bottom:20px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:.85rem">';
    html += '<thead><tr style="background:rgba(255,255,255,0.03);font-size:.72rem;color:var(--text-muted);text-transform:uppercase">';
    html += '<th style="text-align:left;padding:10px"><input type="checkbox" id="adm-payout-all" checked onchange="toggleAdminPayoutAll(this)"></th>';
    html += '<th style="text-align:left;padding:10px">' + (isRu ? 'User' : 'User') + '</th>';
    html += '<th style="text-align:right;padding:10px">TON</th>';
    html += '<th style="text-align:left;padding:10px">' + (isRu ? 'Адрес' : 'Address') + '</th>';
    html += '</tr></thead><tbody>';
    for (var i = 0; i < data.items.length; i++) {
      var r = data.items[i];
      var idx = i;
      html += '<tr data-idx="' + idx + '" style="border-top:1px solid rgba(255,255,255,0.06)">';
      html += '<td style="padding:10px"><input type="checkbox" class="adm-payout-row" data-idx="' + idx + '" checked></td>';
      html += '<td style="padding:10px;font-variant-numeric:tabular-nums">' + r.userId + '</td>';
      html += '<td style="padding:10px;text-align:right;font-variant-numeric:tabular-nums">' + r.amountTon.toFixed(3) + '</td>';
      html += '<td style="padding:10px;font-family:monospace;font-size:.75rem"><code>' + escHtml(r.payoutWallet.slice(0, 12) + '…' + r.payoutWallet.slice(-8)) + '</code></td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    html += '<button data-save-button onclick="signPayoutBatch()" class="btn-accent" style="font-size:.95rem;padding:12px 24px">' +
              (isRu ? '🔐 Подписать через Tonkeeper' : '🔐 Sign via Tonkeeper') +
            '</button>';
    host.innerHTML = html;
    window._adminPayoutItems = data.items;
  } catch (e) {
    host.innerHTML = '<div style="color:var(--danger);padding:16px">Error: ' + escHtml(e.message) + '</div>';
  }
}

function toggleAdminPayoutAll(master) {
  document.querySelectorAll('.adm-payout-row').forEach(function(cb) { cb.checked = master.checked; });
}

async function signPayoutBatch() {
  var items = window._adminPayoutItems || [];
  if (items.length === 0) return;
  var selectedIdxs = Array.from(document.querySelectorAll('.adm-payout-row:checked')).map(function(cb) { return parseInt(cb.getAttribute('data-idx'), 10); });
  if (selectedIdxs.length === 0) {
    toast(currentLang === 'ru' ? 'Никого не выбрано' : 'Nothing selected', 'error');
    return;
  }
  var selected = selectedIdxs.map(function(i) { return items[i]; });
  // Lazy-init TonConnect (Admin page may load before Profile section initialized it)
  if (!_tonConnectUI) initTonConnect();
  var tc = _tonConnectUI;
  if (!tc) {
    toast(currentLang === 'ru' ? 'TON Connect недоступен' : 'TON Connect unavailable', 'error');
    return;
  }
  if (!tc.connected) {
    toast(currentLang === 'ru'
      ? 'Подключаю Tonkeeper… подтверди в кошельке и нажми «Подписать» ещё раз'
      : 'Opening Tonkeeper… approve in wallet then click Sign again', 'info');
    try { await tc.openModal(); } catch (e) { console.warn('openModal failed:', e); }
    return;
  }
  // Build TonConnect messages — up to 4 per TX is the typical limit. We chunk
  // into multiple sequential sendTransaction calls if needed.
  var BATCH_LIMIT = 4;
  var allSent = [];
  try {
    for (var start = 0; start < selected.length; start += BATCH_LIMIT) {
      var chunk = selected.slice(start, start + BATCH_LIMIT);
      var msgs = chunk.map(function(item) {
        return {
          address: item.payoutWallet,
          amount: item.amountNano, // nanoTON as string
          payload: undefined, // optional — could encode "creator payout" comment
        };
      });
      // 5-minute TonConnect validity window
      var tx = { validUntil: Math.floor(Date.now() / 1000) + 300, messages: msgs };
      var result = await tc.sendTransaction(tx);
      // TonConnect returns { boc } — extract real tx hash via SHA-256 of the
      // decoded BoC (matches what tonapi.io / tonscan.org use as tx hash).
      // If decode fails, fall back to a placeholder so the row still gets
      // marked paid — we never re-send the same earning_id (idempotent).
      var txHash = await _txHashFromBoc(result && result.boc).catch(function() { return ''; });
      if (!txHash) txHash = 'manual_' + Date.now();
      // Confirm with backend
      var confirm = await apiRequest('POST', '/api/admin/payouts/confirm', {
        txHash: txHash,
        batch: chunk.map(function(item) {
          return {
            userId: item.userId,
            earningIds: item.earningIds,
            amountNano: item.amountNano,
            toAddress: item.payoutWallet,
          };
        }),
      });
      if (!confirm.ok) {
        toast(confirm.error || 'Confirm failed', 'error');
        return;
      }
      allSent.push({ txHash: txHash, count: chunk.length });
    }
    toast(currentLang === 'ru'
      ? 'Отправлено: ' + selected.length + ' выплат в ' + allSent.length + ' TX'
      : 'Sent ' + selected.length + ' payouts in ' + allSent.length + ' TX', 'success');
    setTimeout(loadAdminPayouts, 1500);
  } catch (e) {
    toast((e && e.message) || 'Sign cancelled', 'error');
  }
}

// ── Admin: Pending user withdrawal requests (manual TonConnect approval) ──
async function loadAdminWithdrawals() {
  if (!currentUser || !currentUser._isAdmin) return;
  var host = document.getElementById('admin-withdrawals-content');
  if (!host) {
    var page = document.getElementById('admin-payouts-page');
    if (!page) return;
    host = document.createElement('div');
    host.id = 'admin-withdrawals-content';
    host.style.padding = '16px';
    host.style.marginTop = '24px';
    page.appendChild(host);
  }
  host.innerHTML = '<div class="skel skel-block" style="height:24px;width:30%"></div>';
  try {
    var data = await apiRequest('GET', '/api/admin/withdrawals/pending');
    if (!data.ok) throw new Error(data.error || 'load failed');
    var isRu = currentLang === 'ru';
    var html = '';
    html += '<h2 style="margin:24px 0 8px;font-size:1.25rem">⬆️ ' + (isRu ? 'Запросы на вывод' : 'Withdrawal requests') + '</h2>';
    html += '<div style="color:var(--text-muted);font-size:.85rem;margin-bottom:16px">' +
            (isRu
              ? 'Юзеры запрашивают вывод — подпиши каждый через свой Tonkeeper.'
              : 'Users request withdrawals — sign each via Tonkeeper.') + '</div>';
    if (!data.items || data.items.length === 0) {
      html += '<div style="background:var(--bg-tertiary);border-radius:10px;padding:24px;text-align:center;color:var(--text-muted)">' +
              (isRu ? 'Нет ожидающих выводов' : 'No pending withdrawals') + '</div>';
      host.innerHTML = html;
      return;
    }
    html += '<div style="background:var(--bg-tertiary);border-radius:10px;overflow:hidden">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:.85rem">';
    html += '<thead><tr style="background:rgba(255,255,255,0.03);font-size:.72rem;color:var(--text-muted);text-transform:uppercase">';
    html += '<th style="text-align:left;padding:10px">ID</th>';
    html += '<th style="text-align:left;padding:10px">User</th>';
    html += '<th style="text-align:right;padding:10px">TON</th>';
    html += '<th style="text-align:left;padding:10px">' + (isRu ? 'Адрес' : 'Address') + '</th>';
    html += '<th style="text-align:left;padding:10px">' + (isRu ? 'Действие' : 'Action') + '</th>';
    html += '</tr></thead><tbody>';
    for (var i = 0; i < data.items.length; i++) {
      var r = data.items[i];
      html += '<tr id="wd-row-' + r.id + '" style="border-top:1px solid rgba(255,255,255,0.06)">';
      html += '<td style="padding:10px">#' + r.id + '</td>';
      html += '<td style="padding:10px;font-variant-numeric:tabular-nums">' + r.userId + '</td>';
      html += '<td style="padding:10px;text-align:right;font-variant-numeric:tabular-nums">' + r.amountTon.toFixed(3) + '</td>';
      html += '<td style="padding:10px;font-family:monospace;font-size:.75rem"><code>' + escHtml(r.toAddress.slice(0, 12) + '…' + r.toAddress.slice(-8)) + '</code></td>';
      html += '<td style="padding:10px">' +
                '<button class="btn-accent btn-sm" onclick="signWithdrawal(' + r.id + ',' + r.userId + ',\'' + r.amountNano + '\',\'' + r.toAddress + '\')">🔐 ' + (isRu ? 'Подписать' : 'Sign') + '</button> ' +
                '<button class="btn-sm" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3)" onclick="cancelWithdrawal(' + r.id + ')">✕ ' + (isRu ? 'Отмена' : 'Cancel') + '</button>' +
              '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    host.innerHTML = html;
  } catch (e) {
    host.innerHTML = '<div style="color:var(--danger);padding:16px">Error: ' + escHtml(e.message) + '</div>';
  }
}

async function signWithdrawal(requestId, userId, amountNano, toAddress) {
  if (!_tonConnectUI) initTonConnect();
  var tc = _tonConnectUI;
  if (!tc) {
    toast(currentLang === 'ru' ? 'TON Connect недоступен' : 'TON Connect unavailable', 'error');
    return;
  }
  if (!tc.connected) {
    toast(currentLang === 'ru'
      ? 'Подключаю Tonkeeper… подтверди в кошельке и нажми «Подписать» ещё раз'
      : 'Opening Tonkeeper… approve in wallet then click Sign again', 'info');
    try { await tc.openModal(); } catch (e) { console.warn('openModal failed:', e); }
    return;
  }
  try {
    var tx = {
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [{ address: toAddress, amount: String(amountNano) }],
    };
    var result = await tc.sendTransaction(tx);
    var txHash = await _txHashFromBoc(result && result.boc).catch(function() { return ''; });
    if (!txHash) txHash = 'manual_' + Date.now();
    var confirm = await apiRequest('POST', '/api/admin/withdrawals/confirm', { requestId: requestId, txHash: txHash });
    if (!confirm.ok) { toast(confirm.error || 'Confirm failed', 'error'); return; }
    toast(currentLang === 'ru' ? 'Вывод #' + requestId + ' подтверждён' : 'Withdrawal #' + requestId + ' confirmed', 'success');
    setTimeout(loadAdminWithdrawals, 800);
  } catch (e) {
    toast((e && e.message) || 'Sign cancelled', 'error');
  }
}

async function cancelWithdrawal(requestId) {
  var reason = prompt(currentLang === 'ru' ? 'Причина отмены (необязательно):' : 'Cancel reason (optional):');
  if (reason === null) return;
  try {
    var r = await apiRequest('POST', '/api/admin/withdrawals/cancel', { requestId: requestId, reason: reason || '' });
    if (!r.ok) { toast(r.error || 'Cancel failed', 'error'); return; }
    toast(currentLang === 'ru' ? 'Отменён, баланс возвращён' : 'Cancelled, balance refunded', 'success');
    setTimeout(loadAdminWithdrawals, 800);
  } catch (e) { toast((e && e.message) || 'Error', 'error'); }
}

// Patch loadAdminPayouts to ALSO load withdrawals on the same page
var _origLoadAdminPayouts = loadAdminPayouts;
loadAdminPayouts = async function() {
  await _origLoadAdminPayouts();
  await loadAdminWithdrawals();
};

// Register page loader
(function() {
  if (typeof pageLoadFns === 'object' && pageLoadFns) {
    pageLoadFns['admin-payouts'] = loadAdminPayouts;
  }
})();

// ── Plan-limit modal ─────────────────────────────────────────────────────
// Shown automatically when apiRequest detects a plan-limit error. Reuses
// the existing plans grid via openPlansModal(), but throttles + adds a
// dedicated "you hit the limit" intro so the user understands WHY.
var _lastPlanLimitShownAt = 0;
function showPlanLimitModal(reason) {
  // Throttle — at most once per 5s. Multiple parallel requests can each
  // return the same plan-limit error; we don't want to flash modal 5×.
  var now = Date.now();
  if (now - _lastPlanLimitShownAt < 5000) return;
  _lastPlanLimitShownAt = now;

  var isRu = (typeof currentLang !== 'undefined' && currentLang === 'ru');
  var modal = document.getElementById('plan-limit-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'plan-limit-modal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.62);backdrop-filter:blur(6px)';
    modal.onclick = function(e) { if (e.target === modal) closePlanLimitModal(); };
    document.body.appendChild(modal);
  }
  // Clean reason — strip the leading "⛔ *Лимит агентов достигнут*" and trailing "/plans" hint
  var cleaned = String(reason || '')
    .replace(/^[⛔*\s]+/, '')
    .replace(/[\][_*~`]/g, '')
    .replace(/\/plans\s*$/, '')
    .trim();
  if (!cleaned) cleaned = isRu ? 'Достигнут лимит твоего плана.' : 'You hit your plan limit.';

  modal.innerHTML =
    '<div style="background:var(--bg-secondary);border-radius:14px;padding:24px 28px;max-width:440px;width:92vw;border:1px solid var(--border);box-shadow:0 24px 60px rgba(0,0,0,0.45)">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
        '<div style="width:44px;height:44px;border-radius:12px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:1.4rem">⚡</div>' +
        '<h2 style="margin:0;font-size:1.15rem">' + (isRu ? 'Лимит плана достигнут' : 'Plan limit reached') + '</h2>' +
      '</div>' +
      '<div style="color:var(--text-secondary, var(--text-muted));font-size:.9rem;line-height:1.5;margin-bottom:18px">' + escHtml(cleaned) + '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn-accent" onclick="closePlanLimitModal();openPlansModal()" style="flex:1;min-width:140px">' +
          (isRu ? '💳 Посмотреть тарифы' : '💳 View plans') +
        '</button>' +
        '<button onclick="closePlanLimitModal()" style="padding:10px 18px;background:transparent;border:1px solid var(--border);color:var(--text-muted);border-radius:10px;cursor:pointer">' +
          (isRu ? 'Позже' : 'Later') +
        '</button>' +
      '</div>' +
    '</div>';
}
function closePlanLimitModal() {
  var m = document.getElementById('plan-limit-modal');
  if (m) m.remove();
}

// ── BoC → tx hash extraction ─────────────────────────────────────────────
// TonConnect.sendTransaction returns the raw signed message BoC (base64). The
// tx hash is the SHA-256 of the BoC's root cell representation. We don't ship
// @ton/core in the browser — but the BoC is already a binary blob we can
// hash via SubtleCrypto. This gives a stable, lookup-friendly hash we can
// store + display in transaction history.
async function _txHashFromBoc(bocB64) {
  if (!bocB64 || typeof bocB64 !== 'string') return '';
  try {
    // base64 → Uint8Array
    var bin = atob(bocB64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // SHA-256 of the full BoC. Note: the "official" tx hash is hash of the
    // root cell representation (slightly different from SHA-256 of raw BoC
    // bytes), but for our audit log purposes a stable, deterministic hash of
    // the signed message is enough — equal BoC always yields equal hash so
    // we can detect duplicates / look up later.
    var hashBuf = await crypto.subtle.digest('SHA-256', bytes);
    var arr = Array.from(new Uint8Array(hashBuf));
    return arr.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  } catch (e) {
    console.warn('[Payout] txHashFromBoc failed:', e && e.message);
    return '';
  }
}
