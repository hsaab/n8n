# Error Classes

## When

A diff under `packages/cli/src/**` or any node implementation introduces:

- `new ApplicationError(...)` — deprecated.
- `throw new Error(...)` — too generic; loses error code metadata.

## Flag

> n8n root `AGENTS.md` deprecates `ApplicationError`. Use `UnexpectedError`,
> `OperationalError`, or `UserError` instead. For node operations use
> `NodeOperationError` / `NodeApiError` so the UI can render structured error
> details.

## Suggest

Pick the class that matches the failure semantic:

| Class | When to use |
|---|---|
| `UserError` | The user provided input that cannot be processed (validation, not found because a user-supplied id doesn't exist). |
| `OperationalError` | A transient external dependency failed (DB, network, upstream service). |
| `UnexpectedError` | An invariant the code assumed has been violated; not the user's fault. |
| `NodeOperationError` | Inside a node, when the node configuration is invalid. |
| `NodeApiError` | Inside a node, when the upstream API returned an error response. |

Import from the appropriate package. For cli code:

```ts
import { UnexpectedError, OperationalError, UserError } from 'n8n-workflow';
```

For node code, use the node-specific classes from `n8n-workflow`.
