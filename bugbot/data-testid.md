# data-testid

## When

A diff adds a `data-testid="..."` attribute that is not a single, lowercase,
hyphenated string. Specifically flag:

- Multiple values separated by spaces (`data-testid="foo bar"`).
- Dynamic templates that interpolate spaces (`data-testid="${a} ${b}"`).
- camelCase or PascalCase values when the surrounding code uses kebab-case.

## Flag

> `data-testid` must be a single string; Playwright and Vitest selectors
> assume that. A space-separated value silently breaks `getByTestId('foo')`.

## Suggest

- Pick a single canonical id and update both the component and any tests that
  reference the old value.
- If two ids feel necessary, the test is probably reaching for an
  implementation detail; consider a richer page object instead.
