/**
 * Plugin SDK — isolated plugins with their own SQLite databases
 *
 * Each plugin gets:
 * - Its own SQLite database file (data/{pluginId}.sqlite)
 * - Lifecycle hooks: onLoad, onUnload, onMessage, onTick
 * - Tool definitions that get injected into the agent's tool list
 * - Isolated key-value store
 */

import path from 'path';
import fs from 'fs';

const PLUGINS_DIR = process.env.PLUGINS_DIR || path.join(process.cwd(), 'data', 'plugins');
const pluginInstances = new Map<string, PluginInstance>();

// ── Types ──────────────────────────────────────────────────────────────────

export interface PluginTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any, context: PluginContext) => Promise<any>;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;

  // Lifecycle
  onLoad?: (ctx: PluginContext) => Promise<void>;
  onUnload?: (ctx: PluginContext) => Promise<void>;
  onMessage?: (
    message: { text: string; chatId: string; senderId: string; isGroup: boolean },
    ctx: PluginContext,
  ) => Promise<string | null>; // return response or null to pass through
  onTick?: (ctx: PluginContext) => Promise<void>; // called on agent tick

  // Tools this plugin provides
  tools?: PluginTool[];

  // DB migrations (run on load)
  migrations?: string[]; // SQL statements
}

export interface PluginContext {
  pluginId: string;
  agentId: number;
  db: PluginDB;
  log: (msg: string) => void;
  notify: (text: string) => Promise<void>;
}

// ── PluginDB: SQLite-backed isolated storage ──────────────────────────────

export class PluginDB {
  private sqlite: any; // better-sqlite3 instance

