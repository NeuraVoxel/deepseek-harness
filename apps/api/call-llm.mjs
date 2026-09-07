/**
 * Lowest-level DeepSeek chat-completions example.
 *
 * Mirrors what `packages/llm/llm-deepseek` ultimately does after all harness
 * layers (Agent → llm.stream → DeepSeekAdapter):
 *
 *   POST {DEEPSEEK_BASE_URL}/chat/completions
 *
 * Usage (from repo root):
 *   export DEEPSEEK_API_KEY=sk-...
 *   # optional: export DEEPSEEK_BASE_URL=https://api.deepseek.com
 *   node apps/api/call-llm.mjs
 *   node apps/api/call-llm.mjs "用一句话介绍你自己"
 *   node apps/api/call-llm.mjs --no-stream "hi"
 *
 * Env:
 *   DEEPSEEK_API_KEY   required
 *   DEEPSEEK_BASE_URL  optional, default https://api.deepseek.com
 *   DEEPSEEK_MODEL     optional, default deepseek-v4-flash
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
loadDotEnv(resolve(ROOT, '.env'))

const args = process.argv.slice(2)
const stream = !args.includes('--no-stream')
const promptParts = args.filter(a => a !== '--no-stream')
const prompt = promptParts.join(' ').trim() || 'hi'

const apiKey = process.env.DEEPSEEK_API_KEY
if (!apiKey) {
  console.error('Missing DEEPSEEK_API_KEY. Set it in the environment or repo-root .env')
  process.exit(1)
}

const baseURL = (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/u, '')
const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const url = `${baseURL}/chat/completions`

/** Same wire body shape as WireRequest in packages/llm/llm-deepseek/src/types.ts */
const body = {
  model,
  messages: [
    { role: 'system', content: 'You are a helpful assistant. Reply briefly.' },
    { role: 'user', content: prompt },
  ],
  stream,
  ...(stream ? { stream_options: { include_usage: true } } : {}),
  // Matches adapter defaults when thinking is enabled and effort is high:
  thinking: { type: 'enabled' },
  reasoning_effort: 'high',
}

console.error(`→ POST ${url}`)
console.error(`  model=${model} stream=${stream}`)
console.error(`  user=${JSON.stringify(prompt)}`)
console.error('')

const response = await fetch(url, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    accept: stream ? 'text/event-stream' : 'application/json',
  },
  body: JSON.stringify(body),
})

if (!response.ok) {
  const text = await response.text()
  console.error(`HTTP ${response.status}\n${text}`)
  process.exit(1)
}

if (!stream) {
  const json = await response.json()
  const choice = json.choices?.[0]?.message
  if (choice?.reasoning_content) {
    console.error('--- reasoning ---')
    console.error(choice.reasoning_content)
    console.error('--- content ---')
  }
  process.stdout.write(`${choice?.content ?? ''}\n`)
  if (json.usage) console.error('\nusage:', json.usage)
  process.exit(0)
}

if (!response.body) {
  console.error('empty response body')
  process.exit(1)
}

let reasoningOpen = false
let contentOpen = false
let usage

for await (const data of readSseData(response.body)) {
  if (data === '[DONE]') break
  let chunk
  try {
    chunk = JSON.parse(data)
  } catch {
    console.error('skip malformed SSE data:', data)
    continue
  }
  if (chunk.usage) usage = chunk.usage
  const delta = chunk.choices?.[0]?.delta
  if (!delta) continue

  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
    if (!reasoningOpen) {
      console.error('--- reasoning ---')
      reasoningOpen = true
    }
    process.stderr.write(delta.reasoning_content)
  }
  if (typeof delta.content === 'string' && delta.content.length > 0) {
    if (!contentOpen) {
      if (reasoningOpen) process.stderr.write('\n')
      console.error('--- content ---')
      contentOpen = true
    }
    process.stdout.write(delta.content)
  }
}

process.stdout.write('\n')
if (usage) console.error('\nusage:', usage)

/**
 * Minimal SSE `data:` reader (same framing contract as parseSse in llm-deepseek).
 * @param {ReadableStream<Uint8Array>} body
 */
async function* readSseData(body) {
  const lines = createInterface({
    input: /** @type {import('node:stream').Readable} */ (
      // Node 22+: Web ReadableStream → Node Readable
      (await import('node:stream')).Readable.fromWeb(body)
    ),
    crlfDelay: Infinity,
  })
  let buf = []
  for await (const line of lines) {
    if (line.startsWith(':')) continue // comment / keep-alive
    if (line.startsWith('data:')) {
      buf.push(line.slice(5).replace(/^ /u, ''))
      continue
    }
    if (line === '') {
      if (buf.length > 0) {
        yield buf.join('\n')
        buf = []
      }
    }
  }
  if (buf.length > 0) yield buf.join('\n')
}

/** Load KEY=VALUE pairs from a .env file into process.env (no overwrite). */
function loadDotEnv(path) {
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
