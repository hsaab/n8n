# REST Scope

## When

A diff adds or modifies a `@Get`, `@Post`, `@Put`, `@Patch`, or `@Delete`
route on a class decorated with `@RestController(...)` and the route handler
does not carry an adjacent `@ProjectScope('<resource>:<op>')` /
`@GlobalScope('<resource>:<op>')` decorator.

Carve-out: handlers with `{ skipAuth: true }` (and an explanatory comment
about the alternate auth mechanism) are public and intentionally unscoped.

## Flag

> Authenticated REST routes must carry an access-scope decorator
> (`@ProjectScope` or `@GlobalScope`). Without one, any authenticated user can
> hit the route, which is a real IDOR risk. See `.claude/skills/protect-endpoints/SKILL.md`.

## Suggest

Add the decorator immediately under the HTTP-method decorator. Use the most
specific scope that fits, matching the resource's existing CRUD convention:

```ts
@Post('/widgets')
@ProjectScope('widget:create')
async create(...) { ... }
```

If the scope you need doesn't exist yet, add it to
`packages/@n8n/permissions/src/constants.ee.ts` and follow the rest of the
checklist in `protect-endpoints`.
