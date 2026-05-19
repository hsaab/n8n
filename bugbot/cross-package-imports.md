# Cross-Package Imports

## When

A diff in `packages/frontend/**` introduces an import from a backend package:

- `packages/cli/...`
- `packages/core/...`
- `packages/@n8n/db/...`
- Any other backend-only `@n8n/*` package.

## Flag

> Frontend code must not import from backend packages. The frontend ships to
> the browser; backend packages pull in TypeORM, Node-only modules, and
> service code that have no place there. Even type-only imports drag
> dependency edges into the bundle graph.

## Suggest

- Move the shared shape into `@n8n/api-types` and import it from there in
  both producer and consumer.
- For shared workflow types, use `n8n-workflow` (which is browser-safe).
- If the type genuinely cannot live in `@n8n/api-types` (e.g. it depends on
  TypeORM), redesign the API so the frontend doesn't need it; expose a
  serializable response shape instead.
