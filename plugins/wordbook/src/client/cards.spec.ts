/**
 * Card metadata validation: the wire `result.meta` value is `unknown`, so the
 * cards must reject anything they cannot render instead of showing a
 * half-built word.
 * @module dsh-wordbook/src/client/cards.spec
 */

import { describe, expect, it } from 'vitest'
import { argsTextOf, isSettledTool, outputTextOf, parseWordCardMeta } from './cards.ts'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-chat/client'

/** One canonical stored word as the tools persist it. */
const word = {
  word: 'apple',
  display: 'Apple',
  phonetic: { us: '/ˈæp.əl/' },
  senses: [{ pos: 'n.', meaning: '苹果', examples: ['an apple a day'] }],
  model: { provider: 'scripted', model: 'test-model' },
  createdAt: 1,
  updatedAt: 2,
}

describe('parseWordCardMeta', () => {
  it('accepts a lookup result and keeps the display form, senses, and route', () => {
    const parsed = parseWordCardMeta({ kind: 'lookup', created: true, refresh: false, entry: word })

    expect(parsed).toEqual({
      kind: 'lookup',
      created: true,
      refresh: false,
      entry: {
        display: 'Apple',
        phonetic: { us: '/ˈæp.əl/' },
        senses: [{ pos: 'n.', meaning: '苹果', examples: ['an apple a day'] }],
        model: { provider: 'scripted', model: 'test-model' },
      },
    })
  })

  it('accepts a query result and reads the pre-cap total', () => {
    const parsed = parseWordCardMeta({ kind: 'query', entries: [word], total: 7 })

    expect(parsed?.kind).toBe('query')
    expect(parsed).toMatchObject({ total: 7 })
  })

  it('falls back to the entry count when the total is missing or not a number', () => {
    expect(parseWordCardMeta({ kind: 'query', entries: [word] })).toMatchObject({ total: 1 })
    expect(parseWordCardMeta({ kind: 'query', entries: [word], total: 'many' })).toMatchObject({ total: 1 })
  })

  it('drops an absent phonetic object and defaults a missing part of speech', () => {
    const parsed = parseWordCardMeta({
      kind: 'lookup',
      created: false,
      entry: { display: 'apple', phonetic: { us: '  ' }, senses: [{ meaning: '苹果' }], model: {} },
    })

    expect(parsed).toMatchObject({
      created: false,
      entry: {
        display: 'apple',
        senses: [{ pos: '', meaning: '苹果', examples: [] }],
        model: { provider: '', model: '' },
      },
    })
    expect(parsed?.kind === 'lookup' ? parsed.entry.phonetic : 'unexpected kind').toBeUndefined()
  })

  it('rejects metadata a card cannot render', () => {
    expect(parseWordCardMeta(undefined)).toBeUndefined()
    expect(parseWordCardMeta('lookup')).toBeUndefined()
    expect(parseWordCardMeta({ kind: 'other' })).toBeUndefined()
    expect(parseWordCardMeta({ kind: 'lookup', created: true })).toBeUndefined()
    expect(parseWordCardMeta({ kind: 'lookup', entry: { senses: [] } })).toBeUndefined()
    expect(parseWordCardMeta({ kind: 'lookup', entry: { display: 'a', senses: 'nope' } })).toBeUndefined()
    expect(parseWordCardMeta({ kind: 'lookup', entry: { display: 'a', senses: [{ meaning: 42 }] } })).toBeUndefined()
    expect(parseWordCardMeta({ kind: 'query', entries: [word, { display: 'broken' }] })).toBeUndefined()
    expect(parseWordCardMeta({ kind: 'query', entries: 'nope' })).toBeUndefined()
  })
})

describe('tool block readers', () => {
  const running: ToolCallBlock = {
    callId: 'call-1',
    name: 'word_lookup',
    argsRaw: '{"word":"apple"}',
    turn: 1,
    step: 1,
    time: 0,
    subCalls: [],
  }
  const settled: ToolCallBlock = {
    kind: 'tool-result',
    seq: 2,
    time: 1,
    callId: 'call-1',
    call: { name: 'word_lookup', argsRaw: '{"word":"apple"}' },
    callTime: 0,
    content: [{ type: 'text', text: 'apple /ˈæp.əl/ — n. 苹果' }],
    isError: false,
    subCalls: [],
  }

  it('reads arguments from both call forms', () => {
    expect(argsTextOf(running)).toBe('{"word":"apple"}')
    expect(argsTextOf(settled)).toBe('{"word":"apple"}')
  })

  it('reports settled state and no output while running', () => {
    expect(isSettledTool(running)).toBe(false)
    expect(isSettledTool(settled)).toBe(true)
    expect(outputTextOf(running)).toBe('')
    expect(outputTextOf(settled)).toContain('apple')
  })

  it('falls back to the failure identity when a settled result has no content', () => {
    const failed: ToolCallBlock = {
      ...settled,
      isError: true,
      content: [],
      error: { name: 'ToolCallError', code: 'LOOKUP_FAILED' },
    }
    expect(outputTextOf(failed)).toBe('ToolCallError: LOOKUP_FAILED')
  })
})
