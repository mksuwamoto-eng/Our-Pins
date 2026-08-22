import { test, expect } from '@playwright/test';

/**
 * Smoke test for the public sign-in page. The full invite → onboard → first-pin
 * flow needs a seeded Supabase project + LINE creds and is documented in the
 * README under "Verification". Run those once Mako has a staging environment.
 */
// Public sign-in is LINE-only since 3fe8d49 — Google and magic link moved to
// the unlinked /admin-login page. Asserting Google is ABSENT is the point: it
// is what keeps membership on the LINE identity the bot maps against.
test('sign-in page offers LINE only', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('link', { name: /LINE/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Google/i })).toHaveCount(0);
});

test('no-invite page renders', async ({ page }) => {
  await page.goto('/no-invite');
  await expect(page.locator('h1')).toBeVisible();
});
