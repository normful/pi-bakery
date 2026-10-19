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

## How-To: Audit for unpublished changes

A matching `version` does not mean a matching package: the tarball on the registry can lag the source under the same version. Diff the published tarball, not the version field.

1. Compare local versions against the registry, using `curl` rather than `npm view` (see the false-404 note under "Publish one package").
2. Unpack what is actually published and diff it against `src/`:

       npm pack @normful/pi-<name>
       tar -xzf normful-pi-<name>-<version>.tgz -C /tmp/pubcheck
       diff -rq /tmp/pubcheck/package/src packages/pi-<name>/src

3. Ignore three kinds of noise: `devDependencies` churn in `package.json`, files the root `.npmignore` excludes on purpose (`test/`, `AGENTS.md`), and `CHANGELOG.md` appearing locally but not in an older tarball.
4. Treat differing `src/` as a reason to publish. Treat byte-identical `src/` as a reason NOT to, even when `CHANGELOG.md` changed: that would be a version number with no code behind it.
5. A registry HTTP 404 for a package whose changelog already carries a version heading means that release never shipped. Fold that heading into the first real release instead of publishing a number above one nobody could install.

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

For contributor credit, see "Contributor credit" below.

## Contributor credit

Credit outside contributors inline in the changelog entry their change produced. Never collect credits into a separate `### Contributors` section: the credit belongs next to the change it describes. The full rule, including how to resolve a login, is in `.pi/skills/changelogs/SKILL.md` under "Crediting Outside Contributors".

- No credit for your own work, and none for `dependabot[bot]`.
- Name the GitHub login, not the name in the commit's `Author:` header.

## How-To: Attribute a changelog entry

A commit that edits `CHANGELOG.md` is not necessarily the commit that wrote the code: your own docs commit can record a fix authored elsewhere, and crediting it credits the wrong person.

1. Find candidate commits:

       git log --since=<last-release> --format='%h|%an|%ae|%s' -- packages/pi-<name>/CHANGELOG.md

2. See which entry each one introduced:

       git show --format='' <sha> -- packages/pi-<name>/CHANGELOG.md | grep '^+' | grep '^- '

3. Resolve the login, which may differ from the commit name:

       GH_TOKEN=$(cat ~/.config/pi-bakery-coding-agent) gh api repos/normful/pi-bakery/commits/<sha> --jq '.author.login'

4. Confirm against the code commit, not only the changelog commit, before adding a credit.

## Monorepo README contributors table

The top-level `README.md` carries a `## Contributors` avatar table for outside contributors only. The maintainer is excluded: the README already names them and every `package.json` sets `author`.

- One `<td align="center" valign="top" width="21.42%">` per person, holding a 100px avatar from `https://avatars.githubusercontent.com/u/<id>?v=4`, a bolded login linking to their profile, and a `<sub>` role line (e.g. `code, i18n`).
- Keep the table between `<!-- readme: contributors -start -->` and `<!-- readme: contributors -end -->` so a generator can rewrite the block later.
- Source the list from the GitHub contributors API, not from `git log`, which shows commit names rather than logins:

      GH_TOKEN=$(cat ~/.config/pi-bakery-coding-agent) gh api repos/normful/pi-bakery/contributors --jq '.[]|"\(.login) \(.contributions)"'

- Exclude bots. Adjust the `width` so the row is not half empty: `21.42%` for up to six people, `14.28%` for seven.

## How-To: Run `gh` CLI

The `~/.config/pi-bakery-coding-agent` file contains a previously created minimally scoped fine-graine
GitHub Personal Access Token.

For all `gh` CLI commands, invoke with an explicit `GH_TOKEN` from that file. Example:

```bash
GH_TOKEN=$(cat ~/.config/pi-bakery-coding-agent) gh pr view 6
```

### Forbidden commands

NEVER attempt any of these, whether or not they look harmless:

```bash
gh pr review --approve
gh pr merge
gh auth logout
gh auth login
git push --force
git push --force-with-lease
```

Force-pushing rewrites a branch's history and breaks review threads. To replace pushed work, create a new branch and push that instead; to correct a commit that is already pushed, add a forward commit. A rejected `--force-with-lease` (`stale info`) is not a prompt to retry harder.

## Running one package's tests

Pass the path, not a project filter:

```bash
npx vp test run packages/pi-<name>/
```

`npm test -- --project pi-<name>` fails with `No projects matched the filter "<name>"`, because the workspace projects are not named after the package directories.
