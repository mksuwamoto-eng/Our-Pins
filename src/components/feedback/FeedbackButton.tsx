'use client';

import { Drawer } from 'vaul';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquarePlus, X } from 'lucide-react';
import { FEEDBACK_KINDS } from '@/lib/schemas/feedback';
import type { FeedbackKind } from '@/lib/schemas/feedback';
import { cn } from '@/lib/utils';

/**
 * Header button → bottom sheet for bug reports and feature ideas. Reports go
 * to the feedback table (admin-only read, /admin/feedback).
 */
export function FeedbackButton() {
  const t = useTranslations('feedback');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setError(t('required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          body: body.trim(),
          pageContext: window.location.pathname,
        }),
      });
      if (!res.ok) {
        setError(t('failed'));
        return;
      }
      setBody('');
      setSent(true);
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSent(false);
      setError(null);
    }
  }

  return (
    <>
      <button
        onClick={() => onOpenChange(true)}
        aria-label={t('buttonLabel')}
        title={t('buttonLabel')}
        className="text-[var(--muted)] hover:text-[var(--fg)]"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-30 bg-black/30" />
          {/* Content stays non-scrolling; the body wrapper scrolls (Vaul
              overscroll-mask gotcha). */}
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl bg-[var(--surface)] outline-none">
            <div className="flex items-start justify-between px-6 pt-6">
              <div>
                <Drawer.Title className="font-serif text-2xl">{t('title')}</Drawer.Title>
                <p className="mt-1 text-sm text-[var(--muted)]">{t('subtitle')}</p>
              </div>
              <Drawer.Close
                aria-label={t('close')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              >
                <X className="h-5 w-5" />
              </Drawer.Close>
            </div>

            <div className="min-h-0 overflow-y-auto p-6">
              {sent ? (
                <div className="space-y-4">
                  <p className="text-sm">{t('thanks')}</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                  >
                    {t('close')}
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="flex gap-1">
                    {FEEDBACK_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs',
                          kind === k
                            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]',
                        )}
                      >
                        {t(`kind_${k}`)}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium">{t('bodyLabel')}</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      required
                      maxLength={2000}
                      rows={5}
                      placeholder={t('bodyPlaceholder')}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                  </div>
                  {error ? <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p> : null}
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busy ? t('sending') : t('submit')}
                  </button>
                </form>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
