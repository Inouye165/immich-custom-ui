import express from 'express';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { buildAssetContext } from './assets/buildAssetContext';
import { assetContextQuerySchema, assetParamsSchema, trashRequestSchema } from './assets/assetSchemas';
import { getServerConfig, getPaperlessConfig, getVectorConfig, type ServerConfig } from './config';
import {
  createLiveImmichGateway,
  isRecoverableServerError,
  type ImmichGateway,
  UpstreamHttpError,
} from './immich/ImmichGateway';
import { createLiveAiSummaryService, type AiSummaryService } from './services/GeminiService';
import { createLivePoiService, type PoiService } from './services/PoiService';
import { createLiveWeatherService, type WeatherService } from './services/WeatherService';
import { normalizeAssetInfo, normalizeAssetMetadata } from './assets/normalizeAssetDetails';
import { buildSmartSearchPayload } from './search/buildSmartSearchPayload';
import { normalizeSearchResponse } from './search/normalizeSearchResponse';
import {
  searchRequestSchema,
  thumbnailParamsSchema,
  thumbnailQuerySchema,
} from './search/searchSchemas';
import {
  createPaperlessGatewayFromConfig,
  type PaperlessGateway,
} from './paperless/PaperlessGateway';
import {
  documentSearchQuerySchema,
  documentParamsSchema,
} from './paperless/paperlessSchemas';
import { HybridDocumentSearchService } from './vector/HybridDocumentSearchService';
import { DocumentSemanticSearchService } from './vector/DocumentSemanticSearchService';
import { OpenAICompatibleEmbeddingService } from './vector/EmbeddingService';
import { getQdrantClient } from './vector/QdrantClientFactory';

