import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';

const MODEL = 'claude-opus-4-8';

const FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: { el: { type: 'string' }, en: { type: 'string' } },
    required: ['el', 'en'],
    additionalProperties: false,
  },
};

/**
 * Produce Greek + English versions of a member-written text. The version in
 * the text's own language is a verbatim copy; the other is a translation.
 * Returns null when translation is unavailable (no API key) or fails —
 * callers store null and the UI falls back to the original.
 */
export async function translateBoth(
  text: string,
  // Must fit verbatim copy + translation of the longest input; 2200 truncated
  // 2000-char board posts and broke the JSON. The 6000 default fits those;
  // longer inputs (resource bodies allow 5000 chars) must pass a bigger cap
  // or the same truncate-and-null failure recurs.
  maxTokens = 6000,
): Promise<{ el: string; en: string } | null> {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return null;
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { format: FORMAT },
      system:
        'You translate short community reviews between Greek and English for a private map app. ' +
        'Given a text, return JSON with both an "el" and an "en" version. Copy the text verbatim ' +
        'for the language it is already written in, and translate it faithfully for the other — ' +
        'keep the casual, personal tone; do not embellish or omit. If the text mixes languages, ' +
        'produce a clean full version of each.',
      messages: [{ role: 'user', content: text }],
    });
    if (response.stop_reason === 'refusal') return null;
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = JSON.parse(raw) as { el?: string; en?: string };
    if (typeof parsed.el !== 'string' || typeof parsed.en !== 'string') return null;
    return { el: parsed.el, en: parsed.en };
  } catch (err) {
    console.error('translation failed:', err);
    return null;
  }
}

/** Translate a pin's vouch_note and store it. Fire from next/server after(). */
export async function translatePinNote(pinId: string, note: string) {
  const translations = await translateBoth(note);
  if (!translations) return;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('pins').update({ translations }).eq('id', pinId);
  if (error) console.error('storing pin translation failed:', error);
}

/** Translate a board post's body and store it. Fire from next/server after(). */
export async function translateBoardPost(postId: string, body: string) {
  const translations = await translateBoth(body);
  if (!translations) return;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('board_posts').update({ translations }).eq('id', postId);
  if (error) console.error('storing board post translation failed:', error);
}

/**
 * Translate a resource's title AND body and store them (nested jsonb:
 * { title: {el,en}, body: {el,en} }). Fire from next/server after(), on
 * create and on every edit. Unlike the other callers this always writes —
 * even null — so an edit whose translation fails clears the previous
 * translations instead of leaving them attached to the new text.
 */
export async function translateResource(resourceId: string, title: string, body: string) {
  // Bodies run up to 5000 chars — Greek is >1 token/char, and the model must
  // emit verbatim copy + translation, so the board-sized default cap would
  // truncate long how-tos mid-JSON (returning null and clearing translations).
  const [titleT, bodyT] = await Promise.all([translateBoth(title), translateBoth(body, 16000)]);
  const translations = titleT || bodyT ? { title: titleT, body: bodyT } : null;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('resources').update({ translations }).eq('id', resourceId);
  if (error) console.error('storing resource translation failed:', error);
}

/** Translate a vouch comment and store it. Fire from next/server after(). */
export async function translateVouchComment(pinId: string, voucherId: string, comment: string) {
  const translations = await translateBoth(comment);
  if (!translations) return;
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('vouches')
    .update({ translations })
    .eq('pin_id', pinId)
    .eq('voucher_id', voucherId);
  if (error) console.error('storing vouch translation failed:', error);
}
