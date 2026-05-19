# Bugbot Review Rules

Bugbot reads this file plus everything under [`bugbot/`](bugbot/). Each rule
file is a single block with `When` (what to flag), `Flag` (the comment text)
and `Suggest` (the fix). Rules are written so a static diff scanner can match
them mechanically; bugbot is free to add nuance when context warrants.

When a rule fires, leave a single review comment per occurrence. Combine the
comment with a code suggestion when the fix is mechanical. Do not block on
style; block on correctness, security, and policy issues only.

## Cost controls

- See: [bugbot/cost-controls.md](bugbot/cost-controls.md) — Opus → Sonnet

## Quality gates

- See: [bugbot/i18n-interpolate.md](bugbot/i18n-interpolate.md)
- See: [bugbot/rest-scope.md](bugbot/rest-scope.md)
- See: [bugbot/type-safety.md](bugbot/type-safety.md)
- See: [bugbot/design-tokens.md](bugbot/design-tokens.md)
- See: [bugbot/data-testid.md](bugbot/data-testid.md)
- See: [bugbot/env-config.md](bugbot/env-config.md)
- See: [bugbot/pnpm-only.md](bugbot/pnpm-only.md)
- See: [bugbot/error-classes.md](bugbot/error-classes.md)
- See: [bugbot/console-logs.md](bugbot/console-logs.md)
- See: [bugbot/cross-package-imports.md](bugbot/cross-package-imports.md)
- See: [bugbot/deprecated-icons.md](bugbot/deprecated-icons.md)
