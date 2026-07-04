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
export async function translateBoth(text: string): Promise<{ el: string; en: string } | null> {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return null;
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2200,
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
