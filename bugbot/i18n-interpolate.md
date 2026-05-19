# i18n Interpolate

## When

A diff in `packages/frontend/**/*.{ts,vue}` introduces a `i18n.baseText('...', { ... })`
call where the second argument is not exactly `{ interpolate: { ... } }`. In
particular, top-level `{ count: ... }` / `{ name: ... }` shapes silently fail
to substitute because the wrapper at `packages/frontend/@n8n/i18n/src/index.ts`
only forwards `options.interpolate` to vue-i18n.

Carve-out: `{ adjustToNumber: <n>, interpolate: { count: <n> } }` is correct
for plural forms.

## Flag

> `baseText` placeholders only get substituted when wrapped in `interpolate`.
> A bare `{ count: 3 }` second argument renders the literal `{count}` text in
> the UI. This silently broke time-saved labels on the Insights Analyst page.

## Suggest

```ts
- i18n.baseText('foo.bar', { count: 3 })
+ i18n.baseText('foo.bar', { interpolate: { count: 3 } })
```

If the value is dynamic, prefer the existing helper formatters that already
wrap i18n correctly (e.g. `formatInsightsTimeSavedLabel(minutes)` for
time-saved values).
