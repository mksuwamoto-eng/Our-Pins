'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LifeBuoy, HelpCircle, ScrollText, MessageSquarePlus } from 'lucide-react';
import { FeedbackSheet } from '@/components/feedback/FeedbackSheet';

/**
 * One header icon that used to be three (guide, guidelines, feedback). Opens a
 * small dropdown with links to /guide and /guidelines plus a "Send feedback"
 * action that opens the shared feedback sheet. Outside-click-to-close pattern
 * mirrors src/components/map/CategoryFilter.tsx.
 */
export function HelpMenu() {
  const t = useTranslations('header');
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const itemClass =
    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--surface-subtle)]';

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('help')}
        title={t('help')}
        className="text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <LifeBuoy className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg"
        >
          <Link href="/guide" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <HelpCircle className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <span>{t('howItWorks')}</span>
          </Link>
          <Link
            href="/guidelines"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <ScrollText className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <span>{t('guidelines')}</span>
          </Link>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              setFeedbackOpen(true);
            }}
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <span>{t('feedback')}</span>
          </button>
        </div>
      ) : null}

      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
