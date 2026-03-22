/**
 * Telegram Flow Control — rate limiting, flood protection, chat queues, debouncing.
 * Ensures agents don't spam, handles FLOOD_WAIT gracefully, serializes per-chat processing.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTIVE FLOOD GATE
// Tracks FLOOD_WAIT penalties per chat and applies proactive cooldowns.
// Cooldown decays (halves) over time so chats recover naturally.
// ═══════════════════════════════════════════════════════════════════════════════

const COOLDOWN_DECAY_MS = 60_000;   // halve cooldown every 60s
const COOLDOWN_MIN_MS = 1_000;      // remove tracking below 1s
const MAX_TRACKED_CHATS = 500;      // prevent unbounded memory growth

interface CooldownSlot {
  /** Earliest time (epoch ms) when a send is allowed */
  unlocksAt: number;
  /** Current cooldown duration in ms — shrinks over time */
  durationMs: number;
  /** Timer for automatic decay */
  _decay: NodeJS.Timeout;
}

class AdaptiveFloodGate {
  private slots = new Map<string, CooldownSlot>();

  /** Block until the cooldown for this chat has elapsed (if any). */
  async hold(chatKey: string): Promise<void> {
    const slot = this.slots.get(chatKey);
    if (!slot) return;
    const wait = slot.unlocksAt - Date.now();
    if (wait <= 0) return;
    console.log(`[FloodGate] ${chatKey}: holding ${(wait / 1000).toFixed(1)}s`);
    await new Promise(r => setTimeout(r, wait));
  }

  /** Register a FLOOD_WAIT penalty for a chat. */
  penalize(chatKey: string, waitSec: number): void {
    const ms = waitSec * 1000;
    const prev = this.slots.get(chatKey);
    if (prev) clearTimeout(prev._decay);

    const slot: CooldownSlot = {
      unlocksAt: Date.now() + ms,
      durationMs: ms,
      _decay: null as any,
    };
    slot._decay = this._startDecay(chatKey, slot);
    this.slots.set(chatKey, slot);

    // Evict oldest if map grows too large
    if (this.slots.size > MAX_TRACKED_CHATS) {
      const oldest = this.slots.keys().next().value;
      if (oldest && oldest !== chatKey) {
        const stale = this.slots.get(oldest);
        if (stale) clearTimeout(stale._decay);
        this.slots.delete(oldest);
      }
    }

    console.log(`[FloodGate] ${chatKey}: penalized ${waitSec}s`);
  }

  /** After a successful send, extend spacing if still inside penalty window. */
  recordOk(chatKey: string): void {
    const slot = this.slots.get(chatKey);
    if (!slot || Date.now() >= slot.unlocksAt) return;
    slot.unlocksAt = Date.now() + slot.durationMs;
  }

  /** Check if a chat is currently gated (without waiting). */
  isGated(chatKey: string): boolean {
    const slot = this.slots.get(chatKey);
    return !!slot && Date.now() < slot.unlocksAt;
  }

  /** Get remaining wait time in seconds, or 0 if not gated. */
  remainingSec(chatKey: string): number {
    const slot = this.slots.get(chatKey);
    if (!slot) return 0;
    return Math.max(0, Math.ceil((slot.unlocksAt - Date.now()) / 1000));
  }

  private _startDecay(chatKey: string, slot: CooldownSlot): NodeJS.Timeout {
    // Jitter ±10% to prevent thundering herd when many agents hit FLOOD_WAIT simultaneously
    const jitter = COOLDOWN_DECAY_MS * 0.1 * (Math.random() * 2 - 1); // ±6s
    const decayDelay = Math.max(5000, COOLDOWN_DECAY_MS + jitter);
    const timer = setTimeout(() => {
      slot.durationMs = Math.floor(slot.durationMs / 2);
      if (slot.durationMs < COOLDOWN_MIN_MS) {
        this.slots.delete(chatKey);
        return;
      }
      slot._decay = this._startDecay(chatKey, slot);
    }, decayDelay);
    if (timer.unref) timer.unref();
    return timer;
  }
}

