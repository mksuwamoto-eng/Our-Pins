'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { LocalizedText } from '@/components/i18n/LocalizedText';
import { CategorySection } from '@/components/common/CategorySection';
import { BOARD_CATEGORIES } from '@/lib/schemas/board';
import { relativeTime } from '@/lib/time';
import type { BoardCategory, BoardPost } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

export interface BoardPostView {
  post: BoardPost;
  authorName: string | null;
  authorAvatarUrl: string | null;
}

interface Props {
  posts: BoardPostView[];
  meId: string | null;
  isAdmin: boolean;
}

const CATEGORY_COLORS: Record<BoardCategory, string> = {
  job: 'bg-[var(--primary)]/10 text-[var(--primary)]',
  housing: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  for_sale: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  event: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  other: 'bg-[var(--color-washi-200)] text-[var(--muted)]',
};

export function BoardClient({ posts, meId, isAdmin }: Props) {
  const t = useTranslations('board');
  const locale = useLocale();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<BoardCategory>('job');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  // Compact-by-default rows; a category section can be folded away.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groups = BOARD_CATEGORIES.map((c) => ({
    category: c,
    items: posts.filter((v) => v.post.category === c),
  })).filter((g) => g.items.length > 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // `required` accepts whitespace-only input; the server would reject it
    // with an untranslated Zod message.
    if (!title.trim() || !body.trim()) {
      setError(t('requiredFields'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/board', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category, title: title.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        // 429 = daily cap hit; show a helpful message instead of a generic one.
        setError(res.status === 429 ? t('limitDaily') : t('postFailed'));
        return;
      }
      setTitle('');
      setBody('');
      setShowForm(false);
      router.refresh();
    } catch {
      setError(t('postFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function onArchive(id: string) {
    setArchivingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/board/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(t('removeFailed'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('removeFailed'));
    } finally {
      setArchivingId(null);
    }
  }

  // Compact row → expands to full detail on tap. Board titles aren't
  // translated (by design), so the compact title is the plain original.
  function renderRow({ post, authorName, authorAvatarUrl }: BoardPostView) {
    const canArchive = isAdmin || post.created_by === meId;
    const expanded = expandedIds.has(post.id);
    return (
      <div key={post.id} className="rounded-lg">
        <button
          type="button"
          onClick={() => toggleExpand(post.id)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-subtle)]"
        >
          <span className={cn('min-w-0 flex-1 text-sm font-medium', !expanded && 'truncate')}>
            {post.title}
          </span>
          {authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={authorAvatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="h-5 w-5 shrink-0 rounded-full bg-[var(--color-washi-200)]" />
          )}
          <time className="shrink-0 text-xs text-[var(--muted)]">{relativeTime(post.created_at, locale)}</time>
        </button>
        {expanded ? (
          <div className="space-y-1.5 px-2 pb-2">
            <LocalizedText
              original={post.body}
              translations={post.translations}
              className="whitespace-pre-wrap text-sm text-[var(--fg)]"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              {authorName ? (
                <Link href={`/members/${post.created_by}`} className="hover:underline">
                  {authorName}
                </Link>
              ) : (
                <span>{t('formerMember')}</span>
              )}
              {canArchive ? (
                <>
                  <span>·</span>
                  <button
                    onClick={() => onArchive(post.id)}
                    disabled={archivingId === post.id}
                    className="underline decoration-dotted disabled:opacity-60"
                  >
                    {t('remove')}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {error ? <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p> : null}

      {showForm ? (
        <form onSubmit={onSubmit} className="card space-y-3 p-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">{t('categoryLabel')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BoardCategory)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              {BOARD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category_${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">{t('titleLabel')}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder={t('titlePlaceholder')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">{t('bodyLabel')}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={2000}
              rows={4}
              placeholder={t('bodyPlaceholder')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-[var(--muted)]">{t('expiryNote')}</p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? t('posting') : t('submit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => {
            setShowForm(true);
            setError(null);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          {t('newPost')}
        </button>
      )}

      {posts.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t('empty')}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <CategorySection
              key={g.category}
              count={g.items.length}
              header={
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    CATEGORY_COLORS[g.category],
                  )}
                >
                  {t(`category_${g.category}`)}
                </span>
              }
            >
              {g.items.map((v) => renderRow(v))}
            </CategorySection>
          ))}
        </div>
      )}
    </div>
  );
}
