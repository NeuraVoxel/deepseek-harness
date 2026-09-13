/**
 * Word-key normalization shared by the store and the lookup pipeline.
 * @module dsh-wordbook/src/word
 */

/**
 * Normalize one word or phrase into its storage key: trim the ends, case-fold,
 * and collapse internal whitespace.
 * @param input - raw user- or model-supplied text.
 * @returns the normalized key; empty when the input carries no word.
 */
export function normalizeWord(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/gu, ' ')
}
