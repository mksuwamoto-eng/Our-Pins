'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, Heart } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

export function VouchPanel({ pinId, onChange }: { pinId: string; onChange?: () => void }) {
  const t = useTranslations('pin');
  const tCommon = useTranslations('common');
  const [vouched, setVouched] = useState(false);
  const [comment, setComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user || cancelled) return;
      supabase
        .from('vouches')
        .select('id, comment')
        .eq('pin_id', pinId)
        .eq('voucher_id', data.user.id)
        .maybeSingle()
        .then(({ data: row }: { data: { id: string; comment: string | null } | null }) => {
          if (cancelled) return;
          setVouched(!!row);
          if (row?.comment) setComment(row.comment);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [pinId]);

  async function submitVouch() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/pins/${pinId}/vouch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      setVouched(true);
      setShowCommentInput(false);
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  async function removeVouch() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/pins/${pinId}/vouch`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setVouched(false);
      setComment('');
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  if (vouched) {
    return (
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={removeVouch}
          disabled={pending}
          className={cn(
            'flex items-center gap-2 rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)]',
            pending && 'opacity-60',
          )}
        >
          <CheckCircle className="h-4 w-4" />
          {t('removeVouch')}
        </button>
        {error ? <span className="text-xs text-[var(--color-terracotta-500)]">{error}</span> : null}
      </div>
    );
  }

  if (showCommentInput) {
    return (
      <div className="mt-4 space-y-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={`${t('vouchComment')}…`}
          rows={2}
          maxLength={500}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={submitVouch}
            disabled={pending}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            {pending ? '…' : t('iVouchedToo')}
          </button>
          <button
            onClick={() => setShowCommentInput(false)}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
          >
            {tCommon('cancel')}
          </button>
          {error ? <span className="text-xs text-[var(--color-terracotta-500)]">{error}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        onClick={() => setShowCommentInput(true)}
        className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
      >
        <Heart className="h-4 w-4" />
        {t('iVouchedToo')}
      </button>
    </div>
  );
}
