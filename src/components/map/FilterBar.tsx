'use client';

import { useTranslations } from 'next-intl';
import { useFiltersStore } from '@/stores/filters';
import type { Category } from '@/lib/supabase/types';
import type { MemberOption } from './MapView';
import { CategoryFilter } from './CategoryFilter';
import { cn } from '@/lib/utils';

export function FilterBar({
  categories,
  members,
  counts,
}: {
  categories: Category[];
  members: MemberOption[];
  counts: Record<string, number>;
}) {
  const t = useTranslations('map');
  const { authorIds, setAuthorIds, search, setSearch } = useFiltersStore();

  const selectedAuthor = authorIds[0] ?? '';

  return (
    <div className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`${t('filters')}…`}
        className="rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2 text-sm shadow-sm backdrop-blur"
      />
      <CategoryFilter categories={categories} counts={counts} />
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
  );
}
