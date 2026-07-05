'use client';

import { Drawer } from 'vaul';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, MessageCircle, Send, X } from 'lucide-react';
import { PIN_MARKER } from '@/lib/concierge/markers';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Render an answer, turning [[pin:<id>|<name>]] markers into map deep-links.
 */
function renderAnswer(text: string, onNavigate: () => void): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  PIN_MARKER.lastIndex = 0;
  while ((match = PIN_MARKER.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <Link
        key={`${match[1]}-${match.index}`}
        href={`/?pin=${match[1]}`}
        onClick={onNavigate}
        className="inline-flex items-center gap-0.5 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[var(--primary)] hover:underline"
      >
        <MapPin className="h-3 w-3 shrink-0" />
        {match[2]}
      </Link>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Concierge() {
  const t = useTranslations('concierge');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || pending) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setPending(true);
    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (!res.ok || !json.answer) {
        setError(
          json.error === 'budget_exhausted'
            ? t('errorBudget')
            : json.error === 'daily_limit'
              ? t('errorDaily')
              : json.error === 'concierge_not_configured'
                ? t('errorNotConfigured')
                : t('errorGeneric'),
        );
        return;
      }
      setMessages((m) => [...m, { role: 'assistant', text: json.answer! }]);
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setPending(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('title')}
        title={t('title')}
        className="absolute bottom-6 left-6 z-20 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] shadow-lg"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-30 bg-black/30" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-40 flex h-[80vh] flex-col rounded-t-2xl bg-[var(--surface)] outline-none">
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

            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {messages.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{t('empty')}</p>
              ) : null}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <p
                    key={i}
                    className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--primary)] px-3 py-2 text-sm text-white"
                  >
                    {m.text}
                  </p>
                ) : (
                  <div
                    key={i}
                    className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-[var(--surface-subtle)] px-3 py-2 text-sm"
                  >
                    {renderAnswer(m.text, () => setOpen(false))}
                  </div>
                ),
              )}
              {pending ? (
                <p className="text-sm italic text-[var(--muted)]">{t('thinking')}</p>
              ) : null}
              {error ? (
                <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={ask}
              className="flex gap-2 border-t border-[var(--border)] px-6 py-4"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('placeholder')}
                maxLength={500}
                aria-label={t('placeholder')}
                className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                aria-label={t('send')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
