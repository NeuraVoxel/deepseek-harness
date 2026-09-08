/**
 * Per-Turn assistant-actions shortcut that opens the Observe Conversation tab.
 *
 * Seated beside Turn usage on the turn-tail action row. `messageId` is owned
 * for a future Turn-scoped payload; this build only navigates.
 */

import { IconBrowseOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { NS } from './locales.ts'
import { openConversationViewTab } from './open-view-tab.ts'
import css from './ViewShortcut.module.css'

/** Full props of the Observe assistant-actions shortcut. */
export type ViewShortcutProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & PropsLocale<typeof NS>

/**
 * Opens the Observe tab via the Session header tab list.
 * @param props - assistant-actions runtime props plus this plugin's locale seat.
 * @returns the shortcut button.
 */
export function ViewShortcut({ messageId: _messageId, t }: ViewShortcutProps) {
  void _messageId
  const label = t('view.observe')
  return (
    <span className={css.root} data-observe-shortcut="">
      <Tooltip label={t('dock.open')} side="bottom" delayMs={200}>
        <button
          type="button"
          className={css.trigger}
          aria-label={t('dock.open')}
          onClick={() => { openConversationViewTab(label) }}
        >
          <IconBrowseOutline16 size={15} />
        </button>
      </Tooltip>
    </span>
  )
}
