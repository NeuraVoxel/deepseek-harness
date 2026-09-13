/**
 * Pure translation between a word and the model's JSON answer: request text
 * construction plus strict parsing, validation, and normalization.
 * @module dsh-wordbook/src/lookup
 */

import { z } from 'zod'
import type { WordSense } from './spec.ts'
import { lookupSystemPrompt, lookupUserText, type LookupPromptOptions } from './prompts.ts'

/** Why one model answer could not become a word record. */
export type LookupFailureCode =
  /** The answer carried no JSON object at all. */
  | 'invalid-json'
  /** The JSON object did not match the lookup protocol. */
  | 'invalid-shape'
  /** The answer was well formed but named no sense for the word. */
  | 'unrecognized'

/** Raised when a model answer cannot become a word record. */
export class LookupError extends Error {
  /**
   * @param code - which stage rejected the answer.
   * @param message - concrete account of what was wrong.
   */
  constructor(readonly code: LookupFailureCode, message: string) {
    super(message)
    this.name = 'LookupError'
  }
}

/**
 * The protocol `parseLookup` accepts. Extra keys are dropped, and `word` is
 * accepted but ignored: the caller's own input owns the displayed form.
 */
const modelAnswerSchema = z.object({
  word: z.string().optional(),
  phonetic: z.object({
    us: z.string().optional(),
    uk: z.string().optional(),
  }).optional(),
  senses: z.array(z.object({
    pos: z.string().optional(),
    meaning: z.string(),
    examples: z.array(z.string()).optional(),
  })),
})

/** One model answer, inferred from {@link modelAnswerSchema}. */
type ModelAnswer = z.infer<typeof modelAnswerSchema>

/** One raw sense inside a model answer. */
type ModelSense = ModelAnswer['senses'][number]

/** Phonetic transcriptions as the model protocol declares them. */
export type LookupPhonetic = NonNullable<ModelAnswer['phonetic']>

/** What one successful answer yields, before the service stamps identity, route, and timestamps. */
export interface LookupDraft {
  /** Trimmed phonetic transcriptions; the whole field is absent when the answer carried none. */
  readonly phonetic?: LookupPhonetic
  /** Normalized senses, most common first. */
  readonly senses: readonly WordSense[]
}

/**
 * Build the one-shot request text for a lookup.
 * @param word - the word or phrase to look up.
 * @param options - the sense bound advertised to the model.
 * @returns the system and user prompt text for `ctx.llm.stream`.
 */
export function buildLookupPrompt(
  word: string,
  options: LookupPromptOptions,
): { system: string; user: string } {
  return { system: lookupSystemPrompt(options), user: lookupUserText(word) }
}

/**
 * Extract the outermost JSON object from one model answer, tolerating prose or
 * a Markdown fence around it.
 * @param text - the joined text of the answer's text blocks.
 * @returns the object source text, or undefined when the answer has none.
 */
function extractJsonObject(text: string): string | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start === -1 || end <= start ? undefined : text.slice(start, end + 1)
}

/**
 * Parse, validate, and normalize one model answer.
 * @param text - the joined text of the answer's text blocks.
 * @param options - the sense bound applied during normalization.
 * @returns the normalized draft.
 * @throws {LookupError} `invalid-json`, `invalid-shape`, or `unrecognized`.
 */
export function parseLookup(text: string, options: LookupPromptOptions): LookupDraft {
  const source = extractJsonObject(text)
  if (source === undefined) {
    throw new LookupError('invalid-json', 'wordbook: the model answer contained no JSON object')
  }
  let decoded: unknown
  try {
    decoded = JSON.parse(source)
  } catch (error) {
    throw new LookupError('invalid-json', `wordbook: the model answer was not valid JSON (${String(error)})`)
  }
  const parsed = modelAnswerSchema.safeParse(decoded)
  if (!parsed.success) {
    const fields = parsed.error.issues.map(issue => issue.path.join('.') || '(root)').join(', ')
    throw new LookupError('invalid-shape', `wordbook: the model answer did not match the lookup protocol (${fields})`)
  }

  const senses = normalizeSenses(parsed.data.senses, options.maxSenses)
  if (senses.length === 0) {
    throw new LookupError('unrecognized', 'wordbook: the model returned no sense for this word')
  }
  const phonetic = normalizePhonetic(parsed.data.phonetic)
  return phonetic === undefined ? { senses } : { phonetic, senses }
}

/**
 * Trim, deduplicate, drop empty senses, and cap the list.
 * @param senses - the answer's raw sense list.
 * @param maxSenses - the cap applied after deduplication.
 * @returns the normalized senses.
 */
function normalizeSenses(
  senses: readonly ModelSense[],
  maxSenses: number,
): WordSense[] {
  const seen = new Set<string>()
  const normalized: WordSense[] = []
  for (const sense of senses) {
    const meaning = sense.meaning.trim()
    if (meaning === '') continue
    const pos = sense.pos?.trim() ?? ''
    const key = `${pos}\u0000${meaning}`
    if (seen.has(key)) continue
    seen.add(key)
    const examples = normalizeExamples(sense.examples)
    normalized.push(examples === undefined ? { pos, meaning } : { pos, meaning, examples })
    if (normalized.length === maxSenses) break
  }
  return normalized
}

/**
 * Trim and deduplicate examples, dropping empties.
 * @param examples - the answer's raw examples for one sense.
 * @returns the normalized examples, or undefined when none survive.
 */
function normalizeExamples(examples: readonly string[] | undefined): string[] | undefined {
  if (examples === undefined) return undefined
  const kept: string[] = []
  for (const example of examples) {
    const trimmed = example.trim()
    if (trimmed !== '' && !kept.includes(trimmed)) kept.push(trimmed)
  }
  return kept.length === 0 ? undefined : kept
}

/**
 * Trim both transcriptions and drop the field when neither survives.
 * @param phonetic - the answer's raw phonetic object.
 * @returns the trimmed transcriptions, or undefined when empty.
 */
function normalizePhonetic(phonetic: ModelAnswer['phonetic']): LookupPhonetic | undefined {
  if (phonetic === undefined) return undefined
  const us = phonetic.us?.trim()
  const uk = phonetic.uk?.trim()
  const kept: LookupPhonetic = {
    ...us === undefined || us === '' ? {} : { us },
    ...uk === undefined || uk === '' ? {} : { uk },
  }
  return Object.keys(kept).length === 0 ? undefined : kept
}
