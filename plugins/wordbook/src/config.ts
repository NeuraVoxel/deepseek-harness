/**
 * Wordbook plugin configuration: deployment-varying bounds and the optional
 * auxiliary lookup route.
 * @module dsh-wordbook/src/config
 */

import z from '@deepseek-ai/schemastery'

/** Validated wordbook configuration. */
export interface Config {
  /** Registered provider route for the auxiliary lookup; omit it with `model` to use the agent default model. */
  provider?: string
  /** Exact model id paired with {@link Config.provider}. */
  model?: string
  /** Output-token cap for one lookup answer. */
  maxOutputTokens: number
  /** Sampling temperature passed to the adapter; absent keeps the model default. */
  temperature?: number
  /** End-to-end deadline for one lookup, in milliseconds. */
  timeoutMs: number
  /** Sense bound advertised to the model and enforced while normalizing. */
  maxSenses: number
  /** Whether an existing record is refreshed instead of returned as stored. */
  refreshByDefault: boolean
  /** Result cap for one query. */
  maxQueryResults: number
}

/** Schemastery schema with the shipped defaults. */
export const Config: z<Config> = z.object({
  provider: z.string(),
  model: z.string(),
  maxOutputTokens: z.number().min(1).default(1024),
  temperature: z.number(),
  timeoutMs: z.number().min(1).default(20000),
  maxSenses: z.number().min(1).default(8),
  refreshByDefault: z.boolean().default(false),
  maxQueryResults: z.number().min(1).default(20),
})
