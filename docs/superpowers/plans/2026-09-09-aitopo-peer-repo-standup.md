# AITopo peer repo standup Implementation Plan

English | [中文](2026-09-09-aitopo-peer-repo-standup.zh.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Complete [ai-eng-kit MVP](./2026-09-09-ai-eng-kit-mvp.md) first.

**Goal:** Populate private `git@github.com:NeuraVoxel/aitopo.git` with the engine from deepseek-harness `vendor/aitopo`, make it build/test without the harness monorepo, and wire `@neuravoxel/ai-eng`.

**Architecture:** Snapshot or history-preserving import of `vendor/aitopo/{src,tests,fixtures,demo,docs,package.json,…}`. Replace `extends: ../../tsconfig.base.json` with a self-contained `tsconfig.json`. Add kit as a `devDependency` via git URL (MVP; npm later). CI runs `pnpm test`, `typecheck`, and `ai-eng verify-notes`.

**Tech Stack:** Existing aitopo stack (TypeScript, vitest, vite demo, zod) + `@neuravoxel/ai-eng` from `NeuraVoxel/ai-eng-kit`.

**Spec:** [../../.agents/notes/proposed/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md](../../.agents/notes/proposed/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md)

**Index:** [2026-09-09-peer-ai-eng-and-aitopo-index.md](./2026-09-09-peer-ai-eng-and-aitopo-index.md)

**Harness path to copy from:** `/home/jeff/Documents/AI/coding-agent/deepseek-harness/vendor/aitopo` (adjust if your clone differs).

---

## File structure after standup (aitopo repo root)

```text
aitopo/
  package.json              # still @neuravoxel/aitopo; + ai-eng scripts
  tsconfig.json             # NO extends into harness
  vitest.config.ts
  tsdown.config.ts          # keep if present; else tsc-only
  src/ …
  tests/ …
  fixtures/ …
  demo/ …
  docs/ …                   # existing design/plans stay
  README.md
  AGENTS.md                 # from ai-eng init (or merge)
  .agents/                  # from ai-eng init
  .github/workflows/ci.yml
  .gitignore                # node_modules, lib, demo dist
```

---

### Task 1: Clone remote and import tree

**Files:** entire aitopo working tree

- [ ] **Step 1: Clone the private remote**

```bash
git clone git@github.com:NeuraVoxel/aitopo.git ~/src/aitopo
cd ~/src/aitopo
git status
git log -1 --oneline || true
```

Expected: clone succeeds (empty or prior content). If the remote already has divergent history, stop and reconcile with the human before force-pushing.

- [ ] **Step 2: Prefer history-preserving split (try once)**

From the **harness** repo:

```bash
cd /home/jeff/Documents/AI/coding-agent/deepseek-harness
git subtree split -P vendor/aitopo -b aitopo-split
```

Expected: branch `aitopo-split` with only aitopo history. If this takes too long or fails, abandon and use Step 3 snapshot instead (document which path you took in the aitopo README).

If split succeeds:

```bash
cd ~/src/aitopo
git pull /home/jeff/Documents/AI/coding-agent/deepseek-harness aitopo-split --allow-unrelated-histories
# resolve conflicts favoring the split tree for src/tests
```

- [ ] **Step 3: Snapshot fallback (if split skipped)**

```bash
rsync -a --delete \
  --exclude node_modules --exclude lib --exclude .git \
  /home/jeff/Documents/AI/coding-agent/deepseek-harness/vendor/aitopo/ \
  ~/src/aitopo/
cd ~/src/aitopo
git add -A
git status
```

Expected: `src/`, `tests/`, `fixtures/`, `demo/`, `docs/`, `package.json`, configs present; no `node_modules`.

- [ ] **Step 4: Commit import**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: import @neuravoxel/aitopo engine sources

Peer repo seed from deepseek-harness vendor/aitopo.
EOF
)"
```

---

### Task 2: Standalone TypeScript + tests green

**Files:**
- Modify: `tsconfig.json`, `package.json`
- Create: `.gitignore` if missing

- [ ] **Step 1: Write failing standalone typecheck**

Replace `tsconfig.json` so it no longer extends harness:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "lib/types",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Ensure `.gitignore`**

```gitignore
node_modules/
lib/
dist/
*.tsbuildinfo
.DS_Store
demo/dist/
```

- [ ] **Step 3: Install and typecheck**

```bash
cd ~/src/aitopo
pnpm install
pnpm run typecheck
```

Expected: PASS. If `package.json` scripts still assume filter paths, fix scripts to local only:

```json
"scripts": {
  "test": "vitest run --config vitest.config.ts",
  "typecheck": "tsc -b || tsc -p tsconfig.json --noEmit",
  "demo": "vite --config demo/vite.config.ts",
  "verify-notes": "ai-eng verify-notes .agents/notes"
}
```

Use `tsc -p tsconfig.json --noEmit` if project references are gone.

- [ ] **Step 4: Run unit tests**

```bash
pnpm test
```

Expected: PASS (same suite as in harness vendor tree).

- [ ] **Step 5: Purity grep**

```bash
rg -n "cordis|@deepseek-ai/dsh-|from 'react'|from \"react\"" src package.json || true
```

Expected: no matches in `src/` or runtime `dependencies`. Dev-only vite is fine.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json package.json .gitignore
git commit -m "$(cat <<'EOF'
build: standalone tsconfig outside deepseek-harness

Engine typechecks and tests without monorepo base config.
EOF
)"
```

