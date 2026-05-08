'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteAccountForm() {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== 'DELETE') {
      setError('Type DELETE in capital letters to confirm.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      router.push('/sign-in');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm">
        Type <code>DELETE</code> to confirm:
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
        {pending ? 'Deleting…' : 'Delete my account'}
      </button>
    </form>
  );
}
