import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { env } from '../../server/src/config/env';

test('company registration, persistent sign-in, logout and login work in the browser', async ({
  page,
}) => {
  const email = `browser-${randomUUID()}@example.test`;
  const companyName = `Browser test ${randomUUID()}`;
  let companyId: string | undefined;
  try {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('link', { name: 'Create a company', exact: true }).click();
    await page.getByLabel('Company name').fill(companyName);
    await page.getByLabel('Your name').fill('Browser Tester');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Browser test passphrase 2026!');
    await page.getByLabel('Confirm password').fill('Browser test passphrase 2026!');
    const registration = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/register'),
    );
    await page.getByRole('button', { name: 'Create company account' }).click();
    companyId = (await (await registration).json()).user?.companyId;
    await expect(page.getByRole('heading', { name: 'Welcome, Browser.' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome, Browser.' })).toBeVisible();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page.locator('dd').filter({ hasText: email })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('incorrect password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');
    await page.getByLabel('Password', { exact: true }).fill('Browser test passphrase 2026!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome, Browser.' })).toBeVisible();
  } finally {
    if (companyId) {
      const database = new pg.Pool({ connectionString: env.databaseUrl });
      try {
        await database.query('DELETE FROM companies WHERE id = $1 AND name = $2', [
          companyId,
          companyName,
        ]);
      } finally {
        await database.end();
      }
    }
  }
});
