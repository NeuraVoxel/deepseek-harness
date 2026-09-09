# Harness aitopo submodule cut Implementation Plan

English | [中文](2026-09-09-harness-aitopo-submodule.zh.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Complete [aitopo peer standup](./2026-09-09-aitopo-peer-repo-standup.md) first so `NeuraVoxel/aitopo` `main` is green.

**Goal:** In deepseek-harness, replace in-tree `vendor/aitopo` sources with a git submodule pinned to `git@github.com:NeuraVoxel/aitopo.git`, update vendor docs/notices, and record Agent Note ownership change — without depending on `ai-eng-kit` (K1).

**Architecture:** `vendor/*` remains a pnpm workspace glob. A submodule at `vendor/aitopo` still exposes `package.json` name `@neuravoxel/aitopo`, so `link:` / workspace resolution and `tsconfig` paths keep working. Cordis sync procedure stays inapplicable. First-party local-mod essays for aitopo editor changes are removed in favor of "bump submodule SHA" instructions.

**Tech Stack:** git submodule, existing pnpm workspace, harness doc/notice gates.

**Spec:** [../../.agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md](../../.agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md)

**Index:** [2026-09-09-peer-ai-eng-and-aitopo-index.md](./2026-09-09-peer-ai-eng-and-aitopo-index.md)

**Working tree:** `/home/jeff/Documents/AI/coding-agent/deepseek-harness`

---

### Task 1: Preflight — remote SHA and clean tree

**Files:** none yet

- [ ] **Step 1: Record the aitopo commit to pin**

```bash
git -C ~/src/aitopo fetch origin
git -C ~/src/aitopo rev-parse origin/main
```

Write down the SHA as `AITOPO_SHA`.

- [ ] **Step 2: Confirm harness is clean on a working branch**

```bash
cd /home/jeff/Documents/AI/coding-agent/deepseek-harness
git status --short --branch
git checkout -b chore/aitopo-submodule
```

Expected: no unrelated dirty files (or stash them). Commit the already-written proposed Agent Note / plans on this branch first if they are still unstaged:

```bash
git add \
  .agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md \
  .agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md \
  .agents/notes/proposed/architecture/2026-09-07-aitopo-dual-face-canvas-engine.md \
  .agents/notes/proposed/architecture/2026-09-07-aitopo-dual-face-canvas-engine.zh.md \
  docs/superpowers/plans/2026-09-09-*.md
git commit -m "$(cat <<'EOF'
docs: peer ai-eng-kit and aitopo extraction plans

Record K1 peer design and phased submodule cut.
EOF
)"
```

---

### Task 2: Remove in-tree sources and add submodule

**Files:**
- Delete: tracked files under `vendor/aitopo/**` (via git rm)
- Create: `.gitmodules` entry, submodule checkout at `vendor/aitopo`

- [ ] **Step 1: Remove the tracked first-party tree**

```bash
cd /home/jeff/Documents/AI/coding-agent/deepseek-harness
# Keep a local backup tarball outside the repo in case of mistakes:
tar -C vendor -czf /tmp/aitopo-vendor-backup.tgz aitopo
git rm -r vendor/aitopo
```

Expected: `vendor/aitopo` staged for deletion; backup at `/tmp/aitopo-vendor-backup.tgz`.

- [ ] **Step 2: Add submodule**

```bash
git submodule add git@github.com:NeuraVoxel/aitopo.git vendor/aitopo
cd vendor/aitopo && git checkout "$AITOPO_SHA" && cd ../..
git add vendor/aitopo .gitmodules
```

If `git submodule add` fails because the directory exists, ensure Step 1 fully removed it (including untracked residue):

```bash
rm -rf vendor/aitopo
git submodule add git@github.com:NeuraVoxel/aitopo.git vendor/aitopo
```

- [ ] **Step 3: Verify package identity**

```bash
node -e "console.log(require('./vendor/aitopo/package.json').name)"
test -f vendor/aitopo/src/index.ts && echo ok-src
```

Expected: `@neuravoxel/aitopo` and `ok-src`.

- [ ] **Step 4: Do not commit yet** — docs/tests update in Task 3 first (same commit preferred).

---

### Task 3: Update vendor README, notices expectations, development docs

**Files:**
- Modify: `vendor/README.md`
- Modify: `scripts/gen-third-party-notices.spec.ts` (only if assertions change)
- Modify: `docs/development.md` and/or `docs/development.zh.md` if clone instructions omit submodules
- Modify: `.gitmodules` already staged

- [ ] **Step 1: Rewrite the First-party libraries table row for aitopo**

In `vendor/README.md`, replace the first-party blurb so aitopo is a **submodule pin**, not an in-tree first-party source. Example table row:

```markdown
| Directory | npm name | Role |
|---|---|---|
| `aitopo/` | `@neuravoxel/aitopo` | Git submodule → `NeuraVoxel/aitopo` (private peer). Clean-room Canvas topology engine. Not a Cordis pin; do not run the Cordis sync procedure. Upgrade by bumping the submodule commit (see below). |
```

Remove or archive local-modification log entries **20–29** that narrate in-tree aitopo editor history (those commits now live in the aitopo peer repo). Keep Cordis local-mod items 1–19 unchanged.

Add an **Upgrading aitopo** subsection:

```markdown
## Upgrading aitopo (submodule)

1. `cd vendor/aitopo && git fetch origin && git checkout <sha> && cd ../..`
2. `git add vendor/aitopo`
3. Run `pnpm install && pnpm --filter @neuravoxel/aitopo test` (and any harness consumer tests that import the engine).
4. Commit the submodule pointer bump in deepseek-harness. Do not edit engine sources inside this monorepo except via the peer repo.
```

- [ ] **Step 2: Keep first-party parser recognition**

`parseFirstPartyVendorDirs` must still treat `aitopo` as first-party (not a Cordis pin). The existing test:

```ts
expect(parseFirstPartyVendorDirs(readme).has('aitopo')).toBe(true)
```

must keep passing — adjust README wording, not the classification, unless the parser key format changes.

- [ ] **Step 3: Submodule clone note**

If `docs/development.md` clone instructions lack submodules, add one line:

```markdown
Clone with submodules: `git clone --recurse-submodules <url>` (or `git submodule update --init --recursive` after clone). `vendor/aitopo` is required for workspace resolution of `@neuravoxel/aitopo`.
```

Update the Chinese counterpart in the same change.

- [ ] **Step 4: Optional CI guard**

Add a cheap check script or CI step that fails if `vendor/aitopo/package.json` is missing:

```bash
test -f vendor/aitopo/package.json || { echo 'vendor/aitopo submodule missing; run git submodule update --init'; exit 1; }
```

Wire it where harness already validates workspace layout (prefer an existing hygiene or boot smoke entry point; do not invent a second notices system).

---

### Task 4: Agent Notes lifecycle update

**Files:**
- Modify: `.agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md` (+ `.zh.md`) → move to `implemented/` with Decision rewrite
- Modify: `.agents/notes/proposed/architecture/2026-09-07-aitopo-dual-face-canvas-engine.md` (+ `.zh.md`) ownership lines already cross-linked; ensure they point at the implemented peer note after the move

- [ ] **Step 1: Move peer-repos note to implemented**

```bash
git mv \
  .agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md \
  .agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md
git mv \
  .agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md \
  .agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md
```

Rewrite English body: `Status: implemented`; replace `## Proposal` / `## Acceptance criteria` / `## Risks` with `## Decision` + `## Consequences` in present tense (what shipped: submodule pin, peers, K1). Keep `## Alternatives considered`. Mirror structure in `.zh.md`.

- [ ] **Step 2: Fix inbound links**

```bash
rg -n '2026-09-09-ai-eng-kit-and-aitopo-peer-repos' .agents docs
```

Update paths from `proposed/` to `implemented/` where needed.

- [ ] **Step 3: Run note format gate**

```bash
pnpm run verify-agent-note-format
```

Expected: PASS.

---

### Task 5: Install, typecheck, focused tests, commit

- [ ] **Step 1: Reinstall workspace**

```bash
pnpm install
```

Expected: `@neuravoxel/aitopo` resolves via workspace to `vendor/aitopo`.

- [ ] **Step 2: Filter tests + typecheck path**

```bash
pnpm --filter @neuravoxel/aitopo test
pnpm run typecheck
pnpm exec vitest run scripts/gen-third-party-notices.spec.ts
```

Expected: all PASS. If no package currently depends on aitopo yet, filter test still validates the submodule package.

- [ ] **Step 3: Commit submodule cut**

```bash
git add vendor/aitopo .gitmodules vendor/README.md docs .agents scripts
git commit -m "$(cat <<'EOF'
chore: consume NeuraVoxel/aitopo via vendor submodule

Replace in-tree first-party sources; peers stay on K1.
EOF
)"
```

- [ ] **Step 4: Document contributor one-liner in PR body**

```text
After pull: git submodule update --init --recursive
```

---

## Part 3 acceptance

- [ ] `vendor/aitopo` is a submodule at a known `NeuraVoxel/aitopo` SHA.
- [ ] `pnpm --filter @neuravoxel/aitopo test` and notices/format gates pass.
- [ ] `vendor/README.md` documents submodule upgrade; Cordis sync still excluded.
- [ ] Peer Agent Note is `implemented/`; harness does **not** add `@neuravoxel/ai-eng` dependency.
- [ ] Backup tarball `/tmp/aitopo-vendor-backup.tgz` can be deleted after the PR is merged and green.

---

## Deferred follow-ups (do not execute in this plan)

1. **agent-observe integration** — separate plan from [aitopo agent-observe integration spec](../specs/2026-09-07-aitopo-agent-observe-integration.md).
2. **npm publish of `@neuravoxel/aitopo`** — after observe acceptance tests exist; then replace submodule with semver dependency.
3. **Cherry-pick process improvements** harness ↔ kit under K1 — ad hoc, not a migration.
