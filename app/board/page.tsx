import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { getCurrentClaims } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BoardClient, type BoardPostView } from '@/components/board/BoardClient';
import type { BoardPost } from '@/lib/supabase/types';

const ONE_HOUR = 3600;

export default async function BoardPage() {
  const supabase = await createSupabaseServerClient();
  const t = await getTranslations('board');
  const claims = await getCurrentClaims();
  const meId = typeof claims?.sub === 'string' ? claims.sub : null;
  const isAdmin = claims?.user_role === 'admin';

  const { data: posts } = await supabase
    .from('board_posts')
    .select('*')
    .is('archived_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.created_by)));
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, display_name, avatar_path').in('id', authorIds)
    : { data: [] };
  const authorById = new Map<string, { display_name: string; avatar_path: string | null }>();
  for (const a of authors ?? []) authorById.set(a.id, a);

  const realAvatarPaths = (authors ?? [])
    .map((a) => a.avatar_path)
    .filter((p): p is string => typeof p === 'string' && !p.includes('_pending'));
  const { data: signed } = realAvatarPaths.length
    ? await supabase.storage.from('pin-photos').createSignedUrls(realAvatarPaths, ONE_HOUR)
    : { data: [] };
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  const views: BoardPostView[] = ((posts ?? []) as BoardPost[]).map((p) => {
    const author = authorById.get(p.created_by);
    return {
      post: p,
      authorName: author?.display_name ?? null,
      authorAvatarUrl: author?.avatar_path ? (urlByPath.get(author.avatar_path) ?? null) : null,
    };
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-serif text-2xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('subtitle')}</p>
        <BoardClient posts={views} meId={meId} isAdmin={isAdmin} />
      </div>
    </AppShell>
  );
}
