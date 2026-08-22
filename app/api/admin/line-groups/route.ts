import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';

const patchSchema = z.object({
  group_id: z.string().min(1),
  label: z.string().trim().max(80).optional(),
  digest_enabled: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  // /api/admin/* is not middleware-gated (its check is startsWith('/admin')),
  // and line_groups has no member write policy — check admin explicitly.
  if (!(await requireAdmin())) return new NextResponse('forbidden', { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid' }, { status: 400 });
  }

  const update: { label?: string | null; digest_enabled?: boolean } = {};
  if (parsed.data.label !== undefined) update.label = parsed.data.label === '' ? null : parsed.data.label;
  if (parsed.data.digest_enabled !== undefined) update.digest_enabled = parsed.data.digest_enabled;
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

  // Service-role client: line_groups has no member update grant/policy.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('line_groups').update(update).eq('group_id', parsed.data.group_id);
  if (error) {
    console.error('line_groups update failed:', error);
    return new NextResponse('server error', { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
