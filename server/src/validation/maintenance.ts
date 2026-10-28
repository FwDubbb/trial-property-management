import { z } from 'zod';
import { idSchema } from './portfolio.js';
import { date } from './tenancy.js';
export const maintenanceStatuses = [
  'SUBMITTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export const maintenancePriorities = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'] as const;
const details = {
  title: z.string().trim().min(1, 'Enter a request title.').max(150),
  description: z.string().trim().min(1, 'Describe the issue.').max(10000),
  priority: z.enum(maintenancePriorities),
  submittedDate: date.refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    'Submitted date cannot be in the future.',
  ),
  assignedTo: z.string().trim().max(150).default(''),
  notes: z.string().trim().max(5000).default(''),
};
export const maintenanceCreateSchema = z
  .object({
    ...details,
    propertyId: idSchema,
    unitId: idSchema.nullable().default(null),
    tenantId: idSchema.nullable().default(null),
  })
  .strict()
  .refine((value) => !value.tenantId || !!value.unitId, {
    path: ['tenantId'],
    message: 'Select a unit before linking a tenant.',
  });
export const maintenanceUpdateSchema = z
  .object({ ...details, version: z.number().int().positive() })
  .strict();
export const maintenanceStatusSchema = z
  .object({
    status: z.enum(maintenanceStatuses),
    version: z.number().int().positive(),
    reason: z.string().trim().max(1000).default(''),
  })
  .strict();
export const maintenanceQuerySchema = z
  .object({
    q: z.string().trim().max(150).default(''),
    status: z.enum(maintenanceStatuses).optional(),
    priority: z.enum(maintenancePriorities).optional(),
    propertyId: idSchema.optional(),
    unitId: idSchema.optional(),
    tenantId: idSchema.optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type MaintenanceCreate = z.infer<typeof maintenanceCreateSchema>;
export type MaintenanceUpdate = z.infer<typeof maintenanceUpdateSchema>;
export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;
export type MaintenanceQuery = z.infer<typeof maintenanceQuerySchema>;
