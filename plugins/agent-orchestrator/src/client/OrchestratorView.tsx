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
import { fromInventory } from '../from-inventory.ts'
import { documentForCanvas } from '../document-for-canvas.ts'
import { pluginCountsFromDocument } from '../plugin-counts.ts'
import { liveUnitIds, withLiveActivity } from '../map-tool-activity.ts'
import { unitIdsForModules } from '../participation-map.ts'
import { toGraphDocument, type GraphUnitMembership } from '../to-graph.ts'
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
  const [hostEntries, setHostEntries] = useState<PluginInventorySnapshot['entries']>([])
  const [presetId, setPresetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [showHostCatalog, setShowHostCatalog] = useState(false)
  const hostRef = useRef<AITopoHostHandle>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const snapshot = await listInventory()
        if (cancelled) return
        const groups = snapshot.agentPresets ?? []
        setPresets(groups)
        setHostEntries(snapshot.entries)
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
          setHostEntries([])
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
    () => selected === null
      ? null
      : fromInventory(selected, hostEntries.map(entry => ({
        entryId: entry.entryId,
        moduleName: entry.moduleName,
        enabled: entry.enabled,
        fiberPhase: entry.fiberPhase,
      }))),
    [selected, hostEntries],
  )

  const canvasDoc = useMemo(
    () => orchestrationDoc === null
      ? null
      : documentForCanvas(orchestrationDoc, showHostCatalog),
    [orchestrationDoc, showHostCatalog],
  )

  const baseGraphDoc = useMemo(() => {
    if (canvasDoc === null) return null
    return toGraphDocument(canvasDoc, {
      layerGroup: (layer: ArchitecturalLayerId) => t(layerGroupKey(layer)),
      empty: t('empty'),
      broken: t('broken'),
    })
  }, [canvasDoc, t])

  // Live highlight when Session-log evidence is present. If we know the Session
  // preset and the canvas is showing a different one, do not light unrelated rows.
  const liveActive = selected !== null
    && activity.sessionRunning
    && (activity.sessionPresetId === null || selected.id === activity.sessionPresetId)

  const livePaint = useMemo(() => {
    if (baseGraphDoc === null || canvasDoc === null) {
      return { graphDoc: baseGraphDoc, hitCount: 0 }
    }
    if (!liveActive) return { graphDoc: baseGraphDoc, hitCount: 0 }
    const runningIds = liveUnitIds(canvasDoc.composition, activity.runningToolNames)
    const turnToolIds = liveUnitIds(canvasDoc.composition, activity.turnToolNames)
    const turnModuleIds = unitIdsForModules(canvasDoc.composition, activity.turnModuleNames)
    const turnIds = new Set([...turnToolIds, ...turnModuleIds])
    const hitCount = new Set([...runningIds, ...turnIds]).size
    if (hitCount === 0) return { graphDoc: baseGraphDoc, hitCount: 0 }
    return {
      graphDoc: withLiveActivity(baseGraphDoc, runningIds, turnIds),
      hitCount,
    }
  }, [
    baseGraphDoc,
    canvasDoc,
    liveActive,
    activity.runningToolNames,
    activity.turnToolNames,
    activity.turnModuleNames,
  ])
  const graphDoc = livePaint.graphDoc

  const unitById = useMemo(() => {
    const map = new Map<string, { unit: OrchestrationUnit; membership: GraphUnitMembership }>()
    for (const unit of canvasDoc?.composition ?? []) {
      map.set(unit.id, { unit, membership: 'composition' })
    }
    for (const unit of canvasDoc?.catalog ?? []) {
      map.set(unit.id, { unit, membership: 'catalog' })
    }
    return map
  }, [canvasDoc])

  useEffect(() => {
    if (showHostCatalog || selectedUnitId === null || orchestrationDoc === null) return
    if (!orchestrationDoc.catalog.some(unit => unit.id === selectedUnitId)) return
    setSelectedUnitId(null)
    hostRef.current?.setSelection([])
  }, [showHostCatalog, selectedUnitId, orchestrationDoc])

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
      <div className={css.root} data-conversation-composer-overlay="">
        <div className={css.message} role="alert">{error}</div>
      </div>
    )
  }

  if (presets === null) {
    return (
      <div className={css.root} data-conversation-composer-overlay="">
        <div className={css.message}>{t('loading')}</div>
      </div>
    )
  }

  if (presets.length === 0 || graphDoc === null) {
    return (
      <div className={css.root} data-conversation-composer-overlay="">
        <div className={css.message}>{t('error.noPresets')}</div>
      </div>
    )
  }

  const hint = liveActive && livePaint.hitCount > 0
    ? t('hint.live', { count: livePaint.hitCount })
    : liveActive
      ? t('hint.liveIdle')
      : `${t('hint.readonly')} · ${t(showHostCatalog ? 'hint.membership' : 'hint.membershipPreset')}`

  const counts = orchestrationDoc === null
    ? null
    : pluginCountsFromDocument(orchestrationDoc)

  return (
    <div className={css.root} data-conversation-composer-overlay="">
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
        {counts !== null ? (
          <span className={css.pluginCounts} aria-live="polite">
            {t('toolbar.pluginCounts', {
              composition: counts.composition,
              catalog: counts.catalog,
            })}
          </span>
        ) : null}
        <label className={css.hostCatalogToggle}>
          <input
            type="checkbox"
            checked={showHostCatalog}
            onChange={event => setShowHostCatalog(event.currentTarget.checked)}
          />
          {t('toolbar.showHostCatalog')}
        </label>
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
          fitToken={`${presetId ?? ''}:${showHostCatalog ? 'host' : 'preset'}`}
          ariaLabel={t('view.orchestrator')}
          onEvent={onEvent}
        />
        {inspected !== null ? (
          <UnitDetailPanel
            t={t}
            unit={inspected.unit}
            membership={inspected.membership}
            live={inspected.membership === 'composition'
              && liveActive
              && (
                liveUnitIds([inspected.unit], activity.runningToolNames).has(inspected.unit.id)
                || liveUnitIds([inspected.unit], activity.turnToolNames).has(inspected.unit.id)
                || unitIdsForModules([inspected.unit], activity.turnModuleNames).has(inspected.unit.id)
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
  membership: GraphUnitMembership
  live: boolean
  onClose: () => void
}): ReactElement {
  const { t, unit, membership, live, onClose } = props
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
        <dt>{t('detail.membership')}</dt>
        <dd>
          {membership === 'catalog'
            ? t('detail.membership.catalog')
            : t('detail.membership.composition')}
        </dd>
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
