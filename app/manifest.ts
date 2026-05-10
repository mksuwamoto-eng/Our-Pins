import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Our Pins',
    short_name: 'Our Pins',
    description: 'A private, community-curated map of Japan.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf8f1',
    theme_color: '#2c3d72',
    icons: [
      { src: '/icons/goj-logo.png', sizes: 'any', type: 'image/png', purpose: 'any' },
      { src: '/icons/goj-logo.png', sizes: 'any', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
