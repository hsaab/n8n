# Console Logs

## When

A diff under `packages/cli/src/**`, `packages/core/src/**`, or
`packages/@n8n/<workspace>/src/**` introduces `console.log`, `console.warn`,
or `console.error` outside of:

- Test files (`*.test.ts`, `*.spec.ts`).
- One-off scripts under `scripts/`.
- Files explicitly marked dev-only.

## Flag

> Production code should use the structured logger from `@n8n/backend-common`
> (or the package-local `Logger`). `console.*` calls bypass log levels,
> formatting, and Sentry/OTel pipelines, so production users see noise and
> n8n loses signal in incidents.

## Suggest

```ts
import { Logger } from '@n8n/backend-common';

constructor(private readonly logger: Logger) {}

// then
this.logger.warn('descriptive message', { extra: 'context' });
this.logger.error('descriptive message', { error });
```

Pick the level that matches the situation:

- `debug` — spammy, only useful with `N8N_LOG_LEVEL=debug`.
- `info` — observable lifecycle events.
- `warn` — degraded behavior the user should know about.
- `error` — something failed.
