/**
 * `/word` grammar and result text: pure functions, no model and no storage.
 * @module dsh-wordbook/src/command.spec
 */

import { describe, expect, it } from 'vitest'
import { formatLookupOutcome, parseWordCommand } from './command.ts'
import type { WordRecord } from './spec.ts'

/** One stored record carrying test defaults for every field but the overrides. */
function entry(over: Partial<WordRecord> & { word: string }): WordRecord {
  return {
    display: over.word,
    senses: [{ pos: 'n.', meaning: '苹果' }],
    model: { provider: 'scripted', model: 'test-model' },
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

describe('parseWordCommand', () => {
  it('reads one word, with or without surrounding whitespace', () => {
    expect(parseWordCommand('apple')).toEqual({ word: 'apple', refresh: false })
    expect(parseWordCommand('  give up  ')).toEqual({ word: 'give up', refresh: false })
  })

  it('recognizes a leading --refresh and reads the rest as the word', () => {
    expect(parseWordCommand('--refresh apple')).toEqual({ word: 'apple', refresh: true })
    expect(parseWordCommand('  --refresh   give up ')).toEqual({ word: 'give up', refresh: true })
  })

  it('keeps a trailing --refresh inside a phrase, since only the leading token is a flag', () => {
    expect(parseWordCommand('apple --refresh')).toEqual({ word: 'apple --refresh', refresh: false })
  })

  it('reports no word for an empty or flag-only invocation', () => {
    expect(parseWordCommand('')).toBeUndefined()
    expect(parseWordCommand('   ')).toBeUndefined()
    expect(parseWordCommand('--refresh')).toBeUndefined()
    expect(parseWordCommand('--refresh   ')).toBeUndefined()
  })
})

describe('formatLookupOutcome', () => {
  it('names the word, its transcription, and its senses, marking a fresh store', () => {
    const text = formatLookupOutcome({
      kind: 'created',
      entry: entry({
        word: 'apple',
        display: 'apple',
        phonetic: { us: '/ˈæp.əl/' },
        senses: [{ pos: 'n.', meaning: '苹果' }, { pos: '', meaning: '苹果树' }],
      }),
    })
    expect(text).toBe('apple /ˈæp.əl/ — n. 苹果；苹果树（已入库）')
  })

  it('marks an already stored record so the reader knows the model was not asked', () => {
    const text = formatLookupOutcome({ kind: 'existing', entry: entry({ word: 'apple' }) })
    expect(text).toBe('apple — n. 苹果（已存在，未重新查询）')
  })

  it('falls back to the British transcription and omits a missing one', () => {
    const british = formatLookupOutcome({
      kind: 'created',
      entry: entry({ word: 'colour', phonetic: { uk: '/ˈkʌl.ər/' } }),
    })
    expect(british).toContain('/ˈkʌl.ər/')
    const bare = formatLookupOutcome({ kind: 'created', entry: entry({ word: 'bare' }) })
    expect(bare).toBe('bare — n. 苹果（已入库）')
  })
})
