/** `agent-canvas` locale namespace. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'agent-canvas'

/** Simplified Chinese dictionary (key-set source of truth). */
export const zh = {
  'view.canvas': 'Canvas',
  'toolbar.group': '分组',
  'group.workspace': 'Workspace',
  'group.tree': '父子树',
  'group.teams': 'Agent Teams',
  'group.teams.unavailable': '当前未挂载 Agent Teams',
  'status.running': '运行中',
  'status.idle': '空闲',
  'status.cold': '冷会话',
  'legend.title': '状态',
  'empty': '暂无 Session',
  'ungrouped': '未分组',
  'hint.clientApprox': '客户端近似：非 running 记为 idle（含冷会话）',
}

/** English dictionary (same key set). */
export const en: Record<AgentCanvasKey, string> = {
  'view.canvas': 'Canvas',
  'toolbar.group': 'Group by',
  'group.workspace': 'Workspace',
  'group.tree': 'Parent tree',
  'group.teams': 'Agent Teams',
  'group.teams.unavailable': 'Agent Teams is not composed',
  'status.running': 'Running',
  'status.idle': 'Idle',
  'status.cold': 'Cold',
  'legend.title': 'Status',
  'empty': 'No sessions',
  'ungrouped': 'Ungrouped',
  'hint.clientApprox': 'Client approx: non-running shown as idle (includes cold)',
}

/** Union of this namespace's dictionary keys. */
export type AgentCanvasKey = keyof typeof zh
