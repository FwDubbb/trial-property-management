import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { env } from '../../server/src/config/env';

const headers = { 'X-Requested-With': 'PropertyPlatform' };
function day(offset: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
async function setup(page: Page) {
  const companyName = `Tenancy browser test ${randomUUID()}`;
  const registration = await page.request.post('/api/auth/register', {
    headers,
    data: {
      companyName,
      name: 'Tenancy Tester',
      email: `${randomUUID()}@example.test`,
      password: 'Browser tenancy test passphrase!',
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
        bathrooms: 1.5,
        monthlyRent: 1250.5,
        status: 'VACANT',
      },
    });
    expect(unit.status()).toBe(201);
    return { cleanup, unitId: (await unit.json()).unit.id };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

test('tenant profile, active lease, editing, search, occupancy, and confirmed termination work together', async ({
  page,
}) => {
  test.setTimeout(60000);
  const data = await setup(page);
  try {
    await page.goto('/tenants');
    await expect(page.getByRole('heading', { name: 'No tenants found' })).toBeVisible();
    await page.getByRole('link', { name: '+ Add tenant', exact: true }).click();
    await page.getByLabel('First name').fill('Ama');
    await page.getByLabel('Last name').fill('Mensah');
    await page.getByLabel('Phone number').fill('+233 20 123 4567');
    await page.getByLabel('Email address').fill('ama@example.test');
    await page.getByLabel('Emergency contact name').fill('Kwame Owusu');
    await page.getByLabel('Emergency contact phone').fill('+233 24 111 2222');
    await page.getByRole('button', { name: 'Add tenant', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ama Mensah', exact: true })).toBeVisible();
    const tenantUrl = page.url();
    await expect(page.getByRole('heading', { name: 'No active lease', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Edit tenant', exact: true }).click();
    await page.getByLabel('Phone number').fill('+233 20 999 8888');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(tenantUrl);
    await page.reload();
    await expect(page.getByText('+233 20 999 8888', { exact: true })).toBeVisible();
    await expect(page.getByText('Kwame Owusu', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: '+ Create lease', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Unit / property *', exact: true })
      .selectOption(data.unitId);
    await expect(page.getByLabel('Monthly rent')).toHaveValue('1250.50');
    await page.getByLabel('Start date').fill(day(-1));
    await page.getByLabel('End date').fill(day(30));
    await page.getByLabel('Security deposit').fill('2000');
    await page.getByRole('button', { name: 'Create lease', exact: true }).click();
    await expect(page.locator('.status-pill').filter({ hasText: /^Active$/ })).toBeVisible();
    const leaseUrl = page.url();
    await page.getByRole('link', { name: 'Edit lease', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Tenant *', exact: true })).toBeDisabled();
    await page.getByLabel('Monthly rent').fill('1400.25');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('1,400.25', { exact: true })).toBeVisible();
    await page.goto(`/units/${data.unitId}`);
    await expect(page.getByText('Occupied', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Edit unit', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Occupancy status *', exact: true }),
    ).toBeDisabled();
    await page.goto(tenantUrl);
    await expect(
      page.getByRole('link', { name: 'View current lease', exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Unit 1A', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/tenant-profile-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/tenant-profile-mobile.png', fullPage: true });
    await page.getByRole('link', { name: 'Tenants', exact: true }).click();
    await page.getByLabel('Search tenants').fill('missing tenant');
    await expect(page.getByRole('heading', { name: 'No tenants found' })).toBeVisible();
    await page.getByLabel('Search tenants').fill('Ama');
    await expect(page.getByRole('link', { name: 'Ama Mensah', exact: true })).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Housing status', exact: true })
      .selectOption('unassigned');
    await expect(page.getByRole('heading', { name: 'No tenants found' })).toBeVisible();
    await page.getByRole('link', { name: 'Leases', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Lease status', exact: true })
      .selectOption('UPCOMING');
    await expect(page.getByRole('heading', { name: 'No leases found' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Lease status', exact: true }).selectOption('ACTIVE');
    await expect(page.getByRole('link', { name: 'Ama Mensah', exact: true })).toBeVisible();
    await page.goto(leaseUrl);
    await page.getByRole('button', { name: 'Terminate lease', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Terminate lease', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm termination', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a reason');
    await page.getByLabel('Reason for termination').fill('Tenant moved out');
    await page.getByRole('button', { name: 'Confirm termination', exact: true }).click();
    await expect(page.locator('.status-pill').filter({ hasText: /^Terminated$/ })).toBeVisible();
    await expect(page.getByText('Tenant moved out', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit lease', exact: true })).not.toBeVisible();
    await page.goto(`/units/${data.unitId}`);
    await expect(page.getByText('Vacant', { exact: true })).toBeVisible();
    await page.goto(tenantUrl);
    await expect(page.getByRole('heading', { name: 'No active lease', exact: true })).toBeVisible();
    await expect(page.getByText('Terminated', { exact: true })).toBeVisible();
  } finally {
    await data.cleanup();
  }
});

test('future lease dates can be edited, overlapping dates are rejected, and closed leases remain history', async ({
  page,
}) => {
  test.setTimeout(60000);
  const data = await setup(page);
  try {
    const response = await page.request.post('/api/tenants', {
      headers,
      data: { firstName: 'Kwame', lastName: 'Owusu' },
    });
    expect(response.status()).toBe(201);
    const tenantId = (await response.json()).tenant.id;
    await page.goto(`/leases/new?tenantId=${tenantId}&unitId=${data.unitId}`);
    await page.getByLabel('Start date').fill(day(10));
    await page.getByLabel('End date').fill(day(40));
    await page.getByRole('button', { name: 'Create lease', exact: true }).click();
    await expect(page).toHaveURL(/\/leases\/[0-9a-f-]+$/);
    await expect(page.getByText('Upcoming', { exact: true })).toBeVisible();
    const leaseUrl = page.url();
    await page.goto(`/units/${data.unitId}`);
    await expect(page.getByText('Vacant', { exact: true })).toBeVisible();
    await page.goto(`/leases/new?tenantId=${tenantId}&unitId=${data.unitId}`);
    await page.getByLabel('Start date').fill(day(10));
    await page.getByLabel('End date').fill(day(40));
    await page.getByRole('button', { name: 'Create lease', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('already has a lease');
    await page.goto(leaseUrl);
    await page.getByRole('link', { name: 'Edit lease', exact: true }).click();
    await page.getByLabel('Start date').fill(day(-5));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(leaseUrl);
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await page.goto(`/units/${data.unitId}`);
    await expect(page.getByText('Occupied', { exact: true })).toBeVisible();
    await page.goto(`${leaseUrl}/edit`);
    await page.getByLabel('End date').fill(day(-1));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(leaseUrl);
    await expect(page.getByText('Expired', { exact: true })).toBeVisible();
    await page.goto(`${leaseUrl}/edit`);
    await expect(page.getByRole('heading', { name: 'This lease cannot be edited' })).toBeVisible();
    await page.goto(`/units/${data.unitId}`);
    await expect(page.getByText('Vacant', { exact: true })).toBeVisible();
  } finally {
    await data.cleanup();
  }
});
