/**
 * WordStore behavior over the real JSON storage backend in a temporary root.
 * @module dsh-wordbook/src/store.spec
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import type { WordRecord } from './spec.ts'
import { WordStore } from './store.ts'

let root = ''
const open: WordStore[] = []

/** One stored record carrying test defaults for every field but `word`. */
function record(over: Partial<WordRecord> & { word: string }): WordRecord {
  return {
    display: over.word,
    senses: [{ pos: 'n.', meaning: '苹果' }],
    model: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

/** Mount the storage hub, the JSON backend, and the domain form over a fresh context. */
async function harness(): Promise<WordStore> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  const store = await WordStore.open(ctx)
  open.push(store)
  return store
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'wordbook-store-'))
})

afterEach(async () => {
  await Promise.all(open.splice(0).map(store => store.close()))
  await rm(root, { recursive: true, force: true })
})

describe('WordStore', () => {
  it('round-trips a record under its normalized key, keeping the typed display form', async () => {
    const store = await harness()
    await store.put(record({ word: '  Apple ', display: 'Apple' }))

    expect(store.size).toBe(1)
    expect(store.get('apple')?.display).toBe('Apple')
    expect(store.get('  APPLE  ')?.word).toBe('apple')
  })

  it('rejects an empty key instead of storing an unreachable record', async () => {
    const store = await harness()
    await expect(store.put(record({ word: '   ' }))).rejects.toThrow(/empty key/)
    expect(store.size).toBe(0)
  })

  it('mints the unit file the domain name declares', async () => {
    const store = await harness()
    await store.put(record({ word: 'apple' }))

    const raw = await readFile(join(root, 'wordbook.json'), 'utf8')
    expect(raw).toContain('"apple"')
  })

  it('reads records back after the store is closed and reopened over the same root', async () => {
    const first = await harness()
    await first.put(record({ word: 'apple', display: 'Apple' }))
    await first.close()

    const second = await harness()
    expect(second.get('apple')?.display).toBe('Apple')
  })

  it('frees the domain name after close so the same context can reopen it', async () => {
    const ctx = new Context()
    await ctx.plugin(Storage)
    await ctx.plugin(StorageJson, { root })
    await ctx.plugin(StorageDomain, { backend: 'json' })

    const first = await WordStore.open(ctx)
    await first.close()
    const second = await WordStore.open(ctx)
    open.push(second)

    expect(second.size).toBe(0)
  })

  it('matches the word or any sense meaning, newest first', async () => {
    const store = await harness()
    await store.put(record({
      word: 'apple',
      updatedAt: 10,
      senses: [{ pos: 'n.', meaning: '苹果' }, { pos: 'v.', meaning: '苹果手机' }],
    }))
    await store.put(record({ word: 'pear', updatedAt: 20, senses: [{ pos: 'n.', meaning: '梨' }] }))
    await store.put(record({ word: 'pineapple', updatedAt: 30, senses: [{ pos: 'n.', meaning: '菠萝' }] }))

    expect(store.query({ text: 'apple' }).entries.map(entry => entry.word)).toEqual(['pineapple', 'apple'])
    expect(store.query({ text: '苹果' }).entries.map(entry => entry.word)).toEqual(['apple'])
    expect(store.query({ text: 'PEAR' }).entries.map(entry => entry.word)).toEqual(['pear'])
    expect(store.query({ text: 'missing' }).entries).toEqual([])
  })

  it('returns every record newest first when the text filter is absent', async () => {
    const store = await harness()
    await store.put(record({ word: 'one', updatedAt: 1 }))
    await store.put(record({ word: 'two', updatedAt: 3 }))
    await store.put(record({ word: 'three', updatedAt: 2 }))

    const result = store.query()
    expect(result.total).toBe(3)
    expect(result.entries.map(entry => entry.word)).toEqual(['two', 'three', 'one'])
  })

  it('caps entries by the limit while total keeps the pre-cap match count', async () => {
    const store = await harness()
    for (const [index, word] of ['apple', 'applesauce', 'applejack'].entries()) {
      await store.put(record({ word, updatedAt: index }))
    }

    const result = store.query({ text: 'apple', limit: 2 })
    expect(result.entries).toHaveLength(2)
    expect(result.total).toBe(3)
  })
})
