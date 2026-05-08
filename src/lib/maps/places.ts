/**
 * Google Places API (New) v1 helpers. Pinned to the New API to keep billing
 * predictable (see plan §AI screenshot extraction → Places bridge note,
 * still applies to the manual Autocomplete flow in trimmed v1).
 *
 * Field mask scoped to Essentials SKU only.
 */

export const PLACES_API_BASE = 'https://places.googleapis.com/v1';

export const PLACE_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents';

export interface PlaceCandidate {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  addressComponents: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
}

export function placeToPinFields(place: PlaceCandidate) {
  const components = place.addressComponents.map((c) => ({
    long_name: c.longText,
    short_name: c.shortText,
    types: c.types,
  }));
  const prefecture =
    components.find((c) => c.types.includes('administrative_area_level_1'))?.long_name ?? '';
  const city =
    components.find((c) => c.types.includes('locality'))?.long_name ??
    components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name ??
    null;

  return {
    google_place_id: place.id,
    name: place.displayName,
    address: place.formattedAddress,
    lat: place.location.latitude,
    lng: place.location.longitude,
    prefecture,
    city,
    address_components: components,
  };
}
