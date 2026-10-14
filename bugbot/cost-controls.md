# Cost controls

Product code, demo code, config defaults, and test env fixtures must not set an Anthropic Opus-class model id as a default.

Opus-class models cost more than Sonnet-class models. A default of `claude-opus-4-7-20260101` (or any id matching `claude` + `opus`) in n8n product or demo paths is a blocking finding titled **Use Sonnet-class model by default**.

Replace the default with `claude-sonnet-4-5-20250929`. An explicit env override may still select another model. Do not flag this file.