---

### Task 3: Wire ai-eng-kit

**Files:**
- Modify: `package.json`
- Create: `AGENTS.md`, `.agents/**`, optional `docs/testing-policy.md`

- [ ] **Step 1: Add kit as git/dev dependency**

```bash
cd ~/src/aitopo
pnpm add -D github:NeuraVoxel/ai-eng-kit#main
```

If the package name on disk is `@neuravoxel/ai-eng`, ensure `pnpm` links the bin. Alternative when kit is not yet published:

```json
"devDependencies": {
  "@neuravoxel/ai-eng": "github:NeuraVoxel/ai-eng-kit#main"
}
```

- [ ] **Step 2: Init (skip-existing for README)**

```bash
pnpm exec ai-eng init .
```

Expected: `.agents/notes`, `.agents/skills`, `AGENTS.md` present. Merge any conflicting README by hand — keep existing aitopo product README as authority; add a short "Agent workflow" section pointing at `AGENTS.md` and `pnpm run verify-notes`.

- [ ] **Step 3: Add first aitopo Agent Note**

Create `.agents/notes/implemented/architecture/2026-09-09-peer-repository.md`:

```markdown
# Agent Note: AITopo peer repository

Status: implemented

## Problem

The engine could not iterate independently while living only as first-party sources under deepseek-harness `vendor/aitopo`.

## Decision

`@neuravoxel/aitopo` develops in this private peer repository (`NeuraVoxel/aitopo`). Agent workflow uses `@neuravoxel/ai-eng`. deepseek-harness consumes this repo via git submodule (then npm). Engine purity (no React, Cordis, or `@deepseek-ai/dsh-*`) remains mandatory.

## Alternatives considered

- Remain first-party under harness `vendor/`: rejected — blocks independent release cadence.
- Depend on harness process gates directly: rejected — peers use ai-eng-kit under K1.

## Consequences

- Design docs under `docs/` stay in this repo.
- Session UI adapters stay in deepseek-harness `plugins/agent-observe`.
- Kit upgrades are explicit dependency bumps, not automatic harness sync.
```

- [ ] **Step 4: Verify notes + tests**

```bash
pnpm run verify-notes
pnpm test
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml AGENTS.md .agents docs
git commit -m "$(cat <<'EOF'
chore: wire @neuravoxel/ai-eng for Agent Notes and skills

Peer AI engineering workflow independent of deepseek-harness.
EOF
)"
```

---

### Task 4: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add workflow**

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: pnpm
      - run: pnpm install
      - run: pnpm run typecheck
      - run: pnpm test
      - run: pnpm run verify-notes
```

Private kit dependency: if `github:NeuraVoxel/ai-eng-kit` is private, add a checkout token / `pnpm` git auth (`GH_PACKAGES` or deploy key) in repo secrets before CI will pass. Document the required secret in README.

- [ ] **Step 2: Push and confirm CI**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: typecheck, test, and verify-notes"
git push -u origin main
gh run watch
```

Expected: workflow green (or documented auth fix applied).

---

## Part 2 acceptance

- [ ] `~/src/aitopo` builds and tests with no harness checkout on `NODE_PATH` / tsconfig paths.
- [ ] `ai-eng` skills + notes present; `verify-notes` passes.
- [ ] Purity grep clean; remote `NeuraVoxel/aitopo` updated.
- [ ] README states peer relationship and that deepseek-harness will submodule this repo.

**Stop here.** Hand off to [2026-09-09-harness-aitopo-submodule.md](./2026-09-09-harness-aitopo-submodule.md).
