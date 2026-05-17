import { expect, test } from '@playwright/test';

/**
 * Smoke test — does the public homepage render?
 *
 * Full signup→login coverage requires a running Supabase instance; this E2E
 * exists so CI can verify the build serves something sensible without auth.
 */
test('homepage shows brand and CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Renters'? Rights Bill/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Log in/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Get started/i }).first()).toBeVisible();
});

test('login page renders the form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel(/Email/i)).toBeVisible();
  await expect(page.getByLabel(/Password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Log in/i })).toBeVisible();
});

test('signup page renders the form', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByLabel(/Full name/i)).toBeVisible();
  await expect(page.getByLabel(/Email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Create account/i })).toBeVisible();
});
