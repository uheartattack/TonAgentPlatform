/**
 * Event Bus — pub/sub system for agent events
 *
 * Agents can:
 *   - subscribe to events (price_change, wallet_tx, custom, cron)
 *   - emit custom events (for inter-agent communication)
 *   - schedule one-shot wake-ups via set_next_wake
 *
 * The Event Bus triggers agent ticks when events fire.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type EventType =
  | 'price_change'   // TON/jetton price crossed a threshold
  | 'wallet_tx'      // incoming/outgoing wallet transaction
  | 'schedule'       // one-shot timer (set_next_wake)
  | 'custom';        // agent-defined custom events

export interface EventSubscription {
  agentId: number;
  userId: number;
  eventType: EventType;
  filter?: Record<string, any>; // e.g. { asset: 'TON', direction: 'up', threshold: 5 }
  createdAt: number;
}

export interface AgentEvent {
  type: EventType;
  source: string;          // who/what emitted (e.g. 'system', 'agent:42')
  data: Record<string, any>;
  timestamp: number;
}

interface WakeTimer {
  agentId: number;
  timer: NodeJS.Timeout;
  wakeAt: number;
  reason: string;
}

// ── Singleton Event Bus ────────────────────────────────────────────────────

class EventBus {
  private subscriptions = new Map<number, EventSubscription[]>(); // agentId → subs
  private wakeTimers = new Map<number, WakeTimer>();              // agentId → pending wake

  // Ring buffer for event log — O(1) push, no .shift() overhead
  private readonly MAX_LOG = 500;
  private ringBuffer: (AgentEvent | null)[] = new Array(500).fill(null);
  private ringHead = 0;   // index of oldest element (read start)
  private ringTail = 0;   // index where next element will be written
  private ringCount = 0;  // number of elements currently stored

  // Callback to trigger an agent tick with event context
  private triggerTick: ((agentId: number, event: AgentEvent) => void) | null = null;

  /** Register the tick trigger (called from ai-agent-runtime on init) */
  setTickTrigger(fn: (agentId: number, event: AgentEvent) => void): void {
    this.triggerTick = fn;
  }

  // ── Subscribe / Unsubscribe ────────────────────────────────────────────

  subscribe(agentId: number, userId: number, eventType: EventType, filter?: Record<string, any>): void {
    const subs = this.subscriptions.get(agentId) || [];
    // Prevent duplicate subscriptions
    const exists = subs.some(s => s.eventType === eventType && JSON.stringify(s.filter) === JSON.stringify(filter));
    if (exists) return;

    subs.push({ agentId, userId, eventType, filter, createdAt: Date.now() });
    this.subscriptions.set(agentId, subs);
    console.log(`[EventBus] Agent #${agentId} subscribed to '${eventType}'${filter ? ` filter=${JSON.stringify(filter)}` : ''}`);
  }

  unsubscribe(agentId: number, eventType?: EventType): void {
    if (!eventType) {
      this.subscriptions.delete(agentId);
      console.log(`[EventBus] Agent #${agentId} unsubscribed from all events`);
    } else {
      const subs = this.subscriptions.get(agentId) || [];
      const filtered = subs.filter(s => s.eventType !== eventType);
      if (filtered.length > 0) {
        this.subscriptions.set(agentId, filtered);
      } else {
        this.subscriptions.delete(agentId);
      }
      console.log(`[EventBus] Agent #${agentId} unsubscribed from '${eventType}'`);
    }
  }

  getSubscriptions(agentId: number): EventSubscription[] {
    return this.subscriptions.get(agentId) || [];
  }

  // ── Emit Events ────────────────────────────────────────────────────────

  emit(event: AgentEvent): void {
    // Add to ring buffer — O(1), no array shifting
    this.ringBuffer[this.ringTail] = event;
    this.ringTail = (this.ringTail + 1) % this.MAX_LOG;
    if (this.ringCount < this.MAX_LOG) {
      this.ringCount++;
    } else {
      // Buffer full: advance head (oldest entry overwritten)
      this.ringHead = (this.ringHead + 1) % this.MAX_LOG;
    }

    // Find all agents subscribed to this event type
    this.subscriptions.forEach((subs, agentId) => {
      for (const sub of subs) {
        if (sub.eventType !== event.type) continue;
        if (!this.matchesFilter(sub.filter, event.data)) continue;

        // Trigger tick with event context
        if (this.triggerTick) {
          console.log(`[EventBus] Triggering agent #${agentId} on '${event.type}' event`);
          this.triggerTick(agentId, event);
        }
      }
    });
  }

  private matchesFilter(filter: Record<string, any> | undefined, data: Record<string, any>): boolean {
    if (!filter) return true;
    for (const [key, value] of Object.entries(filter)) {
      if (key === 'threshold') continue; // special handling below
      if (data[key] !== undefined && data[key] !== value) return false;
    }
    // Threshold check for price events
    if (filter.threshold && typeof data.changePercent === 'number') {
      if (Math.abs(data.changePercent) < filter.threshold) return false;
    }
    return true;
  }

  // ── set_next_wake — One-Shot Timer ─────────────────────────────────────

  setNextWake(agentId: number, delayMs: number, reason: string): { wakeAt: number } {
    // Cancel existing wake timer for this agent
    this.cancelWake(agentId);

    // Clamp: minimum 10 seconds, maximum 7 days
    const clamped = Math.max(10_000, Math.min(delayMs, 7 * 24 * 60 * 60 * 1000));
    const wakeAt = Date.now() + clamped;

    const timer = setTimeout(() => {
      this.wakeTimers.delete(agentId);
      const event: AgentEvent = {
        type: 'schedule',
        source: `agent:${agentId}`,
        data: { reason, scheduled_delay_ms: clamped },
        timestamp: Date.now(),
      };
      console.log(`[EventBus] Wake timer fired for agent #${agentId}: ${reason}`);
      if (this.triggerTick) {
        this.triggerTick(agentId, event);
      }
    }, clamped);

    this.wakeTimers.set(agentId, { agentId, timer, wakeAt, reason });
    console.log(`[EventBus] Agent #${agentId} set_next_wake in ${Math.round(clamped / 1000)}s: ${reason}`);
    return { wakeAt };
  }

  cancelWake(agentId: number): void {
    const existing = this.wakeTimers.get(agentId);
    if (existing) {
      clearTimeout(existing.timer);
      this.wakeTimers.delete(agentId);
    }
  }

  getWakeInfo(agentId: number): { wakeAt: number; reason: string } | null {
    const w = this.wakeTimers.get(agentId);
    if (!w) return null;
    return { wakeAt: w.wakeAt, reason: w.reason };
  }

  // ── Cleanup on agent deactivation ──────────────────────────────────────

  cleanupAgent(agentId: number): void {
    this.unsubscribe(agentId);
    this.cancelWake(agentId);
  }

  // ── Recent events for agent context ────────────────────────────────────

  getRecentEvents(limit: number = 10): AgentEvent[] {
    const count = Math.min(limit, this.ringCount);
    if (count === 0) return [];
    const result: AgentEvent[] = new Array(count);
    // Read the last `count` entries (most recent at end)
    let readIdx = (this.ringTail - count + this.MAX_LOG) % this.MAX_LOG;
    for (let i = 0; i < count; i++) {
      result[i] = this.ringBuffer[readIdx] as AgentEvent;
      readIdx = (readIdx + 1) % this.MAX_LOG;
    }
    return result;
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  getStats(): { totalSubscriptions: number; activeWakeTimers: number; recentEvents: number } {
    let totalSubscriptions = 0;
    this.subscriptions.forEach((subs) => { totalSubscriptions += subs.length; });
    return {
      totalSubscriptions,
      activeWakeTimers: this.wakeTimers.size,
      recentEvents: this.ringCount,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _eventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!_eventBus) _eventBus = new EventBus();
  return _eventBus;
}
