/**
 * Answers cite places as [[pin:<id>|<name>]] (the grammar lives in the
 * Concierge system prompt in ask.ts). Single definition for every renderer:
 * the web client turns markers into <Link>s, the LINE bot into plain URLs.
 */
export const PIN_MARKER = /\[\[pin:([0-9a-fA-F-]{36})\|([^\]]+)\]\]/g;
