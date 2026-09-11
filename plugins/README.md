# plugins/

English | [中文](README.zh.md)

Opt-in demos and local experiment packages that mount onto a shipped `dsh` profile. They are **not** product packages under `packages/`.

**Agent standing orders** (including: do not modify harness or `vendor/` source; AITopo needs go as requirements proposals to the peer repo; plugin-local kit Agent Notes for the `agent-observe` pilot) live in [AGENTS.md](AGENTS.md).

## Packages here

| Directory | Role |
|---|---|
| [hello-patch](hello-patch/README.md) | One-shot `--patch` example |
| [hello-bundle](hello-bundle/README.md) | Persistently installed bundle example |
| [agent-observe](agent-observe/README.md) | Observe tab (Session / Agent topology) |
| [agent-orchestrator](agent-orchestrator/README.md) | Orchestrator canvas experiment |
| [turn-cost](turn-cost/README.md) | Per-turn cost display |

Each package owns its README, build, and tests. Follow that package’s run instructions from the repository root.
