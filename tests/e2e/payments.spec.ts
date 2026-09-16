import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { env } from '../../server/src/config/env';
const headers = { 'X-Requested-With': 'PropertyPlatform' };
const today = () => new Date().toISOString().slice(0, 10);
function month(offset = 0) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
async function fixture(page: Page) {
  const companyName = `Payment browser test ${randomUUID()}`;
  const registration = await page.request.post('/api/auth/register', {
    headers,
    data: {
      companyName,
      name: 'Payment Tester',
      email: `${randomUUID()}@example.test`,
      password: 'Payment browser passphrase!',
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
    const property = await page.request.post('/api/properties', {
      headers,
      data: {
        name: 'Mensah Apartments',
        address: '123 Example Street',
        city: 'Accra',
        country: 'Ghana',
        propertyType: 'APARTMENT',
      },
    });
    expect(property.status()).toBe(201);
    const propertyId = (await property.json()).property.id;
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
        unitId,
        tenantId,
        startDate: today(),
        endDate: `${month(2)}-28`,
        monthlyRent: 1200.3,
        securityDeposit: 2000,
      },
    });
    expect(lease.status()).toBe(201);
    const leaseId = (await lease.json()).lease.id;
    return { cleanup, leaseId, tenantId };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
async function record(page: Page, leaseId: string, value: string, reference: string) {
  await page.goto(`/payments/new?leaseId=${leaseId}&period=${month()}`);
  await expect(page.getByText(/outstanding$/)).toBeVisible();
  await page.getByLabel('Amount received').fill(value);
  await page.getByLabel('Payment method').selectOption('MOBILE_MONEY');
  await page.getByLabel('Reference number').fill(reference);
  await page.getByLabel('Notes').fill('Received by mobile money.');
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expect(page).toHaveURL(/\/payments\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'Rent payment', exact: true })).toBeVisible();
  return page.url();
}
test('rent payment workflow shows partial and full balances, searches history, and voids without losing the receipt', async ({
  page,
}) => {
  test.setTimeout(60000);
  const data = await fixture(page);
  try {
    await page.goto('/payments');
    await expect(page.getByRole('heading', { name: 'Rent balances', exact: true })).toBeVisible();
    await expect(page.locator('.status-pill.unpaid')).toBeVisible();
    const paymentUrl = await record(page, data.leaseId, '400.10', 'MOMO-PHASE5-001');
    await expect(page.getByText('MOMO-PHASE5-001', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('MOMO-PHASE5-001', { exact: true })).toBeVisible();
    await page.goto('/payments');
    await expect(page.locator('.status-pill.partially_paid')).toBeVisible();
    await expect(
      page.locator('.stat-card').filter({ hasText: 'Outstanding rent' }).locator('strong'),
    ).toHaveText('800.20');
    await page.screenshot({ path: 'test-results/rent-balances-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/rent-balances-mobile.png', fullPage: true });
    await record(page, data.leaseId, '800.20', 'MOMO-PHASE5-002');
    await page.goto('/payments');
    await expect(page.locator('.status-pill.paid')).toBeVisible();
    await expect(
      page.locator('.stat-card').filter({ hasText: 'Outstanding rent' }).locator('strong'),
    ).toHaveText('0.00');
    await page.getByRole('link', { name: 'Payment history', exact: true }).click();
    await page.getByLabel('Search payments').fill('MOMO-PHASE5-001');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByText('MOMO-PHASE5-001', { exact: true })).toBeVisible();
    await page.getByLabel('Payment method').selectOption('CASH');
    await expect(page.getByRole('heading', { name: 'No payments found' })).toBeVisible();
    await page.getByLabel('Payment method').selectOption('MOBILE_MONEY');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.goto(paymentUrl);
    await page.getByRole('button', { name: 'Void payment', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Void payment', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm void', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a reason');
    await page.getByLabel('Reason for voiding').fill('Wrong receipt entered');
    await page.getByRole('button', { name: 'Confirm void', exact: true }).click();
    await expect(page.getByText('Voided', { exact: true })).toBeVisible();
    await expect(page.getByText('Wrong receipt entered', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Void payment', exact: true })).not.toBeVisible();
    await page.goto('/payments');
    await expect(
      page.locator('.stat-card').filter({ hasText: 'Outstanding rent' }).locator('strong'),
    ).toHaveText('400.10');
    await page.goto(`/tenants/${data.tenantId}`);
    await expect(page.getByRole('heading', { name: 'Payment history', exact: true })).toBeVisible();
    await expect(page.getByText('MOMO-PHASE5-001', { exact: true })).toBeVisible();
    await expect(page.getByText('Voided', { exact: true })).toBeVisible();
    await page.goto(`/leases/${data.leaseId}`);
    await expect(page.getByText('MOMO-PHASE5-002', { exact: true })).toBeVisible();
  } finally {
    await data.cleanup();
  }
});
test('payment form handles an invalid rent month and rejects a balance changed by another payment', async ({
  page,
}) => {
  test.setTimeout(45000);
  const data = await fixture(page);
  try {
    await page.goto(`/payments/new?leaseId=${data.leaseId}&period=${month(-1)}`);
    await expect(
      page.getByText(
        'No rent is due for this lease and month. Choose a month within the lease term.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record payment', exact: true })).toBeDisabled();
    await page.getByLabel('Rent month').fill(month());
    await expect(page.getByText('1,200.30 outstanding', { exact: true })).toBeVisible();
    await page.getByLabel('Amount received').fill('900');
    await page.getByLabel('Payment method').selectOption('CASH');
    const concurrent = await page.request.post('/api/payments', {
      headers,
      data: {
        leaseId: data.leaseId,
        period: month(),
        amount: 500,
        paymentDate: today(),
        method: 'BANK_TRANSFER',
        requestId: randomUUID(),
      },
    });
    expect(concurrent.status()).toBe(201);
    await page.getByRole('button', { name: 'Record payment', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('exceeds the outstanding rent');
    await page.getByLabel('Amount received').fill('700.30');
    await page.getByRole('button', { name: 'Record payment', exact: true }).click();
    await expect(page).toHaveURL(/\/payments\/[0-9a-f-]+$/);
    await page.goto('/payments');
    await expect(page.locator('.status-pill.paid')).toBeVisible();
  } finally {
    await data.cleanup();
  }
});
