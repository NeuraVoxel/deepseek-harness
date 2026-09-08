/**
 * Demo: list plugins currently registered on a running `dsh web` Host.
 *
 * Calls the Host Remote `pluginInventory/list` (same surface as Settings →
 * Plugins) and prints a categorized inventory: Host Loader entries by
 * responsibility family, then each agent-preset composition.
 *
 * Prerequisites:
 *   1. Build + start Host:  `pnpm dsh web --no-open`
 *   2. Copy the printed URL: `dsh web: http://127.0.0.1:3080/?token=…`
 *
 * Run:
 *   node apps/api/list-host-plugins.mjs 'http://127.0.0.1:3080/?token=…'
 *   DSH_WEB_URL='http://…/?token=…' node apps/api/list-host-plugins.mjs
 *   node apps/api/list-host-plugins.mjs --group status 'http://…/?token=…'
 *   node apps/api/list-host-plugins.mjs --json 'http://…/?token=…'
 *
 * Flags:
 *   --group family   categorize Host rows by responsibility (default)
 *   --group status   categorize Host rows by enablement / fiber phase
 *   --json           print the raw PluginInventorySnapshot and exit
 */

import { randomUUID } from 'node:crypto'

/**
 * @typedef {{
 *   entryId: string
 *   moduleName: string
 *   enabled: boolean
 *   fiberPhase: string | null
 * }} PluginInventoryEntry
 *
 * @typedef {{
 *   entryId: string | null
 *   moduleName: string
 *   enabled: boolean | 'conditional'
 *   condition?: string
 *   fiberPhase: string | null
 * }} AgentPresetPluginRow
 *
 * @typedef {{
 *   id: string
 *   trust: 'system' | 'user'
 *   name?: string
 *   isDefault: boolean
 *   broken?: string
 *   rows: readonly AgentPresetPluginRow[]
 * }} AgentPresetPluginGroup
 *
 * @typedef {{
 *   entries: readonly PluginInventoryEntry[]
 *   agentPresets?: readonly AgentPresetPluginGroup[]
 * }} PluginInventorySnapshot
 */

/** Base spine entry ids (wiki/008 Framework / Core). */
const CORE_ENTRY_IDS = new Set([
  'timer', 'hmr', 'llm', 'session', 'agent', 'tools', 'system-prompt',
  'agent-loop', 'typert', 'typert-loader', 'typert-gateway',
])

/** Fixed display order for responsibility families. */
const FAMILY_ORDER = [
  'Framework / Core',
  'LLM / Credentials / Settings',
  'Session',
  'Sandbox / Shell / FS',
  'Tools / Agent / Product',
  'Presets / Roster',
  'Client / Web UI',
  'Other',
]

await main()

async function main() {
  const args = process.argv.slice(2)
  const jsonOnly = args.includes('--json')
  const groupFlag = args.includes('--group')
    ? args[args.indexOf('--group') + 1]
    : 'family'
  const launchUrl = args.find(a => a.startsWith('http')) ?? process.env.DSH_WEB_URL

  if (groupFlag !== 'family' && groupFlag !== 'status') {
    console.error(`Unknown --group ${JSON.stringify(groupFlag)} (use family|status)`)
    process.exit(1)
  }

  if (!launchUrl) {
    console.error(`Usage: node apps/api/list-host-plugins.mjs [--group family|status] [--json] 'http://127.0.0.1:3080/?token=…'`)
    console.error(`   or: DSH_WEB_URL='http://…/?token=…' node apps/api/list-host-plugins.mjs`)
    process.exit(1)
  }

  let hostOrigin
  let cookie
  try {
    hostOrigin = new URL(launchUrl).origin
    ;({ cookie } = await exchangeToken(launchUrl))
  } catch (error) {
    console.error('Failed to authenticate against dsh web:', error instanceof Error ? error.message : error)
    console.error('Start Host first: pnpm dsh web --no-open')
    process.exit(1)
  }

  console.error(`✓ Host cookie acquired for ${hostOrigin}`)
  console.error(`→ POST /api/pluginInventory/list`)
  console.error('')

  /** @type {PluginInventorySnapshot} */
  let snapshot
  try {
    snapshot = await remoteRpc(hostOrigin, cookie, 'pluginInventory/list', {})
  } catch (error) {
    console.error('pluginInventory/list failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }

  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`)
    return
  }

  printInventory(snapshot, groupFlag)
}

/** Token URL → HttpOnly session cookie (same as apps/api/web-host-comm.mjs). */
async function exchangeToken(url) {
  const response = await fetch(url, { redirect: 'manual' })
  const setCookie = response.headers.get('set-cookie')
  if (response.status !== 303 || setCookie === null) {
    throw new Error(`token exchange failed: HTTP ${response.status} (is dsh web running?)`)
  }
  return { cookie: setCookie.split(';', 1)[0] }
}

/**
 * Unary Remote POST — mirrors web-host-comm.html / smoke-real.e2e.
 * @param {string} origin
 * @param {string} authCookie
 * @param {string} endpoint
 * @param {object} rpcArgs
 */
async function remoteRpc(origin, authCookie, endpoint, rpcArgs) {
  const rpcId = randomUUID()
  const response = await fetch(`${origin}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: authCookie,
      host: new URL(origin).host,
    },
    body: JSON.stringify({
      type: 'client-request',
      rpcId,
      method: endpoint,
      payload: { args: rpcArgs },
    }),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`non-JSON response: ${text.slice(0, 200)}`)
  }
  if (body.rpcId !== rpcId) throw new Error('rpcId mismatch')
  if (!body.result?.ok) {
    const err = body.result?.error
    throw new Error(`${err?.code ?? 'UNKNOWN'}: ${err?.message ?? text}`)
  }
  return body.result.value
}

