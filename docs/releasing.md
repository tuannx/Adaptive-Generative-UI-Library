# Releasing to npm

The `Publish` workflow (`.github/workflows/publish.yml`) publishes `packages/core`, `packages/react` and `packages/mcp`, in that
order, with [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC). There is no
`NPM_TOKEN` secret. The workflow builds, tests, typechecks and runs `verify-pack` first, and skips any
version that is already on npm, so a re-run after a partial failure is safe. Package names come from each
`package.json`, so changing the npm scope needs no workflow change.

It runs only when asked:

- **Tag:** push `vX.Y.Z` on the default branch. The tag must equal the version of at least one package
  (the packages are linked, so every package bumped in a release shares that version).
- **Manual:** Actions → Publish → Run workflow. `dry_run` is on by default (pack and check only); turn it
  off to publish.

## One-time setup

1. **First publish by hand.** npm's docs only describe adding a trusted publisher on an existing package's
   settings page, so each package has to exist before CI can publish it. On a machine logged in to npm as a member of the
   org that owns the scope, from a clean checkout of the default branch:

   ```bash
   npm ci && npm run build
   node scripts/publish-packages.mjs --dry-run
   node scripts/publish-packages.mjs
   ```

2. **Trusted publisher, once per package** (core, react, mcp): on npmjs.com open the package →
   Settings → Trusted Publisher → GitHub Actions, and enter:
   - Organization or user: `tuannx`
   - Repository: `Adaptive-Generative-UI-Library`
   - Workflow filename: `publish.yml`
   - Environment name: `npm`
   - Allowed actions: allow `npm publish` (newer configurations default to `npm stage publish` only)

   Each field is case-sensitive. A new configuration must publish successfully within 2 days, or it expires.

3. **Lock it down (optional):** package Settings → Publishing access → "Require two-factor authentication
   and disallow tokens". Trusted publishing keeps working. Revoke any npm tokens you no longer need.

4. **GitHub environment (optional):** the workflow runs in the `npm` environment, which GitHub creates on the
   first run. Add yourself as a required reviewer under Settings → Environments → npm to approve each publish.

## Each release

```bash
npm run version-packages   # applies .changeset/*.md: bumps versions, writes CHANGELOGs
git add -A && git commit -m "chore: release vX.Y.Z"   # -A also picks up new CHANGELOG.md files
```

Merge that through a PR, then push the tag on the merge commit (`git tag vX.Y.Z && git push origin vX.Y.Z`)
or start the workflow by hand.

## Notes

- **Provenance:** npm adds provenance automatically with trusted publishing, but not from a private
  repository. This repository is private, so packages publish without provenance until it is public.
- **`[skip ci]`:** GitHub skips push-triggered workflows when the pushed commit's message contains
  `[skip ci]`. Tag a commit without it (a PR merge commit), or use the manual run.
- **`repository.url`** in each `package.json` must point at this repository, or the OIDC publish fails.
