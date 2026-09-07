/**
 * Example: call a model through `@deepseek-ai/dsh-llm-deepseek` (not raw fetch).
 *
 * Stack (same minimal composition as package e2e / README):
 *   Context → LlmRuntime → LlmDeepSeek → ctx.llm.stream({ provider: 'deepseek-official', ... })
 *
 * Run from repo root (resolves workspace packages via the llm-deepseek package):
 *
 *   export DEEPSEEK_API_KEY=sk-...
 *   # optional: DEEPSEEK_BASE_URL / DEEPSEEK_MODEL
 *   pnpm --filter @deepseek-ai/dsh-llm-deepseek exec \
 *     node --import tsx/esm ../../../apps/api/call-llm-deepseek.ts
 *   pnpm --filter @deepseek-ai/dsh-llm-deepseek exec \
 *     node --import tsx/esm ../../../apps/api/call-llm-deepseek.ts "用一句话介绍你自己"
 *
 * For the wire-level `POST /chat/completions` demo, see `call-llm.mjs` beside this file.
 */

import { readFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, {
  BlockAssembler,
  createUserMessage,
  type ContentBlock,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import * as LlmDeepSeek from '@deepseek-ai/dsh-llm-deepseek'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
loadDotEnv(resolve(ROOT, '.env'))

const prompt = process.argv.slice(2).join(' ').trim() || 'hi'
const apiKey = process.env.DEEPSEEK_API_KEY
if (!apiKey) {
  console.error('Missing DEEPSEEK_API_KEY. Set it in the environment or repo-root .env')
  process.exit(1)
}

const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const baseURL = process.env.DEEPSEEK_BASE_URL ?? LlmDeepSeek.PUBLIC_BASE_URL

// Plugin resolves the anonymous user id under $DSH_HOME (default ~/.dsh).
// Pin a temp home so this demo never writes into a real install directory.
if (process.env.DSH_HOME === undefined) {
  process.env.DSH_HOME = mkdtempSync(resolve(tmpdir(), 'dsh-api-example-'))
}

const ctx = new Context()
await ctx.plugin(LlmRuntime)
await ctx.plugin(LlmDeepSeek, { baseURL })

console.error(`→ ctx.llm.stream provider=deepseek-official model=${model}`)
console.error(`  baseURL=${baseURL}`)
console.error(`  user=${JSON.stringify(prompt)}`)
console.error('')

const assembler = new BlockAssembler()
const stream = ctx.llm.stream({
  provider: 'deepseek-official',
  model,
  messages: [
    createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: { kind: 'plugin', plugin: 'apps/api/call-llm-deepseek' },
    }),
  ],
})

let sawReasoning = false
let sawText = false
for await (const chunk of stream) {
  printLive(chunk)
  assembler.push(chunk)
}

const message = assembler.message({
  kind: 'model',
  provider: 'deepseek-official',
  model,
  ...assembler.replayState === undefined ? {} : { replayState: assembler.replayState },
})

if (sawReasoning || sawText) process.stdout.write('\n')
printBlocks(message.content)

if (assembler.usage) console.error('\nusage:', assembler.usage)
console.error('finish:', assembler.finish)

await ctx.fiber.dispose()

if (assembler.finish.kind === 'error' || assembler.finish.kind === 'aborted') {
  process.exitCode = 1
}

function printLive(chunk: StreamChunk): void {
  switch (chunk.type) {
    case 'reasoning-delta':
      if (!sawReasoning) {
        console.error('--- reasoning (live) ---')
        sawReasoning = true
      }
      process.stderr.write(chunk.text)
      return
    case 'text-delta':
      if (!sawText) {
        if (sawReasoning) process.stderr.write('\n')
        console.error('--- content (live) ---')
        sawText = true
      }
      process.stdout.write(chunk.text)
      return
    default:
      return
  }
}

function printBlocks(blocks: readonly ContentBlock[]): void {
  const reasoning = blocks.filter(b => b.type === 'reasoning').map(b => b.text).join('')
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('')
  if (reasoning) {
    console.error('--- assembled reasoning ---')
    console.error(reasoning)
  }
  if (text) {
    console.error('--- assembled content ---')
    console.log(text)
  }
}

/** Load KEY=VALUE pairs from a .env file into process.env (no overwrite). */
function loadDotEnv(path: string): void {
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
