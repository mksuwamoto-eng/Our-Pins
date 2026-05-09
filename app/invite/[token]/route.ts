import { NextResponse } from 'next/server';
import { setInviteCookie } from '@/lib/auth/accept-invite';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const url = new URL(request.url);

  if (!UUID_RE.test(token)) {
    return NextResponse.redirect(new URL('/no-invite?reason=invalid', url));
  }

  await setInviteCookie(token);
  return NextResponse.redirect(new URL('/sign-in?next=/onboarding', url));
}
