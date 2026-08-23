'use client';

import { useTranslations } from 'next-intl';
import { TAG_SLUGS } from '@/lib/tags';
import { cn } from '@/lib/utils';

/**
 * The tag axis, as toggle chips. One component for all three pin forms
 * (PinForm, InlineAddPinForm, PinEditForm) — the picker is identical in each
 * and three copies would drift the moment the vocabulary changes.
 *
 * Tags are optional and orthogonal to category: a Greek taverna is
 * Restaurants + `greek`. See src/lib/tags for the vocabulary.
 */
export function TagPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('pin');
  const tt = useTranslations('tags');

  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium">{t('tagsLabel')}</span>
      <div className="flex flex-wrap gap-2">
        {TAG_SLUGS.map((slug) => {
          const active = value.includes(slug);
          return (
            <button
              key={slug}
              type="button"
              onClick={() => toggle(slug)}
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm disabled:opacity-60',
                active
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]',
              )}
            >
              {tt(slug)}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">{t('tagsHint')}</p>
    </div>
  );
}
