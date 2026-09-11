#!/usr/bin/env node
/**
 * Run kit Agent Note format gate for this package.
 * Uses `@neuravoxel/ai-eng` public API because the `ai-eng` bin's direct-run
 * check fails under pnpm symlinks (argv path ≠ realpath import.meta.url).
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyAgentNoteFormat } from '@neuravoxel/ai-eng'

const notesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.agents', 'notes')
const result = verifyAgentNoteFormat(notesRoot)
if (!result.ok) {
  console.error('verify-notes: violations:')
  for (const error of result.errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(`verify-notes: ${result.checked} note(s) ok`)
