---
name: pre-push-checks
description: Use before pushing, force-pushing, marking ready for review, or claiming checks pass on any repository initialized with @neuravoxel/ai-eng, to select the smallest tests and checks that cover the outgoing diff without reflexively running the full repository suite.
---

# Pre-Push Checks

Use this skill to run relevant local evidence once before a push. Git hooks (when present) should stay narrow; CI owns exhaustive coverage and the platform matrix. Never claim that running the full suite by default is required locally.

## Inspect the outgoing change

1. Confirm the checkout and branch.

```sh
git status --short --branch
git rev-parse --show-toplevel
```

2. Identify the live PR base or merge target, fetch that ref when needed, and inspect the complete scope against it (`git diff <base>...HEAD`, plus staged/unstaged/untracked paths). After merging a changed base, reassess which behavior the combined scope can affect, and rerun only checks invalidated by the merge.

## Select relevant evidence

There is no universal local baseline beyond hooks the repository already defines. Every behavior change needs the narrowest available test or purpose-built check that would fail for its regression; add broader checks only for surfaces the diff actually reaches.

- **Package or script behavior:** run the owning Vitest (or equivalent) file or focused test name. Add adjacent package tests when a shared contract changes; leave repository-wide coverage to CI unless the change is genuinely cross-cutting or the user requests it.
- **Agent Notes under `.agents/notes/`:** run `ai-eng verify-notes .agents/notes` (or the package's `verify-notes` script).
- **This kit repository:** also run `pnpm run test:coverage` when `src/` changes, `pnpm run test:smoke` when CLI emit or `init` scaffolding changes, and `pnpm run test:pack-smoke` when `files` / `bin` / `exports` or pack layout changes.
- **Documentation or comments:** run the repository's documentation checks when it has them; otherwise review links and `git diff --check`.
- **Expected output:** owner-local expected fixtures live next to the owning test. A top-level snapshot tree is only for full product round-trips the consumer defines; this kit does not ship recorded-session replay.
- **Package manifests, public exports, build configuration, or built runtime paths:** run `pnpm run build` / `typecheck` and the owning built-artifact smoke when those scripts exist.
- **Real provider or agent behavior:** run the relevant e2e target when credentials are available; never print secrets.

Do not manually repeat a passing check merely because commit or push follows.

### Focus unit coverage on the affected source

Test selection and coverage selection are separate. A file filter chooses which tests run, while coverage configuration otherwise may measure every `src/**/*.ts` file. When unit coverage is relevant, name both the owning tests and the source files whose coverage those tests must prove. Prefer per-`src` coverage gates; see [testing-policy](../../../docs/testing-policy.md).

Do not use `--passWithNoTests`, lower coverage thresholds, or narrow coverage includes merely to hide an uncovered affected file.

## Full local rehearsal

Run the complete local approximation only when the user explicitly requests it, while diagnosing a CI failure, or when the change spans the repository so broadly that no narrower set is credible.

## Protect history-rewriting pushes

Before a history rewrite, fetch the current remote branch and record its exact OID; publish with `--force-with-lease=<branch>:<observed-oid>` so a concurrent update aborts the push. Raw `--force` is never allowed unless the user explicitly requests it.

After any rewritten push, fetch the live heads again and re-audit unresolved review threads, approvals, mergeability, and checks. Commit hashes and inline-comment anchors from before the rewrite are not current evidence.

## Handle failures

If a relevant check fails before an ordinary push, stop and fix or explain the blocker. Do not push and hope CI differs.

If a failure looks environment-specific, prove it:

- Record the exact command, failing test, and platform-specific mismatch.
- Confirm the relevant non-platform evidence.
- Prefer fixing cross-platform nondeterminism when the check is required.
- Bypass a local hook only when the user explicitly asks or agrees, and report exactly what failed and why CI is expected to differ.

## Push procedure

1. Run the selected relevant checks once.
2. Commit normally and inspect any files changed by a pre-commit fixer before continuing.
3. Push normally, or use the exact lease for an authorized rewritten branch.
4. Verify the remote ref matches local `HEAD`.

```sh
git rev-parse HEAD origin/$(git branch --show-current)
```

For GitHub PRs, inspect remote CI after the push (`gh pr checks`) and report pending checks as pending.
