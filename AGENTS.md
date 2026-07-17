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
    - `"pi": { ... }` object property that declares Pi extension entry points.
    - `"peerDependencies"` for:
        - `@earendil-works/pi-coding-agent` at a `"*"` semver range
        - `@earendil-works/pi-tui` at a `"*"` semver range
        - `@earendil-works/pi-ai` at a `"*"` semver range
- Must contain extension code as TypeScript files in a `packages/pi-<package-name-slug>/src/` directory.
- Must contain extension unit tests as TypeScript files in a `packages/pi-<package-name-slug>/test/` directory.

## Root Workspace

- The root workspace is named `pi-bakery`.
    - Keep tsconfig.json, vite.config.ts (configuration file for Vite Plus -- `vp`) in the root workspace `pi-bakery`.
    - Only add scripts to the `scripts` property of the root workspace's package.json file.
    - The `pi-bakery/.npmrc` in the root workspace configures flags to be passed to `npm` such that you only need to run the common commands below.

## How extensions are loaded by Pi

Extensions are loaded by pi using [jiti](https://github.com/unjs/jiti).
TypeScript is configured in `tsconfig.json` to NOT transpile to JavaScript, with `"noEmit": true`.

## Common commands

```bash
npm run lint
npm run lint:fix
```

## How-To: Create a new extension package

1. Create `packages/pi-<package-name-slug>/` with AT LEAST: `package.json`, `README.md`, `LICENSE`, `.npmignore` symlink that points to repo root's `.npmignore` file, `src/index.ts` file, `test/` dir.
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

## How-To: Publish one package

1. **Bump the version** — edit the `"version"` field in `packages/pi-<name>/package.json` directly, then run:

       npm install

   (This keeps the lockfile in sync.)

2. **Dry-run** to confirm only intended files are included:

       npm publish --workspace=@normful/pi-<name> --access public --dry-run

3. Confirm with user that they want to proceed.
4. **Publish** — ask the user to run this themselves (npm 2FA requires their session):

       npm publish --workspace=@normful/pi-<name> --access public

## How-To: Publish all packages

1. **Bump versions** — edit the `"version"` field in each package's `packages/pi-<name>/package.json`, then run:

       npm install

2. **Dry-run** to confirm:

       npm publish --workspaces --access public --dry-run

3. Confirm with user that they want to proceed.
4. **Publish all** — ask the user to run this themselves (npm 2FA requires their session):

       npm publish --workspaces --access public
