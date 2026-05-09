import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { onboardingSchema } from '@/lib/schemas/profile';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const v = parsed.data;

  const update: Record<string, unknown> = {
    display_name: v.displayName,
    display_pref: v.displayPref,
    instagram: v.instagram ?? null,
    website: v.website ?? null,
    onboarded_at: new Date().toISOString(),
  };
  if (v.avatarPath) update.avatar_path = v.avatarPath;

  const { error: upProfileErr } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id);
  if (upProfileErr) return NextResponse.json({ error: upProfileErr.message }, { status: 500 });

  if (v.realName) {
    // private_profiles has no INSERT policy by design (same as profiles);
    // first-time onboarding has to use the admin client.
    const admin = createSupabaseAdminClient();
    const { error: upPrivErr } = await admin
      .from('private_profiles')
      .upsert({ id: user.id, real_name: v.realName, email: v.email ?? null }, { onConflict: 'id' });
    if (upPrivErr) return NextResponse.json({ error: upPrivErr.message }, { status: 500 });
  }

  // Force a token refresh so the new `onboarded` claim takes effect immediately
  // (otherwise middleware would keep bouncing back to /onboarding for up to 1h).
  await supabase.auth.refreshSession();

  return NextResponse.json({ ok: true });
}
