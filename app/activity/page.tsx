import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { relativeTime } from '@/lib/time';

const ONE_HOUR = 3600;
const FEED_LIMIT = 30;

interface ActivityEvent {
  kind: 'pin' | 'vouch';
  id: string;
  pinId: string;
  pinName: string;
  actorId: string;
  createdAt: string;
}

export default async function ActivityPage() {
  const supabase = await createSupabaseServerClient();
  const t = await getTranslations('activity');

  const [{ data: recentPins }, { data: recentVouches }] = await Promise.all([
    supabase
      .from('pins')
      .select('id, name, created_by, created_at')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT),
    // Overshoot: every pin creation also creates a creator auto-vouch via
    // trigger, so we need extra headroom after filtering those out.
    supabase
      .from('vouches')
      .select('id, voucher_id, created_at, pin:pins!inner(id, name, created_by, archived_at)')
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT * 2),
  ]);

  const pinEvents: ActivityEvent[] = (recentPins ?? []).map((p) => ({
    kind: 'pin',
    id: `pin-${p.id}`,
    pinId: p.id,
    pinName: p.name,
    actorId: p.created_by,
    createdAt: p.created_at,
  }));

  const vouchEvents: ActivityEvent[] = (
    (recentVouches ?? []) as unknown as Array<{
      id: string;
      voucher_id: string;
      created_at: string;
      pin: { id: string; name: string; created_by: string; archived_at: string | null } | null;
    }>
  )
    .filter((v) => v.pin && !v.pin.archived_at && v.voucher_id !== v.pin.created_by)
    .map((v) => ({
      kind: 'vouch',
      id: `vouch-${v.id}`,
      pinId: v.pin!.id,
      pinName: v.pin!.name,
      actorId: v.voucher_id,
      createdAt: v.created_at,
    }));

  const events: ActivityEvent[] = [...pinEvents, ...vouchEvents]
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    .slice(0, FEED_LIMIT);

  const actorIds = Array.from(new Set(events.map((e) => e.actorId)));
  const { data: profiles } = actorIds.length
    ? await supabase
        .from('profiles')
        .select('id, display_name, avatar_path')
        .in('id', actorIds)
    : { data: [] };

  const profileById = new Map<string, { display_name: string; avatar_path: string | null }>();
  for (const p of profiles ?? []) profileById.set(p.id, p);

  const realAvatarPaths = (profiles ?? [])
    .map((p) => p.avatar_path)
    .filter((p): p is string => typeof p === 'string' && !p.includes('_pending'));
  const { data: signed } = realAvatarPaths.length
    ? await supabase.storage.from('pin-photos').createSignedUrls(realAvatarPaths, ONE_HOUR)
    : { data: [] };
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl">{t('title')}</h1>
        {events.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t('empty')}</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => {
              const actor = profileById.get(e.actorId);
              const avatarUrl = actor?.avatar_path
                ? urlByPath.get(actor.avatar_path)
                : undefined;
              return (
                <li key={e.id}>
                  <Link
                    href={`/?pin=${e.pinId}`}
                    className="card flex items-start gap-3 p-3 hover:bg-[var(--surface-subtle)]"
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--color-washi-200)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">
                          {actor?.display_name ?? t('formerMember')}
                        </span>{' '}
                        <span className="text-[var(--muted)]">
                          {e.kind === 'pin' ? t('pinned') : t('vouchedFor')}
                        </span>{' '}
                        <span className="font-medium">{e.pinName}</span>
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {relativeTime(e.createdAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
