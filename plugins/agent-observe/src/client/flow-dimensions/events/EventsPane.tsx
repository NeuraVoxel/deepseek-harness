/**
 * Events dimension dual-pane UI.
 */

import { type ReactElement } from 'react'
import type { EventListEntry, EventListFilter } from '../types.ts'
import css from './EventsPane.module.css'

/** Props for the events timeline + payload pane. */
export interface EventsPaneProps {
  readonly t: (key: string, params?: Record<string, string>) => string
  readonly entries: readonly EventListEntry[]
  readonly selected: EventListEntry | null
  readonly filter: EventListFilter
  readonly onFilter: (filter: EventListFilter) => void
  readonly onSelect: (entry: EventListEntry) => void
}

/**
 * Left timeline / right payload for the events Flow dimension.
 * @param props - list data and selection callbacks.
 */
export function EventsPane(props: EventsPaneProps): ReactElement {
  const { t, entries, selected, filter, onFilter, onSelect } = props
  return (
    <div className={css.root}>
      <div className={css.listPane}>
        <div className={css.filters} role="group" aria-label={t('flow.events.filter')}>
          {(['all', 'surface', 'control'] as const).map(chip => (
            <button
              key={chip}
              type="button"
              className={css.chip}
              data-active={filter === chip ? 'true' : 'false'}
              onClick={() => { onFilter(chip) }}
            >
              {t(`flow.events.filter.${chip}`)}
            </button>
          ))}
        </div>
        {entries.length === 0 ? (
          <div className={css.empty}>{t('flow.events.empty')}</div>
        ) : (
          <ul className={css.list}>
            {entries.map(entry => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={css.row}
                  data-active={selected?.id === entry.id ? 'true' : 'false'}
                  onClick={() => { onSelect(entry) }}
                >
                  <span className={css.seq}>{entry.seq}</span>
                  <span className={css.summary}>{entry.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={css.payloadPane}>
        {selected === null ? (
          <div className={css.empty}>{t('flow.events.payloadEmpty')}</div>
        ) : (
          <>
            <div className={css.payloadTitle}>{selected.type}</div>
            {selected.linkedNodeId !== undefined ? (
              <div className={css.linkHint}>
                {t('flow.events.linkedNode', { id: selected.linkedNodeId })}
              </div>
            ) : null}
            <pre className={css.payload}>{selected.payloadText}</pre>
          </>
        )}
      </div>
    </div>
  )
}
