# pnpm Only

## When

A diff adds or modifies docs, scripts, CI workflow files, or `package.json`
scripts that invoke `npm install`, `npm i`, `npm ci`, `npm run`, or
`yarn add`/`yarn install`. The repository is pnpm-only — see root
`AGENTS.md` and the `preinstall` hook in root `package.json`.

## Flag

> n8n is a pnpm workspace. Documenting or invoking `npm`/`yarn` will break
> CI and confuse contributors. The root `preinstall` script blocks `npm`
> installs already.

## Suggest

- Replace `npm install` → `pnpm install`.
- Replace `npm run <script>` → `pnpm <script>` (pnpm runs scripts directly).
- Replace `yarn add <pkg>` → `pnpm add <pkg>`.
- For workspace-scoped commands, prefer `pnpm --filter <name> <script>`.
