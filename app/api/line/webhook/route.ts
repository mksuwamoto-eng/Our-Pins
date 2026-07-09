import { after, NextResponse } from 'next/server';
import { askParea, type AskError } from '@/lib/concierge/ask';
import { PIN_MARKER } from '@/lib/concierge/markers';
import {
  replyLineMessage,
  verifyLineSignature,
  type LineWebhookEvent,
} from '@/lib/line/messaging';
import { activateLineGroup, deactivateLineGroup, ensureLineGroup } from '@/lib/line/groups';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getServerEnv, publicEnv } from '@/lib/env';

// Model call can take a while; the reply token stays valid ~1 minute.
export const maxDuration = 60;

// In the group, only messages that address the bot get an answer: a real
// @mention, or a typed "@parea …" prefix. A bare leading "παρέα" must NOT
// trigger — it's an everyday Greek word ("Παρέα, ποιος έρχεται;" addresses
// the group, not the bot).
const TRIGGER_PREFIX = /^\s*@(parea|παρέα|παρεα)(?:$|[\s,:;!?.·—-]+)/i;

// Per-instance cache so we hit the DB to register a group at most once per cold
// start, not on every message in a busy group. A group added AFTER deploy is
// registered by its join event; this only backfills groups already joined when
// the code shipped, so a lightweight guard is plenty.
const discoveredGroups = new Set<string>();

const ERROR_REPLY: Record<AskError, string> = {
  not_configured: 'Sorry, I am not fully set up yet. / Συγγνώμη, δεν είμαι έτοιμη ακόμα.',
  invalid_question:
    'That is a bit long for me — keep questions under 500 characters. / Λίγο μεγάλο για μένα — έως 500 χαρακτήρες.',
  budget_exhausted:
    'I have used up my budget for this month — ask me again next month! / Εξάντλησα το μηνιαίο μου όριο — τα ξαναλέμε του μήνα!',
  daily_limit:
    'You have reached today’s question limit — ask me again tomorrow! / Έφτασες το ημερήσιο όριο — ρώτα με ξανά αύριο!',
  model_rate_limited: 'I am a bit overloaded — try again in a minute. / Λίγη υπερφόρτωση — δοκίμασε ξανά σε ένα λεπτό.',
  model_error: 'Something went wrong on my end — try again later. / Κάτι πήγε στραβά — δοκίμασε ξανά αργότερα.',
  model_refused: 'Something went wrong on my end — try again later. / Κάτι πήγε στραβά — δοκίμασε ξανά αργότερα.',
};

// Bare sign-in doesn't work without an invite: the LINE callback would mint
// a non-member account and middleware bounces it to /no-invite. The path
// that DOES work today is invite link → sign in with LINE — so that's what
// the copy has to say.
const NOT_LINKED_REPLY =
  'This chat is for Our Pins members. Ask Mako (or the group) for an invite link, open it, and sign in with LINE — then ask me anything! / Ζήτα από τον Μάκο (ή την ομάδα) ένα invite link, άνοιξέ το και συνδέσου με LINE — μετά ρώτα με ό,τι θες!';

const LOCATION_REPLY =
  'I can’t turn shared locations into pins yet — add it on the map! / Δεν μπορώ να κάνω pin από τοποθεσία ακόμα — πρόσθεσέ το στον χάρτη!';

const TEXT_ONLY_REPLY =
  'I only understand text for now 💬 / Καταλαβαίνω μόνο κείμενο προς το παρόν!';

const USAGE_HINT_REPLY =
  'Γεια! 👋 Ask me about places members have vouched for — e.g. "@parea πού για καλό καφέ;" or "@parea any good restaurants in Tokyo?"';

const INTRO_REPLY = `Γεια σας! I’m Parea, the Our Pins concierge for Greeks of Japan. Ask me for places the community has vouched for — try "πού για καλό καφέ;" or "any good restaurants in Tokyo?" — and I’ll answer with who recommended what. In the group chat, start your message with @parea (or mention me). I only know what members have pinned on ${publicEnv.NEXT_PUBLIC_SITE_URL} — the more you pin, the smarter I get!`;