  constructor(private pluginId: string, private agentId: number) {
    const dir = path.join(PLUGINS_DIR, String(agentId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const dbPath = path.join(dir, `${pluginId}.sqlite`);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3');
    this.sqlite = new Database(dbPath);
    this.sqlite.pragma('journal_mode = WAL');

    // Create default KV table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);
  }

  get(key: string): string | null {
    const row = this.sqlite.prepare('SELECT value FROM kv WHERE key = ?').get(key) as any;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.sqlite
      .prepare(
        "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, strftime('%s', 'now'))",
      )
      .run(key, value);
  }

  delete(key: string): void {
    this.sqlite.prepare('DELETE FROM kv WHERE key = ?').run(key);
  }

  list(prefix?: string): Array<{ key: string; value: string }> {
    if (prefix) {
      return this.sqlite
        .prepare('SELECT key, value FROM kv WHERE key LIKE ?')
        .all(prefix + '%') as any[];
    }
    return this.sqlite.prepare('SELECT key, value FROM kv').all() as any[];
  }

  // Run raw SQL (for plugin-specific tables)
  exec(sql: string): void {
    this.sqlite.exec(sql);
  }

  query(sql: string, params?: any[]): any[] {
    return this.sqlite.prepare(sql).all(...(params || []));
  }

  run(sql: string, params?: any[]): any {
    return this.sqlite.prepare(sql).run(...(params || []));
  }

  close(): void {
    try {
      this.sqlite.close();
    } catch {}
  }
}

// ── PluginInstance ─────────────────────────────────────────────────────────

class PluginInstance {
  public db: PluginDB;
  public definition: PluginDefinition;
  public loaded = false;

  constructor(def: PluginDefinition, agentId: number) {
    this.definition = def;
    this.db = new PluginDB(def.id, agentId);
  }
}

// ── Plugin Registry ───────────────────────────────────────────────────────

const builtinPlugins: PluginDefinition[] = [];

export function registerPlugin(plugin: PluginDefinition): void {
  builtinPlugins.push(plugin);
  console.log(`[PluginSDK] Registered plugin: ${plugin.id} v${plugin.version}`);
}

export function getRegisteredPlugins(): PluginDefinition[] {
  return [...builtinPlugins];
}

export async function loadPluginsForAgent(
  agentId: number,
  enabledPluginIds?: string[],
): Promise<PluginInstance[]> {
  const instances: PluginInstance[] = [];
  const toLoad = enabledPluginIds
    ? builtinPlugins.filter((p) => enabledPluginIds.includes(p.id))
    : builtinPlugins;

  for (const def of toLoad) {
    const key = `${agentId}:${def.id}`;
    let inst = pluginInstances.get(key);
    if (!inst) {
      inst = new PluginInstance(def, agentId);
      pluginInstances.set(key, inst);
    }

    if (!inst.loaded) {
      // Run migrations
      if (def.migrations) {
        for (const sql of def.migrations) {
          try {
            inst.db.exec(sql);
          } catch (e: any) {
            console.warn(`[PluginSDK] Migration warning for ${def.id}: ${e.message}`);
          }
        }
      }

      // Call onLoad
      const ctx = buildContext(inst, agentId);
      if (def.onLoad) {
        try {
          await def.onLoad(ctx);
        } catch (e: any) {
          console.error(`[PluginSDK] onLoad error for ${def.id}: ${e.message}`);
        }
      }
      inst.loaded = true;
      console.log(`[PluginSDK] Loaded plugin ${def.id} for agent #${agentId}`);
    }

    instances.push(inst);
  }
  return instances;
}

export function getPluginTools(agentId: number): PluginTool[] {
  const tools: PluginTool[] = [];
  for (const [key, inst] of pluginInstances) {
    if (key.startsWith(`${agentId}:`)) {
      if (inst.definition.tools) {
        tools.push(...inst.definition.tools);
      }
    }
  }
  return tools;
}

/**
 * Convert plugin tools to OpenAI function-call format for injection into tool list.
 */
export function getPluginToolDefs(agentId: number): any[] {
  const pluginTools = getPluginTools(agentId);
  return pluginTools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function executePluginTool(
  agentId: number,
  toolName: string,
  args: any,
): Promise<any> {
  for (const [key, inst] of pluginInstances) {
    if (key.startsWith(`${agentId}:`)) {
      const tool = inst.definition.tools?.find((t) => t.name === toolName);
      if (tool) {
        const ctx = buildContext(inst, agentId);
        return await tool.execute(args, ctx);
      }
    }
  }
  return { error: `Plugin tool ${toolName} not found` };
}

export async function dispatchPluginMessage(
  agentId: number,
  message: { text: string; chatId: string; senderId: string; isGroup: boolean },
): Promise<string | null> {
  for (const [key, inst] of pluginInstances) {
    if (key.startsWith(`${agentId}:`) && inst.definition.onMessage) {
      const ctx = buildContext(inst, agentId);
      try {
        const response = await inst.definition.onMessage(message, ctx);
        if (response) return response;
      } catch {}
    }
  }
  return null;
}

export async function tickPlugins(agentId: number): Promise<void> {
  for (const [key, inst] of pluginInstances) {
    if (key.startsWith(`${agentId}:`) && inst.definition.onTick) {
      const ctx = buildContext(inst, agentId);
      try {
        await inst.definition.onTick(ctx);
      } catch (e: any) {
        console.warn(`[PluginSDK] tick error ${inst.definition.id}: ${e.message}`);
      }
    }
  }
}

export function unloadPluginsForAgent(agentId: number): void {
  for (const [key, inst] of pluginInstances) {
    if (key.startsWith(`${agentId}:`)) {
      if (inst.definition.onUnload) {
        const ctx = buildContext(inst, agentId);
        inst.definition.onUnload(ctx).catch(() => {});
      }
      inst.db.close();
      pluginInstances.delete(key);
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

function buildContext(inst: PluginInstance, agentId: number): PluginContext {
  return {
    pluginId: inst.definition.id,
    agentId,
    db: inst.db,
    log: (msg: string) => console.log(`[Plugin:${inst.definition.id}] ${msg}`),
    notify: async (text: string) => {
      try {
        const { notifyUser } = await import('../notifier');
        // Get userId from agent — look up in DB
        const { Pool } = require('pg');
        const pool = new Pool({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          user: process.env.DB_USER || 'ton_agent',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'ton_agent_platform',
          max: 1,
        });
        try {
          const res = await pool.query(
            'SELECT user_id FROM builder_bot.agents WHERE id = $1 LIMIT 1',
            [agentId],
          );
          if (res.rows.length > 0) {
            await notifyUser(Number(res.rows[0].user_id), text);
          }
        } finally {
          await pool.end();
        }
      } catch (e: any) {
        console.warn(`[Plugin:${inst.definition.id}] notify failed: ${e.message}`);
      }
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════
// ── Built-in Plugins ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

// ── Analytics plugin ──────────────────────────────────────────────────────

registerPlugin({
  id: 'analytics',
  name: 'Chat Analytics',
  version: '1.0.0',
  description: 'Track message counts, active users, popular topics per chat',
  migrations: [
    `CREATE TABLE IF NOT EXISTS message_stats (
      chat_id TEXT,
      user_id TEXT,
      date TEXT,
      count INTEGER DEFAULT 1,
      PRIMARY KEY (chat_id, user_id, date)
    )`,
    `CREATE TABLE IF NOT EXISTS topic_stats (
      chat_id TEXT,
      topic TEXT,
      count INTEGER DEFAULT 1,
      last_seen INTEGER,
      PRIMARY KEY (chat_id, topic)
    )`,
  ],
  onMessage: async (msg, ctx) => {
    // Track message counts
    const date = new Date().toISOString().split('T')[0];
    ctx.db.run(
      `INSERT INTO message_stats (chat_id, user_id, date, count) VALUES (?, ?, ?, 1)
       ON CONFLICT(chat_id, user_id, date) DO UPDATE SET count = count + 1`,
      [msg.chatId, msg.senderId, date],
    );
    return null; // don't intercept
  },
  tools: [
    {
      name: 'plugin_get_chat_activity',
      description: 'Get message activity stats for a chat (daily counts, top users)',
      parameters: {
        type: 'object',
        properties: {
          chat_id: { type: 'string' },
          days: { type: 'number', description: 'Number of days to look back (default 7)' },
        },
        required: ['chat_id'],
      },
      execute: async (args, ctx) => {
        const days = args.days || 7;
        const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
        const daily = ctx.db.query(
          'SELECT date, SUM(count) as messages FROM message_stats WHERE chat_id = ? AND date >= ? GROUP BY date ORDER BY date',
          [args.chat_id, since],
        );
        const topUsers = ctx.db.query(
          'SELECT user_id, SUM(count) as messages FROM message_stats WHERE chat_id = ? AND date >= ? GROUP BY user_id ORDER BY messages DESC LIMIT 10',
          [args.chat_id, since],
        );
        return { daily, topUsers, period: `${since} to now` };
      },
    },
  ],
});

// ── Reminders plugin ──────────────────────────────────────────────────────

registerPlugin({
  id: 'reminders',
  name: 'Reminders',
  version: '1.0.0',
  description: 'Set and manage timed reminders',
  migrations: [
    `CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      text TEXT,
      remind_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      fired INTEGER DEFAULT 0
    )`,
  ],
  onTick: async (ctx) => {
    const now = Math.floor(Date.now() / 1000);
    const due = ctx.db.query('SELECT * FROM reminders WHERE remind_at <= ? AND fired = 0', [now]);
    for (const r of due as any[]) {
      ctx.log(`Reminder fired: ${r.text}`);
      ctx.db.run('UPDATE reminders SET fired = 1 WHERE id = ?', [r.id]);
      await ctx.notify(`Reminder: ${r.text}`);
    }
  },
  tools: [
    {
      name: 'plugin_set_reminder',
      description: 'Set a reminder for later',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          minutes: { type: 'number', description: 'Minutes from now' },
          chat_id: { type: 'string' },
        },
        required: ['text', 'minutes'],
      },
      execute: async (args, ctx) => {
        const remindAt = Math.floor(Date.now() / 1000) + (args.minutes || 5) * 60;
        ctx.db.run('INSERT INTO reminders (chat_id, text, remind_at) VALUES (?, ?, ?)', [
          args.chat_id || '',
          args.text,
          remindAt,
        ]);
        return { ok: true, remind_at: new Date(remindAt * 1000).toISOString() };
      },
    },
    {
      name: 'plugin_list_reminders',
      description: 'List pending reminders',
      parameters: { type: 'object', properties: { chat_id: { type: 'string' } } },
      execute: async (args, ctx) => {
        const reminders = ctx.db.query(
          'SELECT id, text, remind_at, chat_id FROM reminders WHERE fired = 0 ORDER BY remind_at',
        );
        return {
          reminders: (reminders as any[]).map((r) => ({
            ...r,
            remind_at_human: new Date(r.remind_at * 1000).toISOString(),
          })),
        };
      },
    },
  ],
});

// ── Notes & Bookmarks plugin ──────────────────────────────────────────────

registerPlugin({
  id: 'notes',
  name: 'Notes & Bookmarks',
  version: '1.0.0',
  description: 'Save and search notes, bookmarks, snippets',
  migrations: [
    `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      tags TEXT DEFAULT '',
      chat_id TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
  ],
  tools: [
    {
      name: 'plugin_save_note',
      description: 'Save a note or bookmark',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          tags: { type: 'string', description: 'Comma-separated tags' },
        },
        required: ['title', 'content'],
      },
      execute: async (args, ctx) => {
        ctx.db.run('INSERT INTO notes (title, content, tags) VALUES (?, ?, ?)', [
          args.title,
          args.content,
          args.tags || '',
        ]);
        return { ok: true };
      },
    },
    {
      name: 'plugin_search_notes',
      description: 'Search saved notes',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
      execute: async (args, ctx) => {
        const notes = ctx.db.query(
          'SELECT id, title, content, tags, created_at FROM notes WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY created_at DESC LIMIT 20',
          [`%${args.query}%`, `%${args.query}%`, `%${args.query}%`],
        );
        return { notes };
      },
    },
  ],
});
