import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { env } from '../../server/src/config/env';
const headers = { 'X-Requested-With': 'PropertyPlatform' };
const today = () => new Date().toISOString().slice(0, 10);
async function fixture(page: Page) {
  const companyName = `Maintenance browser test ${randomUUID()}`;
  const registration = await page.request.post('/api/auth/register', {
    headers,
    data: {
      companyName,
      name: 'Maintenance Tester',
      email: `${randomUUID()}@example.test`,
      password: 'Maintenance browser passphrase!',
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
        monthlyRent: 1200,
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
        endDate: '9999-12-31',
        monthlyRent: 1200,
        securityDeposit: 0,
      },
    });
    expect(lease.status()).toBe(201);
    return { cleanup, propertyId, unitId, tenantId };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
test('tenant repair workflow records assignment, completion, reopening, filtering and history on responsive pages', async ({
  page,
}) => {
  test.setTimeout(60000);
  const data = await fixture(page);
  try {
    await page.goto(`/tenants/${data.tenantId}`);
    await page.getByRole('link', { name: '+ Add request', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Property *', exact: true })).toHaveValue(
      data.propertyId,
    );
    await expect(page.getByRole('combobox', { name: 'Unit', exact: true })).toHaveValue(
      data.unitId,
    );
    await expect(page.getByRole('combobox', { name: 'Tenant', exact: true })).toHaveValue(
      data.tenantId,
    );
    await page.getByLabel('Title *', { exact: true }).fill('Kitchen sink leaking');
    await page
      .getByLabel('Description *', { exact: true })
      .fill('Water dripping from the drain pipe under the kitchen sink.');
    await page.getByRole('combobox', { name: 'Priority *', exact: true }).selectOption('HIGH');
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Call before visiting.');
    await page.getByRole('button', { name: 'Create request', exact: true }).click();
    await expect(page).toHaveURL(/\/maintenance\/[0-9a-f-]+$/);
    const requestUrl = page.url();
    await expect(page.locator('.status-pill.maintenance-submitted')).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Kitchen sink leaking', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Edit request', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Property *', exact: true })).toBeDisabled();
    await page.getByLabel('Assigned to', { exact: true }).fill('Kofi Plumbing');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page).toHaveURL(requestUrl);
    await expect(page.locator('.status-pill.maintenance-assigned')).toBeVisible();
    await page.getByRole('button', { name: 'Start work', exact: true }).click();
    await page
      .getByLabel('Update note (optional)', { exact: true })
      .fill('Replacement parts arrived.');
    await page.getByRole('button', { name: 'Confirm status', exact: true }).click();
    await expect(page.locator('.status-pill.maintenance-in_progress')).toBeVisible();
    await page.screenshot({ path: 'test-results/maintenance-detail-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/maintenance-detail-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Mark completed', exact: true }).click();
    await page
      .getByLabel('Update note (optional)', { exact: true })
      .fill('Replaced seal and checked for leaks.');
    await page.getByRole('button', { name: 'Confirm completion', exact: true }).click();
    await expect(page.locator('.status-pill.maintenance-completed')).toBeVisible();
    await expect(page.getByText('Not completed', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit request', exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Reopen request', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm reopen', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a reason');
    await page.getByLabel('Reason for change *', { exact: true }).fill('Leak returned after use.');
    await page.getByRole('button', { name: 'Confirm reopen', exact: true }).click();
    await expect(page.locator('.status-pill.maintenance-assigned')).toBeVisible();
    await expect(page.getByText('Not completed', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Replaced seal and checked for leaks.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Maintenance', exact: true }).click();
    await page.getByLabel('Search maintenance').fill('not an issue');
    await expect(
      page.getByRole('heading', { name: 'No maintenance requests found' }),
    ).toBeVisible();
    await page.getByLabel('Search maintenance').fill('sink');
    await expect(
      page.getByRole('link', { name: 'Kitchen sink leaking', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Request status', exact: true })
      .selectOption('COMPLETED');
    await expect(
      page.getByRole('heading', { name: 'No maintenance requests found' }),
    ).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Request status', exact: true })
      .selectOption('ASSIGNED');
    await page.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('HIGH');
    await page
      .getByRole('combobox', { name: 'Property', exact: true })
      .selectOption(data.propertyId);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    for (const url of [
      `/tenants/${data.tenantId}`,
      `/units/${data.unitId}`,
      `/properties/${data.propertyId}`,
    ]) {
      await page.goto(url);
      await expect(
        page.getByRole('link', { name: 'Kitchen sink leaking', exact: true }),
      ).toBeVisible();
    }
    await page.goto(`/units/${data.unitId}`);
    await expect(page.getByText('Occupied', { exact: true })).toBeVisible();
  } finally {
    await data.cleanup();
  }
});
test('property-wide requests support stale-edit recovery and confirmed cancellation with a reason', async ({
  page,
}) => {
  test.setTimeout(45000);
  const data = await fixture(page);
  try {
    await page.goto(`/properties/${data.propertyId}`);
    await page.getByRole('link', { name: '+ Add request', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Tenant', exact: true })).toBeDisabled();
    await page.getByLabel('Title *', { exact: true }).fill('Garden cleanup');
    await page
      .getByLabel('Description *', { exact: true })
      .fill('Remove fallen branches in the shared courtyard.');
    await page.getByRole('button', { name: 'Create request', exact: true }).click();
    await expect(page).toHaveURL(/\/maintenance\/[0-9a-f-]+$/);
    const requestUrl = page.url();
    const id = requestUrl.split('/').at(-1)!;
    const current = (await (await page.request.get(`/api/maintenance/${id}`)).json()).request;
    await page.getByRole('link', { name: 'Edit request', exact: true }).click();
    await page.getByLabel('Title *', { exact: true }).fill('Local edit');
    const changed = await page.request.put(`/api/maintenance/${id}`, {
      headers,
      data: {
        title: 'Courtyard cleanup',
        description: current.description,
        priority: 'HIGH',
        submittedDate: today(),
        assignedTo: 'Garden Team',
        notes: 'Changed by another manager',
        version: current.version,
      },
    });
    expect(changed.status()).toBe(200);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('changed since you opened it');
    await page.getByRole('button', { name: 'Reload latest details', exact: true }).click();
    await expect(page.getByLabel('Title *', { exact: true })).toHaveValue('Courtyard cleanup');
    await expect(page.getByLabel('Assigned to', { exact: true })).toHaveValue('Garden Team');
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Repair no longer needed');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page).toHaveURL(requestUrl);
    await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a reason');
    await page
      .getByLabel('Reason for change *', { exact: true })
      .fill('Landscaper already completed this elsewhere');
    await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await expect(page.locator('.status-pill.maintenance-cancelled')).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('Landscaper already completed this elsewhere', { exact: true }),
    ).toBeVisible();
    await page.goto(`${requestUrl}/edit`);
    await expect(page.getByRole('heading', { name: 'This request is closed' })).toBeVisible();
  } finally {
    await data.cleanup();
  }
});
