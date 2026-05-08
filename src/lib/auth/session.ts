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
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { line_sub: line.sub, name: line.name, picture: line.picture },
  });
  if (error || !created.user) {
    throw new Error(`Failed to create Supabase user: ${error?.message ?? 'unknown error'}`);
  }

  // Profiles + private_profiles rows are created during onboarding flow,
  // not here, to avoid race with the seed migration's bootstrap admin block.
  // We do create the private_profiles row now to anchor the line_sub mapping.
  await admin.from('private_profiles').insert({
    id: created.user.id,
    email,
    line_sub: line.sub,
  });

  // Ensure a profiles row exists with default values; onboarding will overwrite.
  await admin.from('profiles').insert({
    id: created.user.id,
    display_name: line.name ?? 'New member',
    avatar_path: line.picture ? 'avatars/_pending.png' : 'avatars/_pending.png',
    display_pref: 'avatar_name',
    is_member: false,
    role: 'member',
  });

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
