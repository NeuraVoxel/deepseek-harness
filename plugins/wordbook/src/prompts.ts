/**
 * Model-facing prompt text for one word lookup. The JSON protocol below is a
 * fixed contract between this plugin and the model; `parseLookup` enforces it.
 * @module dsh-wordbook/src/prompts
 */

/** Normalization bound the system prompt advertises to the model. */
export interface LookupPromptOptions {
  /** Maximum senses the model should return. */
  readonly maxSenses: number
}

/**
 * Build the system instruction for one lookup.
 * @param options - the sense bound advertised to the model.
 * @returns the system prompt text.
 */
export function lookupSystemPrompt(options: LookupPromptOptions): string {
  return [
    'You compile one dictionary entry for a personal vocabulary notebook.',
    'Answer with ONE JSON object and no other text, using exactly this protocol:',
    '{"word": string, "phonetic": {"us"?: string, "uk"?: string}, "senses": [{"pos": string, "meaning": string, "examples"?: string[]}]}',
    'Rules:',
    '- meanings are Simplified Chinese; pos uses standard abbreviations such as n., v., adj., adv.',
    `- most common senses first, at most ${options.maxSenses} of them.`,
    '- at most 2 short examples per sense; omit the field when you have none.',
    '- wrap phonetic transcriptions in slashes, for example /ˈæp.əl/.',
    '- return an empty senses array instead of inventing a word you do not know.',
  ].join('\n')
}

/**
 * Build the user message text for one lookup.
 * @param word - the word or phrase to look up.
 * @returns the user prompt text.
 */
export function lookupUserText(word: string): string {
  return `Look up the word: ${word}`
}
