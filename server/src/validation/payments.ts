import { z } from 'zod';
import { idSchema } from './portfolio.js';
import { date, money } from './tenancy.js';

export const periodSchema = z
  .string()
  .regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/, 'Choose a valid rent month.');
export const paymentMethods = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHECK', 'OTHER'] as const;
export const paymentSchema = z
  .object({
    leaseId: idSchema,
    period: periodSchema,
    amount: money.refine((value) => value > 0, 'Payment amount must be greater than zero.'),
    paymentDate: date.refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      'Payment date cannot be in the future.',
    ),
    method: z.enum(paymentMethods),
    reference: z.string().trim().max(150).default(''),
    notes: z.string().trim().max(5000).default(''),
    requestId: idSchema,
  })
  .strict();
export const voidPaymentSchema = z
  .object({
    reason: z.string().trim().min(1, 'Enter a reason for voiding this payment.').max(1000),
  })
  .strict();
const filters = {
  q: z.string().trim().max(150).default(''),
  tenantId: idSchema.optional(),
  leaseId: idSchema.optional(),
  propertyId: idSchema.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
export const paymentQuerySchema = z
  .object({
    ...filters,
    period: periodSchema.optional(),
    method: z.enum(paymentMethods).optional(),
    state: z.enum(['RECORDED', 'VOIDED']).optional(),
  })
  .strict();
export const rentQuerySchema = z
  .object({
    ...filters,
    period: periodSchema.default(() => new Date().toISOString().slice(0, 7)),
    status: z.enum(['PAID', 'PARTIALLY_PAID', 'UNPAID', 'OVERDUE']).optional(),
  })
  .strict();
export type PaymentInput = z.infer<typeof paymentSchema>;
export type PaymentQuery = z.infer<typeof paymentQuerySchema>;
export type RentQuery = z.infer<typeof rentQuerySchema>;
