/**
 * Card rendering: both cards render from persisted metadata, and both fall back
 * to the generic row when that metadata is absent.
 * @module dsh-wordbook/src/client/card-render.spec
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-chat/client'
import { zh } from './locales.ts'
import { WordLookupCard, type WordLookupCardProps } from './WordLookupCard.tsx'
import { WordQueryCard, type WordQueryCardProps } from './WordQueryCard.tsx'

/** One stored word as the tools persist it. */
const word = {
  word: 'apple',
  display: 'Apple',
  phonetic: { us: '/ˈæp.əl/' },
  senses: [{ pos: 'n.', meaning: '苹果', examples: ['an apple a day'] }],
  model: { provider: 'scripted', model: 'test-model' },
  createdAt: 1,
  updatedAt: 2,
}

/** Bind the Chinese dictionary the way the locale seat does. */
const t = ((key: string, params?: Record<string, string>) => {
  const template = (zh as Record<string, string>)[key] ?? key
  return params === undefined
    ? template
    : template.replace(/\{(\w+)\}/gu, (_, name: string) => params[name] ?? '')
}) as WordLookupCardProps['t']

/** One settled result block carrying the given metadata. */
function settled(meta: unknown): ToolCallBlock {
  return {
    kind: 'tool-result',
    seq: 1,
    time: 0,
    callId: 'call-1',
    call: { name: 'word_lookup', argsRaw: '{"word":"apple"}' },
    callTime: 0,
    content: [{ type: 'text', text: 'apple — n. 苹果' }],
    isError: false,
    meta,
    subCalls: [],
  }
}

/** The props one card needs, with the seats a static render never touches. */
function props(block: ToolCallBlock): WordLookupCardProps & WordQueryCardProps {
  return { callId: 'call-1', toolName: 'word_lookup', block, t } as unknown as WordLookupCardProps & WordQueryCardProps
}

describe('WordLookupCard', () => {
  it('renders the word, its transcription, its senses, and the stored badge', () => {
    const html = renderToStaticMarkup(
      <WordLookupCard {...props(settled({ kind: 'lookup', created: true, refresh: false, entry: word }))} />,
    )

    expect(html).toContain('data-wordbook="lookup"')
    expect(html).toContain('Apple')
    expect(html).toContain('/ˈæp.əl/')
    expect(html).toContain('苹果')
    expect(html).toContain('an apple a day')
    expect(html).toContain(zh['lookup.created'])
    expect(html).toContain('scripted/test-model')
  })

  it('marks a repeat call as already stored', () => {
    const html = renderToStaticMarkup(
      <WordLookupCard {...props(settled({ kind: 'lookup', created: false, refresh: false, entry: word }))} />,
    )

    expect(html).toContain('data-state="existing"')
    expect(html).toContain(zh['lookup.existing'])
  })

  it('falls back to the generic row when the metadata is missing', () => {
    const html = renderToStaticMarkup(<WordLookupCard {...props(settled(undefined))} />)

    expect(html).toContain('data-wordbook="fallback"')
    expect(html).toContain(zh['lookup.title'])
  })

  it('falls back while the call is still running', () => {
    const running: ToolCallBlock = {
      callId: 'call-1', name: 'word_lookup', argsRaw: '{"word":"apple"}', turn: 1, step: 1, time: 0, subCalls: [],
    }
    const html = renderToStaticMarkup(<WordLookupCard {...props(running)} />)

    expect(html).toContain('data-wordbook="fallback"')
    expect(html).toContain(zh['lookup.running'])
  })
})

describe('WordQueryCard', () => {
  it('renders the match count, the listed words, and the cap note', () => {
    const html = renderToStaticMarkup(
      <WordQueryCard {...props(settled({ kind: 'query', entries: [word], total: 3 }))} />,
    )

    expect(html).toContain('data-wordbook="query"')
    expect(html).toContain('3 个匹配')
    expect(html).toContain('仅显示 1 个')
    expect(html).toContain('苹果')
  })

  it('renders the empty state without a cap note', () => {
    const html = renderToStaticMarkup(
      <WordQueryCard {...props(settled({ kind: 'query', entries: [], total: 0 }))} />,
    )

    expect(html).toContain('data-state="empty"')
    expect(html).toContain(zh['query.empty'])
    expect(html).not.toContain('仅显示')
  })

  it('falls back when the metadata belongs to the other tool', () => {
    const html = renderToStaticMarkup(
      <WordQueryCard {...props(settled({ kind: 'lookup', created: true, refresh: false, entry: word }))} />,
    )

    expect(html).toContain('data-wordbook="fallback"')
    expect(html).toContain(zh['query.title'])
  })
})
