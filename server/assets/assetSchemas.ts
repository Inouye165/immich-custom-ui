import { z } from 'zod';

export const assetParamsSchema = z.object({
  id: z.string().trim().min(1, 'Asset id is required.'),
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