import { redirect } from 'next/navigation';
import { setInviteCookie } from '@/lib/auth/accept-invite';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!UUID_RE.test(token)) {
    redirect('/no-invite?reason=invalid');
  }

  await setInviteCookie(token);
  redirect('/sign-in?next=/onboarding');
}
