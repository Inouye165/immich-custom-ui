import { z } from 'zod';

export const documentSearchQuerySchema = z.object({
  query: z.string().trim().min(1, 'Document search query cannot be empty.').max(500),
  page: z.coerce.number().int().positive().default(1),
});

export const documentParamsSchema = z.object({
  id: z.coerce.number().int().positive('Document id must be a positive integer.'),
});
