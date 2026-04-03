import { z } from 'zod';

export const assetParamsSchema = z.object({
  id: z.string().trim().min(1, 'Asset id is required.'),
});

export const trashRequestSchema = z.object({
  ids: z.array(z.string().uuid('Each asset id must be a valid UUID.')).min(1, 'At least one asset id is required.').max(100, 'Cannot trash more than 100 assets at once.'),
});

export const assetContextQuerySchema = z.object({
  includeAiSummary: z.preprocess(
    (value) => {
      if (value === undefined) {
        return false;
      }

      if (value === 'true') {
        return true;
      }

      if (value === 'false') {
        return false;
      }

      return value;
    },
    z.boolean().default(false),
  ),
});