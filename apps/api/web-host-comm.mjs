/**
 * Demo: a tiny web page talking to a running `dsh web` Host.
 *
 * Real product UI uses Cordis `ctx.remote` / `ctx.connection`. This example
 * shows the same wire underneath — HTTP unary Remote + WS `/api/remote.mux` —
 * without booting the full Client Cordis tree.
 *
 * Why a local proxy? Host auth is an HttpOnly cookie after
 * `GET /?token=… → 303`. A `file://` or other-origin page cannot hold that
 * cookie for `/api`. This process exchanges the token once, serves the HTML
 * on loopback, and forwards `/api` (+ WS) to Host with the cookie attached.
 *
 * Prerequisites:
 *   1. Build + start Host:  `pnpm dsh web --no-open`
 *   2. Copy the printed URL: `dsh web: http://127.0.0.1:3080/?token=…`
 *
 * Run:
 *   node apps/api/web-host-comm.mjs 'http://127.0.0.1:3080/?token=…'
 *   # or:  DSH_WEB_URL='http://…/?token=…' node apps/api/web-host-comm.mjs
 *
 * Then open the printed demo URL (default http://127.0.0.1:3099/).
 */

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const HTML_PATH = resolve(HERE, 'web-host-comm.html')
const DEMO_PORT = Number(process.env.DSH_DEMO_PORT ?? 3099)

const launchUrl = process.argv[2] ?? process.env.DSH_WEB_URL
if (!launchUrl) {
  console.error(`Usage: node apps/api/web-host-comm.mjs 'http://127.0.0.1:3080/?token=…'`)
  process.exit(1)
}

let hostOrigin
let cookie
try {
  hostOrigin = new URL(launchUrl).origin
  ;({ cookie } = await exchangeToken(launchUrl))
} catch (error) {
  console.error('Failed to authenticate against dsh web:', error instanceof Error ? error.message : error)
  console.error('Start Host first: pnpm dsh web --no-open')
  process.exit(1)
}
console.error(`✓ Host cookie acquired for ${hostOrigin}`)

const require = createRequire(pathToFileURL(resolve(HERE, '../web/package.json')).href)
const { WebSocketServer, WebSocket: NodeWebSocket } = require('ws')

const html = readFileSync(HTML_PATH, 'utf8')
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${DEMO_PORT}`)
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }
    if (url.pathname.startsWith('/api/')) {
      await proxyHttp(req, res, url)
      return
    }
    res.writeHead(404).end('not found')
  } catch (error) {
    console.error(error)
    if (!res.headersSent) res.writeHead(502).end(String(error))
  }
})

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${DEMO_PORT}`)
  if (url.pathname !== '/api/remote.mux') {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (client) => {
    bridgeMux(client)
  })
})

server.listen(DEMO_PORT, '127.0.0.1', () => {
  console.error(`→ Demo UI:  http://127.0.0.1:${DEMO_PORT}/`)
  console.error(`  Proxies /api → ${hostOrigin}/api (cookie attached)`)
  console.error(`  Wire: POST /api/<ns>/<method>  +  WS /api/remote.mux`)
})

/** Token URL → HttpOnly session cookie (same as apps/web smoke-real.e2e). */
async function exchangeToken(url) {
  const response = await fetch(url, { redirect: 'manual' })
  const setCookie = response.headers.get('set-cookie')
  if (response.status !== 303 || setCookie === null) {
    throw new Error(`token exchange failed: HTTP ${response.status} (is dsh web running?)`)
  }
  return { cookie: setCookie.split(';', 1)[0] }
}

/** Forward one unary Remote POST to Host. */
async function proxyHttp(req, res, url) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks)
  const upstream = await fetch(`${hostOrigin}${url.pathname}${url.search}`, {
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'] ?? 'application/json',
      cookie,
      // Host trust fence requires loopback Host.
      host: new URL(hostOrigin).host,
    },
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    redirect: 'manual',
  })
  const text = await upstream.text()
  res.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
  })
  res.end(text)
}

/** Bridge browser mux socket ↔ Host `/api/remote.mux`. */
function bridgeMux(client) {
  const upstream = new NodeWebSocket(
    `${hostOrigin.replace(/^http/u, 'ws')}/api/remote.mux`,
    { headers: { cookie, host: new URL(hostOrigin).host } },
  )

  const closeBoth = () => {
    try { client.close() } catch { /* already closed */ }
    try { upstream.close() } catch { /* already closed */ }
  }

  upstream.on('open', () => {
    client.on('message', (data) => {
      if (upstream.readyState === NodeWebSocket.OPEN) upstream.send(data)
    })
  })
  upstream.on('message', (data) => {
    if (client.readyState === 1 /* OPEN */) client.send(data)
  })
  upstream.on('close', closeBoth)
  upstream.on('error', closeBoth)
  client.on('close', closeBoth)
  client.on('error', closeBoth)
}
