# immich-custom-ui

Simple React + TypeScript search UI for a local Immich instance. The browser never talks to Immich directly. A small Node proxy handles server-side auth and forwards smart-search, thumbnail, and asset-context requests.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `IMMICH_BASE_URL` to your Immich server URL.
3. Set `IMMICH_API_KEY` to a valid Immich API key.
4. Run `npm install`.
5. Run `npm run startup`.

The frontend runs through Vite and the backend proxy runs on port `3001`. During development, Vite proxies `/api/*` requests to the backend.

## Asset details experience

Click any search result to open a right-side asset details panel. The panel loads on demand and can show:

- normalized Immich metadata
- a compact map centered on the asset GPS coordinates
- nearby points of interest from OpenStreetMap via Overpass
- historical weather from Open-Meteo
- an optional Gemini summary generated server-side when enabled
- context status indicators showing whether POI, weather, and AI summary data came from a live request, memory cache, disk cache, or fallback path

If a photo does not include GPS metadata, the panel still renders metadata and shows a graceful no-location state. If POI or weather enrichment fails, the rest of the panel stays usable and surfaces a non-blocking warning.

## Archive masthead editor

The app now includes a branded archive header inspired by the visual direction in the reference mockup.

- Rename the archive directly from the Archive Studio panel.
- Add photos from search results into the masthead.
- Start with one featured image and grow up to eight.
- Adjust each featured image with scale and position controls so the crop sits exactly where you want it.
- Archive preferences persist locally in browser storage.

The search grid keeps the archive workflow separate from asset details: clicking a card opens details, while the archive button on each card adds or removes it from the masthead editor.

## Environment variables

- `IMMICH_BASE_URL`: required base URL for your Immich server, for example `http://localhost:2283`
- `IMMICH_API_KEY`: required Immich API key used only by the backend proxy
- `PORT`: optional backend port, defaults to `3001`
- `GEMINI_API_KEY`: optional Gemini API key used only by the backend when AI summaries are enabled
- `WEATHER_PROVIDER`: optional weather provider override, defaults to `open-meteo`
- `WEATHER_BASE_URL`: optional override for the Open-Meteo archive endpoint
- `OVERPASS_BASE_URL`: optional override for the Overpass interpreter endpoint
- `MAP_DEFAULT_ZOOM`: optional map zoom used for GPS assets, defaults to `15`
- `MAP_POI_RADIUS_METERS`: optional POI search radius in meters, defaults to `1000`

Required keys:

- `IMMICH_API_KEY`
- `GEMINI_API_KEY` only if AI summary generation is enabled

Notes:

- No weather API key is required when using Open-Meteo.
- Gemini, weather, and POI calls are made server-side only. The browser never receives those secret keys.
- The map and POI experience works without exposing secrets to the browser.
- API responses from Immich and third-party enrichments are cached to reduce repeated upstream calls.
- Persistent external API cache files are stored under `.runtime/api-cache` and survive app restarts unless you delete them.
- `docker-compose.yml` includes Qdrant plus an optional local Paperless-ngx stack exposed on `http://localhost:8000`.
- The Paperless containers do not mint an API token automatically. After the stack is up, create a superuser and token, then set `PAPERLESS_API_TOKEN` in `.env`.

Paperless quick start:

```powershell
docker compose up -d paperless-webserver
docker compose exec paperless-webserver python manage.py createsuperuser
docker compose exec paperless-webserver python manage.py drf_create_token <your-paperless-username>
```

Then add these local settings:

```env
PAPERLESS_BASE_URL=http://localhost:8000
PAPERLESS_API_TOKEN=<paste-generated-token-here>
```

## Commands

- `npm run dev`: run the frontend and backend together
- `npm run startup`: start the app with Docker-aware startup checks and readiness waits
- `npm run shutdown`: stop the app process tree and any compose services started by the startup script
- `npm run build`: type-check the frontend and backend, then build the frontend
- `npm run lint`: run ESLint
- `npm run test`: run the test suite
