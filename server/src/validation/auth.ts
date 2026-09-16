import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(254)
  .transform((value) => value.toLowerCase());
export const registerSchema = z
  .object({
    companyName: z.string().trim().min(1, 'Company name is required.').max(150),
    name: z.string().trim().min(1, 'Your name is required.').max(100),
    email,
    password: z.string().min(12, 'Use at least 12 characters for your password.').max(128),
  })
  .strict();

export const loginSchema = z
  .object({ email, password: z.string().min(1, 'Password is required.').max(128) })
  .strict();
