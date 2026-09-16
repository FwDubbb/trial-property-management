import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import * as repository from '../repositories/propertyRepository.js';
import { ApiError } from '../utils/ApiError.js';
import {
  idSchema,
  propertyQuerySchema,
  propertySchema,
  propertyStatusSchema,
} from '../validation/portfolio.js';

function requireProperty(property: unknown) {
  if (!property) throw new ApiError(404, 'NOT_FOUND', 'Property not found.');
  return property;
}
export function createPropertyController(database: Pool) {
  const list: RequestHandler = async (req, res) => {
    res.json(
      await repository.listProperties(
        database,
        req.user!.companyId,
        propertyQuerySchema.parse(req.query),
      ),
    );
  };
  const get: RequestHandler = async (req, res) => {
    res.json({
      property: requireProperty(
        await repository.findProperty(database, req.user!.companyId, idSchema.parse(req.params.id)),
      ),
    });
  };
  const create: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json({
        property: await repository.insertProperty(
          database,
          req.user!.companyId,
          propertySchema.parse(req.body),
        ),
      });
  };
  const update: RequestHandler = async (req, res) => {
    res.json({
      property: requireProperty(
        await repository.updateProperty(
          database,
          req.user!.companyId,
          idSchema.parse(req.params.id),
          propertySchema.parse(req.body),
        ),
      ),
    });
  };
  const status: RequestHandler = async (req, res) => {
    res.json({
      property: requireProperty(
        await repository.setPropertyStatus(
          database,
          req.user!.companyId,
          idSchema.parse(req.params.id),
          propertyStatusSchema.parse(req.body).active,
        ),
      ),
    });
  };
  const summary: RequestHandler = async (req, res) => {
    res.json(await repository.portfolioSummary(database, req.user!.companyId));
  };
  const options: RequestHandler = async (req, res) => {
    const result = await database.query(
      'SELECT id, name, active FROM properties WHERE company_id=$1 ORDER BY name, id',
      [req.user!.companyId],
    );
    res.json({ items: result.rows });
  };
  return { list, get, create, update, status, summary, options };
}
