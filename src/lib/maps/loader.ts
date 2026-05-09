import { Loader } from '@googlemaps/js-api-loader';
import { publicEnv } from '@/lib/env';

/**
 * Shared singleton Loader instance. The Google Maps JS Loader enforces that
 * all calls to `new Loader({...})` across the app use identical options;
 * mismatched libraries arrays throw "Loader must not be called again with
 * different options" at runtime.
 */
let _loader: Loader | null = null;

export function getMapsLoader(): Loader {
  if (!_loader) {
    _loader = new Loader({
      apiKey: publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: 'weekly',
      libraries: ['places', 'marker'],
    });
  }
  return _loader;
}
