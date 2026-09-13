/** `wordbook` locale namespace. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'wordbook'

/** Simplified Chinese dictionary (key-set source of truth). */
export const zh = {
  'card.model': '模型',
  'dock.action': '查询',
  'dock.placeholder': '添加单词…',
  'lookup.title': '单词',
  'lookup.created': '已入库',
  'lookup.existing': '已存在',
  'lookup.running': '查词中…',
  'lookup.failed': '查词失败',
  'query.empty': '词库里还没有匹配的单词',
  'query.failed': '查询失败',
  'query.matches': '{total} 个匹配',
  'query.running': '查询中…',
  'query.showing': '仅显示 {shown} 个',
  'query.title': '词库',
}

/** Every key this plugin's copy defines. */
export type WordbookKey = keyof typeof zh

/** English dictionary (same key set). */
export const en: Record<WordbookKey, string> = {
  'card.model': 'Model',
  'dock.action': 'Look up',
  'dock.placeholder': 'Add a word…',
  'lookup.title': 'Word',
  'lookup.created': 'Stored',
  'lookup.existing': 'Already stored',
  'lookup.running': 'Looking up…',
  'lookup.failed': 'Lookup failed',
  'query.empty': 'No stored word matched',
  'query.failed': 'Query failed',
  'query.matches': '{total} matches',
  'query.running': 'Searching…',
  'query.showing': 'showing {shown}',
  'query.title': 'Wordbook',
}
