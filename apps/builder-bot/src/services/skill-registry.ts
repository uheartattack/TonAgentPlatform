/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SKILL REGISTRY — Agent Skills (agentskills.io specification)
 *
 * Spec-compliant runtime for skill discovery + progressive disclosure:
 *
 *   1. DISCOVERY (cheap, ~80 tokens per skill)
 *      → listMetadata() loads only `name` + `description` from SKILL.md
 *        frontmatter. Used at agent run start to build an inventory block
 *        injected into the system prompt.
 *
 *   2. ACTIVATION (medium, full skill body ~2-5k tokens)
 *      → loadFull(name) reads the full SKILL.md and returns the markdown body
 *        plus frontmatter. Called when the agent invokes the read_skill tool.
 *
 *   3. EXECUTION (heavy, only what's needed)
 *      → loadReference(skill, path) reads files under references/ on demand.
 *      → loadScript(skill, path) reads files under scripts/ for execution
 *        (sandbox separately — NOT auto-executed by the registry itself).
 *
 * Skill sources, in priority order:
 *   - builtin   → apps/builder-bot/src/skills/<name>/  (ships with platform)
 *   - user      → builder_bot.skills table  (created via Studio UI)  [Phase 3]
 *   - imported  → builder_bot.skills table with source_url  (marketplace) [Phase 4]
 *
 * Spec: https://agentskills.io/specification
 * Pattern adopted by: Anthropic CLI, Cursor, GitHub Copilot, Goose, Letta,
 *                     Gemini CLI, OpenHands, OpenAI Codex, VS Code (30+ tools)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types — match agentskills.io specification
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillFrontmatter {
  name: string;                              // 1-64 chars, lowercase, hyphens
  description: string;                       // 1-1024 chars, what + when
  license?: string;
  compatibility?: string;                    // env requirements
  metadata?: Record<string, string>;
  'allowed-tools'?: string;                  // space-separated tool names
}

export interface SkillMetadata {
  name: string;
  description: string;
  source: 'builtin' | 'user' | 'imported';
  ownerId?: number;                          // user_id for user/imported
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  // Computed:
  category?: string;                         // metadata.category for grouping
  version?: string;                          // metadata.version
}

export interface SkillFull extends SkillMetadata {
  body: string;                              // markdown after frontmatter
  /** Filename → file content (only loaded when explicitly requested) */
  references?: Map<string, string>;
  scripts?: Map<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal YAML frontmatter parser (no external dep)
// Handles: scalar strings, quoted strings, nested mapping (1 level for metadata)
// ─────────────────────────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { frontmatter: SkillFrontmatter; body: string } | null {
  // SKILL.md must start with "---\n"
  if (!raw.startsWith('---')) return null;
  const endIdx = raw.indexOf('\n---', 3);
  if (endIdx === -1) return null;

  const yaml = raw.slice(3, endIdx).replace(/^\r?\n/, '');
  const body = raw.slice(endIdx + 4).replace(/^\r?\n/, '');

  const fm: any = {};
  const lines = yaml.split(/\r?\n/);
  let currentKey = '';
  let nestedTarget: Record<string, string> | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    // Detect nested mapping (2-space indent under previous key)
    const nestedMatch = line.match(/^\s{2,}([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (nestedMatch && nestedTarget) {
      const key = nestedMatch[1];
      let val = nestedMatch[2].trim();
      val = stripQuotes(val);
      nestedTarget[key] = val;
      continue;
    }
    // Top-level key
    const topMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!topMatch) continue;
    const key = topMatch[1];
    let val = topMatch[2].trim();

    if (val === '' || val === '{}') {
      // Start of nested mapping
      if (key === 'metadata') {
        fm.metadata = {};
        nestedTarget = fm.metadata;
        currentKey = key;
      } else {
        fm[key] = '';
        nestedTarget = null;
      }
      continue;
    }
    val = stripQuotes(val);
    fm[key] = val;
    nestedTarget = null;
    currentKey = key;
  }

  // Required field check
  if (!fm.name || !fm.description) return null;
  return { frontmatter: fm as SkillFrontmatter, body };
}

function stripQuotes(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec validation — matches agentskills.io rules
// ─────────────────────────────────────────────────────────────────────────────

const NAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function validateSkill(fm: SkillFrontmatter): { ok: boolean; error?: string } {
  if (!fm.name) return { ok: false, error: 'name is required' };
  if (fm.name.length > 64) return { ok: false, error: 'name max 64 chars' };
  if (!NAME_RE.test(fm.name)) return { ok: false, error: 'name must be lowercase alphanumeric + hyphens, no leading/trailing hyphen, no consecutive hyphens' };
  if (fm.name.includes('--')) return { ok: false, error: 'name: consecutive hyphens not allowed' };

  if (!fm.description) return { ok: false, error: 'description is required' };
  if (fm.description.length > 1024) return { ok: false, error: 'description max 1024 chars' };

  if (fm.compatibility && fm.compatibility.length > 500) {
    return { ok: false, error: 'compatibility max 500 chars' };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in skill loader (filesystem)
// ─────────────────────────────────────────────────────────────────────────────

const BUILTIN_DIR = path.resolve(__dirname, '..', 'skills');

let _builtinCache: Map<string, SkillMetadata> | null = null;
let _builtinCacheTime = 0;
const BUILTIN_CACHE_TTL_MS = 60_000;   // 1 min in dev; effectively forever in prod since FS doesn't change

function loadBuiltinDirectory(): Map<string, SkillMetadata> {
  if (_builtinCache && Date.now() - _builtinCacheTime < BUILTIN_CACHE_TTL_MS) {
    return _builtinCache;
  }
  const map = new Map<string, SkillMetadata>();
  try {
    if (!fs.existsSync(BUILTIN_DIR)) {
      _builtinCache = map;
      _builtinCacheTime = Date.now();
      return map;
    }
    const entries = fs.readdirSync(BUILTIN_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirName = entry.name;
      const skillFile = path.join(BUILTIN_DIR, dirName, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;
      try {
        const raw = fs.readFileSync(skillFile, 'utf-8');
        const parsed = parseFrontmatter(raw);
        if (!parsed) {
          console.warn(`[SkillRegistry] ${dirName}/SKILL.md: invalid frontmatter`);
          continue;
        }
        const validation = validateSkill(parsed.frontmatter);
        if (!validation.ok) {
          console.warn(`[SkillRegistry] ${dirName}: ${validation.error}`);
          continue;
        }
        if (parsed.frontmatter.name !== dirName) {
          console.warn(`[SkillRegistry] ${dirName}: name "${parsed.frontmatter.name}" does not match directory`);
          continue;
        }
        const fm = parsed.frontmatter;
        const meta: SkillMetadata = {
          name: fm.name,
          description: fm.description,
          source: 'builtin',
          license: fm.license,
          compatibility: fm.compatibility,
          metadata: fm.metadata,
          allowedTools: fm['allowed-tools']?.split(/\s+/).filter(Boolean),
          category: fm.metadata?.category,
          version: fm.metadata?.version,
        };
        map.set(fm.name, meta);
      } catch (e: any) {
        console.warn(`[SkillRegistry] failed to read ${skillFile}: ${e.message}`);
      }
    }
  } catch (e: any) {
    console.warn(`[SkillRegistry] failed to scan ${BUILTIN_DIR}: ${e.message}`);
  }
  _builtinCache = map;
  _builtinCacheTime = Date.now();
  return map;
}

export function invalidateSkillCache(): void {
  _builtinCache = null;
  _builtinCacheTime = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns metadata for all skills available to the given agent.
 *
 * Resolution order:
 *   1. Load built-in skills from filesystem (apps/builder-bot/src/skills/<name>/)
 *   2. Load user skills (owner_user_id = userId)
 *   3. Load imported public skills (is_public = true)
 *   4. Apply per-agent enable/disable from `builder_bot.agent_skills`
 *      — defaults to ENABLED if there's no row
 *
 * Phase 4 will add marketplace + per-agent explicit opt-in for paid skills.
 */
export async function listSkillsForAgent(agentId: number, userId: number): Promise<SkillMetadata[]> {
  const builtin = loadBuiltinDirectory();
  const merged = new Map<string, SkillMetadata>();
  for (const [name, meta] of builtin) merged.set(name, meta);

  // Pull user + public skills + agent_skills disable map (best-effort; fails open)
  let disabled = new Set<string>();
  try {
    const { pool } = require('../db');
    // Skills owned by user OR public
    const userRes = await pool.query(
      `SELECT name, description, license, compatibility, metadata, allowed_tools,
              source, owner_user_id, version, is_public
         FROM builder_bot.skills
        WHERE owner_user_id = $1 OR is_public = TRUE`,
      [userId],
    );
    for (const row of userRes.rows) {
      if (merged.has(row.name)) continue;   // builtin wins on name collision (security)
      const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      merged.set(row.name, {
        name: row.name,
        description: row.description,
        source: row.owner_user_id === userId ? 'user' : 'imported',
        ownerId: row.owner_user_id,
        license: row.license,
        compatibility: row.compatibility,
        metadata: meta,
        allowedTools: row.allowed_tools?.split(/\s+/).filter(Boolean),
        category: meta.category,
        version: row.version,
        is_public: row.is_public,
      } as SkillMetadata & { is_public?: boolean });
    }
    // Disabled skills for this agent (rows where enabled = false)
    const disRes = await pool.query(
      `SELECT skill_name FROM builder_bot.agent_skills
        WHERE agent_id = $1 AND enabled = FALSE`,
      [agentId],
    );
    for (const r of disRes.rows) disabled.add(r.skill_name);
  } catch (e: any) {
    // If DB lookup fails, just return built-in skills (degraded but functional)
    console.warn('[SkillRegistry] DB lookup failed (using builtin only):', e?.message);
  }

  return Array.from(merged.values())
    .filter(s => !disabled.has(s.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Set per-agent enabled/disabled state for a skill.
 * If `enabled === false`, inserts (or updates) a row that excludes the skill
 * from listSkillsForAgent. If `enabled === true`, deletes the row (default = on).
 */
export async function setAgentSkillEnabled(
  agentId: number, skillName: string, enabled: boolean
): Promise<void> {
  const { pool } = require('../db');
  if (enabled) {
    await pool.query(
      `DELETE FROM builder_bot.agent_skills WHERE agent_id = $1 AND skill_name = $2`,
      [agentId, skillName],
    );
  } else {
    await pool.query(
      `INSERT INTO builder_bot.agent_skills (agent_id, skill_name, enabled)
       VALUES ($1, $2, FALSE)
       ON CONFLICT (agent_id, skill_name) DO UPDATE SET enabled = FALSE`,
      [agentId, skillName],
    );
  }
}

/**
 * Loads the full SKILL.md body for a given skill name. Returns null if not found.
 *
 * Resolution: built-in (filesystem) → user-owned skill → public skill.
 */
export async function loadSkillFull(name: string, _agentId?: number, userId?: number): Promise<SkillFull | null> {
  // 1. Built-in lookup (filesystem)
  const skillFile = path.join(BUILTIN_DIR, name, 'SKILL.md');
  if (fs.existsSync(skillFile)) {
    try {
      const raw = fs.readFileSync(skillFile, 'utf-8');
      const parsed = parseFrontmatter(raw);
      if (!parsed) return null;
      const validation = validateSkill(parsed.frontmatter);
      if (!validation.ok) return null;
      const fm = parsed.frontmatter;
      return {
        name: fm.name,
        description: fm.description,
        source: 'builtin',
        license: fm.license,
        compatibility: fm.compatibility,
        metadata: fm.metadata,
        allowedTools: fm['allowed-tools']?.split(/\s+/).filter(Boolean),
        category: fm.metadata?.category,
        version: fm.metadata?.version,
        body: parsed.body,
      };
    } catch (e: any) {
      console.warn(`[SkillRegistry] loadSkillFull ${name}: ${e.message}`);
      return null;
    }
  }
  // 2. DB lookup — user-owned then public
  try {
    const { pool } = require('../db');
    // Prefer user-owned skill (most specific)
    const userRes = await pool.query(
      `SELECT name, description, body, license, compatibility, metadata,
              allowed_tools, source, owner_user_id, version
         FROM builder_bot.skills
        WHERE name = $1
          AND (owner_user_id = $2 OR is_public = TRUE)
        ORDER BY CASE WHEN owner_user_id = $2 THEN 0 ELSE 1 END
        LIMIT 1`,
      [name, userId || 0],
    );
    const row = userRes.rows[0];
    if (!row) return null;
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return {
      name: row.name,
      description: row.description,
      source: row.owner_user_id === userId ? 'user' : 'imported',
      ownerId: row.owner_user_id,
      license: row.license,
      compatibility: row.compatibility,
      metadata: meta,
      allowedTools: row.allowed_tools?.split(/\s+/).filter(Boolean),
      category: meta.category,
      version: row.version,
      body: row.body,
    };
  } catch (e: any) {
    console.warn(`[SkillRegistry] DB loadSkillFull ${name}: ${e?.message}`);
    return null;
  }
}

/**
 * Create or update a user-authored skill. Builtin skills cannot be overwritten
 * via this API — that's by design (security: users shouldn't be able to shadow
 * built-in safety rules).
 *
 * Returns the saved row id.
 */
export async function saveUserSkill(params: {
  userId: number;
  name: string;
  description: string;
  body: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  isPublic?: boolean;
  sourceUrl?: string;
  isImported?: boolean;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  // Block name collision with built-in skills
  const builtin = loadBuiltinDirectory();
  if (builtin.has(params.name)) {
    return { ok: false, error: `Skill name "${params.name}" is reserved (built-in). Pick a different name.` };
  }
  const validation = validateSkill({
    name: params.name,
    description: params.description,
    license: params.license,
    compatibility: params.compatibility,
    metadata: params.metadata,
    'allowed-tools': params.allowedTools?.join(' '),
  });
  if (!validation.ok) {
    return { ok: false, error: validation.error || 'invalid frontmatter' };
  }
  // ── Safety scan — block HIGH-severity injection / exfil patterns ─────────
  const scan = scanSkillBody(params.body);
  if (!scan.safe) {
    return {
      ok: false,
      error: `Safety scan failed (HIGH severity): ${scan.threats.slice(0, 3).join('; ')}. Public skills must pass safety scan.`,
    };
  }
  // Also scan description (shorter but still risky if prompt-injects)
  const descScan = scanSkillBody(params.description);
  if (!descScan.safe) {
    return { ok: false, error: `Description failed safety scan: ${descScan.threats[0]}` };
  }
  // ── Force-private on imports (no auto-public for content from external URLs) ──
  // User must manually mark their own (source='user') skill public AFTER review.
  // Imported skills are PRIVATE to the importing user — they can copy the body
  // into their own skill if they want to publish it.
  let isPublicFinal = !!params.isPublic;
  if (params.isImported && isPublicFinal) {
    isPublicFinal = false;
    console.log(`[SkillRegistry] Forced isPublic=false on imported skill ${params.name} (user ${params.userId})`);
  }
  try {
    const { pool } = require('../db');
    const source = params.isImported ? 'imported' : 'user';
    const allowedTools = params.allowedTools?.join(' ') || null;
    const res = await pool.query(
      `INSERT INTO builder_bot.skills
         (name, description, body, license, compatibility, metadata,
          allowed_tools, source, owner_user_id, source_url, is_public, version)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (name, owner_user_id)
       DO UPDATE SET description = EXCLUDED.description,
                     body = EXCLUDED.body,
                     license = EXCLUDED.license,
                     compatibility = EXCLUDED.compatibility,
                     metadata = EXCLUDED.metadata,
                     allowed_tools = EXCLUDED.allowed_tools,
                     is_public = EXCLUDED.is_public,
                     version = EXCLUDED.version,
                     updated_at = NOW()
       RETURNING id`,
      [
        params.name, params.description, params.body,
        params.license || null, params.compatibility || null,
        JSON.stringify(params.metadata || {}),
        allowedTools, source, params.userId,
        params.sourceUrl || null, isPublicFinal,
        params.metadata?.version || '1.0',
      ],
    );
    return { ok: true, id: res.rows[0].id };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'db insert failed' };
  }
}

/**
 * Delete a user-authored skill. Only the owner can delete.
 */
export async function deleteUserSkill(userId: number, name: string): Promise<boolean> {
  try {
    const { pool } = require('../db');
    const res = await pool.query(
      `DELETE FROM builder_bot.skills WHERE name = $1 AND owner_user_id = $2 RETURNING id`,
      [name, userId],
    );
    return res.rowCount > 0;
  } catch (e: any) {
    console.warn(`[SkillRegistry] deleteUserSkill: ${e?.message}`);
    return false;
  }
}

/**
 * Parse a SKILL.md file (frontmatter + body) — exported for the Studio editor.
 */
export function parseSkillMd(raw: string): { ok: true; fm: SkillFrontmatter; body: string } | { ok: false; error: string } {
  const parsed = parseFrontmatter(raw);
  if (!parsed) return { ok: false, error: 'Missing or malformed YAML frontmatter (--- ... ---)' };
  const v = validateSkill(parsed.frontmatter);
  if (!v.ok) return { ok: false, error: v.error || 'invalid frontmatter' };
  return { ok: true, fm: parsed.frontmatter, body: parsed.body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill safety scanner — detects prompt-injection + code-exec attempts in body
// ─────────────────────────────────────────────────────────────────────────────

interface ScanResult {
  safe: boolean;
  threats: string[];   // human-readable threat list
  severity: 'low' | 'medium' | 'high';
}

/**
 * Scans a SKILL.md body for prompt-injection patterns and embedded malicious
 * code. Returns `safe: false` if any HIGH severity match found.
 *
 * Used by saveUserSkill before persisting AND in scanImportUrl when importing.
 * Built-in skills are NOT scanned (they're trusted; under our own QA).
 */
export function scanSkillBody(body: string): ScanResult {
  const threats: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';

  // ── Tier 1: prompt-injection signatures (HIGH) ──────────────────────────
  const PROMPT_INJECTION = [
    { re: /ignore\s+(all|any|previous|the\s+above|earlier)\s+instructions?/i, label: 'Prompt injection — "ignore all previous instructions"' },
    { re: /forget\s+(everything|all|previous|the\s+above|earlier)/i, label: 'Prompt injection — "forget everything"' },
    { re: /you\s+are\s+now\s+(in\s+)?(developer|admin|root|jailbreak|DAN|sudo)\s+mode/i, label: 'Role override — developer/admin mode prompt' },
    { re: /system\s*[:>]\s*you\s+(are|must|will)\s+/i, label: 'Fake system prompt injection' },
    { re: /<\s*\/?\s*(system|assistant|user|safety|admin)\s*>/i, label: 'Role-tag injection (<system>, <assistant>, etc.)' },
    { re: /api[_\- ]?key\s*[:=]\s*["']?[a-zA-Z0-9_-]{15,}/i, label: 'Leaked API key in body' },
    { re: /AKIA[0-9A-Z]{16}/, label: 'AWS access key fingerprint' },
    { re: /sk-[a-zA-Z0-9-]{30,}/, label: 'OpenAI-style key fingerprint' },
    { re: /sk-ant-[a-zA-Z0-9-]{20,}/, label: 'Anthropic key fingerprint' },
  ];
  for (const p of PROMPT_INJECTION) {
    if (p.re.test(body)) { threats.push(p.label); severity = 'high'; }
  }

  // ── Tier 2: code-exec patterns in body that AI might be tricked into running (MEDIUM) ──
  const CODE_EXEC = [
    { re: /child_process\s*\.\s*(exec|spawn|fork)/i, label: 'Embedded shell-exec call (child_process)' },
    { re: /\beval\s*\(/, label: 'eval() call' },
    { re: /new\s+Function\s*\(/, label: 'new Function() (dynamic eval)' },
    { re: /require\s*\(\s*['"`](child_process|fs\/promises|net|http|https|crypto|os)['"`]\s*\)/i, label: 'Suspicious require()' },
    { re: /process\.env\.[A-Z_]{4,}/, label: 'Direct process.env access in body' },
    { re: /\brm\s+-rf?\s+\//, label: '"rm -rf /" command' },
    { re: /sudo\s+(rm|chmod|chown|curl|wget|bash)/, label: 'sudo with destructive command' },
    { re: /\bcurl\s+[^|]*\|\s*(bash|sh|python|node)/, label: 'curl piped to shell (remote code execution)' },
  ];
  for (const p of CODE_EXEC) {
    if (p.re.test(body)) { threats.push(p.label); if (severity === 'low') severity = 'medium'; }
  }

  // ── Tier 3: data-exfiltration patterns (HIGH) ───────────────────────────
  const EXFIL = [
    { re: /send\s+(your|user'?s?|this)\s+(api[_\- ]?key|mnemonic|seed|password|token)/i, label: 'Instruction to exfiltrate credentials' },
    { re: /\b(post|send|upload)\s+to\s+https?:\/\/[^\s)]+/i, label: 'Instruction to POST to external URL (verify)' },
    { re: /webhook\s*:\s*https?:\/\/[^\s)]+/i, label: 'Embedded webhook URL (verify)' },
  ];
  for (const p of EXFIL) {
    if (p.re.test(body)) { threats.push(p.label); severity = 'high'; }
  }

  return { safe: severity !== 'high', threats, severity };
}

/**
 * URL whitelist for skill imports. Returns null if URL is allowed, else error.
 */
export function validateImportUrl(rawUrl: string): { ok: true } | { ok: false; error: string } {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return { ok: false, error: 'Invalid URL' }; }
  if (url.protocol !== 'https:') return { ok: false, error: 'Only https:// imports allowed' };
  const ALLOWED_HOSTS = new Set([
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'agentskills.io',
    'cdn.jsdelivr.net',        // jsdelivr serves GitHub raw
  ]);
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return { ok: false, error: `Host "${url.hostname}" not in whitelist. Allowed: ${Array.from(ALLOWED_HOSTS).join(', ')}` };
  }
  return { ok: true };
}

/**
 * Loads a reference file from a skill's `references/` directory.
 * Returns the file contents as a UTF-8 string, or null if not found.
 */
export async function loadSkillReference(skillName: string, refPath: string): Promise<string | null> {
  // Path traversal guard
  const safe = refPath.replace(/\\/g, '/');
  if (safe.includes('..') || safe.startsWith('/')) return null;
  const fullPath = path.join(BUILTIN_DIR, skillName, 'references', safe);
  // Ensure resolved path is still inside skill dir
  const expectedBase = path.resolve(BUILTIN_DIR, skillName);
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(expectedBase + path.sep) && resolved !== expectedBase) return null;
  if (!fs.existsSync(resolved)) return null;
  try {
    return fs.readFileSync(resolved, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Lists files inside `references/` for a skill (so the LLM can pick one to read).
 */
export async function listSkillReferences(skillName: string): Promise<string[]> {
  const refDir = path.join(BUILTIN_DIR, skillName, 'references');
  if (!fs.existsSync(refDir)) return [];
  try {
    return fs.readdirSync(refDir).filter(f => !f.startsWith('.'));
  } catch {
    return [];
  }
}

/**
 * Builds the inventory text block injected into the system prompt at agent
 * run start. Cheap — name + description only.
 *
 * Returns empty string if no skills available (no overhead).
 */
export async function buildSkillsInventory(agentId: number, userId: number): Promise<string> {
  const skills = await listSkillsForAgent(agentId, userId);
  if (skills.length === 0) return '';
  const lines = skills.map(s => `  • ${s.name} — ${s.description}`);
  return [
    '',
    '[AGENT SKILLS — Progressive Disclosure]',
    'You have access to specialized skill bundles. Each bundle contains',
    'expert knowledge, tool-selection rules, and step-by-step procedures',
    'for a specific domain. The list below shows only metadata.',
    '',
    'When a user task matches a skill\'s description, you MUST first call',
    'read_skill(name) to load the full instructions BEFORE choosing tools.',
    'Do not guess which tools to use for that domain without reading the',
    'skill — that is the most common cause of wrong-tool errors.',
    '',
    'Available skills:',
    ...lines,
    '',
    'Spec: https://agentskills.io',
  ].join('\n');
}
