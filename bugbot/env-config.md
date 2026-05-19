# Env Config

## When

A diff in `packages/**` introduces a direct `process.env.<NAME>` read outside
of `@n8n/config` consumers (i.e. the file does not declare the var via an
`@Env(...)` decorator on a `@Config` class).

Carve-outs:

- `packages/cli/src/scripts/**` and `packages/testing/**` for one-off scripts.
- `process.env.NODE_ENV` and `process.env.CI` are framework conventions.

## Flag

> Reading `process.env.<NAME>` directly bypasses the n8n config system. New
> env vars must be declared on a `@Config` class with the `@Env(...)`
> decorator from `@n8n/config` (or a module-local config class). The
> decorator handles validation, type coercion, and `_FILE` indirection for
> secrets.

## Suggest

- Add the var to the relevant config class:

  ```ts
  @Env('N8N_<FEATURE>_<KNOB>')
  knobName: <string|number|boolean> = <default>;
  ```

- Inject the config class via DI and read `this.config.knobName`.
- Document the var in the package's `AGENTS.md` if it crosses module
  boundaries.

Naming conventions live in `.cursor/rules/n8n-config-env.mdc`.
