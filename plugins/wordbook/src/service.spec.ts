/**
 * Wordbook lookup behavior: idempotency, the single retry, and the guarantee
 * that a rejected lookup stores nothing. The harness in `testkit` mounts the
 * real LLM runtime, block assembler, and storage stack over a scripted adapter.
 * @module dsh-wordbook/src/service.spec
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as WordbookHost from './index.ts'
import { LookupError } from './lookup.ts'
import { answer, chunks, mountWordbook, promptText, stored, TEST_CONFIG, type WordbookHarness } from './testkit.ts'

const harnesses: WordbookHarness[] = []

/** Mount one scripted harness and register it for teardown. */
async function harness(script: Parameters<typeof mountWordbook>[0]): Promise<WordbookHarness> {
  const mounted = await mountWordbook(script)
  harnesses.push(mounted)
  return mounted
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(mounted => mounted.dispose()))
})

describe('WordbookService.lookup', () => {
  it('creates the record on the first lookup and asks the model exactly once', async () => {
    const { adapter, store, service } = await harness([answer([{ pos: 'n.', meaning: '苹果' }])])

    const outcome = await service.lookup('  Apple  ')

    expect(adapter.requests).toHaveLength(1)
    expect(outcome.kind).toBe('created')
    expect(outcome.entry.word).toBe('apple')
    expect(outcome.entry.display).toBe('Apple')
    expect(outcome.entry.model).toEqual({ provider: 'scripted', model: 'test-model' })
    expect(outcome.entry.phonetic).toEqual({ us: '/ˈæp.əl/' })
    expect(store.get('apple')?.senses).toEqual([{ pos: 'n.', meaning: '苹果' }])
  })

  it('returns the stored record on a repeat lookup without asking the model again', async () => {
    const { adapter, service } = await harness([answer([{ pos: 'n.', meaning: '苹果' }])])
    await service.lookup('apple')

    const second = await service.lookup('APPLE')

    expect(adapter.requests).toHaveLength(1)
    expect(second.kind).toBe('existing')
  })

  it('asks again on refresh and rewrites the same record', async () => {
    const { adapter, store, service } = await harness([
      answer([{ pos: 'n.', meaning: '苹果' }]),
      answer([{ pos: 'n.', meaning: '苹果树' }]),
    ])
    const first = await service.lookup('apple')

    const refreshed = await service.lookup('apple', { refresh: true })

    expect(adapter.requests).toHaveLength(2)
    expect(refreshed.kind).toBe('created')
    expect(store.size).toBe(1)
    expect(store.get('apple')?.senses).toEqual([{ pos: 'n.', meaning: '苹果树' }])
    expect(refreshed.entry.createdAt).toBe(first.entry.createdAt)
  })

  it('retries a rejected answer once with a stricter prompt, then stores the good answer', async () => {
    const { adapter, store, service } = await harness([
      chunks('I am not going to answer in JSON.'),
      answer([{ pos: 'n.', meaning: '苹果' }]),
    ])

    const outcome = await service.lookup('apple')

    expect(outcome.kind).toBe('created')
    expect(adapter.requests).toHaveLength(2)
    expect(promptText(adapter.requests[1]!)).not.toBe(promptText(adapter.requests[0]!))
    expect(promptText(adapter.requests[1]!)).toContain('nothing else')
    expect(store.get('apple')).toBeDefined()
  })

  it('gives up after one retry and stores nothing', async () => {
    const { adapter, store, service } = await harness([
      chunks('still not JSON'),
      chunks('still not JSON either'),
    ])

    await expect(service.lookup('apple')).rejects.toBeInstanceOf(LookupError)

    expect(adapter.requests).toHaveLength(2)
    expect(store.size).toBe(0)
  })

  it('reports a well-formed answer with no usable sense as unrecognized and stores nothing', async () => {
    const { adapter, store, service } = await harness([
      chunks(JSON.stringify({ word: 'asdfgh', senses: [] })),
      chunks(JSON.stringify({ word: 'asdfgh', senses: [{ pos: 'n.', meaning: '   ' }] })),
    ])

    await expect(service.lookup('asdfgh')).rejects.toMatchObject({ code: 'unrecognized' })

    expect(adapter.requests).toHaveLength(2)
    expect(store.size).toBe(0)
  })

  it('does not retry an infrastructure failure', async () => {
    const { adapter, store, service } = await harness([new Error('provider exploded')])

    await expect(service.lookup('apple')).rejects.toThrow('provider exploded')

    expect(adapter.requests).toHaveLength(1)
    expect(store.size).toBe(0)
  })

  it('honors a pre-aborted caller signal without dispatching a request', async () => {
    const { adapter, store, service } = await harness([answer([{ pos: 'n.', meaning: '苹果' }])])

    await expect(service.lookup('apple', { signal: AbortSignal.abort() })).rejects.toThrow()

    expect(adapter.requests).toHaveLength(0)
    expect(store.size).toBe(0)
  })

  it('rejects an empty word before touching storage or the model', async () => {
    const { adapter, store, service } = await harness([])

    await expect(service.lookup('   ')).rejects.toMatchObject({ code: 'unrecognized' })

    expect(adapter.requests).toHaveLength(0)
    expect(store.size).toBe(0)
  })
})

describe('WordbookService.query', () => {
  it('caps entries at maxQueryResults while total keeps the pre-cap match count', async () => {
    const { store, service } = await harness([])
    await store.put(stored('apple', 1))
    await store.put(stored('applesauce', 2))
    await store.put(stored('applejack', 3))

    const result = service.query({ text: 'apple' })

    expect(result.entries).toHaveLength(TEST_CONFIG.maxQueryResults)
    expect(result.total).toBe(3)
  })

  it('never exceeds the configured cap even when the caller asks for more', async () => {
    const { store, service } = await harness([])
    await store.put(stored('apple', 1))
    await store.put(stored('applesauce', 2))
    await store.put(stored('applejack', 3))

    expect(service.query({ text: 'apple', limit: 99 }).entries).toHaveLength(TEST_CONFIG.maxQueryResults)
  })
})

describe('wordbook Host half', () => {
  it('owns the command, the tools, the service, and the domain as effects, so a remount after unmount succeeds', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wordbook-remount-'))
    try {
      const ctx = new Context()
      await ctx.plugin(LlmRuntime)
      await ctx.plugin(CommandRuntime)
      await ctx.plugin(SystemPrompt)
      await ctx.plugin(ToolRuntime)
      await ctx.plugin(Storage)
      await ctx.plugin(StorageJson, { root })
      await ctx.plugin(StorageDomain, { backend: 'json' })

      const first = await ctx.plugin(WordbookHost, TEST_CONFIG)
      expect(ctx.tools.schemas().map(schema => schema.name)).toContain('word_lookup')
      await first.dispose()
      expect(ctx.tools.schemas()).toHaveLength(0)

      // A leaked command registration, tool registration, service key, or open
      // domain would make the second mount throw instead of activating.
      const second = await ctx.plugin(WordbookHost, TEST_CONFIG)

      expect(ctx.get('wordbook')).toBeDefined()
      expect(ctx.tools.schemas().map(schema => schema.name).sort()).toEqual(['word_lookup', 'word_query'])
      await second.dispose()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
