# Copilot Instructions — immich-custom-ui

## Language & framework

- Always use **TypeScript** (never plain JavaScript).
- React functional components with hooks.
- Vite for build tooling.

## Architecture

- Prefer modular design: small, focused files over monoliths.
- Keep a clear service boundary between UI and API layers.
- Use typed interfaces for all domain models and service contracts.
- Organize code into `src/components`, `src/features`, `src/services`, `src/types`.

## Code quality

- Run `npm run lint` and `npm run test` before considering work complete.
- Write comments in the voice of a senior engineer — concise, direct, no filler.
- Add regression tests when fixing bugs or changing behavior.
- Prefer semantic, accessible HTML (`<label>`, `<button>`, ARIA attributes).

## Security

- Treat cybersecurity as paramount.
- Sanitize all user inputs before use.
- Never embed secrets or credentials in source.
- Use secure defaults everywhere.

## Style

- Keep the UI visually clean and professional.
- Use CSS modules or scoped styles; avoid global style leaks.
