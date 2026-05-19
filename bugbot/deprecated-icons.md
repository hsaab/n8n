# Deprecated Icons

## When

A diff adds an `<N8nIcon icon="..." />` (or any `:icon="..."` prop) using a
name that exists only in `deprecatedIconSet` and not in `updatedIconSet` in
[`packages/frontend/@n8n/design-system/src/components/N8nIcon/icons.ts`](packages/frontend/@n8n/design-system/src/components/N8nIcon/icons.ts).

## Flag

> This icon name is on the deprecated list. New code must use icons from
> `updatedIconSet`. Mixing the two breaks visual consistency between feature
> areas and will be removed in a future design-system cleanup.

## Suggest

- Look up the recommended replacement in `updatedIconSet`.
- If no exact replacement exists, pick the closest semantic match (e.g.
  `triangle-alert` for warnings, `chart-column-decreasing` for analytics,
  `arrow-up-right` for "open in new view"). Document the choice in the PR.
