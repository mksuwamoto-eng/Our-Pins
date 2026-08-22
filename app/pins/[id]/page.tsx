import { redirect } from 'next/navigation';

/**
 * Canonical pin detail lives in the map's PinSheet (photos, translations,
 * avatars, place details, the sensitive-category notice, creator-aware vouch
 * controls). This route used to render a second, thinner copy of that view —
 * shared links and the post-create redirect landed on a degraded page that
 * silently dropped the sensitive-category warning. Keep the URL working as a
 * permalink and hand it to the real thing; MapView absorbs ?pin= and opens the
 * sheet.
 */
export default async function PinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/?pin=${encodeURIComponent(id)}`);
}
