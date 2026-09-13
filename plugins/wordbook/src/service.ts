/**
 * Wordbook lookup orchestration: idempotent lookup over the stored records,
 * the auxiliary model request, and query delegation.
 * @module dsh-wordbook/src/service
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { FinishReason, GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { Config } from './config.ts'
import { buildLookupPrompt, LookupError, parseLookup, type LookupDraft } from './lookup.ts'
import type { WordRecord } from './spec.ts'
import type { WordStore } from './store.ts'
import type { QueryRequest, QueryResult } from './types.ts'
import { normalizeWord } from './word.ts'

/** One resolved auxiliary request route. */
export interface ModelRoute {
  /** Registered provider route. */
  readonly provider: string
  /** Exact model id. */
  readonly model: string
}

/** What one lookup call returns. */
export type LookupOutcome =
  | { readonly kind: 'existing'; readonly entry: WordRecord }
  | { readonly kind: 'created'; readonly entry: WordRecord }

/** Per-call lookup controls. */
export interface LookupOptions {
  /** Ignore a stored record and ask the model again. */
  readonly refresh?: boolean
  /** Caller cancellation; the configured deadline is combined with it. */
  readonly signal?: AbortSignal
  /** Originating session, stamped on the auxiliary request for routing. */
  readonly sessionId?: SessionId
}

/** Suffix appended to the user prompt on the single retry after a rejected answer. */
const STRICT_RETRY_SUFFIX = 'Answer with the JSON object only, and nothing else.'

/**
 * Translate one terminal finish reason into a failure, or undefined for a
 * normal stop. Infrastructure failures reject with the adapter's own error and
 * are never retried; protocol failures are {@link LookupError}s the caller
 * retries once.
 * @param finish - the assembler's terminal finish reason.
 * @returns the failure to raise, or undefined on a normal stop.
 */
function finishError(finish: FinishReason): Error | undefined {
  switch (finish.kind) {
    case 'stop':
      return undefined
    case 'max-tokens':
      return new LookupError('invalid-shape', 'wordbook: the model answer reached maxOutputTokens')
    case 'tool-calls':
      return new LookupError('invalid-shape', 'wordbook: the model answered with a tool call')
    case 'aborted':
    case 'error':
      return new Error(`wordbook: the model call failed (${finish.failure.code}): ${finish.failure.message}`)
    default:
      return new Error('wordbook: the model stream reported an unsupported finish reason')
  }
}

/** Idempotent word lookup and query over the wordbook store. */
export class WordbookService extends Service {
  /**
   * @param ctx - Host context carrying the LLM runtime.
   * @param store - the open word store.
   * @param config - validated plugin configuration.
   */
  constructor(
    ctx: Context,
    private readonly store: WordStore,
    private readonly config: Config,
  ) {
    super(ctx, 'wordbook')
  }

  /**
   * Look one word up, store it, and return the stored record.
   * @param word - the word or phrase to look up.
   * @param options - refresh, cancellation, and originating session.
   * @returns whether the call created the record or returned a stored one.
   * @throws {LookupError} when the model answer is unusable after one retry.
   */
  async lookup(word: string, options: LookupOptions = {}): Promise<LookupOutcome> {
    const key = normalizeWord(word)
    if (key === '') throw new LookupError('unrecognized', 'wordbook: no word was given')
    const existing = this.store.get(key)
    if (existing !== undefined && !(options.refresh ?? this.config.refreshByDefault)) {
      return { kind: 'existing', entry: existing }
    }

    const route = this.resolveRoute()
    const draft = await this.requestLookup(key, route, options)
    const now = Date.now()
    const entry: WordRecord = {
      word: key,
      display: word.trim(),
      ...draft.phonetic === undefined ? {} : { phonetic: draft.phonetic },
      senses: [...draft.senses],
      model: { provider: route.provider, model: route.model },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await this.store.put(entry)
    return { kind: 'created', entry }
  }

  /**
   * Query stored records, capping the result at the configured maximum.
   * @param request - optional text filter and result cap.
   * @returns matching entries plus the pre-cap match total.
   */
  query(request: QueryRequest = {}): QueryResult {
    const requested = request.limit ?? this.config.maxQueryResults
    return this.store.query({
      ...request.text === undefined ? {} : { text: request.text },
      limit: Math.min(requested, this.config.maxQueryResults),
    })
  }

  /**
   * Resolve the auxiliary request route from configuration or the agent default.
   * @returns the provider and model for the next request.
   * @throws when neither configuration nor the default-model service supplies one.
   */
  private resolveRoute(): ModelRoute {
    const { provider, model } = this.config
    if (provider !== undefined && model !== undefined) return { provider, model }
    const selection = this.ctx.get('agentDefaultModel')?.currentSelection()
    if (selection === undefined) {
      throw new Error('wordbook: no provider/model is configured and no agent default model is available')
    }
    return { provider: selection.provider, model: selection.model }
  }

  /**
   * Ask the model once, retrying a rejected answer exactly once with a stricter prompt.
   * @param word - the normalized word key.
   * @param route - the resolved provider and model.
   * @param options - cancellation and originating session.
   * @returns the normalized draft.
   * @throws {LookupError} when both attempts are rejected.
   */
  private async requestLookup(
    word: string,
    route: ModelRoute,
    options: LookupOptions,
  ): Promise<LookupDraft> {
    try {
      return await this.requestOnce(word, route, options, false)
    } catch (error) {
      if (!(error instanceof LookupError)) throw error
      return this.requestOnce(word, route, options, true)
    }
  }

  /**
   * Dispatch one auxiliary request and parse its answer.
   * @param word - the normalized word key.
   * @param route - the resolved provider and model.
   * @param options - cancellation and originating session.
   * @param strict - whether to append the stricter retry instruction.
   * @returns the normalized draft.
   */
  private async requestOnce(
    word: string,
    route: ModelRoute,
    options: LookupOptions,
    strict: boolean,
  ): Promise<LookupDraft> {
    const prompt = buildLookupPrompt(word, { maxSenses: this.config.maxSenses })
    const messages: Message[] = [createUserMessage({
      content: [{
        type: 'text',
        text: strict ? `${prompt.user}\n${STRICT_RETRY_SUFFIX}` : prompt.user,
      }],
      source: { kind: 'plugin', plugin: 'dsh-wordbook' },
    })]
    const signal = this.deadline(options.signal)
    signal.throwIfAborted()
    const request: GenerateOptions = {
      provider: route.provider,
      model: route.model,
      system: prompt.system,
      messages,
      maxTokens: this.config.maxOutputTokens,
      ...this.config.temperature === undefined ? {} : { temperature: this.config.temperature },
      ...options.sessionId === undefined ? {} : { sessionId: options.sessionId },
      signal,
    }

    const assembler = new BlockAssembler()
    for await (const chunk of this.ctx.llm.stream(request)) {
      signal.throwIfAborted()
      assembler.push(chunk)
    }
    const finish = assembler.finish
    if (finish === undefined) {
      throw new Error('wordbook: the model stream ended without a finish reason')
    }
    const terminal = finishError(finish)
    if (terminal !== undefined) throw terminal
    const answer = assembler.blocks()
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
    return parseLookup(answer, { maxSenses: this.config.maxSenses })
  }

  /**
   * Combine caller cancellation with the configured deadline.
   * @param signal - the caller's signal, when it has one.
   * @returns a signal that aborts on either cause.
   */
  private deadline(signal: AbortSignal | undefined): AbortSignal {
    const timeout = AbortSignal.timeout(this.config.timeoutMs)
    return signal === undefined ? timeout : AbortSignal.any([signal, timeout])
  }
}
