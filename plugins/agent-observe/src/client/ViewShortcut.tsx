/**
 * Per-Turn assistant-actions shortcut that opens the Observe Conversation tab
 * pinned to the message's Turn via reverse lookup.
 *
 * Seated beside Turn usage on the turn-tail action row.
 */

import { IconBrowseOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MessageId } from '@deepseek-ai/dsh-llm/brand'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { NS } from './locales.ts'
import css from './ViewShortcut.module.css'

/** Injected callbacks for the Observe assistant-actions shortcut. */
export interface ViewShortcutInjected {
  /** Open Observe flow for the Turn that owns this assistant message. */
  openObserveFlow: (messageId: MessageId) => void
}

/** Full props of the Observe assistant-actions shortcut. */
export type ViewShortcutProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & InjectFace<ViewShortcutInjected>
  & PropsLocale<typeof NS>

/**
 * Opens the Observe tab on the message's Turn via reverse lookup.
 * @param props - assistant-actions runtime props plus inject and locale seats.
 * @returns the shortcut button.
 */
export function ViewShortcut({ messageId, openObserveFlow, t }: ViewShortcutProps) {
  return (
    <span className={css.root} data-observe-shortcut="">
      <Tooltip label={t('dock.open')} side="bottom" delayMs={200}>
        <button
          type="button"
          className={css.trigger}
          aria-label={t('dock.open')}
          onClick={() => { openObserveFlow(messageId) }}
        >
          <IconBrowseOutline16 size={15} />
        </button>
      </Tooltip>
    </span>
  )
}
