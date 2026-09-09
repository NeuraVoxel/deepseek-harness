# Peer AI eng kit + aitopo — plan index

English | [中文](2026-09-09-peer-ai-eng-and-aitopo-index.zh.md)

> **For agentic workers:** Execute the three linked plans **in order**. Each plan is independently shippable. Do not start Part N+1 until Part N acceptance criteria pass. REQUIRED SUB-SKILL when implementing: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Spec:** [.agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md](../../.agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md)

**Peers (no parent authority, K1 cherry-pick only):**

| Order | Plan | Repo | Outcome |
|---|---|---|---|
| 1 | [2026-09-09-ai-eng-kit-mvp.md](./2026-09-09-ai-eng-kit-mvp.md) | `NeuraVoxel/ai-eng-kit` | Installable `@neuravoxel/ai-eng` with `init` + notes gate + portable skills + testing-policy docs |
| 2 | [2026-09-09-aitopo-peer-repo-standup.md](./2026-09-09-aitopo-peer-repo-standup.md) | `NeuraVoxel/aitopo` (`git@github.com:NeuraVoxel/aitopo.git`) | Engine builds/tests alone; kit wired; CI green |
| 3 | [2026-09-09-harness-aitopo-submodule.md](./2026-09-09-harness-aitopo-submodule.md) | `deepseek-harness` | `vendor/aitopo` → submodule pin; notices/README/Agent Notes updated |

**Explicitly out of these three plans (write follow-ups later):**

- `plugins/agent-observe` AITopoHost integration (existing design under `vendor/aitopo/docs/` / `docs/superpowers/specs/`).
- Publishing `@neuravoxel/aitopo` to npm and retiring the submodule.
- Making deepseek-harness depend on `ai-eng-kit` (forbidden under K1).

**Working directories during execution:**

```text
~/src/ai-eng-kit     # or any clone of NeuraVoxel/ai-eng-kit
~/src/aitopo         # clone of git@github.com:NeuraVoxel/aitopo.git
<this-repo>          # deepseek-harness
```

Do not implement kit or aitopo **inside** the harness tree except for the Part 3 submodule cut.
