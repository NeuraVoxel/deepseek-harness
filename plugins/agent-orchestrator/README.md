# agent-orchestrator

[中文](README.zh.md) | English

Opt-in plugin (**design only**): a Harness **orchestration framework**. The Orchestration Document is authoritative; [@neuravoxel/aitopo](../../vendor/aitopo) is the projected edit stage; commit adapters write existing composition artifacts (first kind: agent preset composition).

- Design: [docs/2026-09-08-agent-orchestrator-design.md](./docs/2026-09-08-agent-orchestrator-design.md)
- AITopo Editor requirements: [vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md](../../vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md)
- Sibling of [agent-canvas](../agent-canvas/README.md): canvas observes runtime; this plugin authors composition.

**No Host/Client implementation yet**; the design doc is the contract.

## Model Experience

No model-facing copy or tools at design time.
