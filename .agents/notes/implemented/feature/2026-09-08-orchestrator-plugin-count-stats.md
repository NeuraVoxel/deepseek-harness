# Agent Note: Orchestrate toolbar Preset vs Host-loaded counts

Status: implemented

English | [中文](2026-09-08-orchestrator-plugin-count-stats.zh.md)

## Problem

Operators opening Orchestrate could not see at a glance how many plugins belonged to the selected Preset versus how many Host-loaded plugins sat outside that Preset, especially when the Host catalog was hidden on the canvas.

## Decision

Toolbar shows a read-only locale line **This Preset {composition} · Host-loaded {catalog}** (zh: **本 Preset … · 宿主已加载 …**) after the Preset select. Counts come from `pluginCountsFromDocument(orchestrationDoc)` — full `composition.length` / `catalog.length` for the selected Preset — and do not follow `documentForCanvas` / the Show Host-loaded checkbox. Spec: [`docs/superpowers/specs/2026-09-08-orchestrator-plugin-count-stats-design.md`](../../../../docs/superpowers/specs/2026-09-08-orchestrator-plugin-count-stats-design.md). Related: [Host catalog visibility toggle](2026-09-08-orchestrator-host-catalog-visibility-toggle.md).

## Alternatives considered

- **Count only visible canvas nodes** — rejected; operators still need Host-loaded totals when the catalog is hidden.
- **Session / Global product copy** — rejected; reuse existing Preset / Host-loaded vocabulary.
- **Separate stats row under the toolbar** — rejected; inline muted text matches the existing toolbar density.

## Consequences

- README states that toolbar counts use the full inventory document and are independent of the canvas checkbox.
- Live highlight and detail panel are unchanged.

## Testing

- `pnpm --filter dsh-agent-orchestrator exec vitest run` (`plugin-counts` asserts full-document counts vs hidden canvas catalog).
- `pnpm --filter dsh-agent-orchestrator bundle`.
