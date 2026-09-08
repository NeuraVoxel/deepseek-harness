# `@neuravoxel/aitopo`

Canvas topology engine for AI graphs (fleet, flow, teams, custom kinds).

Humans and models share a versioned **Document / Patch / Events** protocol. Internally a lean Scene + View layer drives a pluggable **Renderer** (Canvas 2D first) with dirty-rect paint.

## Design

- Dual-face architecture and phase plan: [docs/2026-09-07-aitopo-design.md](docs/2026-09-07-aitopo-design.md)
- Implementation checklist: [docs/2026-09-07-aitopo-implementation-plan.md](docs/2026-09-07-aitopo-implementation-plan.md)
- Editor milestone (orchestrator): [docs/2026-09-08-aitopo-editor-requirements.md](docs/2026-09-08-aitopo-editor-requirements.md)

Design ideas come from `twaver.vector` in `vendor/SDK2D`. This package is a **clean-room** TypeScript rewrite: no SDK2D imports, no twaver public API names, and no Cordis sync procedure.

## Status

First-party library under `vendor/` (not an upstream pin). Engine + vanilla demo ship before `plugins/agent-observe` integration.

## Commands

```sh
pnpm install
pnpm --filter @neuravoxel/aitopo test
pnpm --filter @neuravoxel/aitopo demo
```

## Public API (summary)

```ts
import { Network, parseDocument, applyPatch } from '@neuravoxel/aitopo'

const network = new Network()
network.mount(el)
network.load(parseDocument(json))
network.apply(patch)
network.on(event => { /* GraphEvent */ })
network.destroy()
```

## Non-goals (current)

- React bindings (plugin adapter later)
- WebGL renderer (interface reserved)
- Overview / HTML node UI
- Copying or wrapping `vendor/SDK2D`

Editor interactions (node move, external drop, dashed groups, lock, marquee, undo policy) are specified in the [Editor requirements](docs/2026-09-08-aitopo-editor-requirements.md); they are not implemented in observation-grade Phase 1.

## Known Limitations and Deferred Work

- SubNetwork drill-down is single-level (root ↔ one child).
- Alarm badges cover display only; no propagation tree.
- Pan/zoom triggers full-frame invalidate; element edits use dirty-rect.
