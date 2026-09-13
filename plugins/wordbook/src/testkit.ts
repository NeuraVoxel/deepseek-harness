/**
 * Shared test doubles for the wordbook specs: a scripted LLM adapter and a
 * harness that mounts the real LLM runtime and storage stack over a temporary
 * JSON root.
 * @module dsh-wordbook/src/testkit
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { Config } from './config.ts'
import { WordbookService } from './service.ts'
import type { WordRecord } from './spec.ts'
import { WordStore } from './store.ts'

/** The configuration every harness mounts unless a test overrides a field. */
export const TEST_CONFIG: Config = {
  provider: 'scripted',
  model: 'test-model',
  maxOutputTokens: 512,
  timeoutMs: 5000,
  maxSenses: 3,
  refreshByDefault: false,
  maxQueryResults: 2,
}

/** Scripted provider: replays one queued answer per request, in order. */
export class ScriptedAdapter extends LlmAdapter {
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

/**
 * One complete text answer as the chunk stream an adapter would emit.
 * @param text - the answer's single text block.
 * @returns the chunk sequence ending in a normal stop.
 */
export function chunks(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

/**
 * One protocol answer for `apple` carrying the given senses.
 * @param senses - the senses the answer declares.
 * @returns the chunk sequence for one complete answer.
 */
export function answer(senses: readonly { pos: string; meaning: string }[]): StreamChunk[] {
  return chunks(JSON.stringify({
    word: 'apple',
    phonetic: { us: '/ˈæp.əl/' },
    senses,
  }))
}

/**
 * The user prompt text of one dispatched request.
 * @param request - the request the adapter received.
 * @returns the first text block of the first message, or the empty string.
 */
export function promptText(request: GenerateOptions): string {
  const block = request.messages[0]?.content[0]
  return block?.type === 'text' ? block.text : ''
}

/**
 * One stored record carrying test defaults for every field but the overrides.
 * @param word - the normalized key and default display form.
 * @param updatedAt - creation and update stamp.
 * @returns the record to store.
 */
export function stored(word: string, updatedAt: number): WordRecord {
  return {
    word,
    display: word,
    senses: [{ pos: 'n.', meaning: '苹果' }],
    model: { provider: 'scripted', model: 'test-model' },
    createdAt: updatedAt,
    updatedAt,
  }
}

/** One mounted wordbook runtime over a temporary JSON storage root. */
export interface WordbookHarness {
  /** Root context carrying the mounted services. */
  readonly ctx: Context
  /** The scripted provider the runtime dispatches to. */
  readonly adapter: ScriptedAdapter
  /** The open word store. */
  readonly store: WordStore
  /** The wordbook service over that store. */
  readonly service: WordbookService
  /** Close the store and remove the temporary root. */
  dispose(): Promise<void>
}

/**
 * Mount the real LLM runtime, tool registry, and storage stack over one
 * scripted adapter. The tool registry waits for the system-prompt service, so
 * both mount here.
 * @param script - one answer (or thrown failure) per expected request.
 * @param config - configuration overrides merged over {@link TEST_CONFIG}.
 * @returns the harness; the caller must call `dispose()`.
 */
export async function mountWordbook(
  script: (readonly StreamChunk[] | Error)[],
  config: Config = TEST_CONFIG,
): Promise<WordbookHarness> {
  const root = await mkdtemp(join(tmpdir(), 'wordbook-'))
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  const adapter = new ScriptedAdapter(script)
  ctx.llm.registerAdapter(['scripted'], adapter)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  const store = await WordStore.open(ctx)
  const service = new WordbookService(ctx, store, config)
  return {
    ctx,
    adapter,
    store,
    service,
    async dispose() {
      await store.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}
