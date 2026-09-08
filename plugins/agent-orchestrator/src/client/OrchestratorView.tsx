/** Conversation Orchestrator tab: read-only preset composition on AITopo. */

import {
  useEffect, useMemo, useRef, useState,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { AgentPresetPluginGroup, PluginInventorySnapshot } from '@deepseek-ai/dsh-host-plugin-inventory/types'
import type { ArchitecturalLayerId } from '../architectural-layer.ts'
import { fromPresetComposition } from '../from-preset.ts'
import { toGraphDocument } from '../to-graph.ts'
import type {
  OrchestrationEnablement,
  OrchestrationFiberPhase,
  OrchestrationUnit,
} from '../types.ts'
import { NS, type AgentOrchestratorKey } from './locales.ts'
import {
  AITopoHost,
  formatZoomPercent,
  type AITopoHostHandle,
  type GraphEvent,
} from './aitopo/AITopoHost.tsx'
import css from './OrchestratorView.module.css'

/** Injected inventory loader from the plugin apply closure. */
export interface OrchestratorViewInjected {
  /** Load Host plugin inventory (includes agentPresets when composed). */
  listInventory: () => Promise<PluginInventorySnapshot>
}

type Props = ConvViewProps
  & PropsLocale<typeof NS>
  & InjectFace<OrchestratorViewInjected>

/**
 * Orchestrator conversation view (read-only F0).
 * @param props - conversation props + locale + inject.
 */
export function OrchestratorView(props: Props): ReactElement {
  const { t, listInventory } = props
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

  const graphDoc = useMemo(() => {
    if (orchestrationDoc === null) return null
    return toGraphDocument(orchestrationDoc, {
      layerGroup: (layer: ArchitecturalLayerId) => t(layerGroupKey(layer)),
      empty: t('empty'),
      broken: t('broken'),
    })
  }, [orchestrationDoc, t])

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
        <span className={css.hint}>{t('hint.readonly')}</span>
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
  onClose: () => void
}): ReactElement {
  const { t, unit, onClose } = props
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
