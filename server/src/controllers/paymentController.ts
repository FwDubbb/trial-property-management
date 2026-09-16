import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  findPayment,
  listPayments,
  listRent,
  paymentOptions,
} from '../repositories/paymentRepository.js';
import { recordPayment, voidPayment } from '../services/paymentService.js';
import {
  paymentQuerySchema,
  paymentSchema,
  rentQuerySchema,
  voidPaymentSchema,
} from '../validation/payments.js';
import { idSchema } from '../validation/portfolio.js';
import { ApiError } from '../utils/ApiError.js';
export function createPaymentController(database: Pool) {
  const list: RequestHandler = async (req, res) => {
    res.json(
      await listPayments(database, req.user!.companyId, paymentQuerySchema.parse(req.query)),
    );
  };
  const rent: RequestHandler = async (req, res) => {
    res.json(await listRent(database, req.user!.companyId, rentQuerySchema.parse(req.query)));
  };
  const options: RequestHandler = async (req, res) => {
    res.json({ items: await paymentOptions(database, req.user!.companyId) });
  };
  const get: RequestHandler = async (req, res) => {
    const payment = await findPayment(database, req.user!.companyId, idSchema.parse(req.params.id));
    if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Payment not found.');
    res.json({ payment });
  };
  const create: RequestHandler = async (req, res) => {
    const result = await recordPayment(
      database,
      req.user!.companyId,
      req.user!.id,
      paymentSchema.parse(req.body),
    );
    res.status(result.replayed ? 200 : 201).json({ payment: result.payment });
  };
  const voidRecord: RequestHandler = async (req, res) => {
    res.json({
      payment: await voidPayment(
        database,
        req.user!.companyId,
        req.user!.id,
        idSchema.parse(req.params.id),
        voidPaymentSchema.parse(req.body).reason,
      ),
    });
  };
  return { list, rent, options, get, create, voidRecord };
}
