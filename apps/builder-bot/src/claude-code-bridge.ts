/**
 * Claude Code Bridge — uses the local Claude Code CLI (ccd-cli) for AI completions.
 * This uses the user's Claude Code subscription (Max/Pro) instead of API keys.
 * Auto-detects the CLI binary location and handles token refresh transparently.
 *
 * Usage:
 *   const result = await claudeCodeComplete(systemPrompt, userMessage, { maxTokens: 4096 });
 *   console.log(result.text);
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// ── CLI binary detection ─────────────────────────────────────────────────────

const CLAUDE_CLI_PATHS = [
  // Remote connection CLI (most common on servers)
  path.join(process.env.HOME || '/root', '.claude', 'remote', 'ccd-cli'),
  // Global npm install
  '/usr/local/bin/claude',
  '/usr/bin/claude',
  // npx fallback (slowest)
  'npx',
];

let _cachedCliPath: string | null = null;

function findClaudeCli(): string | null {
  if (_cachedCliPath) return _cachedCliPath;

  for (const p of CLAUDE_CLI_PATHS) {
    if (p === 'npx') {
      // npx is always available but slow — use as last resort
      _cachedCliPath = 'npx';
      return _cachedCliPath;
    }
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        _cachedCliPath = p;
        console.log(`[ClaudeCodeBridge] Found CLI at: ${p}`);
        return p;
      }
    } catch {}
  }

  console.warn('[ClaudeCodeBridge] No Claude Code CLI found');
  return null;
}

// ── Completion interface ─────────────────────────────────────────────────────

export interface ClaudeCodeOptions {
  maxTokens?: number;
  model?: string;
  fallbackModel?: string;
  maxBudgetUsd?: number;
  timeout?: number; // ms, default 120000
  systemPrompt?: string;
  jsonSchema?: Record<string, any>;
  allowedTools?: string[];
}

export interface ClaudeCodeResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  sessionId?: string;
}

/**
 * Execute a Claude Code completion using the local CLI.
 * Uses the user's Claude subscription — no API key needed.
 */
export async function claudeCodeComplete(
  prompt: string,
  options: ClaudeCodeOptions = {},
): Promise<ClaudeCodeResult> {
  const cliPath = findClaudeCli();
  if (!cliPath) {
    throw new Error('CLAUDE_CLI_NOT_FOUND');
  }

  const {
    maxTokens = 4096,
    model,
    fallbackModel,
    maxBudgetUsd,
    timeout = 120_000,
    systemPrompt,
    jsonSchema,
    allowedTools,
  } = options;

  // Build args
  const args: string[] = [];

  if (cliPath === 'npx') {
    args.push('@anthropic-ai/claude-code');
  }

  args.push('--print');
  args.push('--output-format', 'json');
  args.push('--max-turns', '1'); // single completion, no multi-turn
  args.push('--no-session-persistence'); // don't save session

  if (systemPrompt) {
    args.push('--append-system-prompt', systemPrompt);
  }
  if (model) {
    args.push('--model', model);
  }
  if (fallbackModel) {
    args.push('--fallback-model', fallbackModel);
  }
  if (maxBudgetUsd) {
    args.push('--max-budget-usd', String(maxBudgetUsd));
  }
  if (jsonSchema) {
    args.push('--json-schema', JSON.stringify(jsonSchema));
  }
  if (allowedTools && allowedTools.length) {
    args.push('--allowedTools', ...allowedTools);
  }

  // The prompt itself
  args.push(prompt);

  return new Promise<ClaudeCodeResult>((resolve, reject) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const proc = spawn(cliPath === 'npx' ? 'npx' : cliPath, args, {
      cwd: process.env.HOME || '/root',
      timeout,
      env: {
        ...process.env,
        // Disable interactive features
        CLAUDE_CODE_NON_INTERACTIVE: '1',
        CI: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const durationMs = Date.now() - startTime;

      if (code !== 0) {
        const errMsg = stderr || stdout || `CLI exited with code ${code}`;
        // Check for auth issues
        if (errMsg.includes('not logged in') || errMsg.includes('authenticate') || errMsg.includes('unauthorized')) {
          reject(new Error('CLAUDE_AUTH_REQUIRED'));
        } else if (errMsg.includes('rate limit') || errMsg.includes('overloaded')) {
          reject(new Error('CLAUDE_RATE_LIMITED'));
        } else {
          reject(new Error(`CLAUDE_CLI_ERROR: ${errMsg.slice(0, 500)}`));
        }
        return;
      }

      try {
        // Parse JSON output
        const result = JSON.parse(stdout);

        // The JSON output format from claude --print --output-format json:
        // { result: string, is_error: boolean, session_id: string,
        //   total_cost_usd: number, total_input_tokens: number, total_output_tokens: number,
        //   model: string, ... }
        if (result.is_error) {
          reject(new Error(result.result || 'Unknown Claude error'));
          return;
        }

        resolve({
          text: result.result || '',
          model: result.model || model || 'unknown',
          inputTokens: result.total_input_tokens || 0,
          outputTokens: result.total_output_tokens || 0,
          costUsd: result.total_cost_usd || 0,
          durationMs,
          sessionId: result.session_id,
        });
      } catch (parseErr) {
        // If not valid JSON, treat stdout as plain text response
        if (stdout.trim()) {
          resolve({
            text: stdout.trim(),
            model: model || 'unknown',
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            durationMs,
          });
        } else {
          reject(new Error(`CLAUDE_PARSE_ERROR: ${(parseErr as Error).message}`));
        }
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`CLAUDE_SPAWN_ERROR: ${err.message}`));
    });

    // Close stdin immediately (we pass prompt via args, not stdin)
    proc.stdin.end();
  });
}

/**
 * Check if Claude Code CLI is available and authenticated.
 */
export async function isClaudeCodeAvailable(): Promise<boolean> {
  const cli = findClaudeCli();
  if (!cli || cli === 'npx') return false;

  try {
    return new Promise((resolve) => {
      const proc = spawn(cli, ['--version'], { timeout: 5000 });
      let out = '';
      proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
      proc.on('close', (code) => {
        resolve(code === 0 && out.includes('Claude Code'));
      });
      proc.on('error', () => resolve(false));
    });
  } catch {
    return false;
  }
}

/**
 * Convenience wrapper for chat-completion style usage.
 * Maps the familiar messages format to Claude Code CLI.
 */
export async function claudeCodeChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: ClaudeCodeOptions = {},
): Promise<{ text: string; model: string }> {
  // Extract system prompt
  const systemMessages = messages.filter(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');

  const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
  const userPrompt = userMessages.map(m => {
    if (m.role === 'assistant') return `[Previous AI response]: ${m.content}`;
    return m.content;
  }).join('\n\n');

  const result = await claudeCodeComplete(userPrompt, {
    ...options,
    systemPrompt: systemPrompt || options.systemPrompt,
  });

  return { text: result.text, model: result.model };
}