/**
 * @param {PluginInventorySnapshot} snap
 * @param {'family' | 'status'} groupBy
 */
function printInventory(snap, groupBy) {
  const entries = [...snap.entries]
  const presets = snap.agentPresets ?? []

  console.log(`# Host plugin inventory`)
  console.log(`# entries=${entries.length}  agentPresets=${presets.length}`)
  console.log('')

  console.log(`## Host Loader (${entries.length})`)
  if (entries.length === 0) {
    console.log('(none)')
  } else if (groupBy === 'status') {
    printGrouped(groupByStatus(entries), formatHostRow)
  } else {
    printGrouped(groupByFamily(entries), formatHostRow)
  }
  console.log('')

  if (presets.length === 0) {
    console.log('## Agent Presets')
    console.log('(roster not composed on this Host)')
    return
  }

  console.log(`## Agent Presets (${presets.length})`)
  for (const preset of presets) {
    const label = [
      preset.name ?? preset.id,
      preset.isDefault ? 'default' : null,
      preset.trust,
      preset.broken !== undefined ? 'BROKEN' : null,
    ].filter(Boolean).join(' · ')
    console.log('')
    console.log(`### ${label}  (${preset.rows.length} rows)`)
    if (preset.broken !== undefined) {
      console.log(`  ! ${preset.broken}`)
    }
    if (preset.rows.length === 0) {
      console.log('  (no rows)')
      continue
    }
    for (const row of preset.rows) {
      console.log(`  ${formatPresetRow(row)}`)
    }
  }
}

/**
 * Map one Host Loader entry to a reader-facing responsibility bucket
 * (aligned with wiki/008 base inventory groupings; heuristic only).
 * @param {PluginInventoryEntry} entry
 */
