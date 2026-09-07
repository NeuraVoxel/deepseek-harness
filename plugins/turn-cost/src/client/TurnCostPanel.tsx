/**
 * Per-Turn cost pill in the assistant-actions strip: opens an itemized CNY dialog.
 */

import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPosition, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { formatCny, priceTurnUsage } from '../rates.ts'
import type { NS } from './locales.ts'
import { turnUsageForMessage } from './usage-lookup.ts'
import css from './TurnCostPanel.module.css'

const PANEL_MARGIN = 12
const PANEL_GAP = 8
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/** Full props of the assistant-actions Turn-cost entry. */
export type TurnCostPanelProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & PropsLocale<typeof NS>

interface DialogSeat {
  open: boolean
  setOpen: (open: boolean) => void
  rootRef: MutableRefObject<HTMLSpanElement | null>
  panelRef: MutableRefObject<HTMLDivElement | null>
  pos: CSSProperties | null
}

function useStatDialog(): DialogSeat {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const pos = useAnchoredPosition({
    open,
    anchorRef: rootRef,
    panelRef,
    side: 'top',
    gap: PANEL_GAP,
    margin: PANEL_MARGIN,
  })
  useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open])
  return { open, setOpen, rootRef, panelRef, pos }
}

/**
 * Icon-row Turn-cost trigger with an itemized CNY dialog.
 * @param props - assistant-actions runtime props plus this plugin's locale seat.
 * @returns the pill, or null when the Turn cannot be priced.
 */
export function TurnCostPanel({ messageId, useChat, useProjection, t }: TurnCostPanelProps) {
  const { open, setOpen, rootRef, panelRef, pos } = useStatDialog()
  const usage = useChat(snapshot => turnUsageForMessage(snapshot, messageId))
  const sessionCost = useProjection('sessionCost')
  if (usage === undefined || sessionCost === undefined) return null
  const priced = priceTurnUsage(usage, sessionCost.rates)
  if (priced === undefined) return null

  const total = formatCny(priced.totalCny)
  return (
    <span ref={rootRef} className={css.root}>
      <button
        type="button"
        className={css.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        {t('turn.trigger', { total })}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className={css.panel}
          role="dialog"
          aria-label={t('turn.title')}
          style={pos ?? MEASURE_STYLE}
        >
          <div className={css.title}>
            <span>{t('turn.title')}</span>
            <span className={css.titleValue}>{total}</span>
          </div>
          <div className={css.titleRule} aria-hidden />
          <dl className={css.details} data-turn-cost-details>
            <dt>{t('turn.route')}</dt>
            <dd className={css.route}>{priced.routeKey}</dd>
            <dt>{t('turn.input')}</dt>
            <dd>{formatCny(priced.inputCny)}</dd>
            {(usage.cacheReadTokens ?? 0) > 0 && (
              <>
                <dt>{t('turn.cacheRead')}</dt>
                <dd>{formatCny(priced.cacheReadCny)}</dd>
              </>
            )}
            {(usage.cacheWriteTokens ?? 0) > 0 && (
              <>
                <dt>{t('turn.cacheWrite')}</dt>
                <dd>{formatCny(priced.cacheWriteCny)}</dd>
              </>
            )}
            <dt>{t('turn.output')}</dt>
            <dd>{formatCny(priced.outputCny)}</dd>
          </dl>
        </div>,
        document.body,
      )}
    </span>
  )
}
