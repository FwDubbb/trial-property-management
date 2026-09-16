import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { findUnit, listUnits } from '../repositories/unitRepository.js';
import { saveUnit } from '../services/unitService.js';
import { ApiError } from '../utils/ApiError.js';
import { idSchema, unitQuerySchema, unitSchema } from '../validation/portfolio.js';

export function createUnitController(database: Pool) {
  const list: RequestHandler = async (req, res) => {
    res.json(await listUnits(database, req.user!.companyId, unitQuerySchema.parse(req.query)));
  };
  const get: RequestHandler = async (req, res) => {
    const unit = await findUnit(database, req.user!.companyId, idSchema.parse(req.params.id));
    if (!unit) throw new ApiError(404, 'NOT_FOUND', 'Unit not found.');
    res.json({ unit });
  };
  const create: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json({ unit: await saveUnit(database, req.user!.companyId, unitSchema.parse(req.body)) });
  };
  const update: RequestHandler = async (req, res) => {
    res.json({
      unit: await saveUnit(
        database,
        req.user!.companyId,
        unitSchema.parse(req.body),
        idSchema.parse(req.params.id),
      ),
    });
  };
  return { list, get, create, update };
}
