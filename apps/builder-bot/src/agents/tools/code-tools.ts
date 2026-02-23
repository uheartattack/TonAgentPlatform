import OpenAI from 'openai';
import { ToolResult } from './db-tools';
import { getSkillDocsForCodeGeneration } from '../../plugins-system';

// ===== Инициализация API =====

// CLIProxyAPIPlus — OpenAI-совместимый прокси (всегда локальный 127.0.0.1)
// НЕ используем OPENAI_BASE_URL — он может указывать на другой хост (192.168.0.x)
const PROXY_API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || 'ton-agent-key-123';
const PROXY_BASE_URL = `${process.env.CLAUDE_BASE_URL || 'http://127.0.0.1:8317'}/v1`;

// OpenAI-совместимый клиент для прокси
const openai = new OpenAI({
  apiKey: PROXY_API_KEY,
  baseURL: PROXY_BASE_URL,
});
// Основная модель — та же что использует orchestrator (Claude Chat Model из .env)
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';

// Qwen3-Coder-Next через OpenRouter (если задан ключ)
// Если не задан — Claude через прокси для всего
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const QWEN_MODEL = process.env.OPENROUTER_MODEL || 'qwen/qwen3-coder-next';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Результат генерации кода
export interface CodeGenerationResult {
  code: string;
  explanation: string;
  placeholders?: Array<{ name: string; description: string; example?: string }>;
}

// ===== Вспомогательная функция: retry с паузой =====

