# Plan: Plugin-local kit Agent Notes (agent-observe pilot)

English | [中文](2026-09-11-plugin-local-kit-agent-notes.zh.md)

> **For agentic workers:** Execute tasks in order. Ship as one PR unless noted. Spec: [.agents/notes/implemented/process/2026-09-11-plugin-local-kit-agent-notes.md](../../.agents/notes/implemented/process/2026-09-11-plugin-local-kit-agent-notes.md).

**Goal:** `plugins/agent-observe` owns kit-shaped Agent Notes (`ai-eng verify-notes`); plugin-only PRs stop requiring root `.agents/notes/`; harness product gates stay K1 (no root kit dependency).

**Out of scope:** other plugins' scaffolds; moving historical root observe notes; root CI/`doc-sync` scanning `plugins/*/`; separate git repos.

## Task 1 — Add kit dep + init scaffold under observe

1. From repo root, add observe devDependency aligned with the workspace kit pin (prefer the same git tag aitopo/lockfile already resolve, e.g. `github:NeuraVoxel/ai-eng-kit#v0.1.6`):
   ```sh
   pnpm --filter dsh-agent-observe add -D github:NeuraVoxel/ai-eng-kit#v0.1.6
   ```
2. In `plugins/agent-observe/`:
   ```sh
   pnpm exec ai-eng init .
   ```
3. Confirm created (and **not** overwritten): `README.md` / `README.zh.md` untouched; new `AGENTS.md` with `<!-- ai-eng:begin -->` … `<!-- ai-eng:end -->`; `.agents/notes/` lifecycle dirs + notes README; `.agents/skills/`; `docs/testing-policy.md`.
4. After `<!-- ai-eng:end -->` in plugin `AGENTS.md`, add a short product section:
   - Pointer to [`../AGENTS.md`](../../plugins/AGENTS.md) (no edit `packages/` / `vendor/`).
   - Note home: non-trivial observe-only decisions → `.agents/notes/` (kit English); plugin-only PRs do not require root notes.
   - `docs/testing-policy.md` is advisory for note/process only; tests stay `pnpm --filter dsh-agent-observe test` / `typecheck`; kit ~90% coverage does not apply.
5. Add script to `plugins/agent-observe/package.json`:
   ```json
   "verify-notes": "ai-eng verify-notes .agents/notes"
   ```

**Verify:** `pnpm --filter dsh-agent-observe run verify-notes` exits 0 on the empty lifecycle tree.

## Task 2 — Plugin-local decision note (prove the gate)

1. Add `plugins/agent-observe/.agents/notes/implemented/process/2026-09-11-observe-kit-agent-notes.md` (kit format: English only; `Status: implemented`; Problem / Decision / Alternatives considered / Consequences).
2. Decision body: observe uses kit notes under this package; root bilingual notes remain for harness contracts; points at the root proposed/process note (relative path up to repo `.agents/notes/...`).
3. Do **not** add `.zh.md` / `.i18n.yaml` under the plugin tree.

**Verify:** `pnpm --filter dsh-agent-observe run verify-notes` still green.

## Task 3 — Document exemption at harness / plugins surface

1. `plugins/AGENTS.md` — add a short standing order: opted-in plugins may own kit `.agents/notes/`; pilot is `agent-observe`; plugin-only PRs write notes there and run that package's `verify-notes`; link the root proposed note.
2. `plugins/README.md` + `README.zh.md` — one bullet on note ownership / pilot.
3. Root `AGENTS.md` — **one** line under conventions or Agent Notes pointer: plugin-owned decisions for opted-in packages follow `plugins/AGENTS.md` (kit notes under the package); do not inflate the standing-order budget.
4. Optionally one sentence in `plugins/agent-observe/README.md` (+ `.zh.md`) under Notes.

**Verify:** `pnpm run verify-doc-budgets` if root `AGENTS.md` changed; `git diff --check` on staged docs.

## Task 4 — Promote root process note when scaffold ships

In the **same PR** as Tasks 1–3:

1. Move `.agents/notes/proposed/process/2026-09-11-plugin-local-kit-agent-notes.{md,zh.md,i18n.yaml}` → `implemented/process/`.
2. Rewrite EN/ZH: `Status: implemented`; `## Proposal` → present-tense `## Decision`; fold Acceptance criteria / Risks into `## Consequences` (and optional `## Testing` for the verify-notes command).
3. Re-record i18n: `pnpm run verify-translation-pairing --write` on the EN path.
4. Fix inbound links if any path broke (grep the basename).

**Verify:** `pnpm run verify-translation-pairing` on the pair; format gate for this file's lifecycle (full `verify-agent-note-format` may still fail on unrelated pre-existing notes — do not expand scope).

## Task 5 — Local evidence before push

```sh
pnpm --filter dsh-agent-observe run verify-notes
pnpm --filter dsh-agent-observe test
pnpm --filter dsh-agent-observe exec tsc -b --pretty false
```

Do not run full `doc-sync` unless Task 3/4 touch surfaces it owns beyond pairing.

## Done when

- [ ] Observe has kit tree + green `verify-notes` + one implemented process note in-plugin.
- [ ] Root / plugins docs state exemption and note-home table (or equivalent short form).
- [ ] Root process note is `implemented/` and bilingual-consistent.
- [ ] Root `package.json` still has no `@neuravoxel/ai-eng` for product gates.
