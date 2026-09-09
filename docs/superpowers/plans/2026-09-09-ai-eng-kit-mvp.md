# AI eng kit MVP Implementation Plan

English | [中文](2026-09-09-ai-eng-kit-mvp.zh.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up peer repo `NeuraVoxel/ai-eng-kit` shipping `@neuravoxel/ai-eng` with `init`, Agent Note format verification, three portable skills, and a testing-policy document.

**Architecture:** Single npm package (ESM). CLI bin `ai-eng` dispatches `init` and `verify-notes`. Gate logic is a portable subset of deepseek-harness `scripts/verify-agent-note-format.ts` + `scripts/agent-note-tree.ts` (no Cordis, no bilingual pairing, no archive freeze gate in MVP). Skills live under `skills/` and are copied into the consumer's `.agents/skills/` by `init`.

**Tech Stack:** Node `^22.19 \|\| >=24`, TypeScript, vitest, `tsx` for CLI during development, `tsdown` or `tsc` for publish build.

**Spec:** [../../.agents/notes/proposed/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md](../../.agents/notes/proposed/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md)

**Seed sources (read-only from deepseek-harness; copy then strip):**

- `scripts/agent-note-tree.ts`
- `scripts/verify-agent-note-format.ts`
- `.agents/notes/README.md` (format sections)
- `.agents/skills/dsh-prose-standard/SKILL.md`
- `.agents/skills/dsh-archive-agent-notes/SKILL.md` (or `.claude/skills/` twin)
- `.agents/skills/dsh-pre-push-checks/SKILL.md`

**Index:** [2026-09-09-peer-ai-eng-and-aitopo-index.md](./2026-09-09-peer-ai-eng-and-aitopo-index.md)

---

## File structure (kit repo)

```text
ai-eng-kit/
  package.json                 # name @neuravoxel/ai-eng, bin ai-eng
  tsconfig.json
  vitest.config.ts
  README.md
  AGENTS.md                    # standing orders for the kit repo itself
  docs/
    testing-policy.md          # coverage + fixture/snapshot conventions
    portable-vs-harness.md     # K1 checklist: what stays out of the kit
  templates/
    AGENTS.root.md
    notes/
      README.md                # Agent Note format (portable)
      proposed/.gitkeep
      implemented/.gitkeep
      rejected/.gitkeep
      archived/.gitkeep
  skills/
    prose-standard/SKILL.md
    archive-agent-notes/SKILL.md
    pre-push-checks/SKILL.md
  src/
    cli.ts
    init.ts
    agent-note-tree.ts
    verify-agent-note-format.ts
  tests/
    fixtures/notes/…           # minimal valid/invalid notes
    agent-note-format.spec.ts
    init.spec.ts
  .github/workflows/ci.yml
```

---

### Task 1: Create empty GitHub repo and local clone

**Files:** none in harness; remote `NeuraVoxel/ai-eng-kit`

- [ ] **Step 1: Create the private or internal repo on GitHub**

```bash
gh repo create NeuraVoxel/ai-eng-kit --private --description "Portable AI engineering toolkit (Agent Notes, skills, gates)"
```

Expected: repo URL `https://github.com/NeuraVoxel/ai-eng-kit` (or org-visible equivalent).

- [ ] **Step 2: Clone and verify empty**

```bash
git clone git@github.com:NeuraVoxel/ai-eng-kit.git ~/src/ai-eng-kit
cd ~/src/ai-eng-kit
git status
```

Expected: clean empty (or README-only) tree on `main`.

- [ ] **Step 3: Commit** — skip until Task 2 adds files.

---

### Task 2: Package skeleton + failing format test

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/agent-note-tree.ts`, `src/verify-agent-note-format.ts`, `tests/agent-note-format.spec.ts`, `tests/fixtures/notes/**`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@neuravoxel/ai-eng",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "ai-eng": "./lib/cli.js"
  },
  "exports": {
    ".": {
      "types": "./lib/index.d.ts",
      "default": "./lib/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": [
    "lib",
    "templates",
    "skills",
    "docs",
    "README.md",
    "AGENTS.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "ai-eng": "node --import tsx/esm src/cli.ts"
  },
  "engines": {
    "node": "^22.19.0 || >=24.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "tsx": "^4.19.3",
    "typescript": "~5.8.2",
    "vitest": "^3.0.9"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "lib",
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
  },
})
```

- [ ] **Step 4: Write failing test that expects a valid note tree to pass**

Create fixture:

`tests/fixtures/notes/proposed/architecture/2026-09-09-sample.md`:

```markdown
# Agent Note: Sample portable note

Status: proposed

## Problem

Consumers need a format gate that fails loud on missing sections.

## Proposal

Ship verify-notes in @neuravoxel/ai-eng.

## Alternatives considered

- Skip format gates: rejected — notes rot without a check.

## Acceptance criteria

- Invalid notes exit non-zero.

## Risks

- Over-fitting to harness bilingual rules: mitigate by omitting pairing in MVP.
```

Create `tests/agent-note-format.spec.ts`:

```ts
import { mkdtempSync, cpSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, afterEach } from 'vitest'
import { verifyAgentNoteFormat } from '../src/verify-agent-note-format.ts'

const fixtureRoot = fileURLToPath(new URL('./fixtures/notes', import.meta.url))
const temps: string[] = []

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('verifyAgentNoteFormat', () => {
  it('accepts a minimal proposed note tree', () => {
    const result = verifyAgentNoteFormat(fixtureRoot)
    expect(result.ok).toBe(true)
    expect(result.checked).toBeGreaterThanOrEqual(1)
  })

  it('rejects a proposed note missing ## Risks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-eng-notes-'))
    temps.push(dir)
    cpSync(fixtureRoot, dir, { recursive: true })
    const bad = join(dir, 'proposed/architecture/2026-09-09-bad.md')
    mkdirSync(join(dir, 'proposed/architecture'), { recursive: true })
    writeFileSync(bad, `# Agent Note: Bad

Status: proposed

## Problem

x

## Proposal

y

## Alternatives considered

- z: rejected.

## Acceptance criteria

- w
`)
    const result = verifyAgentNoteFormat(dir)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('## Risks'))).toBe(true)
  })
})
```

- [ ] **Step 5: Run test — expect FAIL (module missing)**

```bash
cd ~/src/ai-eng-kit
pnpm install
pnpm test
```

Expected: FAIL resolving `../src/verify-agent-note-format.ts` or `verifyAgentNoteFormat` not exported.

- [ ] **Step 6: Implement `src/agent-note-tree.ts` and `src/verify-agent-note-format.ts`**

Port the walker + format checks from harness `scripts/agent-note-tree.ts` and `scripts/verify-agent-note-format.ts` with these MVP changes:

1. Accept `notesRoot: string` instead of hard-coding `../.agents/notes`.
2. Export `verifyAgentNoteFormat(notesRoot): { ok: boolean; checked: number; errors: string[] }` (no `process.exit` inside the library function).
3. Skip `.zh.md` files (same as harness) but do **not** require Chinese counterparts.
4. Keep lifecycle/class sets identical: `proposed|implemented|rejected` × `feature|bug-fix|simplification|architecture|process|testing`, plus `archived/` ignored by the format gate in MVP.

Minimal export surface in `src/verify-agent-note-format.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { walkAgentNoteTree } from './agent-note-tree.ts'

// STATUS / REQUIRED / GRANDFATHER / LEGACY_MARKERS — copy from harness verify-agent-note-format.ts

export function verifyAgentNoteFormat(notesRoot: string): {
  ok: boolean
  checked: number
  errors: string[]
} {
  const { notes, errors } = walkAgentNoteTree(notesRoot)
  // …same per-note checks as harness, pushing into `errors`…
  return { ok: errors.length === 0, checked: notes.length, errors }
}
```

Adapt `walkAgentNoteTree(notesRoot: string)` accordingly.

- [ ] **Step 7: Re-run tests**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src tests pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat: Agent Note format gate with fixtures

Portable verifyAgentNoteFormat for consumer note trees.
EOF
)"
```

---

### Task 3: CLI `verify-notes` + `init`

**Files:**
- Create: `src/cli.ts`, `src/init.ts`, `src/index.ts`, `templates/**`, `tests/init.spec.ts`

- [ ] **Step 1: Write failing init test**

```ts
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { initProject } from '../src/init.ts'

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('initProject', () => {
  it('writes AGENTS.md, notes tree, skills, and package script hint', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-eng-init-'))
    temps.push(dir)
    initProject(dir)
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true)
    expect(existsSync(join(dir, '.agents/notes/README.md'))).toBe(true)
    expect(existsSync(join(dir, '.agents/skills/prose-standard/SKILL.md'))).toBe(true)
    expect(existsSync(join(dir, '.agents/skills/archive-agent-notes/SKILL.md'))).toBe(true)
    expect(existsSync(join(dir, '.agents/skills/pre-push-checks/SKILL.md'))).toBe(true)
    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8')
    expect(agents).toContain('Agent Note')
    expect(agents).not.toContain('deepseek-harness')
    expect(agents).not.toContain('cordis')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- tests/init.spec.ts
```

Expected: FAIL — `initProject` missing.

- [ ] **Step 3: Add templates**

`templates/AGENTS.root.md` (keep under ~40 lines):

```markdown
# AGENTS.md

Standing orders for AI-assisted work in this repository.

- Non-trivial changes add or update an Agent Note under `.agents/notes/` in the same change ([format](.agents/notes/README.md)).
- Registrations and durable decisions state contracts; do not leave reasoning transcripts in comments or docs.
- Prefer explicit resolve/default steps at package boundaries over hidden `??` inside run paths.
- Misconfiguration fails loud at the earliest resolvable point.
- Tests describe behavior, not "correctness."
- Run the smallest relevant checks before push (`ai-eng verify-notes` when notes change; package tests for code).

Product-specific runtime rules belong in this file only when this repository owns that runtime.
```

Copy format docs into `templates/notes/README.md` from harness `.agents/notes/README.md`, deleting harness-only links (website, `pnpm run doc-sync`, bilingual pairing requirements). Keep header/status/section rules identical to what the gate enforces.

Create empty lifecycle dirs with `.gitkeep` under `templates/notes/{proposed,implemented,rejected,archived}/`.

- [ ] **Step 4: Implement `initProject`**

```ts
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const kitRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Scaffold Agent Notes, AGENTS.md, and portable skills into `targetDir`.
 * @param targetDir Absolute or cwd-relative project root.
 */
export function initProject(targetDir: string): void {
  const root = targetDir
  mkdirSync(join(root, '.agents/notes'), { recursive: true })
  mkdirSync(join(root, '.agents/skills'), { recursive: true })
  writeFileSync(join(root, 'AGENTS.md'), readTemplate('templates/AGENTS.root.md'))
  cpSync(join(kitRoot, 'templates/notes'), join(root, '.agents/notes'), { recursive: true })
  for (const skill of ['prose-standard', 'archive-agent-notes', 'pre-push-checks']) {
    cpSync(join(kitRoot, 'skills', skill), join(root, '.agents/skills', skill), { recursive: true })
  }
  if (!existsSync(join(root, 'docs/testing-policy.md'))) {
    mkdirSync(join(root, 'docs'), { recursive: true })
    cpSync(join(kitRoot, 'docs/testing-policy.md'), join(root, 'docs/testing-policy.md'))
  }
}

function readTemplate(rel: string): string {
  return require('node:fs').readFileSync(join(kitRoot, rel), 'utf8')
}
```

Use `readFileSync` import instead of `require` in the real file.

- [ ] **Step 5: Implement `src/cli.ts`**

```ts
#!/usr/bin/env node
import { resolve } from 'node:path'
import { initProject } from './init.ts'
import { verifyAgentNoteFormat } from './verify-agent-note-format.ts'

const [cmd, ...rest] = process.argv.slice(2)

if (cmd === 'init') {
  initProject(resolve(rest[0] ?? '.'))
  console.log('ai-eng init: wrote AGENTS.md, .agents/notes, .agents/skills')
  process.exit(0)
}

if (cmd === 'verify-notes') {
  const root = resolve(rest[0] ?? '.agents/notes')
  const result = verifyAgentNoteFormat(root)
  if (!result.ok) {
    console.error('ai-eng verify-notes: violations:')
    for (const e of result.errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log(`ai-eng verify-notes: ${result.checked} note(s) ok`)
  process.exit(0)
}

console.error('Usage: ai-eng <init|verify-notes> [path]')
process.exit(2)
```

- [ ] **Step 6: Add three skills under `skills/`**

For each skill, copy from harness then strip:

| Kit skill dir | Seed | Strip |
|---|---|---|
| `prose-standard/` | `dsh-prose-standard` | Rename title; remove `vendor/` harness exclusions that assume Cordis; keep contract/Cot rules |
| `archive-agent-notes/` | `dsh-archive-agent-notes` | Point paths at `.agents/notes/`; drop harness gate script names or say `ai-eng verify-notes` |
| `pre-push-checks/` | `dsh-pre-push-checks` | Replace `pnpm run change-scope` / snapshot corpus rules with: run package tests + `ai-eng verify-notes` when `.agents/notes` changes; never claim "run full suite by default" |

Each `SKILL.md` description must say it applies to **any** repo initialized with `@neuravoxel/ai-eng`, not deepseek-harness only.

- [ ] **Step 7: Write `docs/testing-policy.md` and `docs/portable-vs-harness.md`**

`docs/testing-policy.md` must state:

1. Tests describe behavior, not correctness.
2. Prefer per-`src` coverage gates in CI (recipe: vitest `coverage.include: ['src/**']` + threshold; exact % is consumer-chosen; recommend starting at statements 90 for libraries).
3. Owner-local expected output lives next to the owning test; a top-level snapshot tree is only for full product round-trips the consumer defines.
4. Kit does **not** ship harness recorded-session replay.

`docs/portable-vs-harness.md` must list stay-out items: Session JSONL, Cordis vendor sync, `dsh` profiles, bilingual website gates.

- [ ] **Step 8: Pass tests + manual CLI smoke**

```bash
pnpm test
pnpm run ai-eng -- init /tmp/ai-eng-smoke && pnpm run ai-eng -- verify-notes /tmp/ai-eng-smoke/.agents/notes
```

Expected: tests PASS; init creates files; verify-notes exits 0 (empty tree may check 0 notes — if walker requires no unknown folders, empty lifecycle dirs only is ok; if `checked === 0` is allowed, document it).

Add one sample proposed note under the smoke tree if empty trees are rejected.

- [ ] **Step 9: Commit**

```bash
git add src templates skills docs tests
git commit -m "$(cat <<'EOF'
feat: ai-eng init and verify-notes CLI

Scaffold AGENTS, notes, and portable skills for peer repos.
EOF
)"
```

---

### Task 4: CI + README + kit self-hosting

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`, `AGENTS.md`
- Create: `.agents/notes/**` for the kit's own first process note

- [ ] **Step 1: Add CI workflow**

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
      - run: pnpm run ai-eng -- verify-notes .agents/notes
```

- [ ] **Step 2: Self-init the kit repo**

```bash
pnpm run ai-eng -- init .
# Keep the kit's richer README; restore README if init overwrote — init should NOT overwrite README.md (fix init if it does).
```

Ensure `initProject` never overwrites an existing `AGENTS.md` or `README.md` without `--force` (add flag if needed; default skip-existing for those two files). Re-run init test to assert skip behavior if you add it.

- [ ] **Step 3: Add kit Agent Note**

`.agents/notes/implemented/process/2026-09-09-ai-eng-kit-mvp.md` with Status implemented, Decision describing MVP scope, Alternatives, Consequences — mirrors the harness proposed note's kit portion in present tense for **this** repo.

- [ ] **Step 4: Write root README** (install, `init`, `verify-notes`, peer relationship with aitopo/harness, link `docs/portable-vs-harness.md`).

- [ ] **Step 5: Push**

```bash
git add .
git commit -m "chore: CI, README, and self-hosted Agent Notes"
git push -u origin main
```

Expected: GitHub Actions green.

---

## Part 1 acceptance

- [ ] `@neuravoxel/ai-eng` clones, `pnpm test` / `typecheck` / `verify-notes` pass on CI.
- [ ] `ai-eng init` works on an empty directory and installs three skills without harness/Cordis strings in `AGENTS.md`.
- [ ] `docs/portable-vs-harness.md` exists; no agent-loop/session code in the package.

**Stop here.** Hand off to [2026-09-09-aitopo-peer-repo-standup.md](./2026-09-09-aitopo-peer-repo-standup.md).
