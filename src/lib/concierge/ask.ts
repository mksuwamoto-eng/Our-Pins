import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { buildCorpus } from '@/lib/concierge/corpus';
import { getServerEnv } from '@/lib/env';

const MODEL = 'claude-sonnet-5';
// USD per million tokens for claude-sonnet-5 (sticker prices; an intro
// discount runs through 2026-08-31, so the guard overcounts until then —
// the safe direction).
const RATE = { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 };
const DAILY_QUERIES_PER_USER = 20;
const DEFAULT_MONTHLY_BUDGET_USD = 5;

const SYSTEM_INSTRUCTIONS = `You are Parea (Παρέα), the concierge of "Our Pins" — a private app where a community of Greeks living in Japan vouch for places they love, post announcements on a noticeboard, introduce themselves in member bios, and share a permanent library of resources (how-tos, things to watch, things to read).

Your ONLY source of knowledge is the community corpus below (four sections: PLACES, MEMBERS, NOTICEBOARD, RESOURCES). Rules:
- Recommend ONLY places that appear in the corpus. Never invent places, and never draw on general knowledge about Japan to recommend somewhere the community hasn't vouched for.
- Always say WHO vouched: cite members by their display name and quote or paraphrase their words. The whole point is "your friend Eleni loved this", not anonymous ratings.
- Every time you mention a place from the corpus, mark it inline as [[pin:<id>|<name>]] using the pin's exact id and name. Use the marker instead of the bare name.
- Questions about people ("who works in tech?", "does anyone live in Osaka?") may be answered from the MEMBERS section — always attribute ("Aris says in his bio that…"), never speculate beyond what a member wrote about themselves.
- Questions about jobs, housing, things for sale, or events may be answered from the NOTICEBOARD section — name the poster and the date, and point them to the Board page in the app for details. Board posts are time-sensitive; older ones may already be settled.
- For "how do I…" questions and recommendations of things to watch or read, check the RESOURCES section. There you are a LIBRARIAN: locate and point, never teach. Say what the post is, who shared it and when, and mark it inline as [[res:<id>|<title>]] using the resource's exact id and title (same rule as pin markers: use the marker instead of the bare title). NEVER restate the how-to steps, reproduce instructions, summarize the post's content, or enumerate the items, names, offices, or keywords it mentions (not even in parentheses as "it covers X, Y, Z") — the corpus excerpts exist only so you can match questions to posts, they are not the full text. Name only the TOPIC the post covers, in your own general words. The member must read the post itself. If a resource has a Link, you may mention that the post links out. If no resource matches, say so — do not answer procedural questions from general knowledge.
- LANGUAGE (strict): reply in the SAME language as the user's current question — Greek question → Greek answer, English question → English answer. Judge only by the question just asked; ignore the language of the corpus (bios/notes may be in either language) and never switch languages mid-answer.
- Write plain conversational text — no markdown (no asterisks, no headers). Simple dashes for lists are fine. Your answer is shown verbatim in chat bubbles that do not render markdown.
- If the corpus has nothing relevant, say so honestly and warmly — suggest they ask the community, post on the board, or be the first to pin something. Do not pad with generic travel advice.
- Keep answers conversational and short: a few good suggestions beat an exhaustive list.`;

export type AskError =
  | 'not_configured'
  | 'invalid_question'
  | 'budget_exhausted'
  | 'daily_limit'
  | 'model_error'
  | 'model_rate_limited'
  | 'model_refused';

export type AskResult = { ok: true; answer: string } | { ok: false; error: AskError };

/**
 * Ask Parea a question. Callers identify the asker by Supabase user id
 * (web app, or a LINE user mapped via private_profiles.line_sub) and/or
 * raw LINE userId (group members without an app account). At least one
 * must be present — it's what the daily cap and the query log key off.
 */
