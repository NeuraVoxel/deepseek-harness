/**
 * Map running tool names onto composition units and paint live highlight.
 */

import type { GraphDocument, GraphNode } from '@neuravoxel/aitopo'
import { displayLabelForRow } from './from-preset.ts'
import type { NodePaintStyle } from './to-graph.ts'
import type { OrchestrationUnit } from './types.ts'

/** Bright running paint (overrides enablement colors while the tool is in flight). */
export const LIVE_RUNNING_STYLE: NodePaintStyle = {
  fill: '#3b2410',
  stroke: '#f97316',
  labelColor: '#fff7ed',
  metaColor: '#fdba74',
}

/** Softer “used this turn” paint for tools that already returned. */
export const LIVE_TURN_STYLE: NodePaintStyle = {
  fill: '#2f1c0c',
  stroke: '#fb923c',
  labelColor: '#ffedd5',
  metaColor: '#fdba74',
}

/**
 * Explicit tool-name → package / entry leaf hints for common model tools.
 * Keys are normalized (`_` → `-`, lower-case).
 */
const TOOL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  bash: ['tool-bash', 'persistent-bash'],
  pwsh: ['tool-pwsh', 'persistent-pwsh'],
  read: ['tool-fs'],
  write: ['tool-fs'],
  edit: ['tool-fs'],
  'read-image': ['tool-fs'],
  glob: ['tool-fs-search'],
  grep: ['tool-fs-search'],
  'str-replace-editor': ['str-replace-editor', 'tool-str-replace-editor'],
  'web-search': ['tool-web'],
  'web-fetch': ['tool-web'],
  'todo-write': ['tool-todo'],
  'ask-user-question': ['tool-ask-user'],
  subagent: ['tool-subagent'],
  'subagent-fork': ['tool-subagent-fork'],
  'subagent-codex': ['tool-subagent-codex'],
  'subagent-claude-code': ['tool-subagent-claude-code'],
  workflow: ['tool-workflow'],
  ralph: ['tool-ralph'],
  skill: ['tool-skill'],
}

/**
 * Normalize a tool or entry token for matching.
 * @param value - raw tool name or entry leaf.
 */
export function normalizeToolToken(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-')
}

/**
 * Resolve composition unit ids that correspond to a running tool name.
 * @param units - composition units for the viewed preset.
 * @param toolName - model-facing tool name from tool/call.
 * @returns matching unit ids (may be empty when unknown).
 */
export function unitIdsForToolName(
  units: readonly OrchestrationUnit[],
  toolName: string,
): readonly string[] {
  const tool = normalizeToolToken(toolName)
  if (tool.length === 0) return []
  const aliases = new Set(TOOL_ALIASES[tool] ?? [])
  aliases.add(tool)
  aliases.add(`tool-${tool}`)

  const found: string[] = []
  for (const unit of units) {
    const leaf = normalizeToolToken(displayLabelForRow(unit.entryId, unit.moduleName))
    const mod = normalizeToolToken(unit.moduleName.replace(/^@deepseek-ai\/dsh-/, ''))
    if (
      aliases.has(leaf)
      || aliases.has(mod)
      || leaf === tool
      || mod === tool
      || mod === `tool-${tool}`
    ) {
      found.push(unit.id)
    }
  }
  return found
}

/**
 * Collect unit ids currently lit by live tool activity.
 * @param units - composition units.
 * @param runningToolNames - open tool names.
 */
export function liveUnitIds(
  units: readonly OrchestrationUnit[],
  runningToolNames: readonly string[],
): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const name of runningToolNames) {
    for (const id of unitIdsForToolName(units, name)) ids.add(id)
  }
  return ids
}

/**
 * Return a GraphDocument with live paint applied to matching nodes.
 * @param document - base composition graph.
 * @param runningIds - unit ids with tools still in flight.
 * @param turnIds - unit ids touched earlier in the running turn.
 */
export function withLiveActivity(
  document: GraphDocument,
  runningIds: ReadonlySet<string>,
  turnIds: ReadonlySet<string> = runningIds,
): GraphDocument {
  if (runningIds.size === 0 && turnIds.size === 0) return document
  const nodes: GraphNode[] = document.nodes.map(node => {
    if (runningIds.has(node.id)) {
      return {
        ...node,
        status: 'running',
        data: {
          ...(node.data ?? {}),
          ...LIVE_RUNNING_STYLE,
          meta: 'running',
          live: true,
        },
      }
    }
    if (turnIds.has(node.id)) {
      return {
        ...node,
        status: 'running',
        data: {
          ...(node.data ?? {}),
          ...LIVE_TURN_STYLE,
          meta: 'this turn',
          live: true,
        },
      }
    }
    return node
  })
  return { ...document, nodes }
}
