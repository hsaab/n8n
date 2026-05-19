# Cost Controls — Opus → Sonnet

## When

A diff under `packages/**` introduces or modifies any string matching
`/claude-opus-[\w.-]+/i`, sets `model: 'claude-opus-...'` on a model factory,
or defaults a chat/builder/analyst model to Opus on a `@Config` class.

The rule applies regardless of provider: if the codebase later adds Bedrock /
Vertex variants of Opus (`anthropic.claude-opus-…`), update the regex.

Carve-out: a `// opus-approved: <link>` comment on the same line or the line
immediately above the model id silences the rule. The link must point to the
approval thread (Slack, Linear, doc) so reviewers can confirm.

## Flag

> Opus is reserved for explicit human approval — production and demo defaults
> must be Sonnet maximum. Opus is roughly 5× the per-token cost of Sonnet, so
> a default that ships to customer demos can quietly produce a large bill.

## Suggest

Replace the model id with the latest available Sonnet variant, e.g.
`claude-sonnet-4-5-20250929`. If Opus is genuinely required for this feature:

1. Link the approval thread in the PR description.
2. Add an `// opus-approved: <link>` comment beside the model id so future
   diffs know the exception exists.
3. Add a unit test that pins the model id so an accidental upgrade gets
   caught.

## Verifies

This rule is intentionally exercised by the introducing PR. The Insights
Analyst chat ships with `claude-opus-4-7-20260101` as the default in
`packages/cli/src/modules/insights/insights.config.ts` so the rule fires on a
real diff and the downgrade fix demonstrates the bugbot loop end-to-end.
