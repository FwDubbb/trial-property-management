import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { env } from '../../server/src/config/env';

test('manage properties and units, filter records, deactivate safely, and use mobile layout', async ({
  page,
}) => {
  const companyName = `Portfolio browser test ${randomUUID()}`;
  const response = await page.request.post('/api/auth/register', {
    headers: { 'X-Requested-With': 'PropertyPlatform' },
    data: {
      companyName,
      name: 'Portfolio Tester',
      email: `portfolio-${randomUUID()}@example.test`,
      password: 'Portfolio test passphrase 2026!',
    },
  });
  expect(response.status()).toBe(201);
  const companyId = (await response.json()).user.companyId;
  try {
    await page.goto('/properties');
    await expect(page.getByRole('heading', { name: 'No properties found' })).toBeVisible();
    await page.getByRole('link', { name: '+ Add property', exact: true }).click();
    await page.getByLabel('Property name').fill('Mensah Apartments');
    await page.getByLabel('Address', { exact: false }).fill('123 Example Street');
    await page.getByLabel('City').fill('Accra');
    await page.getByLabel('State / region').fill('Greater Accra');
    await page.getByLabel('Country').fill('Ghana');
    await page.getByRole('button', { name: 'Create property' }).click();
    await expect(
      page.getByRole('heading', { name: 'Mensah Apartments', exact: true }),
    ).toBeVisible();
    const propertyUrl = page.url();
    await page.getByRole('link', { name: 'Edit property' }).click();
    await page.getByLabel('Notes').fill('Property updated from the browser.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Property updated from the browser.')).toBeVisible();
    await page.getByRole('link', { name: '+ Add unit' }).click();
    await page.getByLabel('Unit name / number').fill('1A');
    await page.getByLabel('Bedrooms').fill('2');
    await page.getByLabel('Bathrooms').fill('1.5');
    await page.getByLabel('Monthly rent').fill('1250.50');
    await page.getByRole('button', { name: 'Create unit' }).click();
    await expect(page.getByRole('heading', { name: 'Unit 1A', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Edit unit' }).click();
    await page.getByLabel('Monthly rent').fill('1400.25');
    await page.getByLabel('Occupancy status').selectOption('OCCUPIED');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('1,400.25', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Units', exact: true }).click();
    await page.getByLabel('Search units').fill('no match');
    await expect(page.getByRole('heading', { name: 'No units found' })).toBeVisible();
    await page.getByLabel('Search units').fill('1a');
    await expect(page.getByRole('link', { name: '1A', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Unit status', exact: true }).selectOption('VACANT');
    await expect(page.getByRole('heading', { name: 'No units found' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Unit status', exact: true }).selectOption('OCCUPIED');
    await expect(page.getByRole('link', { name: '1A', exact: true })).toBeVisible();
    await page.goto(propertyUrl);
    await page.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await page.getByRole('button', { name: 'Deactivate property', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reactivate', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '1A', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reactivate', exact: true }).click();
    await page.getByRole('button', { name: 'Reactivate property', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Deactivate', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Properties', exact: true }).click();
    await page.getByLabel('Search properties').fill('Mensah');
    await expect(page.getByRole('link', { name: 'Mensah Apartments', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/properties-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'test-results/properties-mobile.png', fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('link', { name: '+ Add property', exact: true }).click();
    await expect(page.getByLabel('Property name')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
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
});
