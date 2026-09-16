import { expect, test } from '@playwright/test';

test('browser reaches the real Express API through the Vite proxy', async ({ page }) => {
  await page.goto('/setup');
  const backend = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Backend API' }) });
  await expect(backend.getByText('Connected', { exact: true })).toBeVisible();
  await expect(backend).toContainText('The frontend is successfully connected to the Express API.');
  await expect(page.getByRole('button', { name: 'Check connections', exact: true })).toBeEnabled({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Check connections', exact: true }).click();
  await expect(backend.getByText('Connected', { exact: true })).toBeVisible();
});

test('database error remains distinct from successful API check', async ({ page }) => {
  await page.route('**/api/health/database', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          message:
            'Cannot connect to PostgreSQL. Check DATABASE_URL in server/.env and ensure PostgreSQL is running.',
        },
      }),
    }),
  );
  await page.goto('/setup');
  const database = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Database', exact: true }) });
  await expect(database).toContainText('Needs attention');
  await expect(database).toContainText('DATABASE_URL');
  await expect(
    page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Backend API' }) }),
  ).toContainText('Connected');
});

test('network error can be retried and mobile page does not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/test', (route) => route.abort());
  await page.goto('/setup');
  await expect(page.getByText('Cannot reach the API.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check connections', exact: true })).toBeEnabled({
    timeout: 15000,
  });
  await page.unroute('**/api/test');
  await page.getByRole('button', { name: 'Check connections', exact: true }).click();
  await expect(
    page.getByText('The frontend is successfully connected to the Express API.'),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
