/**
 * Orchestration document types — plugin authority for composition projection.
 */

import type { ArchitecturalLayerId } from './architectural-layer.ts'

/** Schema version for {@link OrchestrationDocument}. */
export const ORCHESTRATION_DOCUMENT_VERSION = 1 as const

/** First kind: agent-preset composition rows. */
export type OrchestrationKindId = 'agent-preset-composition'

/** Effective enablement mirrored from inventory. */
export type OrchestrationEnablement = boolean | 'conditional'

/**
 * Root-fiber phase for a live composition row, or null when nothing is mounted.
 * Mirrors plugin-inventory's public vocabulary.
 */
export type OrchestrationFiberPhase =
  | 'pending'
  | 'loading'
  | 'active'
  | 'failed'
  | 'unloading'
  | null

/** One catalog or composition unit (never an agent-loop step). */
export interface OrchestrationUnit {
  /** Stable id within the document (preset row entry id or synthesized). */
  readonly id: string
  /** Composition row entry id, or null when the row declares none. */
  readonly entryId: string | null
  /** Module specifier the harness row names. */
  readonly moduleName: string
  /** Display label (defaults to moduleName). */
  readonly label: string
  /** Effective enablement. */
  readonly enabled: OrchestrationEnablement
  /** Optional !!js disabled expression text. */
  readonly condition?: string
  /** Root-fiber phase when known from inventory; omitted on Host file-only reads. */
  readonly fiberPhase?: OrchestrationFiberPhase
  /** When true, editor interactions must skip this unit (F1+). */
  readonly locked: boolean
  /** Wiki/011 architectural layer for grouped display. */
  readonly layer: ArchitecturalLayerId
  /** packages/<group> when resolved from moduleName; null when unknown. */
  readonly packageGroup: string | null
}

/** Optional dependency / exclusivity hook (unused in F0). */
export interface OrchestrationConstraint {
  readonly id: string
  readonly kind: string
  readonly memberIds: readonly string[]
}

/** Layout coordinates keyed by unit id. */
export interface OrchestrationLayout {
  readonly positions: Readonly<Record<string, { readonly x: number; readonly y: number }>>
}

/** Authoritative orchestration document (plugin-owned). */
export interface OrchestrationDocument {
  readonly version: typeof ORCHESTRATION_DOCUMENT_VERSION
  readonly meta: {
    readonly kind: OrchestrationKindId
    /** Preset id for agent-preset-composition. */
    readonly target: string
    readonly title?: string
    readonly trust?: 'system' | 'user'
    readonly isDefault?: boolean
    readonly broken?: string
  }
  /** Available units not necessarily on the composition canvas (empty in F0). */
  readonly catalog: readonly OrchestrationUnit[]
  /** Selected composition units for the target. */
  readonly composition: readonly OrchestrationUnit[]
  readonly constraints: readonly OrchestrationConstraint[]
  readonly layout?: OrchestrationLayout
}

/** Narrow inventory row input shared by Host presets and pluginInventory Remote. */
export interface PresetCompositionRowInput {
  readonly entryId: string | null
  readonly moduleName: string
  readonly enabled: OrchestrationEnablement
  readonly condition?: string
  /** Present on plugin-inventory Remote rows; absent on raw Host file reads. */
  readonly fiberPhase?: OrchestrationFiberPhase
}

/** Narrow preset group input for {@link fromPresetComposition}. */
export interface PresetCompositionInput {
  readonly id: string
  readonly trust: 'system' | 'user'
  readonly name?: string
  readonly isDefault: boolean
  readonly broken?: string
  readonly rows: readonly PresetCompositionRowInput[]
}
