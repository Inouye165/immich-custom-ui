# immich-custom-ui

Simple React + TypeScript search UI for a local Immich instance. The browser never talks to Immich directly. A small Node proxy handles server-side auth and forwards smart-search and thumbnail requests.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `IMMICH_BASE_URL` to your Immich server URL.
3. Set `IMMICH_API_KEY` to a valid Immich API key.
4. Run `npm install`.
5. Run `npm run dev`.

The frontend runs through Vite and the backend proxy runs on port `3001`. During development, Vite proxies `/api/*` requests to the backend.

## Environment variables

- `IMMICH_BASE_URL`: base URL for your Immich server, for example `http://localhost:2283`
- `IMMICH_API_KEY`: Immich API key used only by the backend proxy
- `PORT`: optional backend port, defaults to `3001`

## Commands

- `npm run dev`: run the frontend and backend together
- `npm run build`: type-check the frontend and backend, then build the frontend
- `npm run lint`: run ESLint
- `npm run test`: run the test suite
