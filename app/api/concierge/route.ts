import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { askParea, type AskError } from '@/lib/concierge/ask';

const STATUS: Record<AskError, number> = {
  not_configured: 503,
  invalid_question: 400,
  budget_exhausted: 429,
  daily_limit: 429,
  model_rate_limited: 429,
  model_error: 502,
  model_refused: 502,
};


export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { question?: string } | null;
  const question = typeof body?.question === 'string' ? body.question : '';

  const result = await askParea({ question, userId: user.id });
  if (!result.ok) {
    // 'concierge_not_configured' predates the shared core; the client keys on it.
    const code = result.error === 'not_configured' ? 'concierge_not_configured' : result.error;
    return NextResponse.json({ error: code }, { status: STATUS[result.error] });
  }
  return NextResponse.json({ answer: result.answer });
}
