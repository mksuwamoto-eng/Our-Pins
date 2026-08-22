import { z } from 'zod';

// Every field below is echoed from a Google Places response the browser hands
// us, so the client is not a trustworthy bound. The caps are generous multiples
// of what Places actually returns — they exist to stop a hand-rolled request
// (or a direct PostgREST insert) storing megabyte rows, not to reject real
// addresses.
const addressComponentsSchema = z
  .array(
    z.object({
      long_name: z.string().max(200),
      short_name: z.string().max(200),
      types: z.array(z.string().max(60)).max(20),
    }),
  )
  .max(24);

export const pinCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // Google place ids are ~27-60 chars today; the cap is deliberately loose.
  google_place_id: z.string().max(300).nullable().optional(),
  address: z.string().trim().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  prefecture: z.string().trim().min(1).max(100),
  city: z.string().trim().max(100).nullable().optional(),
  address_components: addressComponentsSchema.nullable().optional(),
  category_id: z.string().uuid(),
  vouch_note: z.string().trim().min(1).max(1000),
});

export type PinCreateInput = z.infer<typeof pinCreateSchema>;

export const pinUpdateSchema = pinCreateSchema.partial();
export type PinUpdateInput = z.infer<typeof pinUpdateSchema>;

export const vouchCreateSchema = z.object({
  pin_id: z.string().uuid(),
  comment: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type VouchCreateInput = z.infer<typeof vouchCreateSchema>;

/**
 * Derive prefecture + city from a Google Places address_components array.
 * Falls back to empty string if the components don't include the expected types.
 */
export function derivePrefectureCity(
  components: z.infer<typeof addressComponentsSchema> | null | undefined,
): { prefecture: string; city: string | null } {
  if (!components) return { prefecture: '', city: null };
  const prefecture =
    components.find((c) => c.types.includes('administrative_area_level_1'))?.long_name ?? '';
  const city =
    components.find((c) => c.types.includes('locality'))?.long_name ??
    components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name ??
    null;
  return { prefecture, city };
}
