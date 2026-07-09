/**
 * Answers cite places as [[pin:<id>|<name>]] and resources as
 * [[res:<id>|<title>]] (the grammar lives in the Concierge system prompt in
 * ask.ts). Single definition for every renderer: the web client turns markers
 * into <Link>s, the LINE bot into plain URLs.
 */
// The label is matched lazily and the closing "]]" must not be followed by
// another "]" — this lets labels contain brackets anywhere, INCLUDING as the
// final character ("Salary guide [2026]" → [[res:id|Salary guide [2026]]]
// has three closing brackets and the label must keep the first one).
export const PIN_MARKER = /\[\[pin:([0-9a-fA-F-]{36})\|(.+?)\]\](?!\])/g;
export const RES_MARKER = /\[\[res:([0-9a-fA-F-]{36})\|(.+?)\]\](?!\])/g;
/** Both kinds in one scan, for renderers that interleave them in order. */
export const ANY_MARKER = /\[\[(pin|res):([0-9a-fA-F-]{36})\|(.+?)\]\](?!\])/g;
