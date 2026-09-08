/**
 * Wiki 011 nine-layer architecture for preset composition display.
 * Maps packages/<group> → layer; resolves moduleName via npm package inventory.
 */

import { NPM_PACKAGE_TO_GROUP } from './npm-package-group.ts'

/**
 * Architectural layer id (wiki/011 ①–⑨), plus `other` for unknown modules.
 */
export type ArchitecturalLayerId =
  | 'core'
  | 'session-data'
  | 'config-identity'
  | 'model-context'
  | 'execution'
  | 'extensions'
  | 'bundle-boot'
  | 'application'
  | 'experimental'
  | 'other'

/** Display order for layer bands (top → bottom: other / ⑨ → ① foundation). */
export const ARCHITECTURAL_LAYER_ORDER: readonly ArchitecturalLayerId[] = [
  'other',
  'experimental',
  'application',
  'bundle-boot',
  'extensions',
  'execution',
  'model-context',
  'config-identity',
  'session-data',
  'core',
] as const

/**
 * packages/<group> → wiki layer (authoritative table from wiki/011).
 */
export const PACKAGE_GROUP_TO_LAYER: Readonly<Record<string, ArchitecturalLayerId>> = {
  // ① 产品脊柱
  core: 'core',
  // ② 会话与数据平面
  session: 'session-data',
  'session-query': 'session-data',
  storage: 'session-data',
  attachment: 'session-data',
  spill: 'session-data',
  workspace: 'session-data',
  // ③ 配置、身份与人机协作
  credentials: 'config-identity',
  settings: 'config-identity',
  identity: 'config-identity',
  interaction: 'config-identity',
  feedback: 'config-identity',
  // ④ 模型上下文与循环卫生
  llm: 'model-context',
  context: 'model-context',
  compaction: 'model-context',
  guard: 'model-context',
  plan: 'model-context',
  todo: 'model-context',
  goal: 'model-context',
  schedule: 'model-context',
  preset: 'model-context',
  skill: 'model-context',
  // ⑤ 执行世界
  fs: 'execution',
  shell: 'execution',
  subprocess: 'execution',
  sandbox: 'execution',
  terminal: 'execution',
  'code-runtime': 'execution',
  lsp: 'execution',
  web: 'execution',
  mcp: 'execution',
  jobs: 'execution',
  subagent: 'execution',
  workflow: 'execution',
  webhook: 'execution',
  e2b: 'execution',
  // ⑥ 运行时扩展与外部桥
  extensions: 'extensions',
  hooks: 'extensions',
  // ⑦ 组合与启动
  bundle: 'bundle-boot',
  boot: 'bundle-boot',
  // ⑧ 应用面
  api: 'application',
  typert: 'application',
  host: 'application',
  client: 'application',
  sdk: 'application',
  acp: 'application',
  // ⑨ 实验、诊断与支持
  experimental: 'experimental',
  'runtime-diagnostics': 'experimental',
  'test-support': 'experimental',
  util: 'experimental',
}

/** Result of resolving a composition module to a layer. */
export interface ArchitecturalLayerResolution {
  readonly layer: ArchitecturalLayerId
  /** packages/<group> when known. */
  readonly packageGroup: string | null
}

/**
 * Resolve a Loader module specifier to a wiki architectural layer.
 * @param moduleName - inventory moduleName (npm name, relative path, or builtin).
 * @returns layer + optional package group.
 */
export function resolveArchitecturalLayer(moduleName: string): ArchitecturalLayerResolution {
  const packageGroup = resolvePackageGroup(moduleName)
  if (packageGroup === null) return { layer: 'other', packageGroup: null }
  const layer = PACKAGE_GROUP_TO_LAYER[packageGroup] ?? 'other'
  return { layer, packageGroup }
}

/**
 * Map module specifier to packages/<group> when it is a known dsh package.
 * @param moduleName - module specifier.
 * @returns package group directory name, or null.
 */
export function resolvePackageGroup(moduleName: string): string | null {
  const bare = stripWorkspaceProtocol(moduleName)
  const fromMap = NPM_PACKAGE_TO_GROUP[bare]
  if (fromMap !== undefined) return fromMap

  // Workspace-relative paths: .../packages/<group>/<pkg>/...
  const packagesMatch = /(?:^|\/)packages\/([^/]+)\//.exec(bare.replace(/\\/g, '/'))
  if (packagesMatch?.[1] !== undefined) return packagesMatch[1]

  return null
}

function stripWorkspaceProtocol(moduleName: string): string {
  // Loader may pass bare npm names; tolerate optional query / version suffixes.
  const withoutQuery = moduleName.split('?')[0] ?? moduleName
  return withoutQuery.trim()
}
