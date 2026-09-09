# Agent Note: AI eng kit and aitopo peer repositories

Status: proposed

English | [中文](2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md)

## Problem

DeepSeek Harness has accumulated reusable AI engineering practice (Agent Notes, AGENTS standing orders, skills, documentation gates, and testing-engineering policy including coverage gates and fixture/snapshot conventions). That practice is trapped in this monorepo, so other products cannot adopt it without forking harness process code. Separately, `@neuravoxel/aitopo` already lives as a first-party tree under `vendor/aitopo` with a private home at `git@github.com:NeuraVoxel/aitopo.git`, but remaining inside the harness workspace blocks independent iteration and forces Cordis-style vendor logging on a non-Cordis library. The earlier [AITopo dual-face proposal](2026-09-07-aitopo-dual-face-canvas-engine.md) deliberately kept the engine in-tree; that ownership choice no longer matches the need for a peer product repo.

## Proposal

Treat three GitHub projects as **full peers** (no parent/child authority):

| Peer | Remote | Role |
|---|---|---|
| `ai-eng-kit` | `NeuraVoxel/ai-eng-kit` (planned) | Portable AI engineering toolkit: Agent Notes format + verify gates, AGENTS templates, installable skills, configurable doc gates, testing-engineering recipes (coverage gate pattern, fixture/snapshot *conventions*). Published as an installable package (e.g. `@neuravoxel/ai-eng`) with `init` + `verify-*`. |
| `aitopo` | `git@github.com:NeuraVoxel/aitopo.git` (private) | Canvas topology engine (`@neuravoxel/aitopo`). Consumes `ai-eng-kit` for agent workflow and testing policy. No React, Cordis, Session brands, or `@deepseek-ai/dsh-*` in the engine. |
| `deepseek-harness` | this repository | Agent product. Consumes aitopo only (not the kit, except optional cherry-picks under K1). Hosts `agent-observe` adapters that map Session snapshots to `GraphDocument` / patches. |

### Authority model (K1)

Each peer evolves on its own timeline. Improvements may be **cherry-picked** across peers when useful. No peer is the live source of truth for another's tree. Seeding `ai-eng-kit` from harness process files is a one-time (or occasional) export, not an ongoing upstream/downstream relationship.

### What enters `ai-eng-kit`

- Agent Notes lifecycle/class tree, uniform format, archive-freeze policy, and portable `verify-agent-note-format` (and related note gates).
- Root `AGENTS.md` / package `AGENTS.md` **templates** stripped of harness-only rules (session format, Cordis vendor sync, `dsh` profile launch, capability-seam vocabulary).
- Portable skills: prose standard, archive-notes, parameterized pre-push checks, code-review, optional trim-cot.
- Doc-gate skeleton: link check, configurable budgets, "current state / one home per fact" as documented policy.
- Testing engineering: behavior-test wording policy; per-`src` coverage gate **recipe**; owner-local expected output vs top-level snapshot **conventions**; a thin fixture-replay skeleton — **not** harness recorded-session profile replay.

### What stays only in deepseek-harness

- Agent-loop, Session JSONL, capability seams, Cordis vendor pins and sync procedure.
- `test:snapshot` recorded-session corpus and shipped-profile replay.
- Product-specific skills and gates (`verify-cordis-config`, bilingual website projection, `dsh-*` package rules).

### aitopo consumption of the kit

aitopo installs or submodules `ai-eng-kit`, runs its gates in CI, and keeps engine docs/tests under aitopo ownership. Session-driven UI snapshots remain a harness concern when `agent-observe` integrates.

### deepseek-harness consumption of aitopo (phased)

1. **Submodule (near term):** replace the in-tree first-party sources with a git submodule at `vendor/aitopo` pinned to `NeuraVoxel/aitopo` commits. Workspace/`tsconfig` paths keep resolving `@neuravoxel/aitopo` for local builds. `vendor/README.md` documents submodule upgrade steps instead of Cordis sync / first-party local-mod essays for engine changes.
2. **npm (later):** publish `@neuravoxel/aitopo` (private registry or restricted npm as org policy allows); harness depends on a semver range and retires the submodule.

