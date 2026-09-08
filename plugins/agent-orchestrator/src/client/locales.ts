/** `agent-orchestrator` locale namespace. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'agent-orchestrator'

/** Simplified Chinese dictionary (key-set source of truth). */
export const zh = {
  'view.orchestrator': '编排',
  'toolbar.preset': 'Preset',
  'hint.readonly': '只读投影 · 编辑能力待 AITopo Editor',
  'hint.zoom': '滚轮缩放 · 拖动画布平移',
  'zoom.group': '缩放',
  'zoom.in': '放大',
  'zoom.out': '缩小',
  'zoom.reset': '100%',
  'zoom.fit': '适应',
  'group.composition': '组合',
  'empty': '该 Preset 无组合行',
  'broken': 'Preset 组合不可读',
  'error.load': '无法加载插件库存',
  'error.noPresets': '部署未暴露 agent preset 库存',
  'loading': '加载中…',
}

/** English dictionary (same key set). */
export const en: Record<AgentOrchestratorKey, string> = {
  'view.orchestrator': 'Orchestrate',
  'toolbar.preset': 'Preset',
  'hint.readonly': 'Read-only projection · editing waits on AITopo Editor',
  'hint.zoom': 'Scroll to zoom · drag canvas to pan',
  'zoom.group': 'Zoom',
  'zoom.in': 'Zoom in',
  'zoom.out': 'Zoom out',
  'zoom.reset': '100%',
  'zoom.fit': 'Fit',
  'group.composition': 'Composition',
  'empty': 'This preset has no composition rows',
  'broken': 'Preset composition is unreadable',
  'error.load': 'Failed to load plugin inventory',
  'error.noPresets': 'No agent preset inventory in this deployment',
  'loading': 'Loading…',
}

/** Dictionary key union. */
export type AgentOrchestratorKey = keyof typeof zh
