import { test, expect } from '@playwright/test';

/**
 * Smoke test for the public sign-in page. The full invite → onboard → first-pin
 * flow needs a seeded Supabase project + LINE creds and is documented in the
 * README under "Verification". Run those once Mako has a staging environment.
 */
test('sign-in page renders both providers', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('link', { name: /LINE/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Google/i })).toBeVisible();
});

test('no-invite page renders', async ({ page }) => {
  await page.goto('/no-invite');
  await expect(page.locator('h1')).toBeVisible();
});
