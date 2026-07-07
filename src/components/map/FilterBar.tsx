'use client';

import { useTranslations } from 'next-intl';
import { useFiltersStore } from '@/stores/filters';
import type { Category } from '@/lib/supabase/types';
import type { MemberOption } from './MapView';
import { cn } from '@/lib/utils';

export function FilterBar({ categories, members }: { categories: Category[]; members: MemberOption[] }) {
  const t = useTranslations('map');
  const { categoryIds, setCategoryIds, authorIds, setAuthorIds, search, setSearch } = useFiltersStore();

  function toggle(id: string) {
    setCategoryIds(categoryIds.includes(id) ? categoryIds.filter((c) => c !== id) : [...categoryIds, id]);
  }

  const selectedAuthor = authorIds[0] ?? '';

  return (
    <div className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`${t('filters')}…`}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2 text-sm shadow-sm backdrop-blur"
        />
        <select
          value={selectedAuthor}
          onChange={(e) => setAuthorIds(e.target.value ? [e.target.value] : [])}
          aria-label={t('memberFilter')}
          className={cn(
            'max-w-44 rounded-full border px-3 py-2 text-sm shadow-sm backdrop-blur',
            selectedAuthor
              ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
              : 'border-[var(--border)] bg-[var(--surface)]/95 text-[var(--fg)]',
          )}
        >
          <option value="">{t('everyone')}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </div>
      {/* One swipeable row on phones; wraps into rows on wider screens. */}
      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => {
          const active = categoryIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs',
                active
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                  : 'border-[var(--border)] bg-[var(--surface)]/95 text-[var(--fg)]',
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
