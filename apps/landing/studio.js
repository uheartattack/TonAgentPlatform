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
  infinity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/></svg>',
  eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  book: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  heartbeat: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  target: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  split: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="M15 9l6-6"/></svg>',
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
    if (!ct.includes('application/json')) {
      const text = await res.text();
      console.error('API returned non-JSON:', res.status, text.slice(0, 200));
      return { ok: false, error: 'Server returned non-JSON response (status ' + res.status + ')' };
    }
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
  _agentsCache = agents;
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

async function openAgentDetail(agentId, skipSettings) {
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
    // Open full-screen settings directly (unless called from settings close refresh)
    if (!skipSettings) {
      closeAgentDetail();
      openAgentSettings();
    }
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
  setTimeout(function() { panel.style.display = 'none'; panel.classList.remove('closing'); }, 400);
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
  body.innerHTML =
    '<div class="agent-detail-section">' +
    '<div class="agent-detail-section-title">Chat with Agent #' + agentId + '</div>' +
    '<div id="agent-chat-messages" style="max-height:400px;overflow-y:auto;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:10px;min-height:100px">' +
    '<div style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:20px">' + (currentLang === 'ru' ? 'Отправьте сообщение агенту...' : 'Send a message to the agent...') + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
    '<input type="text" id="agent-chat-input" placeholder="' + (currentLang === 'ru' ? 'Сообщение агенту...' : 'Message to agent...') + '" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text-primary);font-size:.85rem" onkeydown="if(event.key===\'Enter\')sendAgentChatMsg()">' +
    '<button class="btn btn-primary btn-sm" onclick="sendAgentChatMsg()">' + (currentLang === 'ru' ? 'Отправить' : 'Send') + '</button>' +
    '</div>' +
    '<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="openAgentDetail(_detailAgentId)">' + (currentLang === 'ru' ? 'Назад' : 'Back') + '</button>' +
    '</div>';
  setTimeout(function() { var el = document.getElementById('agent-chat-input'); if (el) el.focus(); }, 100);
}

