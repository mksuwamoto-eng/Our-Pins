import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { onboardingSchema, resolveNames } from '@/lib/schemas/profile';

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
  // The form collects first + last name (and an optional opt-in pseudonym);
  // everything downstream still works in terms of one display name and one
  // private real name.
  const { realName, displayName } = resolveNames(v);

  // Check display_name is not already taken by another member (case-insensitive).
  // Escape LIKE wildcards so a name containing % or _ is matched literally,
  // not as a pattern (otherwise "M_ko" would falsely clash with "Mako").
  const namePattern = displayName.replace(/[\\%_]/g, '\\$&');
  const { data: clash } = await supabase
    .from('profiles')
    .select('id')
    .ilike('display_name', namePattern)
    .neq('id', user.id)
    .maybeSingle();
  if (clash) {
    return NextResponse.json(
      { error: 'Someone already uses that name — tick “Show a different name” to pick another.' },
      { status: 409 },
    );
  }

  const cleanInsta = v.instagram?.trim() || null;
  const cleanWebsite = v.website?.trim() || null;
  const update: Record<string, unknown> = {
    display_name: displayName,
    display_pref: v.displayPref,
    instagram: cleanInsta,
    website: cleanWebsite,
    linkedin: v.linkedin?.trim() || null,
    bio: v.bio?.trim() || null,
    onboarded_at: new Date().toISOString(),
  };
  if (v.avatarPath) update.avatar_path = v.avatarPath;

  // Onboarding has to bypass column-level grants on profiles. Migration 0012
  // revokes UPDATE on onboarded_at (and other privileged cols) from the
  // `authenticated` role; using the user's session client would 401 with
  // "permission denied for table profiles". The admin client bypasses grants.
  const admin = createSupabaseAdminClient();
  const { error: upProfileErr } = await admin
    .from('profiles')
    .update(update)
    .eq('id', user.id);
  if (upProfileErr) {
    console.error('onboarding profile update failed:', upProfileErr);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  {
    // private_profiles has no INSERT policy by design (same as profiles);
    // first-time onboarding has to use the admin client.
    const { error: upPrivErr } = await admin
      .from('private_profiles')
      .upsert({ id: user.id, real_name: realName, email: v.email ?? null }, { onConflict: 'id' });
    if (upPrivErr) {
      console.error('onboarding private_profiles upsert failed:', upPrivErr);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }

  // Force a token refresh so the new `onboarded` claim takes effect immediately
  // (otherwise middleware would keep bouncing back to /onboarding for up to 1h).
  await supabase.auth.refreshSession();

  return NextResponse.json({ ok: true });
}
