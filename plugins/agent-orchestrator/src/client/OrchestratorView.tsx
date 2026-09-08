/** Conversation Orchestrator tab: read-only preset composition on AITopo. */

import {
  useEffect, useMemo, useRef, useState,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { AgentPresetPluginGroup, PluginInventorySnapshot } from '@deepseek-ai/dsh-host-plugin-inventory/types'
import { fromPresetComposition } from '../from-preset.ts'
import { toGraphDocument } from '../to-graph.ts'
import { NS } from './locales.ts'
import {
  AITopoHost,
  formatZoomPercent,
  type AITopoHostHandle,
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

  const graphDoc = useMemo(() => {
    if (selected === null) return null
    const document = fromPresetComposition(selected)
    return toGraphDocument(document, {
      compositionGroup: t('group.composition'),
      empty: t('empty'),
      broken: t('broken'),
    })
  }, [selected, t])

  const onPresetChange = (event: SyntheticEvent<HTMLSelectElement>): void => {
    setPresetId(event.currentTarget.value)
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
          onEvent={event => {
            if (event.type === 'viewportChanged') setZoom(event.viewport.zoom)
          }}
        />
      </div>
    </div>
  )
}
