import { z } from 'zod';

export const propertyTypes = [
  'APARTMENT',
  'HOUSE',
  'TOWNHOUSE',
  'COMMERCIAL',
  'MIXED_USE',
  'OTHER',
] as const;
export const unitStatuses = ['VACANT', 'OCCUPIED', 'MAINTENANCE', 'UNAVAILABLE'] as const;
export const idSchema = z.string().uuid('Invalid record ID.');
export const propertySchema = z
  .object({
    name: z.string().trim().min(1, 'Property name is required.').max(150),
    address: z.string().trim().min(1, 'Address is required.').max(250),
    city: z.string().trim().min(1, 'City is required.').max(100),
    region: z.string().trim().max(100).default(''),
    country: z.string().trim().min(1, 'Country is required.').max(100),
    propertyType: z.enum(propertyTypes),
    notes: z.string().trim().max(5000).default(''),
  })
  .strict();
export const propertyStatusSchema = z.object({ active: z.boolean() }).strict();
export const unitSchema = z
  .object({
    propertyId: idSchema,
    name: z.string().trim().min(1, 'Unit name is required.').max(50),
    bedrooms: z.number().int().min(0).max(100),
    bathrooms: z.number().min(0).max(100).multipleOf(0.5, 'Bathrooms must use increments of 0.5.'),
    monthlyRent: z
      .number()
      .finite()
      .min(0)
      .max(9999999999.99)
      .refine(
        (value) => Math.round(value * 100) / 100 === value,
        'Rent must have at most two decimal places.',
      ),
    status: z.enum(unitStatuses),
    notes: z.string().trim().max(5000).default(''),
  })
  .strict();
const paging = {
  q: z.string().trim().max(150).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
export const propertyQuerySchema = z
  .object({
    ...paging,
    status: z.enum(['active', 'inactive', 'all']).default('active'),
    type: z.enum(propertyTypes).optional(),
  })
  .strict();
export const unitQuerySchema = z
  .object({
    ...paging,
    status: z.enum(unitStatuses).optional(),
    propertyId: idSchema.optional(),
    propertyStatus: z.enum(['active', 'inactive', 'all']).default('active'),
  })
  .strict();

export type PropertyInput = z.infer<typeof propertySchema>;
export type UnitInput = z.infer<typeof unitSchema>;
export type PropertyQuery = z.infer<typeof propertyQuerySchema>;
export type UnitQuery = z.infer<typeof unitQuerySchema>;
