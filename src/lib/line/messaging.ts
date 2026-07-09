import { createHmac, timingSafeEqual } from 'node:crypto';

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const MAX_TEXT_LENGTH = 5000; // LINE hard limit per text message

/**
 * Verify a webhook's x-line-signature: base64 of HMAC-SHA256 over the raw
 * request body, keyed with the Messaging API channel secret.
 */
export function verifyLineSignature(input: {
  rawBody: string;
  signature: string | null;
  channelSecret: string;
}): boolean {
  if (!input.signature) return false;
  const expected = createHmac('sha256', input.channelSecret)
    .update(input.rawBody)
    .digest();
  const received = Buffer.from(input.signature, 'base64');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Reply to a webhook event. Reply tokens are free, single-use, ~1 min TTL. */
export async function replyLineMessage(input: {
  replyToken: string;
  text: string;
  accessToken: string;
}): Promise<void> {
  const res = await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      replyToken: input.replyToken,
      messages: [{ type: 'text', text: input.text.slice(0, MAX_TEXT_LENGTH) }],
    }),
  });
  if (!res.ok) {
    throw new Error(`LINE reply failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Push an unprompted text message to a user / group / room (no reply token).
 * This is what a scheduled digest needs — reply tokens are single-use and
 * expire ~1 min after an inbound event.
 */
export async function pushLineMessage(input: {
  to: string;
  text: string;
  accessToken: string;
}): Promise<void> {
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      to: input.to,
      messages: [{ type: 'text', text: input.text.slice(0, MAX_TEXT_LENGTH) }],
    }),
  });
  if (!res.ok) {
    throw new Error(`LINE push failed: ${res.status} ${await res.text()}`);
  }
}

// Minimal typing of the webhook events we handle.
export interface LineWebhookEvent {
  type: string; // 'message' | 'join' | ...
  replyToken?: string;
  deliveryContext?: { isRedelivery?: boolean };
  source?: { type: 'user' | 'group' | 'room'; userId?: string; groupId?: string };
  message?: {
    type: string; // 'text' | 'location' | ...
    text?: string;
    mention?: { mentionees?: { isSelf?: boolean; index: number; length: number }[] };
  };
}
