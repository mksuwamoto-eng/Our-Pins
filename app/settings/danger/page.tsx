import { AppShell } from '@/components/layout/AppShell';
import { DeleteAccountForm } from '@/components/settings/DeleteAccountForm';

export default function DangerPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="font-serif text-2xl">Delete account</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your pins and vouches will be retained but anonymised. Your private profile data will be erased.
        </p>
        <DeleteAccountForm />
      </div>
    </AppShell>
  );
}
