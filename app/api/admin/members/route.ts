import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

const patchSchema = z
  .object({
    id: z.string().uuid(),
    is_member: z.boolean().optional(),
    role: z.enum(['member', 'admin']).optional(),
  })
  .refine((v) => v.is_member !== undefined || v.role !== undefined, {
    message: 'Nothing to update',
  });

// Flipping is_member / role can only be done by the service role: migration
// 0012 revoked the authenticated role's UPDATE on those columns, so the old
// browser-client update silently no-op'd (permission denied, error discarded).
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauth', { status: 401 });
  // /api/admin/* is not middleware-gated — check admin explicitly.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') return new NextResponse('forbidden', { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid' }, { status: 400 });
  }
  const { id, is_member, role } = parsed.data;

  // Guard against self-lockout: an admin can't revoke or demote themselves.
  if (id === user.id && (is_member === false || role === 'member')) {
    return new NextResponse('You can’t revoke or demote yourself', { status: 400 });
  }

  const update: { is_member?: boolean; role?: string } = {};
  if (is_member !== undefined) update.is_member = is_member;
  if (role !== undefined) update.role = role;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('profiles').update(update).eq('id', id).select('id');
  if (error) {
    console.error('member update failed:', error);
    return new NextResponse('server error', { status: 500 });
  }
  if (!data?.length) return new NextResponse('not found', { status: 404 });
  return NextResponse.json({ ok: true });
}
