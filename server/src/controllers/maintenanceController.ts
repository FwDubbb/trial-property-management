import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  findMaintenance,
  listMaintenance,
  maintenanceEvents,
  maintenanceOptions,
} from '../repositories/maintenanceRepository.js';
import {
  createMaintenance,
  updateMaintenance,
  changeMaintenanceStatus,
} from '../services/maintenanceService.js';
import {
  maintenanceCreateSchema,
  maintenanceUpdateSchema,
  maintenanceStatusSchema,
  maintenanceQuerySchema,
} from '../validation/maintenance.js';
import { idSchema } from '../validation/portfolio.js';
import { ApiError } from '../utils/ApiError.js';
export function createMaintenanceController(database: Pool) {
  const list: RequestHandler = async (req, res) => {
    res.json(
      await listMaintenance(database, req.user!.companyId, maintenanceQuerySchema.parse(req.query)),
    );
  };
  const options: RequestHandler = async (req, res) => {
    res.json(await maintenanceOptions(database, req.user!.companyId));
  };
  const get: RequestHandler = async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const item = await findMaintenance(database, req.user!.companyId, id);
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Maintenance request not found.');
    res.json({ request: item, events: await maintenanceEvents(database, req.user!.companyId, id) });
  };
  const create: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json({
        request: await createMaintenance(
          database,
          req.user!.companyId,
          req.user!.id,
          maintenanceCreateSchema.parse(req.body),
        ),
      });
  };
  const update: RequestHandler = async (req, res) => {
    res.json({
      request: await updateMaintenance(
        database,
        req.user!.companyId,
        req.user!.id,
        idSchema.parse(req.params.id),
        maintenanceUpdateSchema.parse(req.body),
      ),
    });
  };
  const status: RequestHandler = async (req, res) => {
    res.json({
      request: await changeMaintenanceStatus(
        database,
        req.user!.companyId,
        req.user!.id,
        idSchema.parse(req.params.id),
        maintenanceStatusSchema.parse(req.body),
      ),
    });
  };
  return { list, options, get, create, update, status };
}
