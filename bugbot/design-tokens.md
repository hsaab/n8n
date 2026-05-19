# Design Tokens

## When

A diff in `packages/frontend/editor-ui/src/**/*.{vue,scss}` adds:

- Hardcoded `\d+px` or `\d+rem` values inside `<style>` blocks (or in
  `style="..."` inline attributes).
- Imports from `_tokens.legacy.scss`.
- Color literals (`#abc`, `rgb(...)`, `hsl(...)`) outside of token definitions.

Carve-outs:

- `1px`, `2px` for borders or transforms when no token covers the case.
- Animation keyframes that need pixel offsets.

## Flag

> Use semantic tokens for spacing, sizing, color, and radius. Hardcoded values
> drift from the design system over time and break dark mode. Legacy tokens
> are explicitly discouraged in `packages/frontend/AGENTS.md`.

## Suggest

- Spacing → `var(--spacing--{4xs|3xs|2xs|xs|sm|md|lg|xl|2xl|3xl})`.
- Radius → `var(--radius--{xs|sm|md|lg|xl|full})`.
- Color → `var(--color--text)`, `var(--background--surface)`,
  `var(--color--success|warning|danger|primary)`, etc. Pull the right token
  from `_tokens.scss` / `_primitives.scss`.
- Font sizes → `var(--font-size--{3xs|2xs|xs|sm|md|lg|xl|2xl|3xl})`.

If a custom value is genuinely required (e.g. a chart-specific px height),
leave a comment explaining why no token applies.
