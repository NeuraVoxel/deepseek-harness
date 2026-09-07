/** `turn-cost` locale namespace. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'turn-cost'

/** Simplified Chinese dictionary (key-set source of truth). */
export const zh = {
  'turn.trigger': '花费 {total}',
  'turn.title': 'Turn 花费（人民币）',
  'turn.route': '模型',
  'turn.input': '输入',
  'turn.cacheRead': '缓存读取',
  'turn.cacheWrite': '缓存写入',
  'turn.output': '输出',
  'session.line': '会话花费 {total}',
  'session.unpriced': '（{count} 个 Turn 未计价）',
}

/** English dictionary (same key set). */
export const en: Record<TurnCostKey, string> = {
  'turn.trigger': 'Cost {total}',
  'turn.title': 'Turn cost (CNY)',
  'turn.route': 'Model',
  'turn.input': 'Input',
  'turn.cacheRead': 'Cache read',
  'turn.cacheWrite': 'Cache write',
  'turn.output': 'Output',
  'session.line': 'Session {total}',
  'session.unpriced': '({count} turns unpriced)',
}

/** Union of this namespace's dictionary keys. */
export type TurnCostKey = keyof typeof zh
