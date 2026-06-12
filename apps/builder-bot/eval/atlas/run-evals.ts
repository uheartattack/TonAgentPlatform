#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS EVAL RUNNER
 *
 * Loads test-cases.json, calls Gemini API with the SAME system prompt Atlas
 * uses in production (via buildAtlasSystemPrompt), scores every response.
 *
 * Output:
 *   - eval-results-<timestamp>.json   detailed per-test breakdown
 *   - metrics-history.jsonl           appended one line per run (for /loop)
 *
 * Usage:
 *   pnpm --filter @ton-agent/builder-bot exec ts-node eval/atlas/run-evals.ts
 *
 * Env:
 *   OPENAI_API_KEY  — Gemini key (we route through OpenAI-compat endpoint)
 *   ATLAS_EVAL_USER_ID  — optional user id for skill listing (defaults 0)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { buildAtlasSystemPrompt } from '../../src/services/atlas-prompt';

// Load .env from builder-bot root so OPENAI_API_KEY / OPENAI_BASE_URL etc. resolve
try {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) {
    const dotenv = require('dotenv');
    dotenv.config({ path: envPath });
  }
} catch { /* dotenv optional */ }

interface TestCase {
  id: string;
  category: 'factual' | 'anti_halu' | 'intent' | 'language' | 'safety' | 'style';
  weight: number;
  question: string;
  lang: 'ru' | 'en';
  must_include?: string[];
  must_include_any?: string[];
  must_include_regex?: string[];
  must_not_include?: string[];
  must_not_include_regex?: string[];
  min_length?: number;
  max_length?: number;
}

interface TestResult {
  id: string;
  category: string;
  weight: number;
  question: string;
  response: string;
  passed: boolean;
  failures: string[];
  durationMs: number;
}

const TEST_CASES_PATH = path.resolve(__dirname, 'test-cases.json');
const HISTORY_PATH = path.resolve(__dirname, 'metrics-history.jsonl');
const USER_ID = Number(process.env.ATLAS_EVAL_USER_ID || 0);

function loadTests(): TestCase[] {
  const raw = fs.readFileSync(TEST_CASES_PATH, 'utf-8');
  return JSON.parse(raw);
}

function scoreResponse(test: TestCase, response: string): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  const lower = response.toLowerCase();

  if (test.must_include) {
    for (const term of test.must_include) {
      if (!lower.includes(term.toLowerCase())) failures.push(`missing required term "${term}"`);
    }
  }
  if (test.must_include_any && test.must_include_any.length > 0) {
    const found = test.must_include_any.some(t => lower.includes(t.toLowerCase()));
    if (!found) failures.push(`none of [${test.must_include_any.join(', ')}] present`);
  }
  if (test.must_include_regex) {
    for (const re of test.must_include_regex) {
      if (!new RegExp(re).test(response)) failures.push(`regex /${re}/ did not match`);
    }
  }
  if (test.must_not_include) {
    for (const term of test.must_not_include) {
      if (lower.includes(term.toLowerCase())) failures.push(`forbidden term "${term}" present`);
    }
  }
  if (test.must_not_include_regex) {
    for (const re of test.must_not_include_regex) {
      if (new RegExp(re).test(response)) failures.push(`forbidden regex /${re}/ matched`);
    }
  }
  if (test.min_length && response.length < test.min_length) {
    failures.push(`too short (${response.length} < ${test.min_length})`);
  }
  if (test.max_length && response.length > test.max_length) {
    failures.push(`too long (${response.length} > ${test.max_length})`);
  }

  return { passed: failures.length === 0, failures };
}

// Provider chain. Same approach as production Atlas: try Gemini families
// first, then fall over to OpenRouter free models on persistent quota issues.
async function callAtlas(systemPrompt: string, userMessage: string): Promise<string> {
  const geminiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });
  const orKey = process.env.OPENROUTER_API_KEY || '';
  const orClient = orKey ? new OpenAI({
    apiKey: orKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: { 'HTTP-Referer': 'https://tonagentplatform.com', 'X-Title': 'TON Agent Platform - Atlas eval' },
  }) : null;

  const chain: Array<{ client: OpenAI; model: string }> = [
    { client: geminiClient, model: process.env.ATLAS_EVAL_MODEL || 'gemini-2.5-flash' },
    { client: geminiClient, model: 'gemini-2.0-flash' },
    { client: geminiClient, model: 'gemini-2.0-flash-lite' },
    ...(orClient ? [
      { client: orClient, model: 'deepseek/deepseek-v4-flash:free' },
      { client: orClient, model: 'meta-llama/llama-3.3-70b-instruct:free' },
      { client: orClient, model: 'nousresearch/hermes-3-llama-3.1-405b:free' },
    ] : []),
  ];

  let lastErr: any = null;
  for (const { client, model } of chain) {
    try {
      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt } as const,
          { role: 'user', content: userMessage } as const,
        ],
        max_tokens: 4096,
        temperature: 0.3,
      });
      const out = resp.choices?.[0]?.message?.content || '';
      if (out) return out;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || '');
      // Bail only on auth-shape errors. Otherwise try next model.
      if (/401|invalid_api_key|unauthorized/i.test(msg)) break;
      process.stdout.write(`[skip ${model.split('/').pop()}] `);
    }
  }
  throw lastErr || new Error('all models exhausted');
}

