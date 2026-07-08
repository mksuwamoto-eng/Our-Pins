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
    // Must match the DB CHECK on profiles.instagram, or the save 500s at the
    // DB after passing app validation (onboarding enforces the same regex).
    .refine((v) => /^[a-zA-Z0-9._]{1,30}$/.test(v), {
      message: 'Instagram handles use letters, numbers, dots and underscores (max 30)',
    })
    .optional()
    .or(z.literal('').transform(() => undefined)),
  website: z
    .string()
    .trim()
    .max(200)
    // DB CHECK is https-only; upgrade http:// (and add a scheme to bare hosts)
    // so a valid-looking URL can't 500 at the DB.
    .transform((v) => (v ? `https://${v.replace(/^https?:\/\//i, '')}` : v))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  bio: z
    .string()
    .trim()
    .max(500, 'Bio is at most 500 characters')
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

  // Escape LIKE wildcards so a name with % or _ is matched literally.
  const namePattern = v.displayName.replace(/[\\%_]/g, '\\$&');
  const { data: clash } = await supabase
    .from('profiles')
    .select('id')
    .ilike('display_name', namePattern)
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
    instagram: v.instagram?.trim() || null,
    website: v.website?.trim() || null,
    bio: v.bio?.trim() || null,
  };
  if (v.avatarPath) update.avatar_path = v.avatarPath;

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) {
    console.error('profile update failed:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
