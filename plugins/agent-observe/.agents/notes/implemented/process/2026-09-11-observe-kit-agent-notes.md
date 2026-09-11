# Agent Note: Observe package uses kit Agent Notes

Status: implemented

## Problem

`dsh-agent-observe` lives under `plugins/` as an opt-in package, but non-trivial observe decisions were still expected to land in the deepseek-harness root `.agents/notes/` tree. That mixed product and plugin process ownership and blocked taking observe decision history with the package later.

## Decision

This package owns kit-shaped Agent Notes under `.agents/notes/` (English single file). Contributors run `pnpm run verify-notes` (via `scripts/verify-notes.mjs` and `@neuravoxel/ai-eng`) when notes change. Plugin-only PRs that do not change `packages/` contracts do not require a root harness Agent Note.

Harness product contracts and cross-package process still use the root bilingual notes tree. The owning harness process record is [plugin-local kit Agent Notes](../../../../../.agents/notes/implemented/process/2026-09-11-plugin-local-kit-agent-notes.md).

Harness plugin standing orders remain in [plugins/AGENTS.md](../../../../AGENTS.md).

## Alternatives considered

- **Keep writing observe UX notes only under the harness root tree:** rejected — pollutes product notes and does not travel with the package.
- **Shared `plugins/.agents/` for every plugin:** rejected — harder to extract one package; this pilot is per-package.
- **Call the `ai-eng` bin directly from `package.json`:** rejected for this package — under pnpm symlinks the kit CLI's direct-run guard does not execute; the public `verifyAgentNoteFormat` API via `scripts/verify-notes.mjs` is the working gate.

## Consequences

- Observe maintainers follow kit note format here and harness bilingual notes only when a change also owns a harness contract.
- `docs/testing-policy.md` from kit init is advisory; package tests stay owner-local and outside the harness per-file 100% coverage gate.
