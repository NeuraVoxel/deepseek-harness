/**
 * Record a real dsh profile boot and emit an AITopo document of the plugin
 * activation.
 *
 * Dev tool — NOT an application entry: it composes the profile through the
 * same app-boot helpers `apps/cli/src/profile-boot.ts` uses, then boots
 * in-process so the recorder subscribes to `internal/plugin` inside `boot()`'s
 * `prepare` callback, BEFORE any config-tree row mounts. That is the only way
 * to capture the base bundle's first rows; a `--patch` overlay would mount
 * after them. The composition coupling is deliberate: if `runProfile`'s patch
 * stack changes, mirror it here (see the learning note 2026-09-13).
 *
 * Run: pnpm exec tsx scripts/observe-boot.ts [--profile web] [--out dir]
 *                                     [--settle-ms 1500] [--no-emit-demo]
 *
 * Outputs under `.artifacts/observe-boot/<profile>-<timestamp>/`:
 * - `boot-timeline.json` — raw events, phases, layer attribution.
 * - `boot-topology.document.json` — the GraphDocument (parseDocument-validated).
 * - `boot-report.md` — human-readable phase/layer/activation tables.
 * With `--emit-demo` (default), also writes the aitopo demo sample
 * `vendor/aitopo/demo/samples/dsh/boot.ts` and registers it in
 * `demo/samples/registry.ts` (submodule changes — commit them in aitopo).
 * @module scripts/observe-boot
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { FiberState, type Context, type Fiber } from '@deepseek-ai/cordis'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import {
  boot,
  composeEntries,
  healProfilesModuleFallback,
  loadLayeredEnv,
  loadOptionalPatches,
  type Profile,
} from '@deepseek-ai/dsh-app-boot'
import { DSH_LAUNCH_ENVIRONMENT_KEY } from '@deepseek-ai/dsh-launch-environment'
import { installProxyFromEnvironment } from '@deepseek-ai/dsh-http-proxy'
import { provideCmdline, type AppReady } from '@deepseek-ai/dsh-cmdline'
import { parseDocument } from '@neuravoxel/aitopo'
import {
  homePatchPath,
  INSTALL_ANCHOR,
  prepareProfile,
  PROFILE_ROOT_FILENAME,
  resolveTelemetryPatch,
} from '../apps/cli/src/profile-boot.ts'
import {
  buildBootDocument,
  type BootLayerInfo,
  type BootPhaseMark,
  type BootPluginEvent,
  type BootRecording,
} from './observe-boot-document.ts'

const BIN_NAME = 'dsh'
/** Row id owned by profile-boot's telemetry switch; repeated here for the has-row check. */
const TELEMETRY_ROW_ID = 'session-telemetry-otel'

