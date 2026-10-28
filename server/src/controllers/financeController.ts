import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { findExpense, listExpenses } from '../repositories/expenseRepository.js';
import { dashboard } from '../repositories/dashboardRepository.js';
import { recordExpense, voidExpense } from '../services/expenseService.js';
import {
  expenseSchema,
  expenseQuerySchema,
  expenseVoidSchema,
  dashboardQuerySchema,
} from '../validation/expenses.js';
import { idSchema } from '../validation/portfolio.js';
import { ApiError } from '../utils/ApiError.js';
export function createFinanceController(database: Pool) {
  const list: RequestHandler = async (req, res) => {
    res.json(
      await listExpenses(database, req.user!.companyId, expenseQuerySchema.parse(req.query)),
    );
  };
  const get: RequestHandler = async (req, res) => {
    const expense = await findExpense(database, req.user!.companyId, idSchema.parse(req.params.id));
    if (!expense) throw new ApiError(404, 'NOT_FOUND', 'Expense not found.');
    res.json({ expense });
  };
  const create: RequestHandler = async (req, res) => {
    const result = await recordExpense(
      database,
      req.user!.companyId,
      req.user!.id,
      expenseSchema.parse(req.body),
    );
    res.status(result.replayed ? 200 : 201).json({ expense: result.expense });
  };
  const voidRecord: RequestHandler = async (req, res) => {
    res.json({
      expense: await voidExpense(
        database,
        req.user!.companyId,
        req.user!.id,
        idSchema.parse(req.params.id),
        expenseVoidSchema.parse(req.body).reason,
      ),
    });
  };
  const summary: RequestHandler = async (req, res) => {
    res.json(await dashboard(database, req.user!.companyId, dashboardQuerySchema.parse(req.query)));
  };
  return { list, get, create, voidRecord, summary };
}
