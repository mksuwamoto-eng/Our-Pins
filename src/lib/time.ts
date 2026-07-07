const formatters = new Map<string, Intl.RelativeTimeFormat>();

function getRtf(locale?: string) {
  const key = locale ?? '';
  let rtf = formatters.get(key);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    formatters.set(key, rtf);
  }
  return rtf;
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
];

/**
 * Pass the app locale when the result is server-rendered inside a client
 * component: the default locale differs between Node and the browser, which
 * causes React hydration mismatches.
 */
export function relativeTime(input: string | Date, locale?: string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const diff = (date.getTime() - Date.now()) / 1000;
  const rtf = getRtf(locale);
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs || unit === 'minute') {
      return rtf.format(Math.round(diff / secs), unit);
    }
  }
  return rtf.format(Math.round(diff), 'second');
}
