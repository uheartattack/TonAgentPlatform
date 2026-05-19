#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ASK-ATLAS — one-shot Atlas query for the manual training loop.
 *
 * Builds the SAME system prompt Atlas uses in production
 * (`buildAtlasSystemPrompt`) and calls Gemini with it. Prints ONLY the raw
 * answer to stdout — no scoring, no decorations. Designed to be invoked
 * from the chat-driven loop where Claude (me) is the tester/teacher:
 *
 *   ssh ... 'cd /app/apps/builder-bot && npx ts-node eval/atlas/ask-atlas.ts "вопрос"'
 *
 * Pipe via stdin for long / multi-line questions:
 *
 *   echo "long question" | ssh ... 'cd /app/.../builder-bot && npx ts-node eval/atlas/ask-atlas.ts -'
 *
 * Why this exists:
 *   - The eval harness uses regex/keyword scoring which is brittle.
 *   - The teacher-LLM (Gemini) in iterate.ts often produces vague rules.
 *   - When Claude does the analysis & rule-writing manually, both quality
 *     and Gemini quota usage improve dramatically (1 call per training
 *     step instead of ~40).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { buildAtlasSystemPrompt } from '../../src/services/atlas-prompt';

try {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
} catch {}

async function main() {
  let question = process.argv.slice(2).join(' ').trim();
  if (question === '-' || !question) {
    // Read from stdin
    question = await new Promise<string>((resolve) => {
      let buf = '';
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', (chunk) => { buf += chunk; });
      process.stdin.on('end', () => resolve(buf.trim()));
    });
  }
  if (!question) {
    process.stderr.write('Usage: ask-atlas.ts "question" | echo "Q" | ask-atlas.ts -\n');
    process.exit(2);
  }

  const userId = Number(process.env.ATLAS_EVAL_USER_ID || 0);
  const systemPrompt = await buildAtlasSystemPrompt(userId);

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });

  // Same model chain Atlas uses in prod (drops deprecated 1.5-*)
  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  let response = '';
  let usedModel = '';
  let lastErr: any;
  for (const model of MODELS) {
    try {
      const r = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      });
      response = r.choices?.[0]?.message?.content || '';
      if (response) { usedModel = model; break; }
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || '');
      // Skip all transient / not-found errors; bail only on real auth issues
      if (/401|invalid_api_key|unauthorized/i.test(msg)) break;
    }
  }
  if (!response) {
    process.stderr.write(`[ask-atlas] All models failed. Last error: ${lastErr?.message?.slice(0, 200) || 'unknown'}\n`);
    process.exit(3);
  }

  // Stdout = pure response, stderr = meta (so I can grep --stderr for diagnostics)
  process.stderr.write(`[ask-atlas] model=${usedModel}, prompt=${systemPrompt.length}c, q=${question.length}c, a=${response.length}c\n`);
  process.stdout.write(response);
  if (!response.endsWith('\n')) process.stdout.write('\n');
}

main().catch((e) => {
  process.stderr.write(`[ask-atlas] FATAL: ${e?.message || e}\n`);
  process.exit(4);
});
