# Type Safety

## When

A diff adds:

- `: any` annotations.
- `as any` casts.
- `as <T>` casts in non-test code.

Carve-outs:

- `*.test.ts`, `*.spec.ts`, and Storybook story files may use `as` casts
  to satisfy fixtures.
- Narrowing `unknown` via `as <T>` immediately after a runtime type guard is
  acceptable when the guard is colocated.

## Flag

> Avoid `any` and `as` casts in product code. They turn off the type system in
> exactly the places that benefit from it most. n8n root `AGENTS.md` requires
> proper types or `unknown` plus a type guard.

## Suggest

- Replace `any` with `unknown` and narrow with a type guard.
- Replace `as <T>` with a real type predicate function or refine the call site.
- For shared API shapes, add or extend a type in `@n8n/api-types` instead of
  asserting at the call site.