async function runOne(test: TestCase, systemPrompt: string): Promise<TestResult> {
  const start = Date.now();
  let response = '';
  let scored: { passed: boolean; failures: string[] };
  try {
    response = await callAtlas(systemPrompt, test.question);
    scored = scoreResponse(test, response);
  } catch (e: any) {
    response = `[ERROR] ${e?.message || e}`;
    scored = { passed: false, failures: [`api call failed: ${e?.message}`] };
  }
  return {
    id: test.id,
    category: test.category,
    weight: test.weight,
    question: test.question,
    response,
    passed: scored.passed,
    failures: scored.failures,
    durationMs: Date.now() - start,
  };
}

async function main() {
  const allTests = loadTests();
  console.log(`[atlas-eval] Loaded ${allTests.length} test cases`);

  // Optional sampling — keeps the daily Gemini quota budget feasible when the
  // key is shared with prod Atlas. Strategy: take ALL anti_halu + safety
  // tests (they're highest-value), then fill the rest with rotating samples
  // from the remaining pool. Override with ATLAS_EVAL_SAMPLE=0 for full set.
  const sampleSize = Number(process.env.ATLAS_EVAL_SAMPLE || 0);
  let tests = allTests;
  if (sampleSize > 0 && sampleSize < allTests.length) {
    const must = allTests.filter(t => t.category === 'anti_halu' || t.category === 'safety');
    const rest = allTests.filter(t => !must.includes(t));
    // Rotate rest based on day-of-year so each day a different slice runs
    const dayIdx = Math.floor(Date.now() / 86_400_000);
    const rotated = rest.slice(dayIdx % rest.length).concat(rest.slice(0, dayIdx % rest.length));
    const remainingBudget = Math.max(0, sampleSize - must.length);
    tests = must.concat(rotated.slice(0, remainingBudget));
    console.log(`[atlas-eval] Sampled ${tests.length}/${allTests.length} (anti-halu+safety: ${must.length}, rotating fill: ${tests.length - must.length})`);
  }

  const systemPrompt = await buildAtlasSystemPrompt(USER_ID);
  console.log(`[atlas-eval] System prompt: ${systemPrompt.length} chars`);

  // Inter-call delay. Gemini free was 4 RPM (16s). With OpenRouter in the
  // chain we can go faster — 5s gives ample headroom for both providers.
  // Override via ATLAS_EVAL_DELAY_MS env.
  const delayMs = Number(process.env.ATLAS_EVAL_DELAY_MS || 5_000);
  const results: TestResult[] = [];
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    process.stdout.write(`[atlas-eval] ${test.id} ... `);
    const r = await runOne(test, systemPrompt);
    process.stdout.write(`${r.passed ? '✓' : '✗'} (${r.durationMs}ms)${r.passed ? '' : ' — ' + r.failures.join('; ')}\n`);
    results.push(r);
    if (i < tests.length - 1 && delayMs > 0) {
      await new Promise(res => setTimeout(res, delayMs));
    }
  }

  // Aggregate
  const totalWeight = results.reduce((s, r) => s + r.weight, 0);
  const passedWeight = results.filter(r => r.passed).reduce((s, r) => s + r.weight, 0);
  const passRate = (passedWeight / totalWeight) * 100;
  const passCount = results.filter(r => r.passed).length;

  const byCategory: Record<string, { total: number; passed: number }> = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, passed: 0 };
    byCategory[r.category].total++;
    if (r.passed) byCategory[r.category].passed++;
  }

  const summary = {
    timestamp: new Date().toISOString(),
    passRate: Number(passRate.toFixed(1)),
    passCount,
    total: results.length,
    poolSize: allTests.length,
    sampled: sampleSize > 0 && sampleSize < allTests.length,
    passedWeight,
    totalWeight,
    byCategory,
    failedIds: results.filter(r => !r.passed).map(r => r.id),
    promptLength: systemPrompt.length,
    model: process.env.ATLAS_EVAL_MODEL || 'gemini-2.5-flash',
  };

  console.log('\n━━━ SUMMARY ━━━');
  console.log(`Pass rate: ${summary.passRate}%  (${passCount}/${results.length} tests, ${passedWeight}/${totalWeight} weighted)`);
  console.log('By category:');
  for (const [cat, stats] of Object.entries(byCategory)) {
    console.log(`  ${cat.padEnd(12)} ${stats.passed}/${stats.total}`);
  }
  if (summary.failedIds.length > 0) {
    console.log(`Failed: ${summary.failedIds.join(', ')}`);
  }

  // Write detailed results
  const detailedPath = path.resolve(__dirname, `eval-results-${Date.now()}.json`);
  fs.writeFileSync(detailedPath, JSON.stringify({ summary, results }, null, 2), 'utf-8');
  console.log(`\nDetailed: ${path.basename(detailedPath)}`);

  // Append metrics history (for /loop trend)
  fs.appendFileSync(HISTORY_PATH, JSON.stringify(summary) + '\n', 'utf-8');
  console.log(`History: metrics-history.jsonl (+1 entry)`);

  // Exit code = 0 if pass rate ≥ 90%, else 1 (so loop knows to iterate)
  process.exit(summary.passRate >= 90 ? 0 : 1);
}

main().catch(e => {
  console.error('[atlas-eval] FATAL:', e);
  process.exit(2);
});
