'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Category, Pin } from '@/lib/supabase/types';

interface Props {
  pin: Pin;
  categories: Category[];
  onSaved: (pin: Pin) => void;
  onCancel: () => void;
  onDeleted: () => void;
}

export function PinEditForm({ pin, categories, onSaved, onCancel, onDeleted }: Props) {
  const t = useTranslations('pin');
  const tCommon = useTranslations('common');
  const [categoryId, setCategoryId] = useState(pin.category_id);
  const [vouchNote, setVouchNote] = useState(pin.vouch_note);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pins/${pin.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, vouch_note: vouchNote.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as Pin;
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pins/${pin.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">{t('category')}</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t('vouchNote')}</label>
        <textarea
          value={vouchNote}
          onChange={(e) => setVouchNote(e.target.value)}
          rows={4}
          maxLength={1000}
          required
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </div>

      {error ? <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !vouchNote.trim()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? '…' : t('saveChanges')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
        >
          {tCommon('cancel')}
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={archive}
            disabled={busy}
            className="ml-auto rounded-lg bg-[var(--color-terracotta-500)] px-4 py-2 text-sm font-medium text-white"
          >
            {t('confirmDelete')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="ml-auto rounded-lg border border-[var(--color-terracotta-500)] px-4 py-2 text-sm text-[var(--color-terracotta-500)]"
          >
            {t('delete')}
          </button>
        )}
      </div>
    </form>
  );
}