export const floodGate = new AdaptiveFloodGate();

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOD RETRY WRAPPER
// Wraps any async Telegram operation with automatic FLOOD_WAIT handling.
// ═══════════════════════════════════════════════════════════════════════════════

const FLOOD_MAX_WAIT = 120;  // refuse to wait longer than 2 min
const FLOOD_MAX_RETRIES = 2;

export async function withFloodProtection<T>(
  fn: () => Promise<T>,
  chatKey?: string,
  maxWait = FLOOD_MAX_WAIT,
  maxRetries = FLOOD_MAX_RETRIES,
): Promise<T> {
  // Proactive wait if chat is penalized
  if (chatKey) await floodGate.hold(chatKey);

  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (chatKey) floodGate.recordOk(chatKey);
      return result;
    } catch (err: any) {
      const floodSec = err.seconds ?? extractFloodWait(err.message);
      if (typeof floodSec !== 'number' || floodSec <= 0) throw err;

      lastErr = err;
      if (floodSec > maxWait) {
        throw new Error(`FLOOD_WAIT ${floodSec}s exceeds limit ${maxWait}s`);
      }
      if (chatKey) floodGate.penalize(chatKey, floodSec);
      if (attempt >= maxRetries) break;

      console.warn(`[FloodProtection] FLOOD_WAIT ${floodSec}s, retry ${attempt + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, floodSec * 1000));
    }
  }
  throw lastErr ?? new Error('Flood retries exhausted');
}

function extractFloodWait(msg?: string): number | null {
  if (!msg) return null;
  const m = msg.match(/FLOOD_WAIT[_\s]*(\d+)/i);
  return m ? parseInt(m[1]) : null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// PER-CHAT SERIAL QUEUE WITH BACKPRESSURE
// Ensures only one AI call runs per chat at a time. Excess chats wait.
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_CONCURRENT_CHATS = 10;

export class ChatProcessingQueue {
  private chains = new Map<string, Promise<void>>();
  private active = 0;
  private waiting: Array<() => void> = [];
  private maxConcurrent: number;

  constructor(maxConcurrent = MAX_CONCURRENT_CHATS) {
    this.maxConcurrent = maxConcurrent;
  }

  private async acquireSlot(chatKey: string): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return;
    }
    console.log(`[ChatQueue] Backpressure: ${chatKey} queued (${this.active}/${this.maxConcurrent})`);
    return new Promise<void>(resolve => {
      this.waiting.push(() => { this.active++; resolve(); });
    });
  }

  private releaseSlot(): void {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }

  /** Enqueue a task for serial execution within a chat. */
  enqueue(chatKey: string, task: () => Promise<void>): Promise<void> {
    const prev = this.chains.get(chatKey) ?? Promise.resolve();
    const next = prev
      .then(
        () => this.acquireSlot(chatKey).then(task),
        () => this.acquireSlot(chatKey).then(task),
      )
      .finally(() => {
        this.releaseSlot();
        if (this.chains.get(chatKey) === next) this.chains.delete(chatKey);
      });
    this.chains.set(chatKey, next);
    return next;
  }

  /** Wait for all active tasks to complete (graceful shutdown). */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.chains.values()]);
  }

  get activeChatCount(): number { return this.chains.size; }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SEND RATE LIMITER
// Global messages/sec + per-group messages/min. Prevents Telegram API bans.
// ═══════════════════════════════════════════════════════════════════════════════

export class SendRateLimiter {
  private globalTimestamps: number[] = [];
  private perGroupTimestamps = new Map<string, number[]>();

  constructor(
    private msgsPerSec = 25,
    private groupMsgsPerMin = 20,
  ) {}

  canSend(): boolean {
    const now = Date.now();
    const cutoff = now - 1000;
    this.globalTimestamps = this.globalTimestamps.filter(t => t > cutoff);
    if (this.globalTimestamps.length >= this.msgsPerSec) return false;
    this.globalTimestamps.push(now);
    return true;
  }

  canSendToGroup(groupKey: string): boolean {
    const now = Date.now();
    const cutoff = now - 60_000;
    let ts = this.perGroupTimestamps.get(groupKey) || [];
    ts = ts.filter(t => t > cutoff);
    if (ts.length >= this.groupMsgsPerMin) {
      this.perGroupTimestamps.set(groupKey, ts);
      return false;
    }
    ts.push(now);
    this.perGroupTimestamps.set(groupKey, ts);

    // Evict stale groups periodically
    if (this.perGroupTimestamps.size > 200) {
      for (const [k, v] of this.perGroupTimestamps) {
        if (v.length === 0 || v[v.length - 1] <= cutoff) this.perGroupTimestamps.delete(k);
      }
    }
    return true;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE DEBOUNCER
// Batches rapid-fire messages per chat into single AI calls.
// ═══════════════════════════════════════════════════════════════════════════════

interface DebounceEntry<T> {
  items: T[];
  timer: NodeJS.Timeout | null;
  firstAt: number;
}

export class MessageBatchDebouncer<T> {
  private buffers = new Map<string, DebounceEntry<T>>();

  constructor(
    private delayMs: number,
    private maxDelayMs: number,
    private maxBatchSize: number,
    private onFlush: (chatKey: string, items: T[]) => Promise<void>,
  ) {}

  push(chatKey: string, item: T): void {
    const existing = this.buffers.get(chatKey);
    if (existing) {
      if (existing.items.length >= this.maxBatchSize) {
        this._flush(chatKey);
        const fresh: DebounceEntry<T> = { items: [item], timer: null, firstAt: Date.now() };
        this.buffers.set(chatKey, fresh);
        this._scheduleFlush(chatKey, fresh);
      } else {
        existing.items.push(item);
        this._scheduleFlush(chatKey, existing);
      }
    } else {
      const entry: DebounceEntry<T> = { items: [item], timer: null, firstAt: Date.now() };
      this.buffers.set(chatKey, entry);
      this._scheduleFlush(chatKey, entry);
    }
  }

  private _scheduleFlush(chatKey: string, entry: DebounceEntry<T>): void {
    if (entry.timer) clearTimeout(entry.timer);
    const elapsed = Date.now() - entry.firstAt;
    const remaining = Math.max(0, this.maxDelayMs - elapsed);
    const delay = Math.min(this.delayMs, remaining);

    entry.timer = setTimeout(() => {
      this._flush(chatKey);
    }, delay);
    if (entry.timer.unref) entry.timer.unref();
  }

  private _flush(chatKey: string): void {
    const entry = this.buffers.get(chatKey);
    if (!entry) return;
    this.buffers.delete(chatKey);
    if (entry.timer) clearTimeout(entry.timer);
    if (entry.items.length === 0) return;
    this.onFlush(chatKey, entry.items).catch(err => {
      console.error(`[Debouncer] Flush error for ${chatKey}:`, err.message);
    });
  }

  async flushAll(): Promise<void> {
    for (const key of [...this.buffers.keys()]) {
      this._flush(key);
    }
  }

  bufferDepth(chatKey: string): number {
    return this.buffers.get(chatKey)?.items.length ?? 0;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ANTI-LOOP DETECTION
// Prevents bot-to-bot conversation loops and excessive self-responses.
// ═══════════════════════════════════════════════════════════════════════════════

const LOOP_WINDOW_MS = 120_000;  // 2 min window
const LOOP_MAX_RESPONSES = 4;    // max responses per agent per chat per window

const _loopTracker = new Map<string, number[]>();

/** Check if agent can respond in this chat. Returns true if allowed. */
export function loopGuardCheck(agentId: number, chatKey: string): boolean {
  const key = `${agentId}:${chatKey}`;
  const now = Date.now();
  const times = (_loopTracker.get(key) || []).filter(t => now - t < LOOP_WINDOW_MS);
  if (times.length >= LOOP_MAX_RESPONSES) return false;
  times.push(now);
  _loopTracker.set(key, times);
  return true;
}

/** Periodic cleanup of loop tracker. Auto-scheduled on module load. */
export function loopGuardCleanup(): void {
  const now = Date.now();
  for (const [key, times] of _loopTracker) {
    const fresh = times.filter(t => now - t < LOOP_WINDOW_MS);
    if (fresh.length === 0) _loopTracker.delete(key);
    else _loopTracker.set(key, fresh);
  }
}

// Auto-schedule cleanup every 60s (prevents memory leak)
const _loopCleanupTimer = setInterval(() => loopGuardCleanup(), 60_000);
if (_loopCleanupTimer.unref) _loopCleanupTimer.unref();

/** Heuristic: detect AI-generated messages (to skip bot-to-bot loops). */
export function seemsAutoGenerated(text: string): boolean {
  if (!text || text.length < 30) return false;
  let score = 0;
  // Formal greeting patterns typical of LLMs
  if (/^(?:Конечно|Отлично|Понятно|Хорошо|Замечательно|Прекрасно)[!,.]/.test(text)) score++;
  // Offer-to-help patterns
  if (/(?:Как могу помочь|Чем могу быть полезен|Если .{0,30}вопрос)/i.test(text)) score++;
  // Refusal patterns
  if (/(?:Извините, (?:но )?я не могу|К сожалению, я не (?:могу|имею))/i.test(text)) score++;
  // Enthusiastic agreement
  if (/(?:Абсолютно согласен|Отличная (?:мысль|идея))[!]/.test(text)) score++;
  // Heavy emoji in short messages (LLM hallmark)
  const emojiCount = (text.match(/[\u{1F300}-\u{1FFFF}]/gu) || []).length;
  if (emojiCount >= 3 && text.length < 200) score++;
  return score >= 2;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE ID DEDUP
// GramJS sometimes fires the same event from multiple MTProto channels.
// ═══════════════════════════════════════════════════════════════════════════════

const DEDUP_MAX = 500;

export class MessageIdDedup {
  private seen = new Set<string>();

  /** Returns true if this is a DUPLICATE (already seen). */
  isDuplicate(chatId: string, msgId: number): boolean {
    const key = `${chatId}:${msgId}`;
    if (this.seen.has(key)) return true;
    this.seen.add(key);
    // Evict oldest half when too large
    if (this.seen.size > DEDUP_MAX) {
      const arr = [...this.seen];
      this.seen = new Set(arr.slice(arr.length >> 1));
    }
    return false;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ATOMIC OPERATION LOCK
// Prevents double-spend on financial operations (TON send, gift buy/sell).
// Only one financial op per agent at a time; concurrent calls get rejected.
// ═══════════════════════════════════════════════════════════════════════════════

let _opLockGeneration = 0; // monotonic generation counter
const _opLocks = new Map<string, { op: string; since: number; gen: number }>();
const OP_LOCK_TIMEOUT_MS = 60_000; // auto-release stale locks after 60s

export function acquireOpLock(agentId: number, operation: string): boolean {
  const key = `agent:${agentId}`;
  const existing = _opLocks.get(key);
  if (existing) {
    // Auto-release if stuck > timeout AND generation hasn't changed (prevents race)
    if (Date.now() - existing.since > OP_LOCK_TIMEOUT_MS) {
      const currentGen = existing.gen;
      // Re-read to make sure no one else acquired between our check
      const recheck = _opLocks.get(key);
      if (recheck && recheck.gen === currentGen) {
        console.warn(`[OpLock] Force-releasing stale lock agent#${agentId}: ${existing.op} (${((Date.now() - existing.since) / 1000).toFixed(0)}s old, gen=${currentGen})`);
        _opLocks.delete(key);
      } else {
        return false; // someone else already re-acquired
      }
    } else {
      return false; // another op is running
    }
  }
  const gen = ++_opLockGeneration;
  _opLocks.set(key, { op: operation, since: Date.now(), gen });
  return true;
}

