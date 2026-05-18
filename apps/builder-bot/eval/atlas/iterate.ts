#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS TRAINING-LOOP ITERATOR
 *
 * One iteration of the training loop:
 *   1. Read the most recent eval-results-*.json (must run run-evals.ts first)
 *   2. Identify the highest-weight failing test
 *   3. Generate a targeted rule via Gemini (LLM-as-teacher)
 *   4. Append it to atlas-prompt-rules.md below the AUTOGEN_MARKER
 *   5. Re-run evals to verify improvement
 *   6. If pass rate dropped → REVERT the appended rule
 *   7. If improved → keep, write metrics
 *
 * Idempotent + safe: never edits api-server.ts or runtime code. The only
 * mutable surface is atlas-prompt-rules.md below the marker.
 *
 * Usage (one shot):
 *   pnpm --filter @ton-agent/builder-bot exec ts-node eval/atlas/iterate.ts
 *
 * Usage (in /loop):
 *   /loop 10m pnpm --filter @ton-agent/builder-bot exec ts-node eval/atlas/iterate.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import OpenAI from 'openai';
import { readLearnedRules, writeLearnedRules } from '../../src/services/atlas-prompt';

try {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
} catch {}

const RESULTS_DIR = __dirname;
const AUTOGEN_MARKER = '<!-- AUTOGEN_MARKER';

function findLatestResults(): string | null {
  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('eval-results-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files[0] ? path.join(RESULTS_DIR, files[0]) : null;
}

function readPassRate(): number {
  const file = findLatestResults();
  if (!file) return 0;
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return data.summary?.passRate || 0;
}

interface FailedTest {
  id: string;
  category: string;
  weight: number;
  question: string;
  response: string;
  failures: string[];
}

function findWorstFailure(): FailedTest | null {
  const file = findLatestResults();
  if (!file) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const failed: FailedTest[] = (data.results || []).filter((r: any) => !r.passed);
  if (failed.length === 0) return null;
  // Sort by weight desc, then by category priority (anti_halu > safety > factual > rest)
  const catPriority: Record<string, number> = { anti_halu: 100, safety: 90, factual: 70, language: 60, intent: 50, style: 30 };
  failed.sort((a, b) => {
    const wd = b.weight - a.weight;
    if (wd !== 0) return wd;
    return (catPriority[b.category] || 0) - (catPriority[a.category] || 0);
  });
  return failed[0];
}

async function proposeRule(failure: FailedTest): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });
  const reqBody = {
    model: process.env.ATLAS_TEACHER_MODEL || 'gemini-2.5-flash',
    messages: [
      {
        role: 'system' as const,
        content: 'Ты — корректор для другой AI системы (Atlas). Твоя задача: посмотреть на провалившийся тест и сгенерировать ОДНО короткое правило (1-2 предложения, до 200 символов), которое предотвратит эту ошибку в будущем. Правило должно быть КОНКРЕТНЫМ и МЕХАНИЧЕСКИМ ("когда X, всегда Y / никогда не Z"). НЕ давай общих советов. НЕ повторяй очевидное. Просто правило, ничего больше.',
      },
      {
        role: 'user' as const,
        content:
          `Тест "${failure.id}" (категория ${failure.category}) провалился.\n\n` +
          `ВОПРОС:\n${failure.question}\n\n` +
          `ОТВЕТ Atlas:\n${failure.response.slice(0, 1500)}\n\n` +
          `ПРОБЛЕМЫ:\n${failure.failures.join('\n')}\n\n` +
          `Дай ОДНО правило (1-2 предложения, до 200 символов) которое предотвратит эту ошибку.`,
      },
    ],
    max_tokens: 300,
    temperature: 0.2,
  };
  // Retry on 429 with exponential backoff (shared Gemini quota with prod Atlas)
  let lastErr: any = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const teacher = await client.chat.completions.create(reqBody);
      const text = teacher.choices?.[0]?.message?.content?.trim() || '';
      return text.replace(/[\r\n]+/g, ' ').replace(/["`]/g, '').trim().slice(0, 200);
    } catch (e: any) {
      lastErr = e;
      const is429 = e?.status === 429 || (e?.message || '').includes('429');
      if (!is429 || attempt === 3) throw e;
      const delay = (20 + attempt * 40) * 1000;       // 20s, 60s, 100s
      console.log(`[teacher 429] retry in ${delay/1000}s (attempt ${attempt + 1}/4)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function appendRule(rule: string, testId: string): void {
  const current = readLearnedRules();
  const stamp = new Date().toISOString().slice(0, 10);
  const entry = `\n- [${stamp} ${testId}] ${rule}`;
  if (current.includes(AUTOGEN_MARKER)) {
    const updated = current.replace(AUTOGEN_MARKER, AUTOGEN_MARKER + ' -->\n## Auto-generated rules' + entry + '\n<!-- ');
    writeLearnedRules(updated);
  } else {
    writeLearnedRules(current + entry + '\n');
  }
}

function revertLastRule(): void {
  const current = readLearnedRules();
  // Remove the last "- [YYYY-MM-DD test-id] ..." entry from the autogen block
  const updated = current.replace(/\n- \[\d{4}-\d{2}-\d{2} [^\]]+\][^\n]*(?=\n<!-- |\n*$)/, '');
  writeLearnedRules(updated);
}

function runEvals(): { passRate: number; ok: boolean } {
  const r = spawnSync('npx', ['ts-node', path.join(RESULTS_DIR, 'run-evals.ts')], {
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  return { passRate: readPassRate(), ok: r.status === 0 };
}

async function main() {
  console.log('\n━━━ ATLAS TRAINING LOOP — iteration start ━━━');
  const before = readPassRate();
  console.log(`Baseline pass rate (from last eval-results-*.json): ${before}%`);

  const failure = findWorstFailure();
  if (!failure) {
    console.log('No failures in last run. Atlas is at 100% (or no eval results yet).');
    console.log('Run `run-evals.ts` first if metrics are stale.');
    return;
  }
  console.log(`Worst failure: ${failure.id} (${failure.category}, weight ${failure.weight})`);
  console.log(`  Q: ${failure.question.slice(0, 100)}`);
  console.log(`  Problems: ${failure.failures.join('; ')}`);

  const rule = await proposeRule(failure);
  if (!rule || rule.length < 10) {
    console.log('Teacher returned empty/junk rule. Skipping iteration.');
    return;
  }
  console.log(`Proposed rule: ${rule}`);

  appendRule(rule, failure.id);
  console.log('Rule appended to atlas-prompt-rules.md.');

  console.log('\nRe-running evals to verify improvement...\n');
  const after = runEvals();
  console.log(`\nBefore: ${before}% → After: ${after.passRate}%`);

  if (after.passRate < before) {
    console.log('Pass rate DROPPED — reverting rule.');
    revertLastRule();
  } else if (after.passRate === before) {
    console.log('No change. Rule kept (may help on future runs).');
  } else {
    console.log(`Improvement: +${(after.passRate - before).toFixed(1)} pp.`);
  }

  // Stop signal for /loop when at target
  if (after.passRate >= 95) {
    console.log('\n🎯 Pass rate ≥ 95%. Training target reached.');
    process.exit(0);
  }
  console.log('\n━━━ iteration end ━━━\n');
}

main().catch(e => {
  console.error('[atlas-iterate] FATAL:', e);
  process.exit(2);
});
