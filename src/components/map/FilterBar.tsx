'use client';

import { useTranslations } from 'next-intl';
import { useFiltersStore } from '@/stores/filters';
import type { Category } from '@/lib/supabase/types';
import type { MemberOption } from './MapView';
import { FacetFilter } from './FacetFilter';
import { categoryLabel } from '@/lib/i18n/category';
import { categoryIcon } from '@/lib/categories/icons';
import { TAG_SLUGS } from '@/lib/tags';
import { cn } from '@/lib/utils';

export function FilterBar({
  categories,
  members,
  counts,
  tagCounts,
}: {
  categories: Category[];
  members: MemberOption[];
  counts: Record<string, number>;
  tagCounts: Record<string, number>;
}) {
  const t = useTranslations('map');
  const tc = useTranslations('categories');
  const tt = useTranslations('tags');
  const { categoryIds, setCategoryIds, tags, setTags, authorIds, setAuthorIds, search, setSearch } =
    useFiltersStore();

  const selectedAuthor = authorIds[0] ?? '';

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  return (
    <div className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2 text-sm shadow-sm backdrop-blur"
      />
      <FacetFilter
        items={categories.map((c) => ({
          id: c.id,
          label: categoryLabel(tc, c),
          count: counts[c.id] ?? 0,
          color: c.color,
          icon: categoryIcon(c.icon),
        }))}
        selected={categoryIds}
        onToggle={(id) => setCategoryIds(toggle(categoryIds, id))}
        onClear={() => setCategoryIds([])}
        emptyLabel={t('allCategories')}
        selectedLabel={(count) => t('nSelected', { count })}
        ariaLabel={t('categoryFilter')}
        clearLabel={t('clearCategories')}
      />
      <FacetFilter
        items={TAG_SLUGS.map((slug) => ({
          id: slug,
          label: tt(slug),
          count: tagCounts[slug] ?? 0,
        }))}
        selected={tags}
        onToggle={(id) => setTags(toggle(tags, id))}
        onClear={() => setTags([])}
        emptyLabel={t('allTags')}
        selectedLabel={(count) => t('nSelected', { count })}
        ariaLabel={t('tagFilter')}
        clearLabel={t('clearTags')}
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
  );
}
