'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function DeleteAccountForm() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // The confirmation token is the literal word DELETE in both locales; the
    // label and error name it explicitly.
    if (confirm !== 'DELETE') {
      setError(t('deleteTypeError'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) throw new Error('delete failed');
      router.push('/sign-in');
    } catch {
      setError(tCommon('error'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm">
        {t.rich('deleteTypeToConfirm', { code: (chunks) => <code>{chunks}</code> })}
      </label>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
      />
      {error ? <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--color-terracotta-500)] px-4 py-2 text-sm font-medium text-white"
      >
        {pending ? t('deleting') : t('deleteSubmit')}
      </button>
    </form>
  );
}