async function sendAgentChatMsg() {
  var input = document.getElementById('agent-chat-input');
  var msgBox = document.getElementById('agent-chat-messages');
  if (!input || !msgBox || !_agentChatId) return;
  var msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  _agentChatHistory.push({ role: 'user', text: msg });
  renderAgentChat(msgBox);
  try {
    var data = await apiRequest('POST', '/api/agents/' + _agentChatId + '/chat', { message: msg });
    _agentChatHistory.push(data.ok
      ? { role: 'agent', text: data.response || data.message || (currentLang === 'ru' ? 'Сообщение отправлено' : 'Message sent') }
      : { role: 'error', text: data.error || 'Error' });
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
}

function closeAgentSettings() {
  var modal = document.getElementById('agent-settings-modal');
  if (!modal) return;
  modal.classList.add('closing');
  setTimeout(function() {
    modal.style.display = 'none';
    modal.classList.remove('closing');
  }, 400);
  // Refresh detail data without reopening settings
  if (_detailAgentId) openAgentDetail(_detailAgentId, true);
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
        '<div class="rt-header-icon" style="background:rgba(168,85,247,0.12);color:#a855f7">' + IC.brain + '</div>' +
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
      '</div>' +
      '</div>';
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
          ' <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ' + (isRu ? 'Только чтение' : 'Read-only') + '</span>' +
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
          '<div class="st-meta-val">' + (a.role || 'worker') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="rt-actions">' +
        '<button class="rt-save-btn" onclick="saveSettingsInfo()">' + IC.check + ' ' + (isRu ? 'Сохранить' : 'Save') + '</button>' +
      '</div>' +
      '</div>';
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
          '<input type="text" id="ai-utility-model-input" class="rt-input" value="' + escHtml((config.config && config.config.AI_UTILITY_MODEL) || '') + '" placeholder="' + (isRu ? 'auto' : 'auto') + '">' +
          '<div class="rt-input-hint">' + (isRu ? 'Лёгкая модель для суммаризации и vision. Оставьте пустым для авто-выбора.' : 'Lightweight model for summarization and vision. Leave empty for auto.') + '</div>' +
        '</div>' +
      '</div>' +

      // API Key
      '<div class="rt-section">' +
        '<div class="rt-section-label">' + IC.link + ' API Key</div>' +
        '<div class="rt-input-wrap">' +
          '<input type="password" id="ai-key-input" class="rt-input" placeholder="' + (hasKey ? '••••••••••••' : (currentProv ? currentProv.keyPrefix : 'API key')) + '">' +
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
      { id: 'blockchain', name: 'Blockchain', icon: IC.link, color: '#0098ea',
        desc: isRu ? 'Чтение данных блокчейна TON. Транзакции, контракты, адреса' : 'Read TON blockchain data. Transactions, contracts, addresses',
        tools: ['get_account_info'] },
      { id: 'ton_mcp', name: 'TON MCP', icon: IC.link, color: '#0098ea',
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
    var agentColor = (config.config && config.config.agentColor) || '#0098EA';
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
        effect: currentLang === 'ru' ? 'Управляет людьми и агентами. Получает assign_task, manage_agent, send_report, check_tasks.' : 'Manages people and agents. Gets assign_task, manage_agent, send_report, check_tasks.' },
    ];
    var isRu = currentLang === 'ru';
    var colorSwatches = ['#0098EA', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#64748b'];
    body.innerHTML =
      '<div class="rt-page">' +
      '<div class="rt-header">' +
        '<div class="rt-header-icon" style="background:rgba(168,85,247,0.12);color:#a855f7">' + IC.crown + '</div>' +
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
            '<div class="rt-toggle-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>' +
            '<div class="rt-toggle-name">' + (isRu ? 'Личные' : 'DM') + '</div>' +
            '<div class="rt-toggle-desc">' + (isRu ? 'Приватные чаты' : 'Private chats') + '</div>' +
          '</label>' +
          '<label class="rt-toggle-card' + (chatTypes.includes('group') ? ' rt-active' : '') + '" onclick="this.classList.toggle(\'rt-active\');this.querySelector(\'input\').checked=this.classList.contains(\'rt-active\')">' +
            '<input type="checkbox" id="routing-group"' + (chatTypes.includes('group') ? ' checked' : '') + ' style="display:none">' +
            '<div class="rt-toggle-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>' +
            '<div class="rt-toggle-name">' + (isRu ? 'Группы' : 'Groups') + '</div>' +
            '<div class="rt-toggle-desc">' + (isRu ? 'Групповые чаты' : 'Group chats') + '</div>' +
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
              '<div class="bh-toggle-name">' + (isRu ? 'Read Receipts' : 'Read Receipts') + '</div>' +
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
            '<div class="bh-toggle-icon" style="background:rgba(168,85,247,0.12);color:#a855f7">' + IC.split + '</div>' +
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
            '<div class="bh-toggle-icon" style="background:rgba(99,102,241,0.12);color:#6366f1">' + IC.moon + '</div>' +
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
            '<div class="bh-toggle-icon" style="background:rgba(168,85,247,0.12);color:#a855f7">' + IC.shuffle + '</div>' +
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
  } else if (tab === 'audit') {
    body.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted)">' + (currentLang === 'ru' ? 'Загрузка аудита...' : 'Loading audit...') + '</div>';
    runSettingsAudit(body);
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
            '<div class="rt-toggle-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>' +
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
        '<div class="rt-section-label">' + IC.bolt + ' ' + (isRu ? 'Действия' : 'Actions') + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="rt-save-btn" style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)" onclick="cloneAgentFromSettings()">' + IC.clipboard + ' ' + (isRu ? 'Клонировать агента' : 'Clone Agent') + '</button>' +
          '<button class="rt-save-btn" style="background:linear-gradient(135deg,#0ea5e9 0%,#06b6d4 100%)" onclick="exportAgentJSON()">' + IC.download + ' ' + (isRu ? 'Экспорт JSON' : 'Export JSON') + '</button>' +
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

    await apiRequest('POST', '/api/agents/' + _detailAgentId + '/config', {
      daily_spend_limit_ton: spendLimit,
      tick_interval_sec: tickInterval,
      agent_language: agentLang,
    });
    toast(currentLang === 'ru' ? 'Настройки сохранены' : 'Settings saved', 'success');
    // Refresh agent data
    if (_detailAgentId) openAgentDetail(_detailAgentId, true);
  } catch (e) {
    toast('Error: ' + (e.message || e), 'error');
  }
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
    navigateTo('my-agents');
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
      return;
    }
    var res = await apiRequest('POST', '/api/agents', {
      name: data.name + ' (imported)',
      description: data.description || '',
      triggerType: data.triggerType || 'ai_agent',
      code: data.code,
      triggerConfig: data.triggerConfig || {},
    });
    toast(isRu ? 'Агент импортирован!' : 'Agent imported!', 'success');
    navigateTo('my-agents');
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
    var confirmed = confirm(
      (isRu ? 'Импорт агента:\n\n' : 'Import agent:\n\n') +
      (isRu ? 'Имя: ' : 'Name: ') + data.name + '\n' +
      (isRu ? 'Тип: ' : 'Type: ') + triggerType + '\n' +
      (isRu ? 'Описание: ' : 'Desc: ') + (data.description || '—') + '\n\n' +
      (isRu ? 'Промпт (превью):\n' : 'Prompt (preview):\n') + promptPreview + '\n\n' +
      (isRu ? 'Создать агента?' : 'Create agent?')
    );
    if (!confirmed) { input.value = ''; return; }
    var res = await apiRequest('POST', '/api/agents', {
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
        '<button class="rt-save-btn" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);box-shadow:0 4px 16px rgba(239,68,68,0.3)" onclick="disconnectAgentTelegram(' + agentId + ')">' +
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
  var utilityModel = (document.getElementById('ai-utility-model-input') || {}).value || '';
  utilityModel = utilityModel.trim();
  var payload = {};
  if (provider) payload.provider = provider;
  if (model) payload.model = model;
  if (apiKey) payload.apiKey = apiKey;
  if (utilityModel) payload.utilityModel = utilityModel;
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/provider', payload);
  if (data.ok) toast(currentLang === 'ru' ? 'AI настройки обновлены' : 'AI settings updated', 'success');
  else toast(data.error || 'Error', 'error');
}

async function saveSettingsCaps() {
  if (!_detailAgentId) return;
  var caps = Array.from(document.querySelectorAll('.st-cap-active')).map(function(el) { return el.getAttribute('data-cap'); });
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/capabilities', { capabilities: caps });
  if (data.ok) toast(currentLang === 'ru' ? 'Возможности обновлены' : 'Capabilities updated', 'success');
  else toast(data.error || 'Error', 'error');
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
  var agentColor = (document.getElementById('agent-color-picker') || {}).value || '#0098EA';
  var payload = {
    customRole: { name: roleName.trim(), description: roleDesc.trim() },
    agentColor: agentColor
  };
  var data = await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/wizard', payload);
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
    // Also update via wizard for backwards compat
    await apiRequest('PUT', '/api/agents/' + _detailAgentId + '/wizard', payload);
  } else {
    toast((data && data.error) || 'Error saving routing', 'error');
  }
  if (btn) { btn.disabled = false; btn.innerHTML = IC.check + ' ' + (currentLang === 'ru' ? 'Сохранить правила' : 'Save Rules'); }
}

