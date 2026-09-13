/**
 * Real-provider check: one lookup through the shipped DeepSeek adapter, which
 * is the only coverage of the provider's actual chunk shapes. Self-skips when
 * `DEEPSEEK_API_KEY` is unset, matching the repository's e2e policy.
 * @module dsh-wordbook/src/real-api
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as DeepSeek from '@deepseek-ai/dsh-llm-deepseek'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import { WordbookService } from './service.ts'
import { WordStore } from './store.ts'
import { TEST_CONFIG } from './testkit.ts'

/**
 * Ambient `process.env` is typed for the client build face; the Node face adds
 * the real variables, so read it through one widened view.
 */
const env = process.env as Record<string, string | undefined>
const apiKey = env['DEEPSEEK_API_KEY']
const suite = apiKey === undefined || apiKey === '' ? describe.skip : describe

suite('wordbook against the real provider', () => {
  it('stores one dictionary entry the shipped adapter actually returned', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wordbook-e2e-'))
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(DeepSeek, { apiKeyEnv: 'DEEPSEEK_API_KEY' })
    await ctx.plugin(Storage)
    await ctx.plugin(StorageJson, { root })
    await ctx.plugin(StorageDomain, { backend: 'json' })
    const store = await WordStore.open(ctx)
    try {
      const service = new WordbookService(ctx, store, {
        ...TEST_CONFIG,
        provider: 'deepseek-official',
        model: env['DSH_WORDBOOK_E2E_MODEL'] ?? 'deepseek-v4-flash',
        maxOutputTokens: 1024,
      })

      const outcome = await service.lookup('apple')

      expect(outcome.kind).toBe('created')
      expect(outcome.entry.senses.length).toBeGreaterThan(0)
      expect(outcome.entry.senses[0]!.meaning.length).toBeGreaterThan(0)
      expect(outcome.entry.model).toEqual({
        provider: 'deepseek-official',
        model: env['DSH_WORDBOOK_E2E_MODEL'] ?? 'deepseek-v4-flash',
      })
      expect(store.get('apple')).toBeDefined()
    } finally {
      await store.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})
