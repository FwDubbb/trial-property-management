import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { findTenant, listTenants, saveTenant } from '../repositories/tenantRepository.js';
import { findLease, listLeases } from '../repositories/leaseRepository.js';
import { saveLease, terminateLease } from '../services/leaseService.js';
import { ApiError } from '../utils/ApiError.js';
import { idSchema } from '../validation/portfolio.js';
import {
  leaseQuerySchema,
  leaseSchema,
  tenantQuerySchema,
  tenantSchema,
  terminationSchema,
} from '../validation/tenancy.js';

export function createTenancyController(database: Pool) {
  const tenants: RequestHandler = async (req, res) => {
    res.json(await listTenants(database, req.user!.companyId, tenantQuerySchema.parse(req.query)));
  };
  const tenant: RequestHandler = async (req, res) => {
    const result = await findTenant(database, req.user!.companyId, idSchema.parse(req.params.id));
    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Tenant not found.');
    res.json({ tenant: result });
  };
  const createTenant: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json({
        tenant: await saveTenant(database, req.user!.companyId, tenantSchema.parse(req.body)),
      });
  };
  const updateTenant: RequestHandler = async (req, res) => {
    const result = await saveTenant(
      database,
      req.user!.companyId,
      tenantSchema.parse(req.body),
      idSchema.parse(req.params.id),
    );
    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Tenant not found.');
    res.json({ tenant: result });
  };
  const leases: RequestHandler = async (req, res) => {
    res.json(await listLeases(database, req.user!.companyId, leaseQuerySchema.parse(req.query)));
  };
  const lease: RequestHandler = async (req, res) => {
    const result = await findLease(database, req.user!.companyId, idSchema.parse(req.params.id));
    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Lease not found.');
    res.json({ lease: result });
  };
  const create: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json({ lease: await saveLease(database, req.user!.companyId, leaseSchema.parse(req.body)) });
  };
  const update: RequestHandler = async (req, res) => {
    res.json({
      lease: await saveLease(
        database,
        req.user!.companyId,
        leaseSchema.parse(req.body),
        idSchema.parse(req.params.id),
      ),
    });
  };
  const terminate: RequestHandler = async (req, res) => {
    res.json({
      lease: await terminateLease(
        database,
        req.user!.companyId,
        idSchema.parse(req.params.id),
        terminationSchema.parse(req.body).reason,
      ),
    });
  };
  const options: RequestHandler = async (req, res) => {
    const companyId = req.user!.companyId;
    const [tenants, units] = await Promise.all([
      database.query(
        `SELECT id,concat_ws(' ',first_name,last_name) AS name,email FROM tenants WHERE company_id=$1 ORDER BY last_name,first_name,id`,
        [companyId],
      ),
      database.query(
        `SELECT u.id,u.name,u.property_id AS "propertyId",p.name AS "propertyName",p.active AS "propertyActive",
        u.occupancy_status AS status,u.monthly_rent::text AS "monthlyRent" FROM unit_occupancy u
        JOIN properties p ON p.company_id=u.company_id AND p.id=u.property_id WHERE u.company_id=$1 ORDER BY p.name,u.name,u.id`,
        [companyId],
      ),
    ]);
    res.json({ tenants: tenants.rows, units: units.rows });
  };
  return {
    tenants,
    tenant,
    createTenant,
    updateTenant,
    leases,
    lease,
    create,
    update,
    terminate,
    options,
  };
}
