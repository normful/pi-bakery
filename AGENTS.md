# Guidelines for all AI coding agents (including those working on behalf of contributors)

Extensions must independently installable.
All extensions are in `packages/` dir and published to npm in `@normful/` namespace.
For maintenance simplicity, DO NOT duplicate configuration across packages.

## Each Package Workspace

In each package directory under `packages/`:

- Do not create a tsconfig.json
- Do not create a vite.config.json
- Do not add any `scripts` in the package.json files of each package.
- `package.json` should contain:
  - `"name"` scoped as `@normful/pi-<package-name-slug>`.
  - `"version"` (semver). Bump it in the package's own `package.json` (see the publish how-tos).
  - `"private": false` (these packages are published).
  - `"type": "module"`.
  - `"description"`, `"keywords"`, `"license": "MIT"`, and `"author"`.
  - `"repository"` with `"directory": "packages/pi-<package-name-slug>"`, plus `"bugs"` pointing at the repo issues URL.
  - `"pi": { ... }` object property that declares Pi extension entry points.
  - `"peerDependencies"` for:
    - `@earendil-works/pi-agent-core` at a `"*"` semver range
    - `@earendil-works/pi-coding-agent` at a `"*"` semver range
    - `@earendil-works/pi-tui` at a `"*"` semver range
    - `@earendil-works/pi-ai` at a `"*"` semver range
  - `"devDependencies"` for the build/test toolchain (`typescript`, `vite-plus`). This is the **one accepted exception** to the "DO NOT duplicate configuration across packages" rule: the toolchain is repeated per package so each workspace stays self-contained (local `npx` / editor resolution), while all _config files_ (`tsconfig.json`, `vite.config.ts`) and _scripts_ remain root-only.
  - `"dependencies"` only when the extension genuinely needs a runtime library. Pin runtime deps to an **exact** version (e.g. `@spences10/pi-tui-modal` at `0.0.22`) so a published extension installs reproducibly.
- Must contain a `.npmignore` symlink pointing to the repo root's `.npmignore` (`ln -s ../../.npmignore packages/pi-<package-name-slug>/.npmignore`). The root `.npmignore` keeps `test/` and `AGENTS.md` out of the published tarball; npm only honors a `.npmignore` _inside_ the package being published, so the symlink is required.
- Must contain a `LICENSE` that is an exact copy of the repo root's `LICENSE` (`cp LICENSE packages/pi-<package-name-slug>/LICENSE`). **Never write a LICENSE by hand** — the root file is the single source of truth (including the copyright year), so always copy it from there.
- Must contain extension code as TypeScript files in a `packages/pi-<package-name-slug>/src/` directory.
- Must contain extension unit tests as TypeScript files in a `packages/pi-<package-name-slug>/test/` directory. If a package has no tests yet, include an empty `test/.gitkeep` so the directory still exists.

## Root Workspace

- The root workspace is named `pi-bakery`.
  - Keep tsconfig.json, vite.config.ts (configuration file for Vite Plus -- `vp`) in the root workspace `pi-bakery`.
  - Only add scripts to the `scripts` property of the root workspace's package.json file.
  - The `pi-bakery/.npmrc` in the root workspace configures flags to be passed to `npm` such that you only need to run the common commands below.
  - The root `package.json` declares `"workspaces": ["packages/*"]` and a `devEngines` block enforcing `packageManager: npm` and `runtime: node` (both `onFail: error`). Use **npm** in this repo — not pnpm/yarn.

## How extensions are loaded by Pi

Extensions are loaded by pi using [jiti](https://github.com/unjs/jiti).
TypeScript is configured in `tsconfig.json` to NOT transpile to JavaScript, with `"noEmit": true`.

Because jiti resolves imports as ESM, **relative import specifiers must use a `.js` extension** even though the actual files on disk are `.ts`. For example, in `src/index.ts`:

```ts
import { ScanCache } from "./cache.js"; // resolves to src/cache.ts
import type { BetterleaksFinding } from "./types.js"; // resolves to src/types.ts
```

This applies to all relative imports in both `src/` and `test/` files. Do not use extensionless imports (`"./cache"`) — they will fail at runtime under jiti.

## Common commands

```bash
npm test            # run all tests across packages (vp test)
npm run typecheck   # type-check without emitting (tsc)
npm run lint        # lint (vp check)
npm run lint:fix    # lint + autofix (vp check --fix)
```

`test`, `lint`, and `lint:fix` are wrapped by `./run-silent`, which suppresses stdout/stderr on success and prints only a `✔` line. On failure it prints the captured output and exits non-zero.

## Git hooks (hk)

This repo uses [hk](https://hk.jdx.dev) configured in `hk.pkl`. On every `pre-commit`/`pre-push` it runs hygiene (trailing-whitespace, newlines, mixed-line-ending, check-added-large-files, check-symlinks, check-merge-conflict, detect-private-key, etc.) plus `npm run typecheck` / `npm run lint` (`vp check`) / `npm run test` — all project-wide (no per-file filtering).

**Install hk:**

```bash
mise use hk && hk --version   # or: brew install hk / cargo install hk
hk install --global           # once per machine (no-op outside hk repos; Git 2.54+)
# or per-repo: hk install
```

**Use:**

```bash
hk check --all   # check without fixing (CI)
hk fix --all     # auto-fix
hk run pre-commit --all  # test hook without committing
HK=0 git commit  # bypass hook
```

A commit fails if typecheck/lint/test fail, so run `npm run typecheck`, `npm test`, and `npm run lint` (or `hk check`) before committing. Note `check-symlinks` is active — keep per-package `.npmignore` symlinks valid.

## Committing

- After you finish each batch of related changes (one logical unit of work), **commit proactively — do not wait to be asked**. A "batch" is a cohesive set of edits toward one purpose (e.g. scaffolding a new package, fixing license years, updating docs).
- Split logically distinct batches into **separate, focused commits** rather than one lump commit. Stage only the files relevant to each commit.
- Use Conventional Commits with an optional scope, matching the existing history: `feat`, `fix`, `chore`, `docs`, `refactor`, `test` (e.g. `feat(pi-stop-secrets-leaks): scaffold new extension`, `docs(AGENTS): note committing practice`).
- The hk hooks run typecheck/lint/test on every commit, so make sure those pass before committing.

## Testing

Tests are written with [vitest](https://vitest.dev) and run via [Vite Plus](https://github.com/nicholasgriffintn/vite-plus) (`vp`). No additional setup is needed — `vp` wraps vitest and is already in the root workspace.

```bash
# Run all tests across all packages
npx vp test

# Run tests for a specific package (project filter)
npx vp test --project pi-show-theme-colors

# Run tests matching a file pattern
npx vp test packages/pi-show-theme-colors/
```

### Writing tests

- Place test files in `packages/pi-<name>/test/` with a `.test.ts` extension.
- Use standard vitest APIs (`describe`, `it`, `expect`, `vi`).
- Import the source using `.js` extensions: `import { … } from "../src/index.js"` (the files are TypeScript, but jiti resolves ESM imports with `.js` specifiers to the corresponding `.ts` files — see "How extensions are loaded by Pi").
- Mock external dependencies (like `@spences10/pi-tui-modal`) with `vi.mock(...)` at the top of the test file — vitest hoists these before imports.

# Additional guidelines if you are working on behalf of a user named "norman"

If `echo $USER` outputs `norman`, fully read and follow guidelines in `MAINTAINER_AGENTS.md`.