function familyOf(entry) {
  const id = entry.entryId.toLowerCase()
  const mod = entry.moduleName.toLowerCase()
  const hay = `${id} ${mod}`

  if (
    CORE_ENTRY_IDS.has(id)
    || /cordis-plugin-(timer|hmr)/.test(mod)
    || /dsh-(typert(-|$)|api-gateway$|agent-loop$|system-prompt$|tools$|agent$|session$|llm$)/.test(mod)
  ) {
    return 'Framework / Core'
  }
  // Do not match the `@deepseek-ai/` org scope — only package / entry tokens.
  if (
    /(^|[\s/@-])(llm|llm-|credentials|settings|plugin-package-inventory|agent-default-model|deepseek-llm|session-log-deepseek)/.test(` ${hay}`)
    || /dsh-(llm-|deepseek|credentials|settings)/.test(mod)
  ) {
    return 'LLM / Credentials / Settings'
  }
  if (/(^|[\s/-])(session-|attachment|storage|projection|telemetry|title|checkpoint)/.test(` ${hay}`)) {
    return 'Session'
  }
  if (
    /(^|[\s/-])(sandbox|subprocess|bash|pwsh|permission|approval|shell-env|fs-observation|fs-sandbox)/.test(` ${hay}`)
    || /(^|[\s/@-])(fs-|tool-fs)/.test(` ${hay}`)
  ) {
    return 'Sandbox / Shell / FS'
  }
  if (
    /dsh-client-|client-ui-|ui-|webserver|file-upload|host-web/.test(hay)
    || /(^|[\s/-])(connection|slots|locale|theme)([\s-]|$)/.test(` ${hay} `)
  ) {
    return 'Client / Web UI'
  }
  if (/agent-preset|presets/.test(hay)) {
    return 'Presets / Roster'
  }
  if (
    /(^|[\s/-])(tool-|skill|subagent|workflow|plan|goal|todo|ralph|compaction|web-|jobs|command|token-meter|spill|timeout|user-questions|agent-instructions|str-replace|repeat-tool|message-feedback|webhook|identity|anonymous|interaction|hooks|bundle|self-mod|guard|context-|workspace|remotes|api-)/.test(` ${hay}`)
  ) {
    return 'Tools / Agent / Product'
  }
  return 'Other'
}

/**
 * @param {readonly PluginInventoryEntry[]} entries
 * @returns {Map<string, PluginInventoryEntry[]>}
 */
function groupByFamily(entries) {
  /** @type {Map<string, PluginInventoryEntry[]>} */
  const groups = new Map(FAMILY_ORDER.map(name => [name, []]))
  for (const entry of entries) {
    const family = familyOf(entry)
    const bucket = groups.get(family) ?? []
    bucket.push(entry)
    groups.set(family, bucket)
  }
  for (const [key, rows] of [...groups]) {
    if (rows.length === 0) groups.delete(key)
  }
  return groups
}

/**
 * Status buckets: failed → disabled → active → pending/loading/unloading → unobserved.
 * @param {readonly PluginInventoryEntry[]} entries
 * @returns {Map<string, PluginInventoryEntry[]>}
 */
function groupByStatus(entries) {
  /** @type {Map<string, PluginInventoryEntry[]>} */
  const groups = new Map([
    ['failed', []],
    ['disabled', []],
    ['active', []],
    ['pending / loading / unloading', []],
    ['unobserved (no live fiber)', []],
  ])
  for (const entry of entries) {
    let key
    if (entry.fiberPhase === 'failed') key = 'failed'
    else if (!entry.enabled) key = 'disabled'
    else if (entry.fiberPhase === 'active') key = 'active'
    else if (entry.fiberPhase === 'pending' || entry.fiberPhase === 'loading' || entry.fiberPhase === 'unloading') {
      key = 'pending / loading / unloading'
    } else {
      key = 'unobserved (no live fiber)'
    }
    groups.get(key).push(entry)
  }
  for (const [key, rows] of [...groups]) {
    if (rows.length === 0) groups.delete(key)
  }
  return groups
}

/**
 * @param {Map<string, PluginInventoryEntry[]>} groups
 * @param {(entry: PluginInventoryEntry) => string} format
 */
function printGrouped(groups, format) {
  for (const [title, rows] of groups) {
    console.log('')
    console.log(`### ${title}  (${rows.length})`)
    for (const row of rows) {
      console.log(`  ${format(row)}`)
    }
  }
}

/** @param {PluginInventoryEntry} entry */
function formatHostRow(entry) {
  const phase = entry.fiberPhase ?? '—'
  const en = entry.enabled ? 'on ' : 'off'
  return `${pad(entry.entryId, 36)}  ${en}  ${pad(phase, 10)}  ${entry.moduleName}`
}

/** @param {AgentPresetPluginRow} row */
function formatPresetRow(row) {
  const id = row.entryId ?? '(no id)'
  const en = row.enabled === true ? 'on ' : row.enabled === false ? 'off' : '???'
  const phase = row.fiberPhase ?? '—'
  const cond = row.condition === undefined ? '' : `  cond=${JSON.stringify(row.condition)}`
  return `${pad(id, 36)}  ${en}  ${pad(phase, 10)}  ${row.moduleName}${cond}`
}

/** @param {string} text @param {number} width */
function pad(text, width) {
  return text.length >= width ? text : text + ' '.repeat(width - text.length)
}
