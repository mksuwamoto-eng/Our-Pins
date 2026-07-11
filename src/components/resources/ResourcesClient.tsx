'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { LocalizedText } from '@/components/i18n/LocalizedText';
import { CategorySection } from '@/components/common/CategorySection';
import { RESOURCE_CATEGORIES } from '@/lib/schemas/resource';
import { relativeTime } from '@/lib/time';
import type { Resource, ResourceCategory } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

export interface ResourceView {
  resource: Resource;
  authorName: string | null;
  authorAvatarUrl: string | null;
}

interface Props {
  resources: ResourceView[];
  meId: string | null;
  isAdmin: boolean;
}

const CATEGORY_COLORS: Record<ResourceCategory, string> = {
  how_to: 'bg-[var(--primary)]/10 text-[var(--primary)]',
  watch: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  read: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  other: 'bg-[var(--color-washi-200)] text-[var(--muted)]',
};

interface FormValues {
  category: ResourceCategory;
  title: string;
  body: string;
  url: string;
}

const EMPTY_FORM: FormValues = { category: 'how_to', title: '', body: '', url: '' };

/** Shared by create and edit — one definition, parameterized (never forked). */
function ResourceForm({
  initial,
  submitLabel,
  busyLabel,
  failedLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues;
  submitLabel: string;
  busyLabel: string;
  failedLabel: string;
  /** Resolves true on success (form closes via parent re-render). */
  onSubmit: (values: FormValues) => Promise<boolean>;
  onCancel: () => void;
}) {
  const t = useTranslations('resources');
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // `required` accepts whitespace-only input; the server would reject it
    // with an untranslated Zod message.
    if (!values.title.trim() || !values.body.trim()) {
      setError(t('requiredFields'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await onSubmit({
        ...values,
        title: values.title.trim(),
        body: values.body.trim(),
        url: values.url.trim(),
      });
      if (!ok) setError(failedLabel);
    } catch (err) {
      // A thrown message (e.g. a cap hit) is user-facing; else stay generic.
      setError(err instanceof Error && err.message ? err.message : failedLabel);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3 p-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('categoryLabel')}</label>
        <select
          value={values.category}
          onChange={(e) => set('category', e.target.value as ResourceCategory)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          {RESOURCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category_${c}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('titleLabel')}</label>
        <input
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          required
          maxLength={120}
          placeholder={t('titlePlaceholder')}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('bodyLabel')}</label>
        <textarea
          value={values.body}
          onChange={(e) => set('body', e.target.value)}
          required
          maxLength={5000}
          rows={6}
          placeholder={t('bodyPlaceholder')}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium">{t('urlLabel')}</label>
        <input
          value={values.url}
          onChange={(e) => set('url', e.target.value)}
          maxLength={500}
          placeholder={t('urlPlaceholder')}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>
      <p className="text-xs text-[var(--muted)]">{t('permanentNote')}</p>
      {error ? <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? busyLabel : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function ResourcesClient({ resources, meId, isAdmin }: Props) {
  const t = useTranslations('resources');
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // Which rows are expanded to full detail. Compact-by-default keeps the list
  // short; a category section can also be folded away via CategorySection.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const searchParams = useSearchParams();
  const resFromUrl = searchParams.get('res');
  const routerRef = useRef(router);
  routerRef.current = router;

  // Digest links and Parea answers deep-link here as /resources?res=<id> — a
  // query param, not a #fragment, because the sign-in redirect preserves only
  // pathname + search (same reason map links use ?pin=). Absorb the param:
  // scroll to the card, flash it, clean the URL.
  useEffect(() => {
    if (!resFromUrl) return;
    setHighlightId(resFromUrl);
    setExpandedIds((prev) => new Set(prev).add(resFromUrl));
    routerRef.current.replace('/resources', { scroll: false });
    // Post-paint: the list is rendered by now (server component data).
    setTimeout(() => document.getElementById(resFromUrl)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    const clear = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(clear);
  }, [resFromUrl]);

  const q = search.trim().toLowerCase();
  const matchesSearch = (r: Resource) =>
    !q ||
    [r.title, r.body, r.translations?.title?.el, r.translations?.title?.en, r.translations?.body?.el, r.translations?.body?.en].some(
      (s) => s?.toLowerCase().includes(q),
    );
  const visible = resources.filter((v) => matchesSearch(v.resource));
  const groups = RESOURCE_CATEGORIES.map((category) => ({
    category,
    items: visible.filter((v) => v.resource.category === category),
  })).filter((g) => g.items.length > 0);

  async function submitTo(path: string, method: 'POST' | 'PATCH', values: FormValues) {
    const res = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      // Surface the anti-spam cap reason (429) as a helpful message; other
      // failures fall through to the form's generic failedLabel.
      if (res.status === 429) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error === 'active_limit' ? t('limitActive') : t('limitDaily'));
      }
      return false;
    }
    router.refresh();
    return true;
  }

  async function onArchive(id: string) {
    setArchivingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' });
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

  // Compact row that expands to full detail on tap; the edit form replaces the
  // row inline. Rendered inside each category section.
  function renderRow({ resource: r, authorName, authorAvatarUrl }: ResourceView) {
    const canManage = isAdmin || r.created_by === meId;
    if (editingId === r.id) {
      return (
        <div key={r.id}>
          <ResourceForm
            initial={{ category: r.category, title: r.title, body: r.body, url: r.url ?? '' }}
            submitLabel={t('save')}
            busyLabel={t('saving')}
            failedLabel={t('editFailed')}
            onSubmit={async (values) => {
              const ok = await submitTo(`/api/resources/${r.id}`, 'PATCH', values);
              if (ok) setEditingId(null);
              return ok;
            }}
            onCancel={() => setEditingId(null)}
          />
        </div>
      );
    }
    const expanded = expandedIds.has(r.id);
    const titleText = r.translations?.title?.[locale === 'el' ? 'el' : 'en'] || r.title;
    return (
      <div
        key={r.id}
        id={r.id}
        className={cn('scroll-mt-4 rounded-lg', highlightId === r.id && 'ring-2 ring-[var(--primary)]')}
      >
        <button
          type="button"
          onClick={() => toggleExpand(r.id)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-subtle)]"
        >
          <span className={cn('min-w-0 flex-1 text-sm font-medium', !expanded && 'truncate')}>
            {titleText}
          </span>
          {authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={authorAvatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="h-5 w-5 shrink-0 rounded-full bg-[var(--color-washi-200)]" />
          )}
          <time className="shrink-0 text-xs text-[var(--muted)]">{relativeTime(r.created_at, locale)}</time>
        </button>
        {expanded ? (
          <div className="space-y-1.5 px-2 pb-2">
            <LocalizedText
              original={r.body}
              translations={r.translations?.body ?? null}
              className="whitespace-pre-wrap text-sm text-[var(--fg)]"
            />
            {r.url ? (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-[var(--primary)] underline decoration-dotted"
              >
                {hostOf(r.url)} <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              {authorName ? (
                <Link href={`/members/${r.created_by}`} className="hover:underline">
                  {authorName}
                </Link>
              ) : (
                <span>{t('formerMember')}</span>
              )}
              {r.updated_at > r.created_at ? (
                <>
                  <span>·</span>
                  <span className="italic">{t('updated', { when: relativeTime(r.updated_at, locale) })}</span>
                </>
              ) : null}
              {canManage ? (
                <>
                  <span>·</span>
                  <button
                    onClick={() => {
                      setEditingId(r.id);
                      setError(null);
                    }}
                    className="underline decoration-dotted"
                  >
                    {t('edit')}
                  </button>
                  <button
                    onClick={() => onArchive(r.id)}
                    disabled={archivingId === r.id}
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
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
      />

      {error ? <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p> : null}

      {showForm ? (
        <ResourceForm
          initial={EMPTY_FORM}
          submitLabel={t('submit')}
          busyLabel={t('posting')}
          failedLabel={t('postFailed')}
          onSubmit={async (values) => {
            const ok = await submitTo('/api/resources', 'POST', values);
            if (ok) setShowForm(false);
            return ok;
          }}
          onCancel={() => setShowForm(false)}
        />
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

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{resources.length === 0 ? t('empty') : t('noMatches')}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <CategorySection
              key={g.category}
              count={g.items.length}
              // A search or a deep-link target pops the section open.
              forceOpen={!!q || g.items.some((v) => v.resource.id === highlightId)}
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
