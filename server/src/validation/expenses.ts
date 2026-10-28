import { z } from 'zod';
import { idSchema } from './portfolio.js';
import { date, money } from './tenancy.js';
import { periodSchema } from './payments.js';
export const expenseCategories = [
  'REPAIRS',
  'UTILITIES',
  'PROPERTY_TAXES',
  'INSURANCE',
  'CLEANING',
  'LANDSCAPING',
  'SUPPLIES',
  'OTHER',
] as const;
export const expenseSchema = z
  .object({
    propertyId: idSchema,
    category: z.enum(expenseCategories),
    description: z.string().trim().min(1, 'Describe the expense.').max(500),
    amount: money.refine((value) => value > 0, 'Expense amount must be greater than zero.'),
    expenseDate: date.refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      'Expense date cannot be in the future.',
    ),
    notes: z.string().trim().max(5000).default(''),
    requestId: idSchema,
  })
  .strict();
export const expenseVoidSchema = z
  .object({
    reason: z.string().trim().min(1, 'Enter a reason for voiding this expense.').max(1000),
  })
  .strict();
export const expenseQuerySchema = z
  .object({
    q: z.string().trim().max(150).default(''),
    propertyId: idSchema.optional(),
    category: z.enum(expenseCategories).optional(),
    period: periodSchema.optional(),
    state: z.enum(['RECORDED', 'VOIDED']).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const dashboardQuerySchema = z
  .object({
    period: periodSchema.default(() => new Date().toISOString().slice(0, 7)),
    propertyId: idSchema.optional(),
  })
  .strict();
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