var _agentChatHistory = [];

async function sendAgentChatMessage() {
  var input = document.getElementById('agent-chat-input');
  if (!input || !input.value.trim()) return;
  var text = input.value.trim();
  input.value = '';

  _agentChatHistory.push({ role: 'user', text: text, time: new Date() });
  renderAgentChat();

  try {
    var data = await apiRequest('POST', '/api/agents/' + _detailAgentId + '/chat', { message: text });
    if (data.response) {
      _agentChatHistory.push({ role: 'agent', text: data.response, time: new Date() });
    } else if (data.error) {
      _agentChatHistory.push({ role: 'system', text: 'Error: ' + data.error, time: new Date() });
    }
  } catch (e) {
    _agentChatHistory.push({ role: 'system', text: 'Network error', time: new Date() });
  }
  renderAgentChat();
}

function renderAgentChat() {
  var container = document.getElementById('agent-chat-messages');
  if (!container) return;
  if (_agentChatHistory.length === 0) {
    var isRu = currentLang === 'ru';
    container.innerHTML = '<div class="st-chat-empty">' + IC.chat + '<span>' + (isRu ? 'Начните диалог с агентом...' : 'Start a conversation with the agent...') + '</span></div>';
    return;
  }
  container.innerHTML = _agentChatHistory.map(function(m) {
    var cls = m.role === 'user' ? 'chat-msg-user' : (m.role === 'agent' ? 'chat-msg-agent' : 'chat-msg-system');
    return '<div class="chat-msg ' + cls + '">' + escHtml(m.text) + '</div>';
  }).join('');
  container.scrollTop = container.scrollHeight;
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
      data.passed.forEach(function(p) { html += '<div style="padding:6px 0;font-size:.85rem;color:#4ade80">✓ ' + escHtml(p) + '</div>'; });
    }
    if (data.issues && data.issues.length) {
      data.issues.forEach(function(i) { html += '<div style="padding:6px 0;font-size:.85rem;color:#f59e0b">⚠ ' + escHtml(i) + '</div>'; });
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
      '<span class="agent-role-badge role-' + role + '">' + role + '</span>' +
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

  // "or via bot" fallback link
  var alt = document.createElement('div');
  alt.style.cssText = 'margin-top:6px;text-align:center';
  alt.innerHTML = '<span style="color:var(--text-muted);font-size:.72rem;cursor:pointer;opacity:.6" onclick="showBotAuthButton()">' +
    (currentLang === 'ru' ? 'или через бота' : 'or via bot') + '</span>';
  holder.appendChild(alt);

  // Load Telegram Login SDK
  if (!document.querySelector('script[src*="telegram-login.js"]')) {
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://oauth.telegram.org/js/telegram-login.js?3';
    document.head.appendChild(script);
  }
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
    if (data.planId) currentUser._plan = { planId: data.planId, planName: data.planName, planIcon: data.planIcon };
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
  assistant:   () => loadAssistantPage(),
  guide:       () => Promise.resolve(),
  wallets:     () => loadWalletsPage(),
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
  var modeLabels = { active: '🟢 Active', open: '🔵 Open', 'mention-only': '🟡 Mention', disabled: '🔴 Off' };
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
  if (pageEl) {
    pageEl.style.animation = 'none';
    pageEl.offsetHeight; // force reflow to retrigger animation
    pageEl.style.animation = '';
    pageEl.classList.add('active');
  }

  if (authToken && pageLoadFns[pageName]) {
    var _result = pageLoadFns[pageName]();
    if (_result && typeof _result.catch === 'function') _result.catch(console.error);
  }

  // Refresh subscription data on profile/overview navigation
  if (authToken && (pageName === 'profile' || pageName === 'overview')) {
    loadSubscriptionGlobal();
  }

  // Track getting-started steps
  if (pageName === 'settings') markGSStep('ai');
  if (pageName === 'marketplace') markGSStep('marketplace');
  if (pageName === 'guide') markGSStep('guide');
}

