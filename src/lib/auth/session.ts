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
    // The auth user's own email is the only safe magic-link target. Deriving
    // it (private_profiles.email fallback to syntheticEmail) signed the
    // browser into a DIFFERENT auth user when the stored email was null:
    // Supabase lowercases emails, its lookup is case-insensitive, and LINE
    // subs are mixed-case — the synthetic alias can resolve to an orphan
    // account instead of existing.id.
    const { data: authUser, error } = await admin.auth.admin.getUserById(existing.id);
    if (error || !authUser.user?.email) {
      throw new Error(`No auth user for LINE mapping ${existing.id}: ${error?.message ?? 'no email'}`);
    }
    const email = authUser.user.email;
    if (existing.email !== email) {
      await admin.from('private_profiles').update({ email }).eq('id', existing.id);
    }
    return { userId: existing.id, email, isNewUser: false };
  }

  const email = line.email ?? syntheticEmail(line.sub);

  // Resolve an existing auth user for this email — a member who onboarded via
  // Google/magic link (when LINE shares the email), or an orphan from an
  // earlier half-completed LINE sign-in. generateLink is the documented way
  // to look up an auth user by email; it errors for unknown emails, in which
  // case we create the user.
  let userId: string;
  let isNewUser = false;
  const { data: linked } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linked?.user) {
    userId = linked.user.id;
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { line_sub: line.sub, name: line.name, picture: line.picture },
    });
    if (error || !created.user) {
      throw new Error(`Failed to create Supabase user: ${error?.message ?? 'unknown error'}`);
    }
    userId = created.user.id;
    isNewUser = true;
  }

  // profiles first (private_profiles.id has an FK to profiles.id), defaults
  // mirroring the magic/Google callback bootstrap; onboarding will overwrite.
  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      // display_name has a 1-60 char CHECK; LINE names can exceed it.
      display_name: (line.name ?? 'New member').slice(0, 60) || 'New member',
      avatar_path: 'avatars/_pending.png',
      display_pref: 'avatar_name',
      is_member: false,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (profileError) {
    throw new Error(`Failed to bootstrap profile: ${profileError.message}`);
  }

  // Anchor the line_sub mapping; this row is what future sign-ins key off.
  const { error: ppError } = await admin
    .from('private_profiles')
    .upsert({ id: userId, email, line_sub: line.sub }, { onConflict: 'id' });
  if (ppError) {
    throw new Error(`Failed to store LINE mapping: ${ppError.message}`);
  }

  return { userId, email, isNewUser };
}

function syntheticEmail(lineSub: string): string {
  // Lowercase: Supabase normalizes emails to lowercase on creation, so a
  // mixed-case alias (LINE subs start with 'U') would never round-trip to
  // the same string we later derive.
  return `line.${lineSub.toLowerCase()}@line.our-pins.local`;
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
