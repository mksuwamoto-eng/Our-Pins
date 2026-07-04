'use client';

import { ExternalLink, Globe, Phone, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  addressComponents: Array<{ longText: string; shortText: string; types: string[] }>;
  photoUrls: string[];
  weekdayDescriptions: string[];
  phone: string | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
  editorialSummary: string | null;
  primaryType: string | null;
}

export function PlaceInfoCard({ place }: { place: PlaceDetails }) {
  const t = useTranslations('pin');
  const todayIdx = (new Date().getDay() + 6) % 7; // Google starts week on Monday
  const todayHours = place.weekdayDescriptions[todayIdx] ?? null;

  return (
    <div className="space-y-3">
      {place.photoUrls.length ? (
        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none]">
          {place.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="h-32 w-48 shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      ) : null}

      {place.editorialSummary ? (
        <p className="text-sm text-[var(--muted)]">{place.editorialSummary}</p>
      ) : null}

      {place.primaryType ? (
        <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
          {humanizeType(place.primaryType)}
        </p>
      ) : null}

      <ul className="space-y-1 text-sm">
        {todayHours ? (
          <li className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--muted)]" />
            <span>{todayHours}</span>
          </li>
        ) : null}
        {place.phone ? (
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[var(--muted)]" />
            <a href={`tel:${place.phone.replace(/\s/g, '')}`} className="underline">
              {place.phone}
            </a>
          </li>
        ) : null}
        {place.websiteUri ? (
          <li className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--muted)]" />
            <a
              href={place.websiteUri}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate underline"
            >
              {prettyUrl(place.websiteUri)}
            </a>
          </li>
        ) : null}
        {place.googleMapsUri ? (
          <li className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-[var(--muted)]" />
            <a
              href={place.googleMapsUri}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              {t('viewOnGoogleMaps')}
            </a>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function humanizeType(t: string): string {
  return t.replace(/_/g, ' ');
}

function prettyUrl(u: string): string {
  try {
    const url = new URL(u);
    return url.host.replace(/^www\./, '') + (url.pathname === '/' ? '' : url.pathname);
  } catch {
    return u;
  }
}