/** Launcher-owned readiness signal, mirrored from profile-boot (private there). */
function createAppReady(): { service: AppReady; commit(): void } {
  let ready = false
  const listeners = new Set<() => void>()
  return {
    service: {
      onReady(listener) {
        if (ready) {
          listener()
          return () => {}
        }
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    commit() {
      if (ready) return
      ready = true
      for (const listener of [...listeners]) listener()
      listeners.clear()
    },
  }
}

interface ComposedProfile {
  profile: Profile
  /** Patch list in application order, mirroring runProfile's stack. */
  patches: PatchOptions[]
  layers: BootLayerInfo[]
}

/**
 * Mirror `runProfile`/`composeProfile`'s stack: bundle layers in
 * `dsh.profile.bundles` order, the profile's user layer, the home layer, then
 * the telemetry switch. Attribution records which layer owns each row id so
 * the document can band plugins by origin.
 */
async function composeRecordingProfile(profileName: string): Promise<ComposedProfile> {
  const profile = prepareProfile(profileName)
  await healProfilesModuleFallback({ installAnchor: INSTALL_ANCHOR, profile })
  const homePatches = loadOptionalPatches(BIN_NAME, homePatchPath()) ?? []

  const layers: BootLayerInfo[] = []
  const layerOfRow = new Map<string, string>()
  const attribute = (name: string, patches: readonly PatchOptions[]): void => {
    const rowIds: string[] = []
    for (const patch of patches) {
      for (const row of patch.insert ?? [{ id: patch.id }]) {
        if (row.id === undefined) continue
        rowIds.push(row.id)
        // Later layers override earlier rows by id; keep the final owner.
        layerOfRow.set(row.id, name)
      }
    }
    layers.push({ name, rowIds })
  }
  profile.layers.forEach(layer => attribute(layer.packageName, layer.patches))
  attribute('profile:cordis.patch.yml', profile.patches)
  attribute('home:cordis.patch.yml', homePatches)

  const rows = new Map<string, unknown>()
  for (const row of composeEntries([profile.layers.flatMap(layer => layer.patches), profile.patches, homePatches])) {
    if (typeof row.id === 'string') rows.set(row.id, row)
  }
  const telemetryPatch = resolveTelemetryPatch(process.env.DSH_TELEMETRY_DISABLED, rows.has(TELEMETRY_ROW_ID))
  const overlays = telemetryPatch === undefined ? [] : [telemetryPatch]
  if (telemetryPatch !== undefined) attribute('telemetry', overlays)

  return {
    profile,
    // Cloned per boot application, same reason as runProfile: the include
    // pushes insert rows by reference and later patches mutate them in place.
    patches: structuredClone([
      ...profile.layers.flatMap(layer => layer.patches),
      ...profile.patches,
      ...homePatches,
      ...overlays,
    ]) as PatchOptions[],
    layers,
  }
}

/** Normalize a loader `inject` declaration into display strings. */
function injectLabels(inject: unknown): string[] {
  if (inject === undefined || inject === null) return []
  if (typeof inject === 'string') return [inject]
  if (Array.isArray(inject)) return inject.map(String)
  return Object.keys(inject as Record<string, unknown>)
}

function pluginEvent(fiber: Fiber, atMs: number): BootPluginEvent {
  const options = fiber.entry?.options
  const parentEntryId = fiber.parent?.fiber?.entry?.options?.id
  const kind = fiber.state === FiberState.DISPOSED || fiber.state === FiberState.UNLOADING
    || fiber.state === FiberState.FAILED
    ? 'disposal'
    : 'construction'
  return {
    atMs,
    kind,
    // Disposal fibers report uid null; events key on entryId, the uid only disambiguates edges.
    fiberUid: fiber.uid ?? -1,
    entryId: options?.id ?? `fiber:${fiber.uid}`,
    entryName: options?.name ?? '(unknown)',
    inject: injectLabels(options?.inject),
    disabled: options?.disabled === true,
    ...(parentEntryId === undefined ? {} : { parentEntryId }),
  }
}

function renderReport(recording: BootRecording, outPath: string): void {
  const lines: string[] = [
    `# dsh boot recording: ${recording.profile}`,
    '',
    `Recorded ${recording.recordedAt} by \`scripts/observe-boot.ts\` (in-process boot, bin \`${recording.binName}\`).`,
    '',
    '## Phases',
    '',
    '| phase | duration | detail |',
    '|---|---|---|',
  ]
  for (const phase of recording.phases) {
    lines.push(`| ${phase.id} | ${Math.round(phase.endedAtMs - phase.startedAtMs)}ms | ${phase.detail} |`)
  }
  lines.push('', '## Patch layers', '', '| # | layer | rows |', '|---|---|---|')
  recording.layers.forEach((layer, index) => {
    lines.push(`| ${index} | ${layer.name} | ${layer.rowIds.length} |`)
  })
  const constructions = recording.events.filter(event => event.kind === 'construction')
  lines.push(
    '',
    `## Activation order (${constructions.length} constructed, ${recording.inactiveEntryIds.length} inactive)`,
    '',
    '| # | t(ms) | layer | entry id | plugin | inject |',
    '|---|---|---|---|---|---|',
  )
  constructions.forEach((event, index) => {
    const layer = recording.layers.find(candidate => candidate.rowIds.includes(event.entryId))?.name ?? '(unattributed)'
    lines.push(
      `| ${index} | ${Math.round(event.atMs)} | ${layer} | ${event.entryId} | ${event.entryName} | ${event.inject.join(', ') || '—'} |`,
    )
  })
  lines.push('', `Artifacts: ${outPath}`, '')
  writeFileSync(join(outPath, 'boot-report.md'), lines.join('\n'))
}

/** Emit the demo sample module and register it; registry edit is best-effort. */
function emitDemoSample(document: unknown, profileName: string): void {
  const samplesDir = resolve('vendor/aitopo/demo/samples')
  const moduleText = `import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/** Generated by deepseek-harness \`scripts/observe-boot.ts\` — dsh ${profileName} profile boot. Regenerate by re-running the script. */
export const dshBootDocument: GraphDocument = ${JSON.stringify(document, null, 2)}

export const dshBootSample: DemoSample = {
  id: 'dsh-boot',
  title: 'DSH boot',
  group: 'dsh',
  description: 'Recorded dsh ${profileName}-profile startup: phase flow, patch layers, plugin activation time axis.',
  document: dshBootDocument,
}
`
  writeFileSync(join(samplesDir, 'dsh', 'boot.ts'), moduleText)

  const registryPath = join(samplesDir, 'registry.ts')
  const registry = readFileSync(registryPath, 'utf8')
  const anchorImport = "import { helloWorldSample } from './hello-world.ts'"
  const importLine = "import { dshBootSample } from './dsh/boot.ts'"
  // Idempotent against any prior dshBootSample import (the sample once lived
  // under agents/): presence by symbol, not by path.
  const priorImport = /^[^\n]*dshBootSample[^\n]*\n/m.exec(registry)?.[0]
  if (priorImport !== undefined && priorImport.trim() !== importLine) {
    console.warn(`observe-boot: registry.ts imports dshBootSample from "${priorImport.trim()}" `
      + 'instead of the emitted ./dsh/boot.ts — update the import path manually')
    return
  }
  if (!registry.includes(anchorImport)) {
    console.warn('observe-boot: registry.ts anchor not found — add the dsh-boot sample import and entry manually')
    return
  }
  const updated = registry
    .replace(anchorImport, registry.includes(importLine) ? anchorImport : `${importLine}\n${anchorImport}`)
    .replace('  helloWorldSample,', registry.includes('  dshBootSample,') ? '  helloWorldSample,' : '  dshBootSample,\n  helloWorldSample,')
  writeFileSync(registryPath, updated)
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      profile: { type: 'string', default: 'web' },
      out: { type: 'string' },
      'settle-ms': { type: 'string', default: '1500' },
      'emit-demo': { type: 'boolean', default: true },
    },
  })
  const profileName = values.profile
  const settleMs = Number(values['settle-ms'])
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-').slice(0, 19)
  const outPath = values.out ?? resolve('.artifacts/observe-boot', `${profileName}-${stamp}`)
  mkdirSync(outPath, { recursive: true })

  const t0 = performance.now()
  const mark = (atMs: number): number => Math.round((atMs - t0) * 100) / 100
  const phases: BootPhaseMark[] = []
  const events: BootPluginEvent[] = []
  let phaseStart = t0
  const beginPhase = (): void => { phaseStart = performance.now() }
  const endPhase = (id: BootPhaseMark['id'], label: string, detail: string): void => {
    const endedAtMs = performance.now()
    phases.push({ id, label, startedAtMs: mark(phaseStart), endedAtMs: mark(endedAtMs), detail })
    phaseStart = endedAtMs
  }

  const environment = loadLayeredEnv(BIN_NAME)
  const disposeProxy = await installProxyFromEnvironment(environment, (message) => {
    process.stderr.write(`${BIN_NAME}: ${message}\n`)
  })

  endPhase('compose', 'Compose profile', `patch layers + attribution for profile "${profileName}"`)
  const composed = await composeRecordingProfile(profileName)

  const appReady = createAppReady()
  beginPhase()
  let ctx: Context
  try {
    ctx = await boot(BIN_NAME, join(composed.profile.dir, PROFILE_ROOT_FILENAME), composed.patches, (hostCtx) => {
      // First statement: nothing may mount before this subscription.
      hostCtx.on('internal/plugin', (fiber) => {
        events.push(pluginEvent(fiber, mark(performance.now())))
      })
      hostCtx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, environment)
      provideCmdline(hostCtx, {
        // Recording-only invocation: never pop the user's browser mid-capture.
        args: ['--no-open'],
        exit: (code) => { console.warn(`observe-boot: app requested exit ${code}`) },
        ready: appReady.service,
      })
      endPhase('prepare', 'Host prepare', 'recorder subscribed; launch env + cmdline provided')
      beginPhase()
    })
  } catch (error) {
    endPhase('mount', 'Mount (failed)', String((error as Error)?.message ?? error))
    const recording: BootRecording = {
      binName: BIN_NAME,
      profile: profileName,
      recordedAt: new Date().toISOString(),
      phases,
      events,
      layers: composed.layers,
      inactiveEntryIds: [],
    }
    writeFileSync(join(outPath, 'boot-timeline.json'), JSON.stringify(recording, null, 2))
    console.error(`observe-boot: boot failed — partial timeline written to ${outPath}`)
    await disposeProxy()
    return 1
  }
  endPhase('mount', 'Mount plugin tree', `${events.filter(event => event.kind === 'construction').length} fibers constructed`)

  beginPhase()
  await new Promise(resolve => setTimeout(resolve, settleMs))
  endPhase('settle', 'Settle', `${settleMs}ms grace after boot() returned`)

  // EntryTree.entries() is a Generator; spread first — Node 22 iterator
  // helpers would otherwise let .filter/.map return lazy iterators, not arrays.
  const inactiveEntryIds = [...(ctx.loader?.entries() ?? [])]
    .filter(entry => entry.options.disabled === true
      || !events.some(event => event.kind === 'construction' && event.entryId === entry.options.id))
    .map(entry => entry.options.id)
  endPhase('ready', 'Ready', `${inactiveEntryIds.length} composed rows never activated`)

  const recording: BootRecording = {
    binName: BIN_NAME,
    profile: profileName,
    recordedAt: new Date().toISOString(),
    phases,
    events,
    layers: composed.layers,
    inactiveEntryIds,
  }
  const document = buildBootDocument(recording)
  parseDocument(document) // Fail loud before writing an invalid document.

  writeFileSync(join(outPath, 'boot-timeline.json'), JSON.stringify(recording, null, 2))
  writeFileSync(join(outPath, 'boot-topology.document.json'), JSON.stringify(document, null, 2))
  renderReport(recording, outPath)
  if (values['emit-demo']) emitDemoSample(document, profileName)

  console.log(`observe-boot: ${events.filter(event => event.kind === 'construction').length} plugins, `
    + `${composed.layers.length} layers → ${outPath}`)
  await ctx.fiber.dispose().catch((error) => {
    // Post-recording teardown only; the artifacts are already on disk.
    console.warn(`observe-boot: dispose warned: ${(error as Error)?.message ?? error}`)
  })
  await disposeProxy()
  return 0
}

process.exitCode = 1
main().then((code) => {
  process.exitCode = code
}, (error) => {
  console.error('observe-boot:', error)
}).finally(() => {
  if (process.exitCode === 1) process.exit(1)
})
