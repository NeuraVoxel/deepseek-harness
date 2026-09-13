/**
 * `buildLookupPrompt` and `parseLookup` behavior: the protocol contract with
 * the model, exercised without any I/O.
 * @module dsh-wordbook/src/lookup.spec
 */

import { describe, expect, it } from 'vitest'
import { buildLookupPrompt, LookupError, parseLookup } from './lookup.ts'

const options = { maxSenses: 3 }

/** One complete protocol answer, so tests can vary a single field. */
function answer(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    word: 'apple',
    phonetic: { us: '/ˈæp.əl/', uk: '/ˈæp.əl/' },
    senses: [{ pos: 'n.', meaning: '苹果', examples: ['an apple a day'] }],
    ...over,
  })
}

/** Run `parseLookup` and return the failure code it raised. */
function failureCode(text: string): string {
  try {
    parseLookup(text, options)
  } catch (error) {
    if (error instanceof LookupError) return error.code
    throw error
  }
  throw new Error('parseLookup resolved where the test expected a failure')
}

describe('buildLookupPrompt', () => {
  it('names the word and advertises the sense bound', () => {
    const prompt = buildLookupPrompt('give up', { maxSenses: 5 })
    expect(prompt.user).toContain('give up')
    expect(prompt.system).toContain('at most 5')
    expect(prompt.system).toContain('ONE JSON object')
  })
})

describe('parseLookup', () => {
  it('parses a clean protocol answer', () => {
    const draft = parseLookup(answer(), options)
    expect(draft.phonetic).toEqual({ us: '/ˈæp.əl/', uk: '/ˈæp.əl/' })
    expect(draft.senses).toEqual([{ pos: 'n.', meaning: '苹果', examples: ['an apple a day'] }])
  })

  it('parses a fenced answer and one wrapped in prose', () => {
    const fenced = `Here it is:\n\`\`\`json\n${answer()}\n\`\`\`\nHope that helps.`
    expect(parseLookup(fenced, options).senses).toHaveLength(1)
    expect(parseLookup(`  ${answer()}  `, options).senses).toHaveLength(1)
  })

  it('ignores extra fields the protocol does not declare', () => {
    const draft = parseLookup(answer({ etymology: 'Old English æppel', senses: [
      { pos: 'n.', meaning: '苹果', frequency: 0.9 },
    ] }), options)
    expect(draft.senses).toEqual([{ pos: 'n.', meaning: '苹果' }])
  })

  it('trims values, drops empty senses, and deduplicates on pos and meaning', () => {
    const draft = parseLookup(answer({ phonetic: { us: '  /ˈæp.əl/  ', uk: '   ' }, senses: [
      { pos: ' n. ', meaning: ' 苹果 ', examples: ['  an apple  ', '   ', 'an apple'] },
      { pos: 'n.', meaning: '苹果' },
      { pos: 'v.', meaning: '   ' },
    ] }), options)

    expect(draft.phonetic).toEqual({ us: '/ˈæp.əl/' })
    expect(draft.senses).toEqual([{ pos: 'n.', meaning: '苹果', examples: ['an apple'] }])
  })

  it('caps the sense list at the configured bound', () => {
    const draft = parseLookup(answer({ senses: [
      { pos: 'n.', meaning: '甲' },
      { pos: 'n.', meaning: '乙' },
      { pos: 'n.', meaning: '丙' },
      { pos: 'n.', meaning: '丁' },
    ] }), { maxSenses: 2 })
    expect(draft.senses.map(sense => sense.meaning)).toEqual(['甲', '乙'])
  })

  it('omits the phonetic field when the answer carries no usable transcription', () => {
    expect(parseLookup(answer({ phonetic: undefined }), options).phonetic).toBeUndefined()
    expect(parseLookup(answer({ phonetic: { us: ' ', uk: '' } }), options).phonetic).toBeUndefined()
    expect(parseLookup(answer({ phonetic: {} }), options).phonetic).toBeUndefined()
  })

  it('reports an answer with no JSON object as invalid-json', () => {
    expect(failureCode('I could not find that word.')).toBe('invalid-json')
    expect(failureCode('')).toBe('invalid-json')
    expect(failureCode('{ broken')).toBe('invalid-json')
  })

  it('reports a wrong protocol shape as invalid-shape', () => {
    expect(failureCode(answer({ senses: undefined }))).toBe('invalid-shape')
    expect(failureCode(answer({ senses: 'apple' }))).toBe('invalid-shape')
    expect(failureCode(answer({ senses: [{ pos: 'n.' }] }))).toBe('invalid-shape')
    expect(failureCode(answer({ senses: [{ pos: 'n.', meaning: 42 }] }))).toBe('invalid-shape')
    expect(failureCode(answer({ phonetic: 'not an object' }))).toBe('invalid-shape')
    expect(failureCode(answer({ phonetic: { us: 42 } }))).toBe('invalid-shape')
  })

  it('reports a well-formed answer with no usable sense as unrecognized', () => {
    expect(failureCode(answer({ senses: [] }))).toBe('unrecognized')
    expect(failureCode(answer({ senses: [{ pos: 'n.', meaning: '   ' }] }))).toBe('unrecognized')
  })
})
