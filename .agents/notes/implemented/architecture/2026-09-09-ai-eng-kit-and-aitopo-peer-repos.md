# Agent Note: AI eng kit and aitopo peer repositories

Status: implemented

English | [中文](2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md)

## Problem

DeepSeek Harness had accumulated reusable AI engineering practice (Agent Notes, AGENTS standing orders, skills, documentation gates, and testing-engineering policy) trapped in this monorepo. `@neuravoxel/aitopo` lived as first-party sources under `vendor/aitopo`, which blocked independent iteration and forced Cordis-style vendor logging on a non-Cordis library.

## Decision

Three GitHub projects are full peers under K1 (cherry-pick only; no parent authority):

| Peer | Remote | Role |
|---|---|---|
| `ai-eng-kit` | `NeuraVoxel/ai-eng-kit` | Portable toolkit `@neuravoxel/ai-eng` (`init`, `verify-notes`, skills, testing-policy docs). |
| `aitopo` | `git@github.com:NeuraVoxel/aitopo.git` (private) | Canvas topology engine. Uses ai-eng-kit in its own CI/contributor workflow; no React/Cordis/`@deepseek-ai/dsh-*` in the engine. |
| `deepseek-harness` | this repository | Consumes aitopo only via `vendor/aitopo` git submodule (npm later). Does not depend on ai-eng-kit. Hosts future `agent-observe` adapters. |

`vendor/aitopo` is a submodule pin to `NeuraVoxel/aitopo`. Cordis sync does not apply. Engine edits happen in the peer repo; this tree bumps the submodule SHA. Clone with `--recurse-submodules` (or `git submodule update --init --recursive`).

This supersedes the in-tree first-party ownership choice in [2026-09-07-aitopo-dual-face-canvas-engine.md](../../proposed/architecture/2026-09-07-aitopo-dual-face-canvas-engine.md). Dual-face protocol, clean-room rule, and engine purity remain in force.

## Alternatives considered

- **Kit as copy-only template:** rejected — versions drift.
- **Kit as full starter monorepo:** rejected — overweight for a library consumer.
- **Harness depends on kit for its own gates (K2):** rejected — K1 keeps peers independent.
- **aitopo stays first-party under `vendor/` forever:** rejected — blocks independent cadence.
- **Harness consumes aitopo via npm from day one:** rejected — submodule preserves monorepo DX until API/release cadence stabilize.
- **React/Session adapters inside the aitopo repo:** rejected — engine purity.
- **Hierarchical extract under deepseek-harness org:** rejected — explicit NeuraVoxel peers.

## Consequences

- Harness contributors need submodule init; missing `vendor/aitopo/package.json` breaks `@neuravoxel/aitopo` resolution.
- While `vendor/aitopo` is a workspace member, `pnpm install` may resolve aitopo's locked `@neuravoxel/ai-eng` git pin; contributors and CI need read access to `NeuraVoxel/ai-eng-kit`. That install does not make harness use the kit for its own gates (K1).
- CI checkouts set `submodules: true` with repository secret `NEURAVOXEL_PRIVATE_READ_TOKEN` (read on private `aitopo` and `ai-eng-kit`) and run `scripts/ci-configure-private-git.sh` before `pnpm install`. The submodule URL is HTTPS so token checkout works.
- Process ideas can diverge between harness and kit; improve via occasional cherry-picks.
- `agent-observe` integration and npm publish of aitopo remain follow-ups.
- Plans live under `docs/superpowers/plans/2026-09-09-peer-ai-eng-and-aitopo-index.md`.
