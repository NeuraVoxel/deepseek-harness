/**
 * Wordbook lookup behavior: idempotency, the single retry, and the guarantee
 * that a rejected lookup stores nothing. A scripted adapter stands in for the
 * provider, so the real LLM runtime, block assembler, and storage stack run.
 * @module dsh-wordbook/src/service.spec
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import LlmRuntime, { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import type { Config } from './config.ts'
import * as WordbookHost from './index.ts'
import { LookupError } from './lookup.ts'
import { WordbookService } from './service.ts'
import type { WordRecord } from './spec.ts'
import { WordStore } from './store.ts'

/** Scripted provider: replays one queued answer per request, in order. */
class ScriptedAdapter extends LlmAdapter {
  /** Every request the runtime dispatched, in order. */
  readonly requests: GenerateOptions[] = []
  private readonly script: (readonly StreamChunk[] | Error)[]

  /**
   * @param script - one answer (or thrown failure) per expected request.
   */
  constructor(script: (readonly StreamChunk[] | Error)[]) {
    super()
    this.script = [...script]
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const answer = this.script.shift()
    if (answer === undefined) throw new Error('scripted adapter: no scripted answer left')
    if (answer instanceof Error) throw answer
    for (const chunk of answer) yield chunk
  }
}

/** One complete text answer as the chunk stream an adapter would emit. */
function chunks(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

/** One protocol answer naming `word` and the given senses. */
function answer(senses: readonly { pos: string; meaning: string }[]): StreamChunk[] {
  return chunks(JSON.stringify({
    word: 'apple',
    phonetic: { us: '/ˈæp.əl/' },
    senses,
  }))
}

/** The user prompt text of one dispatched request. */
function promptText(request: GenerateOptions): string {
  const block = request.messages[0]?.content[0]
  return block?.type === 'text' ? block.text : ''
}

/** One stored record carrying test defaults for every field but the overrides. */
function stored(word: string, updatedAt: number): WordRecord {
  return {
    word,
    display: word,
    senses: [{ pos: 'n.', meaning: '苹果' }],
    model: { provider: 'scripted', model: 'test-model' },
    createdAt: updatedAt,
    updatedAt,
  }
}

const config: Config = {
  provider: 'scripted',
  model: 'test-model',
  maxOutputTokens: 512,
  timeoutMs: 5000,
  maxSenses: 3,
  refreshByDefault: false,
  maxQueryResults: 2,
}

let root = ''
const stores: WordStore[] = []

/** Mount the real LLM runtime and storage stack over one scripted adapter. */
async function harness(script: (readonly StreamChunk[] | Error)[]) {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  const adapter = new ScriptedAdapter(script)
  ctx.llm.registerAdapter(['scripted'], adapter)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  const store = await WordStore.open(ctx)
  stores.push(store)
  return { adapter, store, service: new WordbookService(ctx, store, config) }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'wordbook-service-'))
})

afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.close()))
  await rm(root, { recursive: true, force: true })
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

describe('WordbookService.query', () => {  it('caps entries at maxQueryResults while total keeps the pre-cap match count', async () => {
    const { store, service } = await harness([])
    await store.put(stored('apple', 1))
    await store.put(stored('applesauce', 2))
    await store.put(stored('applejack', 3))

    const result = service.query({ text: 'apple' })

    expect(result.entries).toHaveLength(config.maxQueryResults)
    expect(result.total).toBe(3)
  })

  it('never exceeds the configured cap even when the caller asks for more', async () => {
    const { store, service } = await harness([])
    await store.put(stored('apple', 1))
    await store.put(stored('applesauce', 2))
    await store.put(stored('applejack', 3))

    expect(service.query({ text: 'apple', limit: 99 }).entries).toHaveLength(config.maxQueryResults)
  })
})

describe('wordbook Host half', () => {
  it('owns the command, the service, and the domain as effects, so a remount after unmount succeeds', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(CommandRuntime)
    await ctx.plugin(Storage)
    await ctx.plugin(StorageJson, { root })
    await ctx.plugin(StorageDomain, { backend: 'json' })

    const first = await ctx.plugin(WordbookHost, config)
    await first.dispose()
    // A leaked command registration, service key, or open domain would make the
    // second mount throw instead of activating.
    const second = await ctx.plugin(WordbookHost, config)

    expect(ctx.get('wordbook')).toBeDefined()
    await second.dispose()
  })
})
