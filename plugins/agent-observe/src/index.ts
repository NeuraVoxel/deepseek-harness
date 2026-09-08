/**
 * Agent Observe plugin — Host half.
 *
 * Provides `ctx.agentObserve` with a live topology snapshot (attached Sessions
 * + Agent status). The browser half derives a Client-side approximation from
 * session/workspace list hooks and registers the Canvas conversation tab.
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { buildLiveTopology } from './topology.ts'
import type { AgentObserveSnapshot } from './types.ts'

export type {
  AgentObserveEdge, AgentObserveGroupMode, AgentObserveNode, AgentNodeStatus,
  AgentObserveSnapshot,
} from './types.ts'
export { buildLiveTopology } from './topology.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host Agent Observe topology service. */
    agentObserve: AgentObserveService
  }
}

/** Cordis plugin name. */
export const name = 'agent-observe'

/** Sessions + agents registries required for topology. */
export const inject = ['sessions', 'agents']

/** Reserved for future Host tunables (refresh policy, Teams wiring). */
export interface Config {}

/** Empty config object. */
export const Config: z<Config> = z.object({})

/**
 * Host service: on-demand topology snapshots for tooling and future remotes.
 */
export class AgentObserveService extends Service {
  /**
   * @param ctx - Host context.
   */
  constructor(ctx: Context) {
    super(ctx, 'agentObserve')
  }

  /**
   * Build a fresh snapshot from live registries.
   * @returns topology nodes and edges.
   */
  snapshot(): AgentObserveSnapshot {
    return buildLiveTopology(this.ctx)
  }
}

/**
 * Register the Host topology service.
 * @param ctx - Host context with sessions and agents.
 */
export function apply(ctx: Context): void {
  ctx.plugin(AgentObserveService)
}
