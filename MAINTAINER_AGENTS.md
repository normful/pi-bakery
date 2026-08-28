# Guidelines for AI coding agents belonging to this monorepo's human maintainer

> [!IMPORTANT]
> If `echo $USER` outputs `norman`, the following guidelines apply.

## How-To: Create a new extension package

1. Create `packages/pi-<package-name-slug>/` with AT LEAST: `package.json`, `README.md`, `LICENSE` (copied from the repo root `LICENSE` via `cp LICENSE packages/pi-<package-name-slug>/LICENSE` — never hand-written), `.npmignore` symlink that points to repo root's `.npmignore` file, `src/index.ts` file, `test/` dir.
2. Use `@normful/pi-<package-name-slug>` as the npm package name
3. In the new package.json, include:

```json
"pi": {
  "extensions": [
    "./src/index.ts"
  ],
  "image": "https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/<package-name-slug>.png"
}
```

4. The `pi.image` URL points to `screenshots/<package-name-slug>.png` in the repo root `screenshots/` directory, matching the convention used by every existing package. If you don't have a screenshot yet, keep the field as a placeholder and add the PNG later.
5. Run `npm run lint:fix`

## Monorepo README conventions

For the top level `README.md`:

- Most content should be screenshots.
- Be ULTRA concise, avoid writing any text. If it can be demonstrated by a screenshot, suggest the user to produce one.

## Package README conventions

For each `packages/pi-<package-name-slug>/README.md`, write drafts using these guidelines:

- **Installation** — show `pi install npm:@normful/pi-<name>` (not `npm install`).
- **Commands** — document with a leading slash: `/command-name`.
- **No Keywords section** — keywords belong in `package.json` only.
- **No filler** — don't state the obvious (e.g., "the extension loads automatically when declared in your Pi configuration"). Keep it terse.

## How-To: Publish one package

1. **Bump the version** — edit the `"version"` field in `packages/pi-<name>/package.json` directly, then run:

       npm install

   (This keeps the lockfile in sync.)

2. **Dry-run** to confirm only intended files are included:

       npm publish --workspace=@normful/pi-<name> --access public --dry-run --loglevel=info

   (The root `.npmrc` silences npm output, so pass `--loglevel=info` explicitly or the tarball listing won't print.)

3. Confirm with user that they want to proceed.
4. **Login** — if the user isn't already logged into npm, ask them to run `npm login` first.
5. **Publish** — ask the user to run this themselves (npm 2FA requires their session):

       npm publish --workspace=@normful/pi-<name> --access public

6. **Verify** — confirm it's on the registry (note: `npm view` may return false 404 — fall back to `curl`):

       curl -s https://registry.npmjs.org/@normful%2fpi-<name> | grep -o '"latest":"[^"]*"'

## How-To: Publish all packages

1. **Bump versions** — edit the `"version"` field in each package's `packages/pi-<name>/package.json`, then run:

       npm install

2. **Dry-run** to confirm:

       npm publish --workspaces --access public --dry-run --loglevel=info

   (The root `.npmrc` silences npm output, so pass `--loglevel=info` explicitly or the tarball listing won't print.)

3. Confirm with user that they want to proceed.
4. **Login** — if the user isn't already logged into npm, ask them to run `npm login` first.
5. **Publish all** — ask the user to run this themselves (npm 2FA requires their session):

       npm publish --workspaces --access public --loglevel=info

6. **Verify** — for each package, confirm the published latest tag. `npm view` may return a false 404 — fall back to `curl`:

       for pkg in packages/pi-*/; do
         name=$(grep '"name"' "$pkg/package.json" | sed 's/.*"name": "\(.*\)".*/\1/')
         encoded=$(echo "$name" | sed 's|/|%2f|g')
         ver=$(curl -s "https://registry.npmjs.org/$encoded" | grep -o '"latest":"[^"]*"')
         echo "$name → $ver"
       done

## How-To: Maintain package CHANGELOG.md files

Always read `.pi/skills/changelogs/SKILL.md` before updating `packages/pi-<package-name-slug>/CHANGELOG.md` files.

## How-To: Run `gh` CLI

The `~/.config/pi-bakery-coding-agent` file contains a previously created minimally scoped fine-graine
GitHub Personal Access Token.

For all `gh` CLI commands, invoke with an explicit `GH_TOKEN` from that file. Example:

```bash
GH_TOKEN=$(cat ~/.config/pi-bakery-coding-agent) gh pr view 6
```

### Forbidden `gh` commands

NEVER attempt any of these:

```bash
gh pr review --approve
gh pr merge
gh auth logout
gh auth login
```
