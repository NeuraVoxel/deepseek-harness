/**
 * Parse unknown JSON into a GraphDocument; fail loud on invalid input.
 */

import { graphDocumentSchema } from './schema.ts'
import type { GraphDocument } from './types.ts'

/**
 * Validate and return a GraphDocument.
 * @param input - unknown JSON value.
 * @returns parsed document.
 * @throws when validation fails.
 */
export function parseDocument(input: unknown): GraphDocument {
  const result = graphDocumentSchema.safeParse(input)
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue?.path.join('.') || '(root)'
    const message = issue?.message ?? 'invalid document'
    throw new Error(`GraphDocument parse failed at ${path}: ${message}`)
  }
  return result.data
}
