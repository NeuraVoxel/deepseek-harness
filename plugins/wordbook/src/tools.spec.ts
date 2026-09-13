/**
 * Model-facing word tools over the real tool registry: registration, canonical
 * values, model-facing text, and card metadata.
 * @module dsh-wordbook/src/tools.spec
 */

import { afterEach, describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import type { WordRecord } from './spec.ts'
import { answer, chunks, mountWordbook, stored, TEST_CONFIG, type WordbookHarness } from './testkit.ts'
import { registerWordTools } from './tools.ts'

let callCounter = 0
const harnesses: WordbookHarness[] = []

/** Mount one scripted harness and register both word tools on its registry. */
async function scene(script: Parameters<typeof mountWordbook>[0]): Promise<WordbookHarness> {
  const mounted = await mountWordbook(script)
  registerWordTools(mounted.ctx, mounted.service)
  harnesses.push(mounted)
  return mounted
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(mounted => mounted.dispose()))
})

/** Invoke one registered tool through the real execution pipeline. */
function call(ctx: Context, name: string, args: unknown): Promise<ToolExecutionResult> {
  return ctx.tools.execute({
    signal: new AbortController().signal,
    callId: ToolCallId(`call-${++callCounter}`),
    name,
    arguments: args,
  })
}

/** The canonical value of a successful call, or a loud failure. */
function valueOf<T>(result: ToolExecutionResult): T {
  if (result.isError) throw new Error(`expected a successful call, got ${JSON.stringify(result.error)}`)
  return result.value as T
}

/** The joined text of one result's content blocks. */
function textOf(result: ToolExecutionResult): string {
  return result.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

describe('word tools', () => {
  it('registers both tools with their parameters', async () => {
    const { ctx } = await scene([])
    const schemas = ctx.tools.schemas()
    const lookup = schemas.find(schema => schema.name === 'word_lookup')
    const query = schemas.find(schema => schema.name === 'word_query')

    expect(lookup).toBeDefined()
    expect(query).toBeDefined()
    const parameters = (lookup!.parameters as { properties?: Record<string, unknown> }).properties ?? {}
    expect(Object.keys(parameters).sort()).toEqual(['refresh', 'word'])
  })

  it('stores on the first call and returns the stored entry on the second without asking again', async () => {
    const { ctx, adapter, store } = await scene([answer([{ pos: 'n.', meaning: '苹果' }])])

    const first = await call(ctx, 'word_lookup', { word: 'apple' })
    const second = await call(ctx, 'word_lookup', { word: 'apple' })

    expect(valueOf<{ created: boolean }>(first).created).toBe(true)
    expect(valueOf<{ created: boolean }>(second).created).toBe(false)
    expect(adapter.requests).toHaveLength(1)
    expect(store.size).toBe(1)
    expect(textOf(first)).toContain('Stored in the wordbook.')
    expect(textOf(second)).toContain('Already stored')
    expect(first.meta).toMatchObject({ kind: 'lookup', created: true, refresh: false })
  })

  it('carries the requested refresh flag into the card metadata', async () => {
    const { ctx } = await scene([
      answer([{ pos: 'n.', meaning: '苹果' }]),
      answer([{ pos: 'n.', meaning: '苹果树' }]),
    ])
    await call(ctx, 'word_lookup', { word: 'apple' })

    const refreshed = await call(ctx, 'word_lookup', { word: 'apple', refresh: true })

    expect(valueOf<{ created: boolean }>(refreshed).created).toBe(true)
    expect(refreshed.meta).toMatchObject({ kind: 'lookup', created: true, refresh: true })
  })

  it('fails the call and stores nothing when the model answer stays unusable', async () => {
    const { ctx, store } = await scene([chunks('not JSON'), chunks('still not JSON')])

    const result = await call(ctx, 'word_lookup', { word: 'apple' })

    expect(result.isError).toBe(true)
    expect(store.size).toBe(0)
  })

  it('reports the pre-cap total and the listed entries separately, with card metadata', async () => {
    const { ctx, store } = await scene([])
    await store.put(stored('apple', 1))
    await store.put(stored('applesauce', 2))
    await store.put(stored('applejack', 3))

    const result = await call(ctx, 'word_query', { text: 'apple' })
    const value = valueOf<{ entries: WordRecord[]; total: number }>(result)

    expect(value.total).toBe(3)
    expect(value.entries).toHaveLength(TEST_CONFIG.maxQueryResults)
    expect(textOf(result)).toContain('3 stored words matched (showing 2)')
    expect(result.meta).toMatchObject({ kind: 'query', total: 3 })
  })

  it('returns stored words newest first when no text filter is given', async () => {
    const { ctx, store } = await scene([])
    await store.put(stored('one', 1))
    await store.put(stored('two', 5))

    const value = valueOf<{ entries: WordRecord[]; total: number }>(await call(ctx, 'word_query', {}))

    expect(value.total).toBe(2)
    expect(value.entries.map(entry => entry.word)).toEqual(['two', 'one'])
  })

  it('answers an empty wordbook without failing', async () => {
    const { ctx } = await scene([])

    const result = await call(ctx, 'word_query', { text: 'nothing' })

    expect(result.isError).toBe(false)
    expect(textOf(result)).toBe('No stored word matched.')
  })
})