export function releaseOpLock(agentId: number): void {
  _opLocks.delete(`agent:${agentId}`);
}

export function getActiveOp(agentId: number): string | null {
  const lock = _opLocks.get(`agent:${agentId}`);
  if (!lock) return null;
  if (Date.now() - lock.since > OP_LOCK_TIMEOUT_MS) {
    _opLocks.delete(`agent:${agentId}`);
    return null;
  }
  return lock.op;
}


// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN USAGE ACCUMULATOR
// Tracks per-agent token consumption across ticks. Periodically flushed to state.
// ═══════════════════════════════════════════════════════════════════════════════

interface TokenBucket {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  lastFlush: number;
}

const _tokenBuckets = new Map<number, TokenBucket>();
const TOKEN_FLUSH_INTERVAL_MS = 300_000; // flush accumulated tokens to state every 5min

export function trackTokenUsage(
  agentId: number,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
): void {
  let bucket = _tokenBuckets.get(agentId);
  if (!bucket) {
    bucket = { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0, lastFlush: Date.now() };
    _tokenBuckets.set(agentId, bucket);
  }
  bucket.promptTokens += usage.prompt_tokens || 0;
  bucket.completionTokens += usage.completion_tokens || 0;
  bucket.totalTokens += usage.total_tokens || 0;
  bucket.calls++;
}

