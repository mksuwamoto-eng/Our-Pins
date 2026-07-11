'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A collapsible category group with a count. Shared by the Board and Resources
 * lists so heavy posters don't force a long scroll — each category can be
 * folded away, and the count is always visible on the header. `forceOpen` lets
 * a deep-link (or an active search) pop the relevant section open.
 */
export function CategorySection({
  header,
  count,
  defaultOpen = true,
  forceOpen = false,
  children,
}: {
  header: ReactNode;
  count: number;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--surface-subtle)]"
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--muted)] transition-transform',
            !open && '-rotate-90',
          )}
        />
        {header}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-[var(--muted)]">{count}</span>
      </button>
      {open ? <div className="space-y-1 px-2 pb-2">{children}</div> : null}
    </section>
  );
}