function parseCooldownMs(errMsg: string): number {
  // "kiro: token is in cooldown for 44.285s"
  const match = errMsg.match(/cooldown for (\d+(?:\.\d+)?)s/);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  return 5000;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Fallback chain: сначала kiro, потом antigravity (разные rate limit пулы!) ──
// Если kiro-aws в cooldown — antigravity модели работают независимо
const MODEL_FALLBACK_CHAIN = [
  'kiro-qwen3-coder-next',       // Qwen специально для кода (kiro-aws)
  CLAUDE_MODEL,                   // основная из .env (aws)
  'claude-sonnet-4-5-20250929',   // kiro-aws
  'claude-opus-4-6',              // kiro-aws
  // ── Antigravity: независимый rate limit, не зависят от kiro cooldown ──
  'claude-sonnet-4-6',            // antigravity Claude
  'gemini-2.5-flash',             // antigravity Gemini
  'gemini-2.5-flash-lite',        // antigravity Gemini lite
  'gemini-3-flash',               // antigravity Gemini 3
].filter((m, i, a) => a.indexOf(m) === i); // убрать дубли

async function callClaudeWithRetry(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000,
  _retries = 2
): Promise<string> {
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user'   as const, content: userPrompt   },
  ];

  // ── Проход 1: пробуем все модели, без ожидания при cooldown ─
  let minCooldownMs = Infinity; // минимальный оставшийся cooldown среди kiro-моделей

  for (const model of MODEL_FALLBACK_CHAIN) {
    try {
      const response = await openai.chat.completions.create({
        model, max_tokens: maxTokens, messages, temperature: 0.3,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from proxy');
      console.log(`[CodeTools] ✅ success: ${model}`);
      return content;
    } catch (err: any) {
      const msg: string = err?.message || err?.error?.message || String(err);
      const isCooldown = msg.includes('cooldown');
      const isRetryable = isCooldown ||
        msg.includes('INSUFFICIENT_MODEL_CAPACITY') ||
        msg.includes('high traffic') ||
        msg.includes('exhausted') ||
        msg.includes('timed out') || msg.includes('timeout') ||
        msg.includes('Permission denied') || // antigravity 403
        msg.includes('503') || msg.includes('502') ||
        msg.includes('ECONNRESET') || msg.includes('Empty response');

      if (isRetryable) {
        if (isCooldown) {
          const cdMs = parseCooldownMs(msg);
          if (cdMs < minCooldownMs) minCooldownMs = cdMs;
          console.warn(`[CodeTools] ${model} kiro cooldown ${(cdMs / 1000).toFixed(0)}s → next`);
        } else {
          console.warn(`[CodeTools] ${model} skip: ${msg.slice(0, 70)}`);
        }
        continue; // следующая модель
      }
      throw err; // auth/network — пробрасываем
    }
  }

  // ── Проход 2: если все модели в kiro cooldown — ждём и ретраим ──
  if (minCooldownMs < Infinity) {
    const waitSec = Math.ceil(minCooldownMs / 1000) + 3;
    console.warn(`[CodeTools] All models in kiro cooldown. Waiting ${waitSec}s then retrying...`);
    await sleep(minCooldownMs + 3000);

    for (const model of MODEL_FALLBACK_CHAIN) {
      try {
        const response = await openai.chat.completions.create({
          model, max_tokens: maxTokens, messages, temperature: 0.3,
        });
        const content = response.choices[0]?.message?.content;
        if (content) {
          console.log(`[CodeTools] ✅ post-cooldown success: ${model}`);
          return content;
        }
      } catch (e: any) {
        console.warn(`[CodeTools] post-cooldown ${model} failed: ${String(e?.message).slice(0, 60)}`);
      }
    }
  }

  throw new Error('Сервер AI временно перегружен (rate limit). Попробуйте через минуту.');
}

// ===== Запрос к Qwen / лучшей coding-модели =====
// Приоритет: kiro-qwen3-coder-next (локальный прокси) → OpenRouter → Claude fallback chain

async function callQwen(systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<string> {
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user'   as const, content: userPrompt   },
  ];

  // 1) kiro-qwen3-coder-next через локальный прокси (доступен в CLIProxyAPIPlus)
  try {
    const response = await openai.chat.completions.create({
      model: 'kiro-qwen3-coder-next',
      max_tokens: maxTokens,
      messages,
      temperature: 0.2,
    });
    const content = response.choices[0]?.message?.content;
    if (content) {
      console.log('[CodeTools] ✅ kiro-qwen3-coder-next success');
      return content;
    }
  } catch (err: any) {
    const msg: string = err?.message || String(err);
    if (msg.includes('cooldown')) {
      console.warn(`[CodeTools] kiro-qwen3-coder-next in cooldown → fallback chain`);
    } else {
      console.warn(`[CodeTools] kiro-qwen3-coder-next error: ${msg.slice(0, 80)} → fallback`);
    }
  }

  // 2) OpenRouter (если задан ключ)
  if (OPENROUTER_API_KEY) {
    try {
      const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://ton-agent-platform.com',
          'X-Title': 'TON Agent Platform Builder Bot',
        },
        body: JSON.stringify({
          model: QWEN_MODEL,
          messages,
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const content = data.choices?.[0]?.message?.content;
        if (content && !data.error) {
          console.log('[CodeTools] ✅ OpenRouter success');
          return content;
        }
      }
      console.warn(`[CodeTools] OpenRouter failed ${response.status} → Claude chain`);
    } catch (err) {
      console.warn('[CodeTools] OpenRouter exception → Claude chain');
    }
  }

  // 3) Fallback chain: kiro models → antigravity (claude-sonnet-4-6, gemini-*)
  return callClaudeWithRetry(systemPrompt, userPrompt, maxTokens);
}

// ===== Алиас для читаемости =====
async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<string> {
  return callClaudeWithRetry(systemPrompt, userPrompt, maxTokens);
}

// ===== Класс инструментов для работы с кодом =====

export class CodeTools {

  // Генерация кода агента (Qwen3-Coder-Next — лучший для кода)
  async generateAgentCode(params: {
    description: string;
    knownParams?: Record<string, any>;
    constraints?: string[];
    language?: 'javascript' | 'typescript' | 'python';
  }): Promise<ToolResult<CodeGenerationResult>> {
    try {
      const lang = params.language || 'javascript';

      // Инжектируем документацию плагинов (OpenClaw SKILL.md pattern)
      const skillDocs = getSkillDocsForCodeGeneration();

      const systemPrompt = `You are the AI Agent Builder for TON Agent Platform — a cloud platform where users create autonomous agents that run 24/7. You write ALL the code FOR the user. They describe what they want in plain language, you build it.

━━━ EXECUTION ENVIRONMENT ━━━
• Node.js 18+ in vm2 sandbox. global fetch() available. Async/await fully supported.
• NO: require(), import, fs, process.env, setTimeout, setInterval (platform handles scheduling)
• context = { userId, agentId, config: {}, soul } — passed automatically at runtime

━━━ BUILT-IN FUNCTIONS (always available, no import needed) ━━━

  notify(text)                    — send Telegram message to user. THE ONLY WAY to message user.
  getTonBalance(address)          — returns TON balance as float (e.g. 5.2341). Handles nanotons.
  getPrice("TON")                 — returns USD price from CoinGecko (e.g. 3.21)
  getState("key")                 — get persistent value from previous run (null if first run)
  setState("key", value)          — save value for next run (survives between scheduled runs)
  agent_send(agentId, data)       — send data to another agent
  agent_receive()                 — receive messages from other agents
  console.log(...)                — write to execution logs (NOT to Telegram)

━━━ GOLDEN RULE: HOW TO NOTIFY USER ━━━
ALWAYS use notify(). NEVER call Telegram API directly. notify() is the ONLY correct way.

  // ✅ CORRECT:
  notify("💰 Balance: 5.23 TON");

  // ❌ WRONG (will fail — no require/fetch to Telegram possible):
  fetch("https://api.telegram.org/bot.../sendMessage", ...)

━━━ PATTERN: CHANGE DETECTION (notify only when something changes) ━━━
  const prev = getState('val');
  const cur = await getTonBalance(WALLET);
  if (prev === null) {
    notify('✅ Monitoring started. Balance: ' + cur.toFixed(4) + ' TON');
  } else if (Math.abs(cur - prev) > 0.001) {
    notify('📊 Changed: ' + prev.toFixed(4) + ' → ' + cur.toFixed(4) + ' TON');
  }
  setState('val', cur);

━━━ CODE STYLE ━━━
Write the agent as "async function agent(context)". It will be called automatically.
Keep code simple and readable. Use try/catch. Return { success, result, summary }.

━━━ EXAMPLE ━━━
async function agent(context) {
  const WALLET = context.config.WALLET_ADDRESS || '{{WALLET_ADDRESS}}';
  try {
    const prev = getState('balance');
    const balance = await getTonBalance(WALLET);
    if (prev === null) {
      notify('✅ Мониторинг запущен\\n💰 Баланс: ' + balance.toFixed(4) + ' TON');
    } else if (Math.abs(balance - prev) > 0.001) {
      const diff = balance - prev;
      notify((diff > 0 ? '📈 Пришло ' : '📉 Ушло ') + Math.abs(diff).toFixed(4) + ' TON\\n💰 Баланс: ' + balance.toFixed(4) + ' TON');
    }
    setState('balance', balance);
    return { success: true, result: { balance }, summary: 'Баланс: ' + balance.toFixed(4) + ' TON' };
  } catch (e) {
    notify('❌ Ошибка: ' + e.message);
    return { success: false, error: e.message };
  }
}

━━━ AVAILABLE APIs (public, no auth needed) ━━━
TON: toncenter.com/api/v2/getAddressBalance?address=X | tonapi.io/v2/accounts/X/events | tonapi.io/v2/accounts/X/jettons/balances
Prices: api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd | api.binance.com/api/v3/ticker/price?symbol=TONUSDT
Any other public REST API — just use fetch()

━━━ PLACEHOLDERS ━━━
Use {{NAME}} for values user must configure. Read from context.config:
  const ADDR = context.config.WALLET_ADDRESS || '{{WALLET_ADDRESS}}';
  const THRESHOLD = parseFloat(context.config.THRESHOLD || '1');

━━━ OUTPUT FORMAT ━━━
Return ONLY the raw code starting with "async function agent(context) {".
NO markdown blocks, NO backticks, NO explanations, NO imports.${skillDocs}`;

      const userPrompt = `Build a fully functional agent for this goal: ${params.description}

${params.knownParams && Object.keys(params.knownParams).length > 0
  ? `\nUser provided parameters:\n${Object.entries(params.knownParams)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n')}\n`
  : ''}
Think step by step what the user actually wants to achieve, then write complete working code.
Return ONLY the executable async function — no markdown, no preamble.`;

      // Используем Qwen3-Coder-Next для генерации кода
      let generatedCode = await callQwen(systemPrompt, userPrompt, 4000);

      // Очищаем от markdown-блоков если вернулись
      generatedCode = this.cleanCodeBlocks(generatedCode);

      // Извлекаем плейсхолдеры
      const placeholders = this.extractPlaceholders(generatedCode);

      // Генерируем объяснение через Claude (лучше для естественного языка)
      const explanation = await this.generateExplanation(generatedCode, params.description);

      return {
        success: true,
        data: {
          code: generatedCode,
          explanation,
          placeholders: placeholders.length > 0 ? placeholders : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка генерации кода: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Редактирование существующего кода (Qwen3-Coder-Next)
  async modifyCode(params: {
    currentCode: string;
    modificationRequest: string;
    preserveLogic?: boolean;
  }): Promise<ToolResult<{ code: string; changes: string }>> {
    try {
      const systemPrompt = `You are a precise code editor powered by Qwen3-Coder-Next.
Your task is to modify code according to user request.

STRICT RULES:
1. Change ONLY what was explicitly requested
2. Preserve ALL other logic and functionality
3. Maintain exact code style and structure
4. Keep all existing error handling
5. Return ONLY the complete modified function
6. NO markdown, NO code blocks, NO explanations — just raw code

${params.preserveLogic !== false ? 'CRITICAL: Do NOT remove or modify any logic unrelated to the requested change.' : ''}`;

      const userPrompt = `Current code:
${params.currentCode}

Modification request: ${params.modificationRequest}

Return the complete modified code WITHOUT markdown blocks.`;

      // Используем Qwen3-Coder-Next для редактирования
      let modifiedCode = await callQwen(systemPrompt, userPrompt, 4000);
      modifiedCode = this.cleanCodeBlocks(modifiedCode);

      // Анализируем изменения через Claude
      const changes = await this.analyzeChanges(params.currentCode, modifiedCode);

      return {
        success: true,
        data: {
          code: modifiedCode,
          changes,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка модификации кода: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Объяснение кода (Claude — лучше для естественного языка)
  async explainCode(params: {
    code: string;
    question?: string;
    detailLevel?: 'brief' | 'normal' | 'detailed';
    language?: 'ru' | 'en';
  }): Promise<ToolResult<string>> {
    try {
      const detailInstructions = {
        brief: 'Give a brief 2-3 sentence summary.',
        normal: 'Explain main functionality in 1-2 paragraphs.',
        detailed: 'Provide detailed step-by-step explanation of what each part does.',
      };

      const systemPrompt = `You are a code explanation assistant. Explain code clearly and concisely.

${detailInstructions[params.detailLevel || 'normal']}

Respond in ${params.language === 'en' ? 'English' : 'Russian'}.
Use simple language that non-developers can understand.`;

      const userPrompt = params.question
        ? `Code:\n\`\`\`javascript\n${params.code}\n\`\`\`\n\nQuestion: ${params.question}`
        : `Explain what this code does:\n\`\`\`javascript\n${params.code}\n\`\`\``;

      // Используем Claude для объяснений
      const explanation = await callClaude(systemPrompt, userPrompt, 2000);

      return {
        success: true,
        data: explanation,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка объяснения: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Поиск багов (Claude — аналитика)
  async findBugs(params: {
    code: string;
    expectedBehavior?: string;
  }): Promise<ToolResult<Array<{
    line?: number;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestion: string;
  }>>> {
    try {
      const systemPrompt = `You are a code review expert. Find bugs, issues, and potential problems in the provided code.

Analyze for:
1. Syntax errors
2. Logic errors
3. Unhandled exceptions
4. Infinite loops or recursion
5. Security vulnerabilities
6. Performance problems
7. Undefined variable usage
8. Type errors

For each issue found, provide:
- Line number (if identifiable)
- Severity: critical/high/medium/low
- Clear description of the issue
- Specific fix suggestion

Format each issue as:
LINE: [number or N/A]
SEVERITY: [level]
ISSUE: [description]
FIX: [suggestion]
---`;

      const userPrompt = `Review this code for bugs and issues:
\`\`\`javascript
${params.code}
\`\`\`

${params.expectedBehavior ? `Expected behavior: ${params.expectedBehavior}` : ''}

List ALL issues found.`;

      // Используем Claude для поиска багов
      const responseText = await callClaude(systemPrompt, userPrompt, 3000);
      const bugs = this.parseBugReport(responseText);

      return {
        success: true,
        data: bugs,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка анализа: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Предложение исправлений (Qwen3-Coder-Next для кода + Claude для объяснения)
  async suggestFix(params: {
    code: string;
    issue: string;
  }): Promise<ToolResult<{ fixedCode: string; explanation: string }>> {
    try {
      // Исправляем код через Qwen
      const codeSystemPrompt = `You are a code fix expert. Fix ONLY the described issue in the provided code.
Return ONLY the fixed function without markdown blocks or explanations.`;

      const codeUserPrompt = `Code:\n${params.code}\n\nIssue to fix: ${params.issue}\n\nReturn the fixed code only.`;

      let fixedCode = await callQwen(codeSystemPrompt, codeUserPrompt, 3000);
      fixedCode = this.cleanCodeBlocks(fixedCode);

      // Объясняем изменения через Claude
      const explainSystemPrompt = `You are a helpful assistant. Briefly explain (2-3 sentences in Russian) what was changed in the code to fix the issue.`;
      const explainUserPrompt = `Issue: ${params.issue}\n\nOriginal code:\n${params.code}\n\nFixed code:\n${fixedCode}`;

      const explanation = await callClaude(explainSystemPrompt, explainUserPrompt, 500);

      return {
        success: true,
        data: { fixedCode, explanation },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка генерации исправления: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Анализ соответствия кода задаче (Claude)
  async analyzeCodeIntent(params: {
    code: string;
    intendedPurpose: string;
  }): Promise<ToolResult<{
    matches: boolean;
    confidence: number;
    analysis: string;
  }>> {
    try {
      const systemPrompt = `You are a code intent analyzer. Compare provided code against its intended purpose.

Return ONLY valid JSON in this exact format:
{
  "matches": true or false,
  "confidence": number from 0 to 100,
  "analysis": "brief explanation"
}`;

      const userPrompt = `Intended purpose: ${params.intendedPurpose}

Code:
\`\`\`javascript
${params.code}
\`\`\`

Does this code match its intended purpose? Return JSON only.`;

      const responseText = await callClaude(systemPrompt, userPrompt, 1000);

      try {
        // Извлекаем JSON из ответа
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            success: true,
            data: parsed,
          };
        }
        throw new Error('No JSON found');
      } catch {
        return {
          success: true,
          data: {
            matches: true,
            confidence: 70,
            analysis: responseText,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Ошибка анализа: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ===== Вспомогательные методы =====

  private cleanCodeBlocks(code: string): string {
    // Убираем markdown-блоки если модель вернула их
    return code
      .replace(/^```[\w]*\n?/gm, '')
      .replace(/```$/gm, '')
      .trim();
  }

  private extractPlaceholders(code: string): Array<{ name: string; description: string; example?: string }> {
    const placeholderRegex = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;
    const matches = [...code.matchAll(placeholderRegex)];
    const unique = [...new Set(matches.map((m) => m[1]))];

    return unique.map((name) => ({
      name,
      description: `Значение для ${name.replace(/_/g, ' ').toLowerCase()}`,
      example: this.getPlaceholderExample(name),
    }));
  }

  private getPlaceholderExample(name: string): string {
    const examples: Record<string, string> = {
      WALLET_ADDRESS: 'EQD...',
      API_KEY: 'your-api-key-here',
      CONTRACT_ADDRESS: 'EQC...',
      TOKEN_ADDRESS: 'EQA...',
      AMOUNT: '100',
      RECIPIENT: 'EQD...',
      ENDPOINT: 'https://api.example.com',
      SECRET_KEY: 'your-secret-key',
      CHAT_ID: '-100123456789',
      BOT_TOKEN: '123456:ABC...',
    };
    return examples[name] || 'your-value-here';
  }

  private async generateExplanation(code: string, description: string): Promise<string> {
    try {
      const explanation = await callClaude(
        'Explain in 2-3 sentences in Russian what this agent does. Be specific and clear.',
        `Agent description: ${description}\n\nAgent code:\n${code}`
      );
      return explanation;
    } catch {
      return 'Агент создан на основе вашего описания';
    }
  }

  private async analyzeChanges(oldCode: string, newCode: string): Promise<string> {
    try {
      const changes = await callClaude(
        'In 1-2 sentences in Russian, briefly describe what changed between these two code versions.',
        `Old code:\n${oldCode}\n\nNew code:\n${newCode}`
      );
      return changes;
    } catch {
      return 'Код изменён';
    }
  }

  private parseBugReport(text: string): Array<{
    line?: number;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestion: string;
  }> {
    const bugs: Array<any> = [];

    // Парсим structured формат
    const sections = text.split('---').filter(s => s.trim());

    for (const section of sections) {
      const lineMatch = section.match(/LINE:\s*(\d+)/i);
      const severityMatch = section.match(/SEVERITY:\s*(critical|high|medium|low)/i);
      const issueMatch = section.match(/ISSUE:\s*(.+?)(?=FIX:|$)/is);
      const fixMatch = section.match(/FIX:\s*(.+?)$/is);

      if (issueMatch) {
        bugs.push({
          line: lineMatch ? parseInt(lineMatch[1]) : undefined,
          issue: issueMatch[1].trim(),
          severity: (severityMatch?.[1].toLowerCase() as any) || 'medium',
          suggestion: fixMatch?.[1].trim() || 'Review and fix the issue',
        });
      }
    }

    // Fallback если формат другой
    if (bugs.length === 0) {
      const lines = text.split('\n');
      for (const line of lines) {
        const severityMatch = line.match(/(critical|high|medium|low)/i);
        if (line.trim() && line.length > 20 && severityMatch) {
          bugs.push({
            issue: line.trim(),
            severity: severityMatch[1].toLowerCase() as any,
            suggestion: 'Review and fix this issue',
          });
        }
      }
    }

    // Если совсем ничего не нашли
    if (bugs.length === 0 && text.trim()) {
      bugs.push({
        issue: text.trim().slice(0, 200),
        severity: 'medium' as const,
        suggestion: 'Review the code carefully',
      });
    }

    return bugs;
  }

  private parseFixResponse(text: string): { code: string; explanation: string } {
    const codeBlockMatch = text.match(/```[\w]*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      const code = codeBlockMatch[1].trim();
      const explanation = text.replace(codeBlockMatch[0], '').trim() || 'Исправление применено';
      return { code, explanation };
    }
    return { code: text, explanation: 'Исправление применено' };
  }
}

// Singleton instance
let codeTools: CodeTools | null = null;

export function getCodeTools(): CodeTools {
  if (!codeTools) {
    codeTools = new CodeTools();
  }
  return codeTools;
}
