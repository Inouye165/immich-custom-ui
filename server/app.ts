import express from 'express';
import type { Response } from 'express';
import { ZodError } from 'zod';
import {
  createLiveImmichGateway,
  isRecoverableServerError,
  type ImmichGateway,
  UpstreamHttpError,
} from './immich/ImmichGateway';
import { buildSmartSearchPayload } from './search/buildSmartSearchPayload';
import { normalizeSearchResponse } from './search/normalizeSearchResponse';
import {
  searchRequestSchema,
  thumbnailParamsSchema,
  thumbnailQuerySchema,
} from './search/searchSchemas';

interface AppDependencies {
  immichGateway?: ImmichGateway;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/search', async (req, res) => {
    try {
      const request = searchRequestSchema.parse(req.body);
      const gateway = dependencies.immichGateway ?? createLiveImmichGateway();
      const payload = buildSmartSearchPayload(request);
      const response = await gateway.searchSmart(payload);
      res.json(normalizeSearchResponse(response));
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/assets/:id/thumbnail', async (req, res) => {
    try {
      const { id } = thumbnailParamsSchema.parse(req.params);
      const { size } = thumbnailQuerySchema.parse(req.query);
      const gateway = dependencies.immichGateway ?? createLiveImmichGateway();
      const upstream = await gateway.fetchThumbnail(id, size);
      const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
      const cacheControl = upstream.headers.get('cache-control') ?? 'private, max-age=300';
      const etag = upstream.headers.get('etag');
      const lastModified = upstream.headers.get('last-modified');
      const payload = Buffer.from(await upstream.arrayBuffer());

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', cacheControl);
      if (etag) {
        res.setHeader('ETag', etag);
      }
      if (lastModified) {
        res.setHeader('Last-Modified', lastModified);
      }
      res.send(payload);
    } catch (error) {
      handleError(error, res);
    }
  });

  return app;
}

function handleError(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    res.status(400).json({ message: issue?.message ?? 'Invalid request.' });
    return;
  }

  if (error instanceof UpstreamHttpError) {
    if (error.status === 401 || error.status === 403) {
      res.status(502).json({ message: 'Immich credentials were rejected. Check IMMICH_API_KEY.' });
      return;
    }

    const statusCode = error.status >= 500 ? 502 : 400;
    res.status(statusCode).json({ message: error.message });
    return;
  }

  if (isRecoverableServerError(error)) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Server configuration is invalid.',
    });
    return;
  }

  console.error(error);
  res.status(500).json({ message: 'Unexpected server error.' });
}
