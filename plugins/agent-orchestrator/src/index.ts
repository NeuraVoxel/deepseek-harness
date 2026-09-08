/**
 * Agent Orchestrator plugin — Host half.
 *
 * Provides `ctx.agentOrchestrator` to build OrchestrationDocuments from the
 * agent-presets composition inventory. The browser half loads the same data
 * via `remote.pluginInventory.list` in F0 (no dedicated Typert Remote yet).
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-agent-presets'
import { fromPresetComposition } from './from-preset.ts'
import type { OrchestrationDocument } from './types.ts'

export type {
  OrchestrationConstraint,
  OrchestrationDocument,
  OrchestrationEnablement,
  OrchestrationFiberPhase,
  OrchestrationKindId,
  OrchestrationLayout,
  OrchestrationUnit,
  PresetCompositionInput,
  PresetCompositionRowInput,
} from './types.ts'
export { ORCHESTRATION_DOCUMENT_VERSION } from './types.ts'
export { fromPresetComposition, unitIdForRow, displayLabelForRow } from './from-preset.ts'
export {
  layoutByArchitecturalLayer,
  layoutComposition,
  statusForEnablement,
  styleForEnablement,
  toGraphDocument,
  type NodePaintStyle,
  type OrchestrationGraphLabels,
} from './to-graph.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host orchestration document service. */
    agentOrchestrator: AgentOrchestratorService
  }
}

/** Cordis plugin name. */
export const name = 'agent-orchestrator'

/** Agent presets roster required for composition inventory. */
export const inject = ['agentPresets']

/** Reserved for future Host tunables. */
export interface Config {}

/** Empty config object. */
export const Config: z<Config> = z.object({})

/**
 * Host service: on-demand orchestration documents from preset inventory.
 */
export class AgentOrchestratorService extends Service {
  /**
   * @param ctx - Host context with agentPresets.
   */
  constructor(ctx: Context) {
    super(ctx, 'agentOrchestrator')
  }

  /**
   * List orchestration documents for every readable preset.
   * @returns one document per inventory group.
   */
  async listDocuments(): Promise<OrchestrationDocument[]> {
    const inventory = await this.ctx.agentPresets.compositionInventory()
    return inventory.map(fromPresetComposition)
  }

  /**
   * Build one document for a preset id.
   * @param presetId - preset id; defaults to the deployment default when omitted.
   * @returns orchestration document.
   * @throws when the preset id is absent from inventory.
   */
  async document(presetId?: string): Promise<OrchestrationDocument> {
    const inventory = await this.ctx.agentPresets.compositionInventory()
    const wanted = presetId
      ?? inventory.find(preset => preset.isDefault)?.id
      ?? inventory[0]?.id
    if (wanted === undefined) {
      throw new Error('agent-orchestrator: no agent presets in inventory')
    }
    const found = inventory.find(preset => preset.id === wanted)
    if (found === undefined) {
      throw new Error(`agent-orchestrator: unknown preset ${wanted}`)
    }
    return fromPresetComposition(found)
  }
}

/**
 * Register the Host orchestration service.
 * @param ctx - Host context with agentPresets.
 */
export function apply(ctx: Context): void {
  ctx.plugin(AgentOrchestratorService)
}
