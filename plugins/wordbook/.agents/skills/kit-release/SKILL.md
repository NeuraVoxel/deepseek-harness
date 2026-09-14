---
name: kit-release
description: >-
  Cuts a release of this repository when the user says 发版 / release / cut a
  version: bump the version authority, write the changelog cut, update version
  references, reconcile next-cut attributions, run the release checks, commit,
  and tag — all in one change. Push and publish stay separate approvals. Do not
  use for development commits; development never touches the version, the
  changelog, or version references.
---

# Kit Release

Cut one release of this repository. This skill states the baseline discipline; it is guidance, not a script. If this repository defines a release contract — an Agent Note under `.agents/notes/`, a `docs/` policy, or a release script — that contract wins over anything here, including where the version lives, the changelog format, and extra steps.

## Trigger and boundary

Cut only on the maintainer's explicit 发版 / release request in the current turn — never spontaneously after finishing a feature. Development commits carry code, tests, and notes only; if the working tree already contains version or changelog edits outside a release request, stop and report the conflict instead of building on it.

## What one cut carries

Exactly one change (one commit) does all of:

1. **Version bump** in the repository's version authority (for npm packages, `package.json`). Default to the semver step the unreleased changes justify; state the chosen version so the maintainer can correct it in the same turn.
2. **Changelog cut** — append a `## [<version>]` entry dated today covering everything since the previous tag (`git log v<prior>..HEAD --oneline` plus uncommitted release content). Fold away stray never-released version headings; the newest heading must match the version authority.
3. **Version references** — README statements, install commands, and docs examples that pin the released version move with the bump.
4. **Next-cut attributions** — notes and docs written during development may attribute shipped work to "next cut" (or 下一 cut); replace each with the released version.
5. **Tag** — annotated `v<version>` matching the version authority, created in the same change.

## Checks before the release commit

Run the repository's smallest relevant checks, and the full set the repo defines for releases when it defines one (a `prepublishOnly` script is the usual anchor). Any failure stops the cut; do not push and hope.

## Explicitly not part of the cut

- `git push` (branch and tag) — separate approval, then verify the remote tag matches local.
- Publishing to a registry — separate approval.
- Loosening gates or thresholds to make a failing cut pass.
