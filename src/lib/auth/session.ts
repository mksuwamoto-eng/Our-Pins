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
    await syncLineMetadata(admin, existing.id, authUser.user.user_metadata, line);
    return { userId: existing.id, email, isNewUser: false };
  }

  const email = line.email ?? syntheticEmail(line.sub);

  // Resolve the auth user for this email — a member who onboarded via
  // Google/magic link (when LINE shares the email), an orphan from an earlier
  // half-completed LINE sign-in, or nobody yet.
  //
  // generate_link does NOT error on an unknown email: it CREATES the user and
  // returns it. So this is the branch a brand-new member takes, and createUser
  // below only runs if generate_link itself fails. That is why the metadata
  // has to be written here — the createUser branch used to be the only writer,
  // which left every LINE member with empty user_metadata.
  let userId: string;
  let isNewUser = false;
  const { data: linked } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linked?.user) {
    userId = linked.user.id;
    await syncLineMetadata(admin, userId, linked.user.user_metadata, line);
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

/**
 * Keep the auth user's metadata in step with the LINE profile.
 *
 * Two features read it back: the automatic photo import (`ensureLineAvatar`,
 * which takes `picture`) and the onboarding name pre-fill (which takes
 * `name`). Both were dead for new members — the only writer was the
 * unreachable createUser branch — so every LINE member landed on onboarding
 * with no photo and empty name fields.
 *
 * Runs on every sign-in, not just the first: LINE rotates its CDN photo URLs
 * when a member changes their picture, and members rename themselves.
 *
 * Never throws. Metadata is a convenience, so a failure here must not cost the
 * member their sign-in.
 */
async function syncLineMetadata(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  current: Record<string, unknown> | undefined,
  line: LineProfile,
): Promise<void> {
  const before = current ?? {};
  const next: Record<string, unknown> = { ...before, line_sub: line.sub };
  // Only overwrite with something: a LINE profile missing a field must not
  // erase a value captured on an earlier sign-in.
  if (line.name) next.name = line.name;
  if (line.picture) next.picture = line.picture;

  const unchanged = (['line_sub', 'name', 'picture'] as const).every((k) => before[k] === next[k]);
  if (unchanged) return;

  const { error } = await admin.auth.admin.updateUserById(userId, { user_metadata: next });
  if (error) console.error('[line] user_metadata sync failed', error);
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

/**
 * Single admin gate for every /api/admin/* route. Returns the verified user id,
 * or null to 403.
 *
 * Two rules, both learned the hard way:
 *  - Verify the user with getUser() (a real round-trip), not getSession()'s
 *    decoded-but-unverified claims. getCurrentClaims() is a UI hint only.
 *  - Read `role` from the database, not the JWT, so a demotion takes effect
 *    without waiting for the member's token to refresh.
 * /api/admin/* is NOT covered by the middleware /admin gate (that check is
 * startsWith('/admin')), so this must live in-route.
 */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (me?.role !== 'admin') return null;
  // Hand back the session client too: routes that write through RLS reuse it
  // instead of building a second one and paying for another getUser().
  return { userId: user.id, supabase };
}

export async function getCurrentClaims() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  // Decode JWT body without verification. Fine for UI hints and middleware
  // (which has already called getUser()); never as an authorization decision
  // on its own — use requireAdmin() for that.
  const [, body] = data.session.access_token.split('.');
  if (!body) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}
