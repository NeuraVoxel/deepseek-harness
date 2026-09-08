// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { openConversationViewTab } from './open-view-tab.ts'

describe('openConversationViewTab', () => {
  it('clicks the tab whose text matches the label', () => {
    document.body.innerHTML = `
      <div role="tablist">
        <button type="button" role="tab">Chat</button>
        <button type="button" role="tab">Orchestrate</button>
      </div>
    `
    const orchestrate = document.querySelectorAll<HTMLElement>('[role="tab"]')[1]!
    const click = vi.spyOn(orchestrate, 'click')
    expect(openConversationViewTab('Orchestrate')).toBe(true)
    expect(click).toHaveBeenCalledOnce()
  })

  it('returns false when no tab matches', () => {
    document.body.innerHTML = `
      <div role="tablist">
        <button type="button" role="tab">Chat</button>
      </div>
    `
    expect(openConversationViewTab('Orchestrate')).toBe(false)
  })
})