### Migration outline

1. Stand up `NeuraVoxel/ai-eng-kit` with minimal `init` + notes gate + two or three portable skills + testing-policy docs.
2. Populate `NeuraVoxel/aitopo` from current `vendor/aitopo` (prefer history-preserving split; snapshot import acceptable if split cost is high), wire the kit, green CI.
3. In harness: swap `vendor/aitopo` to submodule; update workspace/tsconfig/third-party-notices/vendor README; keep typecheck/tests green.
4. Integrate `plugins/agent-observe` against the public Network/Patch API per [vendor/aitopo/docs/2026-09-07-aitopo-agent-observe-integration.md](../../../../vendor/aitopo/docs/2026-09-07-aitopo-agent-observe-integration.md) (path moves with the submodule).
5. When API and release cadence are stable, publish aitopo and switch harness to the registry dependency.

### Relationship to earlier aitopo notes

This proposal **supersedes** the "keep engine inside `vendor/aitopo` as first-party source" ownership decision in [2026-09-07-aitopo-dual-face-canvas-engine.md](2026-09-07-aitopo-dual-face-canvas-engine.md). Dual-face protocol, clean-room rule, and engine purity decisions remain in force. Editor and integration notes stay valid for product behavior; only repository ownership and harness wiring change.

## Alternatives considered

- **Kit as copy-only template:** rejected — versions drift; aitopo cannot upgrade gates/skills cleanly.
- **Kit as full starter monorepo:** rejected — overweight for a single library consumer.
- **Harness depends on kit for its own gates (K2):** rejected for now — forces a large harness migration; K1 cherry-pick keeps peers independent.
- **aitopo stays first-party under `vendor/` forever:** rejected — blocks independent iteration and misuses Cordis vendor process.
- **Harness consumes aitopo via npm from day one:** rejected — API and publish cadence are not stable yet; submodule preserves monorepo DX meanwhile.
- **Put React/Session adapters inside the aitopo repo:** rejected — violates engine purity and couples a graphics library to harness types.
- **ai-eng-kit under deepseek-harness org / hierarchical "extract from parent":** rejected — the three projects are explicit peers under NeuraVoxel (kit + aitopo) and harness as a sibling consumer of aitopo only.

## Acceptance criteria

- `NeuraVoxel/ai-eng-kit` exists with documented `init` and at least one executable notes (or doc) gate plus portable skills usable outside harness.
- `NeuraVoxel/aitopo` private remote builds, tests, and typechecks without the harness monorepo; kit wired into its agent workflow/CI.
- Harness `vendor/aitopo` is a submodule pin (or, after the later phase, a registry dependency) and `@neuravoxel/aitopo` still resolves for workspace consumers.
- No React/Cordis/`@deepseek-ai/dsh-*` dependencies inside the aitopo engine package.
- `vendor/README.md` (and related notices scripts) describe the peer/submodule (then npm) model; Cordis sync procedure remains inapplicable.
- Harness does not require `ai-eng-kit` as a runtime or gate dependency (K1); any reuse is explicit cherry-pick.
- A follow-up change records the dual-face note's ownership amendment (implemented rewrite or cross-link) when the submodule cut lands.

## Risks

- **Dual maintenance of process ideas (K1):** harness and kit can diverge; mitigate with occasional cherry-picks and a short "portable vs harness-only" checklist in the kit README.
- **Submodule DX friction:** contributors must init/update submodules; mitigate with README + CI guard that fails clearly on missing pin.
- **History loss on import:** snapshot import drops `vendor/aitopo` blame; prefer subtree/filter split when practical.
- **Premature npm publish:** unstable Patch/Events churn breaks harness; keep submodule until acceptance tests for observe integration exist.
- **Scope creep into product runtime extraction:** kit must not absorb agent-loop/session; mitigate with the explicit stay-in-harness list above.
