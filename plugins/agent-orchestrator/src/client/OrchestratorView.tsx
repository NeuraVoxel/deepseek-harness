/** Conversation Orchestrator tab: read-only preset composition on AITopo. */

import {
  useEffect, useMemo, useRef, useState,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { AgentPresetPluginGroup, PluginInventorySnapshot } from '@deepseek-ai/dsh-host-plugin-inventory/types'
import type { ArchitecturalLayerId } from '../architectural-layer.ts'
import { fromPresetComposition } from '../from-preset.ts'
import { liveUnitIds, withLiveActivity } from '../map-tool-activity.ts'
import { toGraphDocument } from '../to-graph.ts'
import type {
  OrchestrationEnablement,
  OrchestrationFiberPhase,
  OrchestrationUnit,
} from '../types.ts'
import type { CompositionActivity } from './derive-activity.ts'
import { emptyCompositionActivity } from './derive-activity.ts'
import { NS, type AgentOrchestratorKey } from './locales.ts'
import {
  AITopoHost,
  formatZoomPercent,
  type AITopoHostHandle,
  type GraphEvent,
} from './aitopo/AITopoHost.tsx'
import css from './OrchestratorView.module.css'

/** Injected inventory loader + live activity from the plugin apply closure. */
export interface OrchestratorViewInjected {
  /** Load Host plugin inventory (includes agentPresets when composed). */
  listInventory: () => Promise<PluginInventorySnapshot>
  /** Session-bound live tool activity for composition highlight. */
  hooks: { compositionActivity: ObservableSnapshot<CompositionActivity> }
}

type Props = ConvViewProps
  & PropsLocale<typeof NS>
  & InjectFace<OrchestratorViewInjected>

/**
 * Orchestrator conversation view (read-only + live tool highlight).
 * @param props - conversation props + locale + inject.
 */
export function OrchestratorView(props: Props): ReactElement {
  const { t, listInventory, useCompositionActivity } = props
  const activity = useCompositionActivity(state => state)
  const sessionPresetRef = useRef(activity.sessionPresetId)
  sessionPresetRef.current = activity.sessionPresetId
  const [presets, setPresets] = useState<readonly AgentPresetPluginGroup[] | null>(null)
  const [presetId, setPresetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const hostRef = useRef<AITopoHostHandle>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const snapshot = await listInventory()
        if (cancelled) return
        const groups = snapshot.agentPresets ?? []
        setPresets(groups)
        setPresetId(prev => {
          if (prev !== null && groups.some(group => group.id === prev)) return prev
          const sessionPreset = sessionPresetRef.current
          if (sessionPreset !== null && groups.some(group => group.id === sessionPreset)) {
            return sessionPreset
          }
          return groups.find(group => group.isDefault)?.id ?? groups[0]?.id ?? null
        })
        setError(null)
      } catch {
        if (!cancelled) {
          setError(t('error.load'))
          setPresets([])
        }
      }
    })()
    return () => { cancelled = true }
  }, [listInventory, t])

  const selected = useMemo(
    () => presets?.find(group => group.id === presetId) ?? null,
    [presets, presetId],
  )

  const orchestrationDoc = useMemo(
    () => selected === null ? null : fromPresetComposition(selected),
    [selected],
  )

  const baseGraphDoc = useMemo(() => {
    if (orchestrationDoc === null) return null
    return toGraphDocument(orchestrationDoc, {
      layerGroup: (layer: ArchitecturalLayerId) => t(layerGroupKey(layer)),
      empty: t('empty'),
      broken: t('broken'),
    })
  }, [orchestrationDoc, t])

  // Live highlight when tools are active. If we know the Session preset and the
  // canvas is showing a different one, do not light unrelated composition rows.
  const liveActive = selected !== null
    && activity.sessionRunning
    && (activity.sessionPresetId === null || selected.id === activity.sessionPresetId)

  const highlightNames = activity.runningToolNames.length > 0
    ? activity.runningToolNames
    : activity.turnToolNames

  const graphDoc = useMemo(() => {
    if (baseGraphDoc === null || orchestrationDoc === null) return null
    if (!liveActive || highlightNames.length === 0) return baseGraphDoc
    const runningIds = liveUnitIds(orchestrationDoc.composition, activity.runningToolNames)
    const turnIds = liveUnitIds(orchestrationDoc.composition, activity.turnToolNames)
    return withLiveActivity(baseGraphDoc, runningIds, turnIds)
  }, [
    baseGraphDoc,
    orchestrationDoc,
    liveActive,
    highlightNames,
    activity.runningToolNames,
    activity.turnToolNames,
  ])

  const unitById = useMemo(() => {
    const map = new Map<string, OrchestrationUnit>()
    for (const unit of orchestrationDoc?.composition ?? []) map.set(unit.id, unit)
    return map
  }, [orchestrationDoc])

  const inspected = selectedUnitId === null ? null : unitById.get(selectedUnitId) ?? null

  const onPresetChange = (event: SyntheticEvent<HTMLSelectElement>): void => {
    setPresetId(event.currentTarget.value)
    setSelectedUnitId(null)
  }

  const onEvent = (event: GraphEvent): void => {
    switch (event.type) {
      case 'viewportChanged':
        setZoom(event.viewport.zoom)
        break
      case 'selectionChanged': {
        const id = event.selectedIds[0]
        if (id === undefined || !unitById.has(id)) {
          setSelectedUnitId(null)
          return
        }
        setSelectedUnitId(id)
        break
      }
      default:
        break
    }
  }

  if (error !== null) {
    return (
      <div className={css.root}>
        <div className={css.message} role="alert">{error}</div>
      </div>
    )
  }

  if (presets === null) {
    return (
      <div className={css.root}>
        <div className={css.message}>{t('loading')}</div>
      </div>
    )
  }

  if (presets.length === 0 || graphDoc === null) {
    return (
      <div className={css.root}>
        <div className={css.message}>{t('error.noPresets')}</div>
      </div>
    )
  }

  const hint = liveActive && highlightNames.length > 0
    ? t('hint.live', { count: highlightNames.length })
    : liveActive
      ? t('hint.liveIdle')
      : t('hint.readonly')

  return (
    <div className={css.root}>
      <div className={css.toolbar}>
        <span className={css.presetLabel}>{t('toolbar.preset')}</span>
        <select
          className={css.presetSelect}
          value={presetId ?? ''}
          onChange={onPresetChange}
          aria-label={t('toolbar.preset')}
        >
          {presets.map(preset => (
            <option key={preset.id} value={preset.id}>
              {preset.name ?? preset.id}
              {preset.isDefault ? ' *' : ''}
              {activity.sessionPresetId === preset.id ? ` · ${t('toolbar.session')}` : ''}
            </option>
          ))}
        </select>
        <div className={css.zoomGroup} role="group" aria-label={t('zoom.group')}>
          <button type="button" className={css.zoomButton} onClick={() => hostRef.current?.zoomOut()}>
            {t('zoom.out')}
          </button>
          <span className={css.zoomBadge}>{formatZoomPercent(zoom)}</span>
          <button type="button" className={css.zoomButton} onClick={() => hostRef.current?.zoomIn()}>
            {t('zoom.in')}
          </button>
          <button type="button" className={css.zoomButton} onClick={() => hostRef.current?.resetZoom()}>
            {t('zoom.reset')}
          </button>
          <button type="button" className={css.zoomButton} onClick={() => hostRef.current?.fitContent()}>
            {t('zoom.fit')}
          </button>
        </div>
        <span className={css.hint}>{hint}</span>
      </div>
      <div className={css.stage}>
        <AITopoHost
          ref={hostRef}
          document={graphDoc}
          fitToken={presetId ?? ''}
          ariaLabel={t('view.orchestrator')}
          onEvent={onEvent}
        />
        {inspected !== null ? (
          <UnitDetailPanel
            t={t}
            unit={inspected}
            live={liveActive && (
              liveUnitIds([inspected], activity.runningToolNames).has(inspected.id)
              || liveUnitIds([inspected], activity.turnToolNames).has(inspected.id)
            )}
            onClose={() => {
              setSelectedUnitId(null)
              hostRef.current?.setSelection([])
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function UnitDetailPanel(props: {
  t: Props['t']
  unit: OrchestrationUnit
  live: boolean
  onClose: () => void
}): ReactElement {
  const { t, unit, live, onClose } = props
  const stopCanvasPointer = (event: SyntheticEvent): void => {
    event.stopPropagation()
  }
  return (
    <aside
      className={css.detailPanel}
      role="dialog"
      aria-label={t('detail.title')}
      onPointerDown={stopCanvasPointer}
      onPointerMove={stopCanvasPointer}
      onPointerUp={stopCanvasPointer}
      onWheel={stopCanvasPointer}
      onClick={stopCanvasPointer}
    >
      <div className={css.detailHeader}>
        <div className={css.detailTitle}>{unit.label}</div>
        <button type="button" className={css.detailClose} onClick={onClose}>
          {t('detail.close')}
        </button>
      </div>
      <dl className={css.detailList}>
        <dt>{t('detail.entryId')}</dt>
        <dd>{unit.entryId ?? t('detail.none')}</dd>
        <dt>{t('detail.module')}</dt>
        <dd>{unit.moduleName}</dd>
        <dt>{t('detail.layer')}</dt>
        <dd>{t(layerGroupKey(unit.layer))}</dd>
        <dt>{t('detail.packageGroup')}</dt>
        <dd>{unit.packageGroup ?? t('detail.none')}</dd>
        <dt>{t('detail.enabled')}</dt>
        <dd>{enabledLabel(t, unit.enabled)}</dd>
        <dt>{t('detail.live')}</dt>
        <dd>{live ? t('detail.live.true') : t('detail.live.false')}</dd>
        {unit.condition !== undefined ? (
          <>
            <dt>{t('detail.condition')}</dt>
            <dd>{unit.condition}</dd>
          </>
        ) : null}
        {unit.fiberPhase !== undefined ? (
          <>
            <dt>{t('detail.fiber')}</dt>
            <dd>{fiberLabel(t, unit.fiberPhase)}</dd>
          </>
        ) : null}
        <dt>{t('detail.locked')}</dt>
        <dd>{unit.locked ? t('detail.locked.true') : t('detail.locked.false')}</dd>
      </dl>
    </aside>
  )
}

function layerGroupKey(layer: ArchitecturalLayerId): AgentOrchestratorKey {
  return `group.layer.${layer}` as AgentOrchestratorKey
}

function enabledLabel(
  t: Props['t'],
  enabled: OrchestrationEnablement,
): string {
  if (enabled === true) return t('detail.enabled.true')
  if (enabled === false) return t('detail.enabled.false')
  return t('detail.enabled.conditional')
}

function fiberLabel(
  t: Props['t'],
  phase: OrchestrationFiberPhase,
): string {
  if (phase === null) return t('detail.fiber.null')
  const key = `detail.fiber.${phase}` as AgentOrchestratorKey
  return t(key)
}

/** Re-export empty activity for inject fallbacks. */
export { emptyCompositionActivity }
