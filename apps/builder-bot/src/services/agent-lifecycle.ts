/**
 * agent-lifecycle.ts — FSM lifecycle manager for agents.
 * States: stopped → starting → running → stopping → stopped
 * Tracks uptime, errors, and provides start/stop/restart.
 */

export type AgentState = 'stopped' | 'starting' | 'running' | 'stopping';

export interface LifecycleInfo {
  state: AgentState;
  uptime: number | null;      // seconds, null if not running
  error: string | undefined;
  runningSince: number | null; // timestamp ms
  lastStateChange: number;     // timestamp ms
}

interface AgentEntry {
  state: AgentState;
  error?: string;
  runningSince: number | null;
  lastStateChange: number;
  startFn?: () => Promise<void>;
  stopFn?: () => Promise<void>;
}

class AgentLifecycleManager {
  private agents = new Map<number, AgentEntry>();

  private getOrCreate(agentId: number): AgentEntry {
    let entry = this.agents.get(agentId);
    if (!entry) {
      entry = { state: 'stopped', runningSince: null, lastStateChange: Date.now() };
      this.agents.set(agentId, entry);
    }
    return entry;
  }

  /** Register start/stop callbacks for an agent */
  registerCallbacks(agentId: number, startFn: () => Promise<void>, stopFn: () => Promise<void>): void {
    const entry = this.getOrCreate(agentId);
    entry.startFn = startFn;
    entry.stopFn = stopFn;
  }

  /** Get current lifecycle info */
  getInfo(agentId: number): LifecycleInfo {
    const entry = this.getOrCreate(agentId);
    return {
      state: entry.state,
      uptime: entry.state === 'running' && entry.runningSince
        ? Math.floor((Date.now() - entry.runningSince) / 1000)
        : null,
      error: entry.error,
      runningSince: entry.runningSince,
      lastStateChange: entry.lastStateChange,
    };
  }

  getState(agentId: number): AgentState {
    return this.getOrCreate(agentId).state;
  }

  /** Transition state */
  private transition(agentId: number, newState: AgentState, error?: string): void {
    const entry = this.getOrCreate(agentId);
    const old = entry.state;
    entry.state = newState;
    entry.lastStateChange = Date.now();
    if (error !== undefined) entry.error = error;

    if (newState === 'running') {
      entry.runningSince = Date.now();
      entry.error = undefined;
    } else if (newState === 'stopped') {
      entry.runningSince = null;
    }

    console.log(`[Lifecycle] Agent #${agentId}: ${old} → ${newState}${error ? ` (error: ${error})` : ''}`);
  }

  /** Mark agent as running (called from runner/runtime when agent activates) */
  markRunning(agentId: number): void {
    this.transition(agentId, 'running');
  }

  /** Mark agent as stopped */
  markStopped(agentId: number, error?: string): void {
    this.transition(agentId, 'stopped', error);
  }

  /** Start agent via registered callback */
  async start(agentId: number): Promise<void> {
    const entry = this.getOrCreate(agentId);
    if (entry.state === 'running') return;
    if (entry.state === 'starting') return;
    if (entry.state === 'stopping') {
      throw new Error('Cannot start while agent is stopping');
    }

    this.transition(agentId, 'starting');
    try {
      if (entry.startFn) {
        await entry.startFn();
      }
      this.transition(agentId, 'running');
    } catch (err: any) {
      this.transition(agentId, 'stopped', err.message?.slice(0, 200));
      throw err;
    }
  }

  /** Stop agent via registered callback */
  async stop(agentId: number): Promise<void> {
    const entry = this.getOrCreate(agentId);
    if (entry.state === 'stopped') return;
    if (entry.state === 'stopping') return;

    this.transition(agentId, 'stopping');
    try {
      if (entry.stopFn) {
        await entry.stopFn();
      }
      this.transition(agentId, 'stopped');
    } catch (err: any) {
      this.transition(agentId, 'stopped', err.message?.slice(0, 200));
    }
  }

  /** Restart = stop + start */
  async restart(agentId: number): Promise<void> {
    await this.stop(agentId);
    await this.start(agentId);
  }

  /** Get all agent states (for dashboard overview) */
  getAllStates(): Map<number, LifecycleInfo> {
    const result = new Map<number, LifecycleInfo>();
    for (const [id] of this.agents) {
      result.set(id, this.getInfo(id));
    }
    return result;
  }

  /** Cleanup entry */
  remove(agentId: number): void {
    this.agents.delete(agentId);
  }
}

export const lifecycleManager = new AgentLifecycleManager();
