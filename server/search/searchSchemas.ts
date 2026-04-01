import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const searchRequestSchema = z
  .object({
    query: z.string().trim().min(1, 'Search query cannot be empty.').max(200),
    startDate: z
      .string()
      .regex(datePattern, 'Start date must use YYYY-MM-DD format.')
      .optional(),
    endDate: z
      .string()
      .regex(datePattern, 'End date must use YYYY-MM-DD format.')
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start date must be before end date.',
        path: ['startDate'],
      });
    }
  });

export const thumbnailParamsSchema = z.object({
  id: z.string().uuid('Asset id must be a valid UUID.'),
});

export const thumbnailQuerySchema = z.object({
  size: z.enum(['thumbnail', 'preview', 'fullsize', 'original']).default('preview'),
});

export type ValidSearchRequest = z.infer<typeof searchRequestSchema>;
