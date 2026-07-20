# Guidelines

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

## Common commands

```bash
npm test            # run all tests across packages (vp test)
npm run typecheck   # type-check without emitting (tsc)
npm run lint        # lint (vp check)
npm run lint:fix    # lint + autofix (vp check --fix)
```

`test`, `lint`, and `lint:fix` are wrapped by `./run-silent`, which suppresses stdout/stderr on success and prints only a `✔` line. On failure it prints the captured output and exits non-zero.

## Pre-commit hooks (prek)

This repo uses prek (a pre-commit-compatible hook runner) configured in `prek.toml`. On every commit it runs:

- **Builtin hygiene hooks** — trailing-whitespace, end-of-file-fixer, check-json / check-json5 / check-toml, check-symlinks, check-merge-conflict, detect-private-key, check-added-large-files, and friends.
- **`npm run typecheck`** — type-checks the whole repo (`tsc`).
- **`npm run lint`** — the linter (`vp check`).
- **`npm run test`** — the full test suite (`vp test`).

All three local hooks use `pass_filenames = false` so they run project-wide regardless of which files are staged.

A commit fails if typecheck, lint, or tests fail, so run `npm run typecheck`, `npm test`, and `npm run lint` before committing. Note `check-symlinks` is active — keep the per-package `.npmignore` symlinks valid.

## Committing

- After you finish each batch of related changes (one logical unit of work), **commit proactively — do not wait to be asked**. A "batch" is a cohesive set of edits toward one purpose (e.g. scaffolding a new package, fixing license years, updating docs).
- Split logically distinct batches into **separate, focused commits** rather than one lump commit. Stage only the files relevant to each commit.
- Use Conventional Commits with an optional scope, matching the existing history: `feat`, `fix`, `chore`, `docs`, `refactor`, `test` (e.g. `feat(pi-stop-secrets-leaks): scaffold new extension`, `docs(AGENTS): note committing practice`).
- The prek hooks run typecheck/lint/test on every commit, so make sure those pass before committing.

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
- Import the source from the compiled output path: `import { … } from "../src/index.js"` (TypeScript files, but use the `.js` extension for the npm package's `"type": "module"` resolution).
- Mock external dependencies (like `@spences10/pi-tui-modal`) with `vi.mock(...)` at the top of the test file — vitest hoists these before imports.

## How-To: Create a new extension package

1. Create `packages/pi-<package-name-slug>/` with AT LEAST: `package.json`, `README.md`, `LICENSE` (copied from the repo root `LICENSE` via `cp LICENSE packages/pi-<package-name-slug>/LICENSE` — never hand-written), `.npmignore` symlink that points to repo root's `.npmignore` file, `src/index.ts` file, `test/` dir.
2. Use `@normful/pi-<package-name-slug>` as the npm package name
3. In the new package.json, include:

```json
"pi": {
  "extensions": [
    "./src/index.ts"
  ],
  "video": "https://www.github.com/normful/pi-bakery/packages/pi-<package-name-slug>/demo.mp4"
}
```

4. The `pi.video` URL points to a `demo.mp4` in the package directory. Add a short `demo.mp4` there so the link resolves; if you don't have one yet, treat the field as a placeholder and add the video later.
5. Run `npm run lint:fix`

## How-To: Publish one package

1. **Bump the version** — edit the `"version"` field in `packages/pi-<name>/package.json` directly, then run:

       npm install

   (This keeps the lockfile in sync.)

2. **Dry-run** to confirm only intended files are included:

       npm publish --workspace=@normful/pi-<name> --access public --dry-run --loglevel=info

   (The root `.npmrc` silences npm output, so pass `--loglevel=info` explicitly or the tarball listing won't print.)

3. Confirm with user that they want to proceed.
4. **Publish** — ask the user to run this themselves (npm 2FA requires their session):

       npm publish --workspace=@normful/pi-<name> --access public

## How-To: Publish all packages

1. **Bump versions** — edit the `"version"` field in each package's `packages/pi-<name>/package.json`, then run:

       npm install

2. **Dry-run** to confirm:

       npm publish --workspaces --access public --dry-run --loglevel=info

   (The root `.npmrc` silences npm output, so pass `--loglevel=info` explicitly or the tarball listing won't print.)

3. Confirm with user that they want to proceed.
4. **Publish all** — ask the user to run this themselves (npm 2FA requires their session):

       npm publish --workspaces --access public