// ===== ANALYTICS PAGE =====
let _analyticsLeaderboardSort = 'executions'; // 'executions' | 'success' | 'avgtime'

async function loadAnalytics() {
  const [statsData, exData, agentsData] = await Promise.all([
    apiRequest('GET', '/api/stats/me'),
    apiRequest('GET', '/api/executions?limit=500'),
    apiRequest('GET', '/api/agents'),
  ]);

  // Fill stat cards
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  if (statsData.ok) {
    setEl('an-total-runs', statsData.totalRuns ?? '—');
    setEl('an-success-rate', (statsData.successRate != null ? statsData.successRate + '%' : '—'));
    setEl('an-last24h', statsData.last24hRuns ?? '—');
    setEl('an-active-agents', statsData.agentsActive ?? '—');
  }

  const execs = (exData.ok && exData.executions) || [];
  const agents = (agentsData.ok && agentsData.agents) || [];

  // --- Bar chart: Executions over last 7 days ---
  drawBarChart(execs);

  // --- Donut chart: Success rate ---
  drawDonutChart(execs);

  // --- Agent leaderboard ---
  renderLeaderboard(execs, agents);

  // --- Execution history table ---
  const tableEl = document.getElementById('analytics-executions-table');
  if (!tableEl) return;
  if (!execs.length) {
    tableEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">' + t('no_executions') + '</div>';
    return;
  }

  const statusIcon = s => s === 'success' ? IC.check : s === 'running' ? IC.refresh : s === 'failed' ? IC.x : IC.hourglass;
  tableEl.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:.85rem">' +
    '<thead><tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">' +
    '<th style="text-align:left;padding:.6rem 1rem">Agent</th>' +
    '<th style="text-align:left;padding:.6rem .5rem">Status</th>' +
    '<th style="text-align:left;padding:.6rem .5rem">Duration</th>' +
    '<th style="text-align:left;padding:.6rem .5rem">Time</th>' +
    '</tr></thead><tbody>' +
    execs.slice(0, 50).map(function(ex) {
      return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
        '<td style="padding:.5rem 1rem;font-weight:500">#' + ex.agentId + '</td>' +
        '<td style="padding:.5rem .5rem">' + statusIcon(ex.status) + ' ' + ex.status + '</td>' +
        '<td style="padding:.5rem .5rem">' + (ex.durationMs ? (ex.durationMs / 1000).toFixed(1) + 's' : '—') + '</td>' +
        '<td style="padding:.5rem .5rem;color:var(--text-muted)">' + new Date(ex.startedAt || ex.createdAt).toLocaleString() + '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
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
  var colors = { success: '#2dcc70', failed: '#e74c3c', other: '#0098EA' };
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
    { label: currentLang === 'ru' ? 'Прочее' : 'Other', val: counts.other, color: '#0098EA' }
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

  if (!execs.length) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">' + t('no_executions') + '</div>';
    return;
  }

  // Build per-agent stats
  var agentMap = {};
  agents.forEach(function(a) {
    agentMap[a.id] = a.name || ('Agent #' + a.id);
  });

  var statsMap = {};
  execs.forEach(function(ex) {
    var aid = ex.agentId;
    if (!statsMap[aid]) statsMap[aid] = { id: aid, name: agentMap[aid] || ('#' + aid), total: 0, success: 0, failed: 0, totalDuration: 0, durCount: 0 };
    var s = statsMap[aid];
    s.total++;
    if (ex.status === 'success') s.success++;
    if (ex.status === 'failed') s.failed++;
    if (ex.durationMs) { s.totalDuration += ex.durationMs; s.durCount++; }
  });

  var rows = Object.values(statsMap);

  // Sort
  var sortKey = _analyticsLeaderboardSort;
  if (sortKey === 'success') {
    rows.sort(function(a, b) { return (b.total ? b.success / b.total : 0) - (a.total ? a.success / a.total : 0); });
  } else if (sortKey === 'avgtime') {
    rows.sort(function(a, b) { return (a.durCount ? a.totalDuration / a.durCount : 9e9) - (b.durCount ? b.totalDuration / b.durCount : 9e9); });
  } else {
    rows.sort(function(a, b) { return b.total - a.total; });
  }

  var maxTotal = rows.length ? rows[0].total : 1;
  if (sortKey !== 'executions') maxTotal = rows.reduce(function(m, r) { return Math.max(m, r.total); }, 1);

  var isRu = currentLang === 'ru';
  var tabs = [
    { key: 'executions', label: isRu ? 'По запускам' : 'By Executions' },
    { key: 'success', label: isRu ? 'По успешности' : 'By Success Rate' },
    { key: 'avgtime', label: isRu ? 'По скорости' : 'By Avg Time' }
  ];

  var html = '<div class="leaderboard-tabs">';
  tabs.forEach(function(tab) {
    html += '<button class="leaderboard-tab' + (tab.key === sortKey ? ' active' : '') + '" onclick="_analyticsLeaderboardSort=\'' + tab.key + '\';loadAnalytics()">' + tab.label + '</button>';
  });
  html += '</div>';

  html += '<table class="leaderboard-table"><thead><tr>';
  html += '<th>#</th>';
  html += '<th>' + (isRu ? 'Агент' : 'Agent') + '</th>';
  html += '<th>' + (isRu ? 'Запуски' : 'Runs') + '</th>';
  html += '<th>' + (isRu ? 'Успех' : 'Success') + '</th>';
  html += '<th>' + (isRu ? 'Ср. время' : 'Avg Time') + '</th>';
  html += '</tr></thead><tbody>';

  rows.slice(0, 10).forEach(function(r, i) {
    var rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    var successPct = r.total ? Math.round((r.success / r.total) * 100) : 0;
    var avgTime = r.durCount ? (r.totalDuration / r.durCount / 1000).toFixed(1) + 's' : '—';
    var barPct = Math.round((r.total / maxTotal) * 100);
    var barColor = successPct >= 80 ? '#2dcc70' : successPct >= 50 ? '#f5a623' : '#e74c3c';

    html += '<tr>';
    html += '<td><span class="leaderboard-rank ' + rankClass + '">' + (i + 1) + '</span></td>';
    html += '<td style="font-weight:500">' + escHtml(r.name) + '</td>';
    html += '<td>' + r.total + '<span class="leaderboard-bar-bg"><span class="leaderboard-bar-fill" style="width:' + barPct + '%;background:var(--primary)"></span></span></td>';
    html += '<td><span style="color:' + barColor + '">' + successPct + '%</span> <span style="color:var(--text-muted);font-size:.75rem">(' + r.success + '/' + r.total + ')</span></td>';
    html += '<td style="font-family:\'JetBrains Mono\',monospace;font-size:.8rem">' + avgTime + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  el.innerHTML = html;
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
  html += '<span>' + IC.book + ' ' + (ru ? 'Инструкция' : 'Guide') + '</span>';
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
      d.caps.map(function(c) { return '<span style="background:rgba(125,211,252,0.12);color:#7dd3fc;padding:3px 10px;border-radius:12px;font-size:12px">' + escHtml(c) + '</span>'; }).join('') +
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
      showFlowToast('🎉 ' + t('deployed_ok') + ' #' + data.agentId, 'success');
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

  const data = await apiRequest('GET', '/api/agents');
  const agents = (data.ok ? data.agents : []) || [];

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
  var roleColors = { director: '#ffd700', manager: '#a855f7', specialist: '#10b981', monitor: '#f59e0b', worker: '#0098EA' };
  var roleLabels = { director: 'DIR', manager: 'MGR', specialist: 'SPEC', monitor: 'MON', worker: 'WRK' };

  _networkNodes = agents.map(function(a, i) {
    var role = a.role || 'worker';
    var level = a.level || 1;
    var radius = role === 'director' ? 30 + level : role === 'manager' ? 24 + level : role === 'specialist' ? 22 + level : role === 'monitor' ? 20 + level : 18 + Math.min(level, 5);
    var trigCfg = {}; try { var _t2 = a.trigger_config || a.triggerConfig || {}; trigCfg = typeof _t2 === 'string' ? JSON.parse(_t2) : _t2; } catch(e) {}
    var customColor = (trigCfg.config && trigCfg.config.agentColor) || '';
    var color = !a.isActive ? '#555' : (customColor || roleColors[role] || '#0098EA');
    var customRoleName = (trigCfg.config && trigCfg.config.customRole && trigCfg.config.customRole.name) || '';
    var roleLabel = customRoleName || roleLabels[role] || role.toUpperCase().slice(0, 4);
    var angle = (i / agents.length) * Math.PI * 2;
    var spread = Math.min(W, H) * 0.28;
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

  // Build edges
  var edges = [];
  var directors = _networkNodes.filter(function(n) { return n.role === 'director'; });
  var managers = _networkNodes.filter(function(n) { return n.role === 'manager'; });
  var workers = _networkNodes.filter(function(n) { return n.role === 'worker'; });

  directors.forEach(function(d) {
    _networkNodes.forEach(function(n) {
      if (n.id !== d.id) edges.push({ from: d, to: n });
    });
  });
  managers.forEach(function(m) {
    workers.forEach(function(w) { edges.push({ from: m, to: w }); });
  });
  if (!directors.length && !managers.length && _networkNodes.length > 1) {
    for (var i = 0; i < _networkNodes.length - 1; i++) {
      edges.push({ from: _networkNodes[i], to: _networkNodes[i + 1] });
    }
    // Close the loop for visual interest
    if (_networkNodes.length > 2) {
      edges.push({ from: _networkNodes[_networkNodes.length - 1], to: _networkNodes[0] });
    }
  }
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
    aurora.addColorStop(0, 'rgba(0,152,234,0.04)');
    aurora.addColorStop(0.4, 'rgba(168,85,247,0.02)');
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
      var alpha = matchesSearch ? 1.0 : 0.12;

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

      // Outer glow (large soft)
      var glow = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, r * 2.5);
      glow.addColorStop(0, n.color + '25');
      glow.addColorStop(1, n.color + '00');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Main node circle with gradient fill
      var nodeFill = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
      nodeFill.addColorStop(0, n.color + '50');
      nodeFill.addColorStop(0.7, n.color + '20');
      nodeFill.addColorStop(1, n.color + '10');
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeFill;
      ctx.fill();

      // Border
      ctx.strokeStyle = n.color + (matchesSearch && _networkSearchQuery ? 'ee' : 'aa');
      ctx.lineWidth = matchesSearch && _networkSearchQuery ? 2.5 : 1.8;
      ctx.stroke();

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

  // Default wizard steps
  _wizardSteps = [
    { group: 'ai', title: isRu ? 'AI провайдер' : 'AI Provider', fields: [
      { id: 'AI_PROVIDER', type: 'select', label: isRu ? 'Провайдер' : 'Provider', desc: isRu ? 'Выберите AI модель для агента' : 'Choose AI model for the agent',
        options: [{v:'openai',l:'OpenAI'},{v:'anthropic',l:'Anthropic'},{v:'gemini',l:'Google Gemini'},{v:'groq',l:'Groq'},{v:'deepseek',l:'DeepSeek'},{v:'openrouter',l:'OpenRouter'},{v:'together',l:'Together AI'}] },
      { id: 'AI_API_KEY', type: 'password', label: isRu ? 'API ключ' : 'API Key', desc: isRu ? 'Ваш API ключ провайдера' : 'Your provider API key', required: false }
    ]},
    { group: 'capabilities', title: isRu ? 'Возможности' : 'Capabilities', fields: [
      { id: 'caps', type: 'caps', label: isRu ? 'Выберите возможности' : 'Select capabilities', desc: isRu ? 'Какие инструменты нужны вашему агенту?' : 'What tools does your agent need?' }
    ]},
    { group: 'schedule', title: isRu ? 'Расписание' : 'Schedule', fields: [
      { id: 'intervalMs', type: 'select', label: isRu ? 'Интервал запуска' : 'Run Interval', desc: isRu ? 'Как часто агент должен выполняться автоматически' : 'How often should the agent run automatically',
        options: [{v:'0',l:isRu?'Только вручную':'Manual only'},{v:'60000',l:'1 min'},{v:'300000',l:'5 min'},{v:'900000',l:'15 min'},{v:'1800000',l:'30 min'},{v:'3600000',l:'1 hour'},{v:'21600000',l:'6 hours'},{v:'86400000',l:'24 hours'}] }
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
      var quickCaps = [
        {id:'wallet',icon:IC.dollar,name:'Wallet'}, {id:'nft',icon:IC.image,name:'NFT'}, {id:'gifts_market',icon:IC.trending,name:'Gifts Market'},
        {id:'web',icon:IC.globe,name:'Web'}, {id:'defi',icon:IC.shuffle,name:'DeFi'}, {id:'telegram',icon:IC.send,name:'Telegram'},
        {id:'notify',icon:IC.bell,name:'Notify'}, {id:'state',icon:IC.box,name:'State'}
      ];
      html += '<div class="settings-field"><label>' + f.label + '</label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
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
  // Collect all values
  var config = {};
  var providerEl = document.getElementById('wizard-AI_PROVIDER');
  if (providerEl) config.AI_PROVIDER = providerEl.value;
  var keyEl = document.getElementById('wizard-AI_API_KEY');
  if (keyEl && keyEl.value.trim()) config.AI_API_KEY = keyEl.value.trim();
  var intervalEl = document.getElementById('wizard-intervalMs');
  if (intervalEl && intervalEl.value !== '0') config.intervalMs = parseInt(intervalEl.value);
  // Capabilities
  var caps = [];
  document.querySelectorAll('.wizard-cap-check:checked').forEach(function(cb) { caps.push(cb.value); });
  if (caps.length) config.enabledCapabilities = caps;

  try {
    if (Object.keys(config).length > 0) {
      await apiRequest('PUT', '/api/agents/' + _wizardAgentId + '/wizard', { config: config });
    }
  } catch(e) { /* silent - best effort */ }

  closeWizard();
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
      container.innerHTML = '<div class="assistant-welcome"><div class="assistant-welcome-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>' +
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
    .replace(/\[\[page:(\w+)\|([^\]]+)\]\]/g, '<a href="#" class="assistant-nav-link" onclick="navigateTo(\'$1\');return false" style="color:#7dd3fc;text-decoration:underline;cursor:pointer">$2</a>')
    // Standard markdown links: [text](url) → external links (only http/https)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)"']+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc;text-decoration:underline">$1</a>')
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
  typing.innerHTML = '<div class="assistant-msg-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="assistant-msg-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  var sendBtn = document.getElementById('assistant-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    var data;
    if (_assistantTarget !== 'atlas' && _assistantTarget.startsWith('agent_')) {
      var agentId = _assistantTarget.replace('agent_', '');
      data = await apiRequest('POST', '/api/agents/' + agentId + '/chat', { message: text });
    } else {
      data = await apiRequest('POST', '/api/chat', { message: text, context: getStudioContext() });
    }
    var typingEl = document.getElementById('assistant-typing');
    if (typingEl) typingEl.remove();

    if (data.ok && data.result) {
      var r = data.result;
      appendAssistantMsg('assistant', r.content || r.response || r, r.buttons);
      if (r.type === 'agent_created') {
        loadAgents();
        toast(currentLang === 'ru' ? 'Агент создан!' : 'Agent created!', 'success');
        if (r.agentId) {
          showWizard(r.agentId, r.agentName || '');
        } else {
          navigateTo('agents');
        }
      }
    } else if (data.ok && data.response) {
      appendAssistantMsg('assistant', data.response);
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
        if (data.result.agentId) {
          showWizard(data.result.agentId, data.result.agentName || '');
        } else {
          navigateTo('agents');
        }
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
var _onboardingStep = 0;
var _onboardingTotal = 4;
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
  // personalize subtitle
  var subtitle = document.getElementById('onboarding-subtitle');
  if (subtitle) {
    var name = currentUser.first_name || currentUser.username || '';
    if (name) {
      subtitle.textContent = currentLang === 'ru'
        ? name + ', добро пожаловать! Создавайте автономных AI-агентов, которые работают в Telegram и взаимодействуют с блокчейном TON — без кода.'
        : name + ', welcome! Build autonomous AI agents that live inside Telegram and work with the TON blockchain — no coding required.';
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
  var radios = el.closest('.onboarding-providers').querySelectorAll('.onboarding-provider-radio');
  radios.forEach(function(r) { r.classList.remove('selected'); });
  el.querySelector('.onboarding-provider-radio').classList.add('selected');
}

function onboardingAction(action) {
  dismissOnboarding();
  if (action === 'chat') navigateTo('assistant');
  else if (action === 'constructor') navigateTo('agents');
  else if (action === 'marketplace') navigateTo('marketplace');
  else if (action === 'guide') navigateTo('guide');
  else if (action === 'telegram') window.open('https://t.me/TonAgentPlatformBot', '_blank');
}

function finishOnboarding() {
  dismissOnboarding();
  // If user selected a non-platform provider, navigate to settings so they can add key
  if (_onboardingProvider && _onboardingProvider !== 'platform') {
    navigateTo('settings');
  }
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
  var roleBadgeColor = node.color || '#0098EA';
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
  indicator.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:12px;font-size:11px;color:#999;background:var(--bg-card,#1a1a2e);border:1px solid var(--border,#2a2a3e);opacity:0.7;transition:opacity 0.3s';
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
      '<div style="font-size:1.4rem;font-weight:700;color:' + s.color + ';font-family:\'JetBrains Mono\',monospace">' + s.value + '</div></div>';
  }).join('');
}

function awRenderRoot() {
  var el = document.getElementById('aw-root-section');
  if (!el) return;
  var isRu = currentLang === 'ru';
  var root = _awData.find(function(w) { return w.walletType === 'root'; });
  if (!root) {
    el.innerHTML = '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;padding:40px 32px;text-align:center">' +
      '<div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(168,85,247,0.15));display:flex;align-items:center;justify-content:center;margin:0 auto 16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg></div>' +
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
      '<div style="width:48px;height:48px;border-radius:14px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg></div>' +
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
