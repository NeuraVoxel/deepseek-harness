import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parseDocument } from '../src/protocol/parse.ts'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('fixtures', () => {
  for (const name of ['fleet.json', 'flow.json', 'teams-root.json']) {
    it(`parses ${name}`, () => {
      const raw = JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))
      const doc = parseDocument(raw)
      expect(doc.version).toBe(1)
      expect(doc.nodes.length).toBeGreaterThan(0)
    })
  }
})