interface AppDependencies {
  immichGateway?: ImmichGateway;
  aiSummaryService?: AiSummaryService;
  paperlessGateway?: PaperlessGateway;
  hybridSearchService?: HybridDocumentSearchService;
  poiService?: PoiService;
  serverConfig?: ServerConfig;
  weatherService?: WeatherService;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  let gateway = dependencies.immichGateway;
  let aiSummaryService = dependencies.aiSummaryService;
  let poiService = dependencies.poiService;
  let serverConfig = dependencies.serverConfig;
  let weatherService = dependencies.weatherService;
  let paperlessGw = dependencies.paperlessGateway;
  let hybridSearch = dependencies.hybridSearchService;

  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/search', async (req, res) => {
    try {
      const request = searchRequestSchema.parse(req.body);
      const payload = buildSmartSearchPayload(request);
      const response = await getGateway().searchSmart(payload);
      res.json(normalizeSearchResponse(response));
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/assets/:id', async (req, res) => {
    try {
      const { id } = assetParamsSchema.parse(req.params);
      const asset = await getGateway().getAssetInfo(id);
      res.json(normalizeAssetInfo(asset));
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/assets/:id/metadata', async (req, res) => {
    try {
      const { id } = assetParamsSchema.parse(req.params);
      const currentGateway = getGateway();
      const [asset, metadata] = await Promise.all([
        currentGateway.getAssetInfo(id),
        currentGateway.getAssetMetadata(id),
      ]);
      res.json(normalizeAssetMetadata(asset, metadata));
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/assets/:id/context', async (req, res) => {
    try {
      const { id } = assetParamsSchema.parse(req.params);
      const { includeAiSummary } = assetContextQuerySchema.parse(req.query);
      const currentGateway = getGateway();
      const assetInfo = await currentGateway.getAssetInfo(id);

      let rawMetadata = null;
      const warnings: string[] = [];
      try {
        rawMetadata = await currentGateway.getAssetMetadata(id);
      } catch {
        warnings.push('Additional asset metadata is unavailable right now.');
      }

      const response = await buildAssetContext({
        aiSummaryService: getAiSummaryService(),
        assetInfo,
        includeAiSummary,
        mapDefaultZoom: getServerConfigValue().mapDefaultZoom,
        poiService: getPoiService(),
        rawMetadata,
        warnings,
        weatherService: getWeatherService(),
      });

      res.json(response);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/assets/:id/thumbnail', async (req, res) => {
    try {
      const { id } = thumbnailParamsSchema.parse(req.params);
      const { size } = thumbnailQuerySchema.parse(req.query);
      const upstream = await getGateway().fetchThumbnail(id, size);
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

  app.get('/api/assets/:id/video/playback', async (req, res) => {
    try {
      const { id } = assetParamsSchema.parse(req.params);
      const range = req.headers.range;
      const upstream = await getGateway().fetchVideoPlayback(id, range);

      const contentType = upstream.headers.get('content-type') ?? 'video/mp4';
      const cacheControl = upstream.headers.get('cache-control') ?? 'private, max-age=300';
      const contentLength = upstream.headers.get('content-length');
      const contentRange = upstream.headers.get('content-range');
      const acceptRanges = upstream.headers.get('accept-ranges');

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', cacheControl);
      if (acceptRanges) {
        res.setHeader('Accept-Ranges', acceptRanges);
      } else {
        res.setHeader('Accept-Ranges', 'bytes');
      }
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      if (upstream.body) {
        const { Readable } = await import('node:stream');
        const nodeStream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      handleError(error, res);
    }
  });

  app.post('/api/assets/trash', async (req, res) => {
    try {
      const { ids } = trashRequestSchema.parse(req.body);
      await getGateway().trashAssets(ids);
      res.json({ trashedIds: ids });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/documents/search', async (req, res) => {
    try {
      const { query, page, mode } = documentSearchQuerySchema.parse(req.query);
      const service = getHybridSearchService();
      const result = await service.search(query, page, mode);
      res.json({
        results: result.results,
        total: result.total,
        hasMore: result.hasMore,
        mode: result.mode,
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
      });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/documents/:id/thumb', async (req, res) => {
    try {
      const { id } = documentParamsSchema.parse(req.params);
      const upstream = await getPaperlessGateway().fetchThumbnail(id);
      const contentType = upstream.headers.get('content-type') ?? 'image/png';
      const cacheControl = upstream.headers.get('cache-control') ?? 'private, max-age=300';
      const payload = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', cacheControl);
      res.send(payload);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/documents/:id/preview', async (req, res) => {
    try {
      const { id } = documentParamsSchema.parse(req.params);
      const upstream = await getPaperlessGateway().fetchPreview(id);
      const contentType = upstream.headers.get('content-type') ?? 'application/pdf';
      const contentLength = upstream.headers.get('content-length');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      if (upstream.body) {
        const { Readable } = await import('node:stream');
        const nodeStream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      handleError(error, res);
    }
  });

  return app;

  function getAiSummaryService() {
    aiSummaryService ??= createLiveAiSummaryService(getServerConfigValue());
    return aiSummaryService;
  }

  function getGateway() {
    gateway ??= createLiveImmichGateway();
    return gateway;
  }

  function getPoiService() {
    poiService ??= createLivePoiService(getServerConfigValue());
    return poiService;
  }

  function getServerConfigValue() {
    serverConfig ??= getServerConfig();
    return serverConfig;
  }

  function getWeatherService() {
    weatherService ??= createLiveWeatherService(getServerConfigValue());
    return weatherService;
  }

  function getPaperlessGateway() {
    if (!paperlessGw) {
      const plConfig = getPaperlessConfig();
      if (!plConfig) {
        throw new Error('Paperless is not configured. Set PAPERLESS_BASE_URL and PAPERLESS_API_TOKEN.');
      }
      paperlessGw = createPaperlessGatewayFromConfig(plConfig);
    }
    return paperlessGw;
  }

  function getHybridSearchService() {
    if (!hybridSearch) {
      const plGw = getPaperlessGateway();
      let semanticService: DocumentSemanticSearchService | null = null;

      const vecConfig = getVectorConfig();
      if (vecConfig) {
        try {
          const qdrant = getQdrantClient(vecConfig);
          const embedding = new OpenAICompatibleEmbeddingService(vecConfig);
          semanticService = new DocumentSemanticSearchService(qdrant, embedding, vecConfig);
        } catch (err) {
          console.error('[app] Failed to initialize semantic search:', err);
        }
      }

      hybridSearch = new HybridDocumentSearchService(plGw, semanticService);
    }
    return hybridSearch;
  }
}

function handleError(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    res.status(400).json({ message: issue?.message ?? 'Invalid request.' });
    return;
  }

  if (error instanceof UpstreamHttpError) {
    if (error.status === 401 || error.status === 403) {
      res.status(502).json({ message: 'Photo library credentials were rejected. Check IMMICH_API_KEY.' });
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
