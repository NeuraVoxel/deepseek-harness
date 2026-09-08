/**
 * Activate a Conversation view tab by its visible label.
 *
 * Plugins cannot write the shell's View store without a harness API, so this
 * reuses the Session header tab button that already runs `selectView`.
 * @param label - localized tab text (same string the view entry's `label` thunk returns).
 * @returns whether a matching tab was found and clicked.
 */
export function openConversationViewTab(label: string): boolean {
  const tabs = document.querySelectorAll<HTMLElement>('[role="tablist"] [role="tab"]')
  for (const tab of tabs) {
    if (tab.textContent?.trim() !== label) continue
    tab.click()
    return true
  }
  return false
}
