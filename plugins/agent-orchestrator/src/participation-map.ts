/**
 * Map Session event types and module hints onto composition units.
 */

import { displayLabelForRow } from './from-preset.ts'
import { normalizeToolToken } from './map-tool-activity.ts'
import type { OrchestrationUnit } from './types.ts'

/** Exact Session event type → participating package module names. */
const EXACT_EVENT_MODULES: Readonly<Record<string, readonly string[]>> = {
  'approval/asked': ['@deepseek-ai/dsh-user-approval'],
  'approval/decided': ['@deepseek-ai/dsh-user-approval'],
  'approval/policy': ['@deepseek-ai/dsh-user-approval'],
  'command/run': ['@deepseek-ai/dsh-commands'],
  'command/done': ['@deepseek-ai/dsh-commands'],
  'compaction/start': [
    '@deepseek-ai/dsh-compaction',
    '@deepseek-ai/dsh-compaction-basic',
    '@deepseek-ai/dsh-compaction-tool-result-pruner',
  ],
  'compaction/summary': [
    '@deepseek-ai/dsh-compaction',
    '@deepseek-ai/dsh-compaction-basic',
  ],
  'compaction/end': [
    '@deepseek-ai/dsh-compaction',
    '@deepseek-ai/dsh-compaction-basic',
  ],
  'compaction/prune': [
    '@deepseek-ai/dsh-compaction',
    '@deepseek-ai/dsh-compaction-tool-result-pruner',
  ],
  'hook/invoked': [
    '@deepseek-ai/dsh-hook-protocol',
    '@deepseek-ai/dsh-hooks-claude-code',
    '@deepseek-ai/dsh-hooks-codex',
  ],
  'hook/result': [
    '@deepseek-ai/dsh-hook-protocol',
    '@deepseek-ai/dsh-hooks-claude-code',
    '@deepseek-ai/dsh-hooks-codex',
  ],
  'llm/retry': ['@deepseek-ai/dsh-llm-retry'],
  'llm/retry-started': ['@deepseek-ai/dsh-llm-retry'],
  'plan/mode': ['@deepseek-ai/dsh-plan-mode'],
  'todo/write': ['@deepseek-ai/dsh-tool-todo'],
}

/**
 * Resolve package module names implicated by one Session event type.
 * Unknown types return an empty list (never invent participation).
 * @param eventType - durable Session event type string.
 * @returns module specifiers to match against composition units.
 */
export function modulesForEventType(eventType: string): readonly string[] {
  return EXACT_EVENT_MODULES[eventType] ?? []
}

/**
 * Collect composition unit ids whose module or entry leaf matches any hint.
 * @param units - composition units for the viewed preset.
 * @param moduleNames - package module names from event participation.
 * @returns matching unit ids.
 */
export function unitIdsForModules(
  units: readonly OrchestrationUnit[],
  moduleNames: readonly string[],
): ReadonlySet<string> {
  const hints = new Set<string>()
  for (const name of moduleNames) {
    const normalized = normalizeToolToken(name)
    if (normalized.length === 0) continue
    hints.add(normalized)
    hints.add(normalizeToolToken(name.replace(/^@deepseek-ai\/dsh-/, '')))
  }
  if (hints.size === 0) return new Set()

  const found = new Set<string>()
  for (const unit of units) {
    const leaf = normalizeToolToken(displayLabelForRow(unit.entryId, unit.moduleName))
    const mod = normalizeToolToken(unit.moduleName)
    const short = normalizeToolToken(unit.moduleName.replace(/^@deepseek-ai\/dsh-/, ''))
    if (hints.has(mod) || hints.has(short) || hints.has(leaf)) found.add(unit.id)
  }
  return found
}