/**
 * Render [[pin:<id>|<name>]] markers as "name (Google Maps URL)" — in LINE,
 * a place link should open navigation, not the web app. Falls back to the
 * app deep-link if the pin can't be found.
 */
async function markersToMapLinks(answer: string): Promise<string> {
  const ids = [...answer.matchAll(PIN_MARKER)].map((m) => m[1]);
  if (!ids.length) return answer;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('pins')
    .select('id, name, google_place_id, lat, lng')
    .in('id', ids);
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return answer.replace(PIN_MARKER, (_, id, name) => {
    const pin = byId.get(id);
    if (!pin) return `${name} (${publicEnv.NEXT_PUBLIC_SITE_URL}/?pin=${id})`;
    const url = pin.google_place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin.name)}&query_place_id=${encodeURIComponent(pin.google_place_id)}`
      : `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`;
    // DB name, not the model's marker text — a prompt-injected corpus could
    // otherwise put attacker-chosen lure text next to a legitimate URL.
    return `${pin.name} (${url})`;
  });
}

/**
 * Resolve a LINE userId to an active member's Supabase user id. The line_sub
 * row alone is NOT proof of membership: the LINE callback writes it before
 * invite consumption, so strangers who merely attempted a LINE sign-in have
 * one too.
 */
async function activeMemberIdForLineUser(lineUserId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('private_profiles')
    .select('id, profiles!inner(is_member, archived_at)')
    .eq('line_sub', lineUserId)
    .maybeSingle();
  const profile = data?.profiles as unknown as
    | { is_member: boolean; archived_at: string | null }
    | undefined;
  return profile?.is_member && !profile.archived_at ? data!.id : null;
}

async function answerQuestion(input: {
  question: string;
  replyToken: string;
  userId?: string;
  lineUserId: string;
  accessToken: string;
}) {
  const result = await askParea({
    question: input.question,
    userId: input.userId,
    lineUserId: input.lineUserId,
  });
  const text = result.ok ? await markersToMapLinks(result.answer) : ERROR_REPLY[result.error];
  await replyLineMessage({
    replyToken: input.replyToken,
    text,
    accessToken: input.accessToken,
  });
}

/** Question addressed to the bot in the group, or undefined if not for us. */
function groupQuestion(message: NonNullable<LineWebhookEvent['message']>): string | undefined {
  const text = message.text!;
  const selfMentions = (message.mention?.mentionees ?? []).filter((m) => m.isSelf);
  if (selfMentions.length) {
    // Strip every bot mention, back to front so indices stay valid.
    return selfMentions
      .sort((a, b) => b.index - a.index)
      .reduce((t, m) => t.slice(0, m.index) + t.slice(m.index + m.length), text);
  }
  if (TRIGGER_PREFIX.test(text)) return text.replace(TRIGGER_PREFIX, '');
  return undefined;
}

async function handleEvent(
  event: LineWebhookEvent,
  opts: { accessToken: string; groupId?: string },
) {
  // A redelivered event's reply token is already spent — answering would
  // burn a second model call for a reply LINE will reject.
  if (event.deliveryContext?.isRedelivery) return;

  // Someone added the bot as a friend: introduce it (the OA-side greeting
  // message is disabled so this copy is the single source of truth).
  if (event.type === 'follow' && event.replyToken) {
    await replyLineMessage({
      replyToken: event.replyToken,
      text: INTRO_REPLY,
      accessToken: opts.accessToken,
    });
    return;
  }

  // Bot added to a group: register it as a digest target (or reactivate a
  // group it was removed from and re-added to). Admins manage/label it and
  // toggle its digest at /admin/line-groups.
  if (event.type === 'join' && event.source?.type === 'group' && event.source.groupId) {
    // Silent join: register the group as a digest target but post NOTHING —
    // the admin introduces the bot in their own words and enables the digest
    // deliberately from /admin/line-groups. Adding the bot has no visible
    // effect in the group.
    console.log('[line/webhook] joined group:', event.source.groupId);
    await activateLineGroup(event.source.groupId);
    return;
  }

  // Bot removed from a group: stop targeting it with the digest. No reply
  // token on a leave event — just deactivate.
  if (event.type === 'leave' && event.source?.type === 'group' && event.source.groupId) {
    console.log('[line/webhook] left group:', event.source.groupId);
    await deactivateLineGroup(event.source.groupId);
    return;
  }

  if (event.type !== 'message' || !event.replyToken || !event.source) return;
  const { source, message } = event;

  if (source.type === 'user' && source.userId) {
    // 1:1 chat: active members only, verified via the LINE-login mapping.
    if (!message) return;
    const userId = await activeMemberIdForLineUser(source.userId);
    if (!userId) {
      await replyLineMessage({
        replyToken: event.replyToken,
        text: NOT_LINKED_REPLY,
        accessToken: opts.accessToken,
      });
      return;
    }
    if (message.type === 'location') {
      await replyLineMessage({
        replyToken: event.replyToken,
        text: LOCATION_REPLY,
        accessToken: opts.accessToken,
      });
      return;
    }
    // Stickers are how people talk on LINE — ignoring one in a 1:1 chat
    // reads as broken. Canned reply, no model call.
    if (message.type !== 'text' || !message.text?.trim()) {
      await replyLineMessage({
        replyToken: event.replyToken,
        text: TEXT_ONLY_REPLY,
        accessToken: opts.accessToken,
      });
      return;
    }
    await answerQuestion({
      question: message.text!.trim(),
      replyToken: event.replyToken,
      userId,
      lineUserId: source.userId,
      accessToken: opts.accessToken,
    });
    return;
  }

  if (source.type === 'group') {
    // Backfill discovery: a group the bot joined before this code existed (so
    // its join event was lost) gets registered on the first message we see.
    // Cache-guarded so a chatty group isn't a write per message.
    if (source.groupId && !discoveredGroups.has(source.groupId)) {
      await ensureLineGroup(source.groupId);
      discoveredGroups.add(source.groupId);
    }
    // Passive in-group Q&A is gated on LINE_GROUP_ID and stays OFF by default —
    // being a digest target does NOT enable question-answering here.
    if (!opts.groupId || source.groupId !== opts.groupId) return;
    if (message?.type !== 'text' || !message.text) return;
    const question = groupQuestion(message)?.trim();
    if (question === undefined) return;
    if (!question) {
      // A bare "@Parea" is how people poke a bot to see if it's alive —
      // answer with a usage hint instead of silence. Canned, no model call.
      await replyLineMessage({
        replyToken: event.replyToken,
        text: USAGE_HINT_REPLY,
        accessToken: opts.accessToken,
      });
      return;
    }
    if (!source.userId) {
      // LINE omits userId for members who haven't agreed to its OA terms;
      // without it we can't rate-limit them, so we stay silent — but say why.
      console.log('[line/webhook] group message without userId ignored');
      return;
    }
    await answerQuestion({
      question,
      replyToken: event.replyToken,
      userId: (await activeMemberIdForLineUser(source.userId)) ?? undefined,
      lineUserId: source.userId,
      accessToken: opts.accessToken,
    });
  }
}

export async function POST(req: Request) {
  const env = getServerEnv();
  if (!env.LINE_MESSAGING_CHANNEL_SECRET || !env.LINE_MESSAGING_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const ok = verifyLineSignature({
    rawBody,
    signature: req.headers.get('x-line-signature'),
    channelSecret: env.LINE_MESSAGING_CHANNEL_SECRET,
  });
  if (!ok) return NextResponse.json({ error: 'bad_signature' }, { status: 401 });

  const body = JSON.parse(rawBody) as { events?: LineWebhookEvent[] };
  const events = body.events ?? [];
  const opts = { accessToken: env.LINE_MESSAGING_ACCESS_TOKEN, groupId: env.LINE_GROUP_ID };

  // ACK LINE immediately; answer within the reply token's TTL. Events run
  // concurrently — two questions in one batch must not queue behind each
  // other's model call.
  after(async () => {
    await Promise.all(
      events.map((event) =>
        handleEvent(event, opts).catch((err) =>
          console.error('[line/webhook] event failed:', err),
        ),
      ),
    );
  });

  return NextResponse.json({ ok: true });
}
