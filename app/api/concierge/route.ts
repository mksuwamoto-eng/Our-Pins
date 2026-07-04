import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { buildCorpus } from '@/lib/concierge/corpus';
import { getServerEnv } from '@/lib/env';

const MODEL = 'claude-opus-4-8';
// USD per million tokens for claude-opus-4-8.
const RATE = { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 };
const DAILY_QUERIES_PER_USER = 20;
const DEFAULT_MONTHLY_BUDGET_USD = 10;

const SYSTEM_INSTRUCTIONS = `You are Parea (Παρέα), the concierge of "Our Pins" — a private map where a community of Greeks living in Japan vouch for places they love.

Your ONLY source of knowledge is the community corpus below. Rules:
- Recommend ONLY places that appear in the corpus. Never invent places, and never draw on general knowledge about Japan to recommend somewhere the community hasn't vouched for.
- Always say WHO vouched: cite members by their display name and quote or paraphrase their words. The whole point is "your friend Eleni loved this", not anonymous ratings.
- Every time you mention a place from the corpus, mark it inline as [[pin:<id>|<name>]] using the pin's exact id and name. Use the marker instead of the bare name.
- Answer in the same language the question was asked in (Greek or English).
- If the corpus has nothing relevant, say so honestly and warmly — suggest they ask the community or be the first to pin something. Do not pad with generic travel advice.
- Keep answers conversational and short: a few good suggestions beat an exhaustive list.`;

export async function POST(req: Request) {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'concierge_not_configured' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { question?: string } | null;
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > 500) {
    return NextResponse.json({ error: 'invalid_question' }, { status: 400 });
  }

  // Spend guards, before any model call. The log table is the source of truth.
  const admin = createSupabaseAdminClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [{ data: monthRows }, { count: todayCount }] = await Promise.all([
    admin
      .from('concierge_queries')
      .select('cost_usd')
      .gte('created_at', monthStart.toISOString()),
    admin
      .from('concierge_queries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', dayStart.toISOString()),
  ]);

  const monthlySpend = (monthRows ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const budget = env.CONCIERGE_MONTHLY_BUDGET_USD ?? DEFAULT_MONTHLY_BUDGET_USD;
  if (monthlySpend >= budget) {
    return NextResponse.json({ error: 'budget_exhausted' }, { status: 429 });
  }
  if ((todayCount ?? 0) >= DAILY_QUERIES_PER_USER) {
    return NextResponse.json({ error: 'daily_limit' }, { status: 429 });
  }

  const corpus = await buildCorpus();

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
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
    const status = err instanceof Anthropic.RateLimitError ? 429 : 502;
    return NextResponse.json({ error: 'model_error' }, { status });
  }

  if (response.stop_reason === 'refusal') {
    return NextResponse.json({ error: 'model_refused' }, { status: 502 });
  }

  const answer = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const u = response.usage;
  const costUsd =
    (u.input_tokens * RATE.input +
      (u.cache_creation_input_tokens ?? 0) * RATE.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * RATE.cacheRead +
      u.output_tokens * RATE.output) /
    1_000_000;

  const { error: logError } = await admin.from('concierge_queries').insert({
    user_id: user.id,
    question,
    input_tokens: u.input_tokens,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
    output_tokens: u.output_tokens,
    cost_usd: costUsd,
  });
  // A failed log write must not eat the answer, but it does break the spend
  // cap's bookkeeping — make it loud in the server logs.
  if (logError) console.error('concierge usage log failed:', logError);

  return NextResponse.json({ answer });
}
