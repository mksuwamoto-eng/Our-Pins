/**
 * Look up or create a Supabase user from a LINE profile, then establish a
 * session for them. This is the "Path B" hand-off from line-jwt-bridge into
 * Supabase Auth.
 *
 * Strategy: we use Supabase's magic-link generation on the admin client to
 * obtain a hashed token, then `verifyOtp` on the server response sets the
 * session cookies. This goes through Supabase's normal token issuance path,
 * which fires our access_token_hook (is_member + role JWT claims).
 */

import { createSupabaseAdminClient, createSupabaseServerClient } from '../supabase/server';
import type { LineProfile } from './line-jwt-bridge';

interface UpsertResult {
  userId: string;
  email: string;
  isNewUser: boolean;
}

/**
 * Look up an existing Supabase user by line_sub on private_profiles, OR create one.
 * The synthetic email keeps the auth.users row valid for Supabase's expectations
 * (it's never used for actual email delivery).
 */
export async function upsertUserFromLine(line: LineProfile): Promise<UpsertResult> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('private_profiles')
    .select('id, email')
    .eq('line_sub', line.sub)
    .maybeSingle();

  if (existing) {
    return { userId: existing.id, email: existing.email ?? syntheticEmail(line.sub), isNewUser: false };
  }

  const email = line.email ?? syntheticEmail(line.sub);

  // If LINE gave us an email that already has an account (e.g. a member who
  // onboarded via Google/magic link), link line_sub to it instead of failing.
  // generateLink is the documented way to resolve an auth user by email; it
  // errors for unknown emails, in which case we fall through to createUser.
  if (line.email) {
    const { data: linked } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: line.email,
    });
    if (linked?.user) {
      const { error: linkError } = await admin
        .from('private_profiles')
        .upsert({ id: linked.user.id, email: line.email, line_sub: line.sub }, { onConflict: 'id' });
      if (linkError) {
        throw new Error(`Failed to store LINE mapping: ${linkError.message}`);
      }
      return { userId: linked.user.id, email: line.email, isNewUser: false };
    }
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { line_sub: line.sub, name: line.name, picture: line.picture },
  });
  if (error || !created.user) {
    throw new Error(`Failed to create Supabase user: ${error?.message ?? 'unknown error'}`);
  }

  // Anchor the line_sub mapping now; this row is what future sign-ins key off.
  const { error: ppError } = await admin.from('private_profiles').insert({
    id: created.user.id,
    email,
    line_sub: line.sub,
  });
  if (ppError) {
    throw new Error(`Failed to store LINE mapping: ${ppError.message}`);
  }

  // Ensure a profiles row exists with default values; onboarding will overwrite.
  // Mirrors the magic/Google callback bootstrap.
  await admin.from('profiles').upsert(
    {
      id: created.user.id,
      display_name: line.name ?? 'New member',
      avatar_path: 'avatars/_pending.png',
      display_pref: 'avatar_name',
      is_member: false,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );

  return { userId: created.user.id, email, isNewUser: true };
}

function syntheticEmail(lineSub: string): string {
  return `line.${lineSub}@line.our-pins.local`;
}

/**
 * Generate a magic-link verification token for the given email and return
 * the raw token + token_hash so the caller can redirect the browser to the
 * email-confirm URL, completing the session establishment.
 */
export async function generateMagicLinkVerification(email: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error || !data?.properties) {
    throw new Error(`Failed to generate magic link: ${error?.message ?? 'unknown'}`);
  }
  return data.properties;
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getCurrentClaims() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  // Decode JWT body without verification (Supabase already validated it).
  const [, body] = data.session.access_token.split('.');
  if (!body) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}
