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

async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });
  const reqBody = {
    model: process.env.ATLAS_EVAL_MODEL || 'gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt } as const,
      { role: 'user', content: userMessage } as const,
    ],
    max_tokens: 4096,
    temperature: 0.3,
  };
  // Retry on 429 with exponential backoff (we share Gemini quota with prod Atlas)
  let lastErr: any = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const resp = await client.chat.completions.create(reqBody);
      return resp.choices?.[0]?.message?.content || '';
    } catch (e: any) {
      lastErr = e;
      const msg = e?.message || '';
      const is429 = e?.status === 429 || msg.includes('429') || msg.includes('rate');
      if (!is429 || attempt === 3) throw e;
      const delay = (15 + attempt * 30) * 1000;       // 15s, 45s, 75s
      process.stdout.write(`[429 backoff ${delay/1000}s] `);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function runOne(test: TestCase, systemPrompt: string): Promise<TestResult> {
  const start = Date.now();
  let response = '';
  let scored: { passed: boolean; failures: string[] };
  try {
    response = await callGemini(systemPrompt, test.question);
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
  const tests = loadTests();
  console.log(`[atlas-eval] Loaded ${tests.length} test cases`);

  const systemPrompt = await buildAtlasSystemPrompt(USER_ID);
  console.log(`[atlas-eval] System prompt: ${systemPrompt.length} chars`);

  // Gemini free tier: 4 RPM hard cap. Sleep 16s between calls (3.75 RPM, safe).
  // For 20 tests this is ~5.5 min total. If you switch to a paid tier or a
  // different provider, override via ATLAS_EVAL_DELAY_MS env.
  const delayMs = Number(process.env.ATLAS_EVAL_DELAY_MS || 16_000);
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
