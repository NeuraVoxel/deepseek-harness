# dsh-agent-orchestrator — framework design

**Status:** approved design (2026-09-08)
**Package (planned):** `dsh-agent-orchestrator` under `plugins/agent-orchestrator/`
**Audience:** plugin authors; harness composition maintainers
**Graphics engine:** [`@neuravoxel/aitopo`](../../../vendor/aitopo/README.md)
**AITopo editor requirements:** [2026-09-08-aitopo-editor-requirements.md](../../../vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md)
**Related (observation only):** [`plugins/agent-canvas`](../../agent-canvas/README.md)

## Summary

`dsh-agent-orchestrator` is an opt-in Cordis plugin that provides an **editable orchestration surface** over DeepSeek Harness composition. The source of truth is an **Orchestration Document** owned by the plugin. AITopo renders and edits a projected `GraphDocument`. Commit adapters write harness artifacts (first: agent-preset composition). Industry templates and hospital pilots are out of scope for this design.

## Goals

1. Define a framework-level orchestration document, adapters, and Host/Client split independent of any vertical.
2. Edit composition units (plugin/tool/skill rows and config), not `agent-loop` steps.
3. Reuse existing harness hot-load semantics (preset standing mounts, blank-session select, live patch where configured); do not invent a second Loader.
4. Depend on AITopo public Network / Document / Patch / Events only; graph editor primitives are AITopo requirements, not plugin reimplementations.
5. Remain opt-in via patch / `dsh plugin`; stay out of shipped default profiles.

## Non-goals

- Vertical product flows (departments, hospitals, industry template content).
- Changing `packages/core/agent-loop` or treating Cordis plugins as ordered loop steps.
- Persisting orchestration through session-scoped dynamic Cordis.
- Implementing node drag, marquee, dashed groups, or undo inside the plugin.
- Merging with or replacing `agent-canvas` (runtime observation stays there).
- Installing new Host bundles without process restart (document the limit; do not fake it).

## Decisions

| Topic | Choice |
|---|---|
| Package home | `plugins/agent-orchestrator/` (npm name `dsh-agent-orchestrator`) |
| Authority | `OrchestrationDocument` in the plugin; AITopo holds display/edit projection only |
| First `OrchestrationKind` | `agent-preset-composition` |
| Relation to agent-canvas | Sibling plugins; canvas observes, orchestrator authors |
| Graph editing | Blocked on AITopo Editor milestone ([requirements](../../../vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md)) |
| Hot load | Commit uses existing preset / patch paths; no new process composition engine |

## Architecture

```
InventorySource(s) ──► OrchestrationDocument ──► CommitSink(s)
                              │
                              │ adapt (plain strings; no Session brands)
                              ▼
                         GraphDocument
                              │
                              ▼
                    AITopo Network (Client stage)
                              │
                    GraphEvent / GraphPatch
                              │
                              ▼
                    OrchestrationDocument (apply edit)
```

### OrchestrationDocument (conceptual)

Framework fields (exact TypeScript lands with implementation):

| Field | Role |
|---|---|
| `version` | Document schema version |
| `meta.kind` | `OrchestrationKind` id (e.g. `agent-preset-composition`) |
| `meta.target` | Kind-specific target (e.g. preset id) |
| `catalog[]` | Available units projected from inventory (not necessarily on canvas) |
| `composition[]` | Selected units + config snapshots + lock flags |
| `constraints[]` | Optional dependency / exclusivity hooks filled by kind logic |
| `layout?` | Optional UI positions; may be stored beside composition |

**Semantics:** a composition entry is one harness row the kind knows how to emit (tool row, persona, skill contribution, …). It is never an agent-loop step index.

### Extension points

| Hook | Responsibility |
|---|---|
| `OrchestrationKind` | Parse/validate document slice; map to/from GraphDocument; drive CommitSink |
| `InventorySource` | Read-only roster (default: agent-presets composition inventory) |
| `CommitSink` | Persist (default: preset directory write); report apply result |

Kinds register through Host effects. Misconfiguration fails at load or at the first resolvable commit, never by silent skip.

### Host / Client

| Plane | Owns |
|---|---|
| Host | Document store, inventory, validate, commit, version snapshots API, Remote methods |
| Client | Shell (toolbar, catalog tree, property panel), `AITopoHost`, event→document apply, locale copy |

Client must not paint topology chrome that substitutes for missing AITopo interactions.

### Commit and hot load

| Commit result | Harness behavior (existing) |
|---|---|
| Preset files updated | New sessions / new joiners see the new generation; already joined sessions keep the old standing generation |
| Blank session `select` | Allowed only before any turn |
| Profile/home `cordis.patch.yml` | Live reload only when the profile uses `patchReload: live` |
| Bundle add/remove | Requires process restart; orchestrator must surface this as unsupported for in-session commit |

Any model-visible consequence of a committed mode still requires session-log reconstructability per harness rules; UI-only layout does not.

## AITopo contract

Public API only: `Network.mount` / `load` / `apply` / `toJSON` / `on` / `destroy`, plus Document / Patch / Events.

Editable orchestration (drag into composition, lock, marquee, dashed composition band, undo) requires the AITopo Editor milestone. Until those APIs ship, the plugin may ship **read-only** projection (F0) and must not reimplement editor gestures in DOM/SVG overlays.

## Phasing

| Phase | Orchestrator | AITopo dependency |
|---|---|---|
| **F0** | Package scaffold, Host document + inventory→GraphDocument, Client read-only stage | Current Network (observation-grade) |
| **F1** | Edit apply + commit to preset draft/snapshot; property panel | Editor requirements AT-E1–E6; AT-E8 ownership as decided in the AITopo doc |
| **F2** | Additional kinds, richer constraints, optional edge semantics | AT-E7 and later as needed |

## Testing (framework expectations)

- Kind adapters: inventory → document → GraphDocument round-trip; invalid commit fails loud.
- CommitSink: writes expected preset rows; does not mutate `agent-loop`.
- Client: mount/destroy Network; no stacked RAF; feature-detect Editor interactions before enabling edit chrome.
- Product-visible GUI changes follow repository snapshot / GIF policy when the Canvas-facing UX ships.

## Risks

| Risk | Mitigation |
|---|---|
| Authors treat nodes as loop steps | Document + kind naming; no step-order sink |
| Plugin invents drag/undo ahead of AITopo | Hard rule in this design; block F1 on Editor APIs |
| Commit implies mid-turn preset swap | Sink returns structured limitation; UI offers new-session / blank-select only |
| Drift from agent-canvas AITopoHost | Share patterns by copy or later extract; do not put Cordis into AITopo |

## Open choices (not blockers)

- Exact snapshot directory layout for preset generations.
- Whether layout coordinates live inside `OrchestrationDocument` or a sibling UI store.
- Whether F0 Client tab is a conversation view sibling (like canvas) or a settings/admin route.
