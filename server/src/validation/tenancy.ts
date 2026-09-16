import { z } from 'zod';
import { idSchema } from './portfolio.js';

export const tenantSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required.').max(100),
    lastName: z.string().trim().min(1, 'Last name is required.').max(100),
    phone: z.string().trim().max(40).default(''),
    email: z
      .union([z.string().trim().email('Enter a valid email address.').max(254), z.literal('')])
      .default('')
      .transform((value) => value.toLowerCase()),
    emergencyContactName: z.string().trim().max(150).default(''),
    emergencyContactPhone: z.string().trim().max(40).default(''),
    notes: z.string().trim().max(5000).default(''),
  })
  .strict();

// Date-only strings must round-trip, otherwise JavaScript would normalize dates such as February 30.
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      value >= '1900-01-01' &&
      value <= '9999-12-31' &&
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'Enter a valid date on or after January 1, 1900.');
export const money = z
  .number()
  .finite()
  .min(0)
  .max(9999999999.99)
  .refine(
    (value) => Math.round(value * 100) / 100 === value,
    'Amounts must have at most two decimal places.',
  );
export const leaseSchema = z
  .object({
    tenantId: idSchema,
    unitId: idSchema,
    startDate: date,
    endDate: date,
    monthlyRent: money,
    securityDeposit: money,
    notes: z.string().trim().max(5000).default(''),
  })
  .strict()
  .refine((value) => value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'The end date must be on or after the start date.',
  });
export const terminationSchema = z
  .object({ reason: z.string().trim().min(1, 'Enter a reason for ending this lease.').max(1000) })
  .strict();
const paging = {
  q: z.string().trim().max(150).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
export const tenantQuerySchema = z
  .object({ ...paging, housing: z.enum(['all', 'housed', 'unassigned']).default('all') })
  .strict();
export const leaseQuerySchema = z
  .object({
    ...paging,
    status: z.enum(['ACTIVE', 'UPCOMING', 'EXPIRED', 'TERMINATED']).optional(),
    tenantId: idSchema.optional(),
    unitId: idSchema.optional(),
    propertyId: idSchema.optional(),
  })
  .strict();
export type TenantInput = z.infer<typeof tenantSchema>;
export type TenantQuery = z.infer<typeof tenantQuerySchema>;
export type LeaseInput = z.infer<typeof leaseSchema>;
export type LeaseQuery = z.infer<typeof leaseQuerySchema>;
