import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import pg from 'pg';
import { env } from '../../server/src/config/env';
const headers = { 'X-Requested-With': 'PropertyPlatform' };
const today = () => new Date().toISOString().slice(0, 10);
const period = () => today().slice(0, 7);
function previousMonth() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}
async function fixture(page: Page) {
  const companyName = `Finance browser test ${randomUUID()}`;
  const registration = await page.request.post('/api/auth/register', {
    headers,
    data: {
      companyName,
      name: 'Finance Tester',
      email: `${randomUUID()}@example.test`,
      password: 'Finance browser test passphrase!',
    },
  });
  expect(registration.status()).toBe(201);
  const companyId = (await registration.json()).user.companyId;
  const cleanup = async () => {
    const database = new pg.Pool({ connectionString: env.databaseUrl });
    try {
      await database.query('DELETE FROM companies WHERE id=$1 AND name=$2', [
        companyId,
        companyName,
      ]);
    } finally {
      await database.end();
    }
  };
  try {
    const createProperty = async (name: string) => {
      const response = await page.request.post('/api/properties', {
        headers,
        data: {
          name,
          address: '123 Example Street',
          city: 'Accra',
          country: 'Ghana',
          propertyType: 'APARTMENT',
        },
      });
      expect(response.status()).toBe(201);
      return (await response.json()).property.id;
    };
    const propertyId = await createProperty('Mensah Apartments');
    const otherPropertyId = await createProperty('Airport Homes');
    const unit = await page.request.post('/api/units', {
      headers,
      data: {
        propertyId,
        name: '1A',
        bedrooms: 2,
        bathrooms: 1,
        monthlyRent: 1500,
        status: 'VACANT',
      },
    });
    expect(unit.status()).toBe(201);
    const unitId = (await unit.json()).unit.id;
    const tenant = await page.request.post('/api/tenants', {
      headers,
      data: { firstName: 'Ama', lastName: 'Mensah' },
    });
    expect(tenant.status()).toBe(201);
    const tenantId = (await tenant.json()).tenant.id;
    const lease = await page.request.post('/api/leases', {
      headers,
      data: {
        tenantId,
        unitId,
        startDate: today(),
        endDate: '9999-12-31',
        monthlyRent: 1000.3,
        securityDeposit: 500,
      },
    });
    expect(lease.status()).toBe(201);
    const leaseId = (await lease.json()).lease.id;
    const pay = await page.request.post('/api/payments', {
      headers,
      data: {
        leaseId,
        period: period(),
        amount: 400.1,
        paymentDate: today(),
        method: 'CASH',
        requestId: randomUUID(),
      },
    });
    expect(pay.status()).toBe(201);
    const repair = await page.request.post('/api/maintenance', {
      headers,
      data: {
        propertyId,
        unitId,
        tenantId,
        title: 'Sink repair',
        description: 'Replace leaking seal',
        priority: 'HIGH',
        submittedDate: today(),
      },
    });
    expect(repair.status()).toBe(201);
    return { cleanup, propertyId, otherPropertyId };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
function card(page: Page, name: string) {
  return page
    .locator('.stat-card')
    .filter({ has: page.locator('span').filter({ hasText: new RegExp(`^${name}$`) }) })
    .locator('strong');
}
test('record, filter and void expenses; dashboard totals, property/month filters and mobile layout update correctly', async ({
  page,
}) => {
  test.setTimeout(60000);
  const data = await fixture(page);
  try {
    await page.goto(`/properties/${data.propertyId}`);
    await page.getByRole('link', { name: '+ Record expense', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Property *', exact: true })).toHaveValue(
      data.propertyId,
    );
    await page.getByRole('combobox', { name: 'Category *', exact: true }).selectOption('REPAIRS');
    await page
      .getByRole('textbox', { name: 'Description *', exact: true })
      .fill('Replaced kitchen sink seal');
    await page.getByRole('spinbutton', { name: 'Amount *', exact: true }).fill('125.15');
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Receipt EXP-001');
    await page.getByRole('button', { name: 'Record expense', exact: true }).click();
    await expect(page).toHaveURL(/\/expenses\/[0-9a-f-]+$/);
    const expenseUrl = page.url();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Replaced kitchen sink seal', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Receipt EXP-001', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Expenses', exact: true }).click();
    await expect(page.locator('.expense-total strong')).toHaveText('125.15');
    await page.getByRole('searchbox', { name: 'Search expenses' }).fill('missing');
    await expect(page.getByRole('heading', { name: 'No expenses found' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search expenses' }).fill('sink');
    await expect(
      page.getByRole('link', { name: 'Replaced kitchen sink seal', exact: true }),
    ).toBeVisible();
    await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('UTILITIES');
    await expect(page.getByRole('heading', { name: 'No expenses found' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('REPAIRS');
    await expect(page.locator('.expense-total strong')).toHaveText('125.15');
    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(card(page, 'Total properties')).toHaveText('2');
    await expect(card(page, 'Total tenants')).toHaveText('1');
    await expect(card(page, 'Open maintenance')).toHaveText('1');
    await expect(card(page, 'Expected rent')).toHaveText('1,000.30');
    await expect(card(page, 'Outstanding rent')).toHaveText('600.20');
    await expect(card(page, 'Rent received')).toHaveText('400.10');
    await expect(card(page, 'Total expenses')).toHaveText('125.15');
    await expect(card(page, 'Rent less expenses')).toHaveText('274.95');
    await expect(page.getByRole('link', { name: 'Sink repair', exact: true })).toBeVisible();
    await expect(page.locator('.cash-table tbody tr')).toHaveCount(6);
    await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
    await page
      .getByRole('combobox', { name: 'Property', exact: true })
      .selectOption(data.otherPropertyId);
    await expect(card(page, 'Total expenses')).toHaveText('0.00');
    await expect(card(page, 'Expected rent')).toHaveText('0.00');
    await page
      .getByRole('combobox', { name: 'Property', exact: true })
      .selectOption(data.propertyId);
    await expect(card(page, 'Total expenses')).toHaveText('125.15');
    await page.getByLabel('Report month').fill(previousMonth());
    await expect(card(page, 'Total expenses')).toHaveText('0.00');
    await expect(card(page, 'Rent received')).toHaveText('0.00');
    await expect(card(page, 'Total tenants')).toHaveText('1');
    await page.getByLabel('Report month').fill(period());
    await expect(card(page, 'Total expenses')).toHaveText('125.15');
    await page.goto(expenseUrl);
    await page.getByRole('button', { name: 'Void expense', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Void expense', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm void', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a reason');
    await page
      .getByRole('textbox', { name: 'Reason for voiding', exact: true })
      .fill('Entered twice');
    await page.getByRole('button', { name: 'Confirm void', exact: true }).click();
    await expect(page.locator('.status-pill.voided')).toBeVisible();
    await expect(page.getByText('Entered twice', { exact: true })).toBeVisible();
    await page.goto('/');
    await expect(card(page, 'Total expenses')).toHaveText('0.00');
    await expect(card(page, 'Rent less expenses')).toHaveText('400.10');
    await page.goto(`/properties/${data.propertyId}`);
    await expect(
      page.getByRole('link', { name: 'Replaced kitchen sink seal', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.expense-total strong')).toHaveText('0.00');
  } finally {
    await data.cleanup();
  }
});
