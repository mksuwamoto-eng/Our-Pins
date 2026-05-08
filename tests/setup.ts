import '@testing-library/jest-dom/vitest';

// Stub the public env so tests don't need a .env file.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test';
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
