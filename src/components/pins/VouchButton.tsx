'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, Heart } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

export function VouchButton({ pinId }: { pinId: string }) {
  const t = useTranslations('pin');
  const [vouched, setVouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from('vouches')
        .select('id')
        .eq('pin_id', pinId)
        .eq('voucher_id', data.user.id)
        .maybeSingle()
        .then(({ data: row }) => {
          if (cancelled) return;
          setVouched(!!row);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [pinId]);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/pins/${pinId}/vouch`, {
        method: vouched ? 'DELETE' : 'POST',
      });
      if (!res.ok) throw new Error(await res.text());
      setVouched(!vouched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={cn(
        'mt-4 flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium transition',
        vouched
          ? 'border border-[var(--primary)] text-[var(--primary)]'
          : 'bg-[var(--primary)] text-white',
        pending && 'opacity-60',
      )}
    >
      {vouched ? <CheckCircle className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
      {vouched ? t('removeVouch') : t('iVouchedToo')}
      {error ? <span className="ml-2 text-xs">{error}</span> : null}
    </button>
  );
}
