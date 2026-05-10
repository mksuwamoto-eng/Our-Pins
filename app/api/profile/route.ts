import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const editSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  avatarPath: z.string().optional().or(z.literal('').transform(() => undefined)),
  instagram: z
    .string()
    .trim()
    .max(30, 'Instagram handle is at most 30 characters')
    .transform((v) => v.replace(/^@/, ''))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  website: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }
  const v = parsed.data;

  const { data: clash } = await supabase
    .from('profiles')
    .select('id')
    .ilike('display_name', v.displayName)
    .neq('id', user.id)
    .maybeSingle();
  if (clash) {
    return NextResponse.json(
      { error: 'That name is already taken — try a nickname or add an initial.' },
      { status: 409 },
    );
  }

  const update: Record<string, unknown> = {
    display_name: v.displayName,
    instagram: v.instagram ?? null,
    website: v.website ?? null,
  };
  if (v.avatarPath) update.avatar_path = v.avatarPath;

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
