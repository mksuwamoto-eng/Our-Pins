'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FacetItem {
  id: string;
  label: string;
  count: number;
  /** Optional swatch colour — categories have one, tags don't. */
  color?: string;
  icon?: LucideIcon;
}

/**
 * A multi-select dropdown for one filter axis. Generalized out of the old
 * CategoryFilter so the tag axis reuses it instead of forking a near-identical
 * copy — the two would drift on the next styling change.
 *
 * Selection is OR within a facet ("greek OR english-ok"); the caller ANDs the
 * facets together.
 */
export function FacetFilter({
  items,
  selected,
  onToggle,
  onClear,
  emptyLabel,
  selectedLabel,
  ariaLabel,
  clearLabel,
}: {
  items: FacetItem[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  /** Button text when nothing is selected, e.g. "All categories". */
  emptyLabel: string;
  /** Button text when something is, e.g. (n) => `${n} selected`. */
  selectedLabel: (count: number) => string;
  ariaLabel: string;
  clearLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click (no backdrop — avoids z-index fights with the other
  // filter controls in the same absolutely-positioned bar).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selectedCount = selected.length;
  const label = selectedCount === 0 ? emptyLabel : selectedLabel(selectedCount);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm shadow-sm backdrop-blur',
          selectedCount
            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
            : 'border-[var(--border)] bg-[var(--surface)]/95 text-[var(--fg)]',
        )}
      >
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg">
          {selectedCount > 0 ? (
            <button
              onClick={onClear}
              className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
            >
              {clearLabel}
            </button>
          ) : null}
          {items.map((item) => {
            const active = selected.includes(item.id);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-subtle)]',
                  item.count === 0 && !active && 'opacity-40',
                )}
              >
                {item.color ? (
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: item.color }}
                  >
                    {Icon ? <Icon className="h-3.5 w-3.5 text-white" /> : null}
                  </span>
                ) : null}
                <span className="flex-1 truncate">{item.label}</span>
                <span className="text-xs tabular-nums text-[var(--muted)]">{item.count}</span>
                {active ? (
                  <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
