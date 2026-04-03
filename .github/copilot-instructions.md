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

## Workflow & Version Control

- When a modification or large code change is completed, execute the test suite.
- Any issues or test failures that arise—whether caused by the new code or preexisting—must be fixed until the entire suite is 100% green.
- Once the build is completely green, commit all changes.
- Push the changes and automatically generate a Pull Request.
- The PR description must contain a detailed message explicitly outlining all changes, additions, and fixes made during the session.