export async function askParea(input: {
  question: string;
  userId?: string;
  lineUserId?: string;
}): Promise<AskResult> {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return { ok: false, error: 'not_configured' };

  const question = input.question.trim();
  if (!question || question.length > 500) return { ok: false, error: 'invalid_question' };

  // Spend guards, before any model call. The log table is the source of truth.
  const admin = createSupabaseAdminClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const todayQuery = admin
    .from('concierge_queries')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', dayStart.toISOString());
  const [
    { data: monthRows, error: monthError },
    { count: todayCount, error: todayError },
  ] = await Promise.all([
    admin
      .from('concierge_queries')
      .select('cost_usd')
      .gte('created_at', monthStart.toISOString()),
    input.userId
      ? todayQuery.eq('user_id', input.userId)
      : todayQuery.eq('line_user_id', input.lineUserId!),
  ]);
  // Fail closed: an unreadable log table would otherwise report zero spend
  // and wave every request past both caps.
  if (monthError || todayError) {
    console.error('concierge spend guard failed:', monthError ?? todayError);
    return { ok: false, error: 'model_error' };
  }

  const monthlySpend = (monthRows ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const budget = env.CONCIERGE_MONTHLY_BUDGET_USD ?? DEFAULT_MONTHLY_BUDGET_USD;
  if (monthlySpend >= budget) return { ok: false, error: 'budget_exhausted' };
  if ((todayCount ?? 0) >= DAILY_QUERIES_PER_USER) return { ok: false, error: 'daily_limit' };

  // Reserve the quota slot BEFORE the slow model call: concurrent messages
  // would otherwise all pass the caps during one another's model latency.
  // A failed reservation blocks the query — fail closed, like the guards.
  const { data: logRow, error: reserveError } = await admin
    .from('concierge_queries')
    .insert({
      user_id: input.userId ?? null,
      ...(input.lineUserId ? { line_user_id: input.lineUserId } : {}),
      question,
    })
    .select('id')
    .single();
  if (reserveError || !logRow) {
    console.error('concierge usage reservation failed:', reserveError);
    return { ok: false, error: 'model_error' };
  }

  const corpus = await buildCorpus();

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      // Caps thinking + answer combined (adaptive thinking is on), so leave
      // headroom — a thought-heavy query can eat hundreds of tokens before
      // the answer starts, and Greek text is token-hungrier than English.
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEM_INSTRUCTIONS },
        {
          type: 'text',
          text: `COMMUNITY CORPUS\n\n${corpus}`,
          // Corpus is the big, stable part of the prompt — cache it so
          // back-to-back questions only pay ~0.1x for it.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: question }],
    });
  } catch (err) {
    console.error('concierge model call failed:', err);
    return {
      ok: false,
      error: err instanceof Anthropic.RateLimitError ? 'model_rate_limited' : 'model_error',
    };
  }

  if (response.stop_reason === 'refusal') return { ok: false, error: 'model_refused' };

  let answer = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  // A max_tokens cut ships mid-sentence — or worse, mid-[[pin:…]] marker,
  // which renderers would show as raw syntax. Drop any half-open marker,
  // then end on the last complete sentence.
  if (response.stop_reason === 'max_tokens') {
    const lastOpen = answer.lastIndexOf('[[');
    if (lastOpen !== -1 && !answer.slice(lastOpen).includes(']]')) {
      answer = answer.slice(0, lastOpen);
    }
    const cut = Math.max(...['.', '!', '?', ';', '\n'].map((c) => answer.lastIndexOf(c)));
    if (cut > 0) answer = answer.slice(0, cut + 1).trimEnd();
  }

  const u = response.usage;
  const costUsd =
    (u.input_tokens * RATE.input +
      (u.cache_creation_input_tokens ?? 0) * RATE.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * RATE.cacheRead +
      u.output_tokens * RATE.output) /
    1_000_000;

  const { error: logError } = await admin
    .from('concierge_queries')
    .update({
      answer,
      input_tokens: u.input_tokens,
      cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
      output_tokens: u.output_tokens,
      cost_usd: costUsd,
    })
    .eq('id', logRow.id);
  // A failed cost update must not eat the answer, but it does break the spend
  // cap's bookkeeping — make it loud in the server logs.
  if (logError) console.error('concierge usage log failed:', logError);

  return { ok: true, answer };
}
