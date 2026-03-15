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
import * as os from 'os';

// ── CLI binary detection ─────────────────────────────────────────────────────

const CLAUDE_CLI_PATHS = [
  // Global npm install (works with CLAUDE_CODE_OAUTH_TOKEN)
  '/usr/local/bin/claude',
  '/usr/bin/claude',
  // Remote connection CLI (may not support OAuth token)
  path.join(process.env.HOME || '/root', '.claude', 'remote', 'ccd-cli'),
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
  } else {
    args.push('--tools', ''); // no built-in tools — just answer the prompt, don't browse/search
  }

  // For long prompts, write to temp file and pipe via shell
  const useStdin = prompt.length > 4000;
  args.push('--max-turns', useStdin ? '3' : '1'); // stdin pipe consumes 1 turn; extra turn for retries
  let tempFile = '';
  if (!useStdin) {
    args.push(prompt);
  } else {
    // Write prompt to temp file — don't add '-' flag, just pipe to stdin
    tempFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
    fs.writeFileSync(tempFile, prompt, 'utf8');
    console.log(`[ClaudeCodeBridge] Long prompt (${prompt.length} chars) → temp file: ${tempFile}`);
  }

  return new Promise<ClaudeCodeResult>((resolve, reject) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    let proc: ReturnType<typeof spawn>;

    if (useStdin && tempFile) {
      // Use execFile with shell to pipe file content — more reliable than Node.js stdin.write
      const cliCmd = cliPath === 'npx' ? 'npx @anthropic-ai/claude-code' : cliPath;
      const argsStr = args.map(a => {
        // Escape single quotes in arg values
        if (a === '-') return '-';
        return `'${a.replace(/'/g, "'\\''")}'`;
      }).join(' ');
      const shellCmd = `cat '${tempFile}' | ${cliCmd} ${argsStr}`;

      proc = spawn('bash', ['-c', shellCmd], {
        cwd: process.env.HOME || '/root',
        env: (() => {
          const e: any = { ...process.env, CLAUDE_CODE_NON_INTERACTIVE: '1', CI: '1' };
          delete e.ANTHROPIC_API_KEY;
          return e;
        })(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      proc = spawn(cliPath === 'npx' ? 'npx' : cliPath, args, {
        cwd: process.env.HOME || '/root',
        env: (() => {
          const e: any = { ...process.env, CLAUDE_CODE_NON_INTERACTIVE: '1', CI: '1' };
          delete e.ANTHROPIC_API_KEY;
          return e;
        })(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

    // Safety timeout — kill process if it runs too long
    const safetyTimer = setTimeout(() => {
      console.warn(`[ClaudeCodeBridge] Safety timeout (${timeout}ms) — killing CLI process`);
      proc.kill('SIGKILL');
    }, timeout);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(safetyTimer);
      const durationMs = Date.now() - startTime;

      // Cleanup temp file if used
      if (tempFile) {
        try { fs.unlinkSync(tempFile); } catch {}
      }

      // Debug: log raw output for troubleshooting
      if (stdout.length < 100 || !stdout.trim()) {
        console.warn(`[ClaudeCodeBridge] Raw stdout (${stdout.length} chars): ${stdout.slice(0, 500)}`);
        console.warn(`[ClaudeCodeBridge] Raw stderr (${stderr.length} chars): ${stderr.slice(0, 500)}`);
      }

      // Even on non-zero exit, stdout may contain valid JSON with result
      if (code !== 0) {
        console.warn(`[ClaudeCodeBridge] Non-zero exit=${code}, stdout=${stdout.slice(0, 400)}, stderr=${stderr.slice(0, 200)}`);
        // Try parsing stdout as JSON first — Claude Code sometimes exits non-zero but has a valid response
        try {
          const parsed = JSON.parse(stdout);
          // If result has real content and isn't an auth/config error, treat as valid
          const errPatterns = ['Invalid API key', 'Fix external', 'not logged in', 'authenticate', 'unauthorized'];
          const isRealError = errPatterns.some(p => (parsed.result || '').includes(p));
          if (parsed.result && !isRealError && (!parsed.is_error || (parsed.subtype === 'success' && parsed.result.length > 50))) {
            // Actually successful despite non-zero exit code
            const modelUsageKeys = parsed.modelUsage ? Object.keys(parsed.modelUsage) : [];
            const usedModel = modelUsageKeys[0] || parsed.model || model || 'unknown';
            const mu = parsed.modelUsage?.[usedModel] || {};
            resolve({
              text: parsed.result,
              model: usedModel,
              inputTokens: mu.inputTokens || 0,
              outputTokens: mu.outputTokens || 0,
              costUsd: parsed.total_cost_usd || 0,
              durationMs,
              sessionId: parsed.session_id,
            });
            return;
          }
        } catch {}

        const errMsg = stderr || stdout || `CLI exited with code ${code}`;
        if (errMsg.includes('not logged in') || errMsg.includes('authenticate') || errMsg.includes('unauthorized')) {
          reject(new Error('CLAUDE_AUTH_REQUIRED'));
        } else if (errMsg.includes('rate limit') || errMsg.includes('overloaded')) {
          reject(new Error('CLAUDE_RATE_LIMITED'));
        } else {
          reject(new Error(`CLAUDE_CLI_ERROR: ${errMsg.slice(0, 800)}`));
        }
        return;
      }

      try {
        // Parse JSON output
        const result = JSON.parse(stdout);
        console.log(`[ClaudeCodeBridge] Parsed JSON: is_error=${result.is_error}, result_type=${typeof result.result}, result_len=${(result.result || '').length}, cost=$${result.total_cost_usd || 0}, model_keys=${Object.keys(result.modelUsage || {}).join(',')}, stop=${result.stop_reason}, subtype=${result.subtype}`);
        if ((result.result || '').length === 0) {
          console.log(`[ClaudeCodeBridge] Empty result! Full JSON keys: ${Object.keys(result).join(',')}`);
          console.log(`[ClaudeCodeBridge] result field raw: ${JSON.stringify(result.result)}`);
          // Check if there's text content elsewhere
          if (result.text) console.log(`[ClaudeCodeBridge] Found text field: ${String(result.text).slice(0, 200)}`);
          if (result.content) console.log(`[ClaudeCodeBridge] Found content field: ${JSON.stringify(result.content).slice(0, 200)}`);
          if (result.output) console.log(`[ClaudeCodeBridge] Found output field: ${String(result.output).slice(0, 200)}`);
        }

        // Claude Code CLI v2 JSON format:
        // { type: "result", subtype: "success", is_error: bool, result: string,
        //   total_cost_usd: number, usage: { input_tokens, output_tokens },
        //   modelUsage: { "model-name": { inputTokens, outputTokens, costUSD } },
        //   session_id: string, duration_ms: number }
        if (result.is_error) {
          console.warn(`[ClaudeCodeBridge] is_error=true, result: ${(result.result || '').slice(0, 300)}`);
          // If result contains actual text content (not just an error), treat as success
          if (result.result && result.result.length > 50 && result.subtype === 'success') {
            console.log(`[ClaudeCodeBridge] Treating is_error+success as valid response`);
            // Fall through to success handler
          } else {
            reject(new Error(result.result || 'Unknown Claude error'));
            return;
          }
        }

        // Extract model name from modelUsage keys
        const modelUsageKeys = result.modelUsage ? Object.keys(result.modelUsage) : [];
        const usedModel = modelUsageKeys[0] || result.model || model || 'unknown';
        const mu = result.modelUsage?.[usedModel] || {};

        resolve({
          text: result.result || '',
          model: usedModel,
          inputTokens: mu.inputTokens || result.usage?.input_tokens || result.total_input_tokens || 0,
          outputTokens: mu.outputTokens || result.usage?.output_tokens || result.total_output_tokens || 0,
          costUsd: result.total_cost_usd || mu.costUSD || 0,
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

    // Close stdin if not already closed via useStdin
    if (!useStdin) {
      proc.stdin.end();
    }
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