export function getTokenUsage(agentId: number): TokenBucket | null {
  return _tokenBuckets.get(agentId) || null;
}

const _flushingAgents = new Set<number>(); // prevent concurrent flush race
/** Flush accumulated token counts to DB state and reset in-memory counters. */
export async function flushTokenUsage(agentId: number, stateRepo: any, userId: number): Promise<void> {
  const bucket = _tokenBuckets.get(agentId);
  if (!bucket || bucket.calls === 0) return;
  // Prevent concurrent flush for same agent
  if (_flushingAgents.has(agentId)) return;
  _flushingAgents.add(agentId);

  // Snapshot and reset BEFORE async DB call to prevent race
  const snapshot = {
    promptTokens: bucket.promptTokens,
    completionTokens: bucket.completionTokens,
    totalTokens: bucket.totalTokens,
    calls: bucket.calls,
  };
  bucket.promptTokens = 0;
  bucket.completionTokens = 0;
  bucket.totalTokens = 0;
  bucket.calls = 0;
  bucket.lastFlush = Date.now();

  try {
    const existing = await stateRepo.get(agentId, '_token_usage').catch(() => null);
    let cumulative = { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0 };
    try {
      const raw = typeof existing === 'string' ? JSON.parse(existing) : existing;
      if (raw && typeof raw === 'object') cumulative = { ...cumulative, ...raw };
    } catch {}

    cumulative.promptTokens += snapshot.promptTokens;
    cumulative.completionTokens += snapshot.completionTokens;
    cumulative.totalTokens += snapshot.totalTokens;
    cumulative.calls += snapshot.calls;

    await stateRepo.set(agentId, userId, '_token_usage', cumulative);
  } catch (e: any) {
    console.warn(`[TokenUsage] Flush failed for agent#${agentId}: ${e.message?.slice(0, 100)}`);
    // Restore counters so data isn't permanently lost
    const b = _tokenBuckets.get(agentId);
    if (b) {
      b.promptTokens += snapshot.promptTokens;
      b.completionTokens += snapshot.completionTokens;
      b.totalTokens += snapshot.totalTokens;
      b.calls += snapshot.calls;
    }
  } finally {
    _flushingAgents.delete(agentId);
  }
}

/** Check if it's time to flush (called each tick). */
export function shouldFlushTokens(agentId: number): boolean {
  const bucket = _tokenBuckets.get(agentId);
  if (!bucket || bucket.calls === 0) return false;
  return Date.now() - bucket.lastFlush > TOKEN_FLUSH_INTERVAL_MS;
}
