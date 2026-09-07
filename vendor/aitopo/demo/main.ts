import { Network, contentBounds, parseDocument } from '../src/index.ts'
import fleet from '../fixtures/fleet.json'
import flow from '../fixtures/flow.json'
import teams from '../fixtures/teams-root.json'

const stage = document.querySelector('#stage') as HTMLDivElement
const toolbar = document.querySelector('#toolbar') as HTMLDivElement
const status = document.querySelector('#status') as HTMLDivElement

const network = new Network({ debugPaintRects: false })
network.mount(stage)

network.on(event => {
  status.textContent = `${event.type} · network=${network.scene.currentNetworkId ?? 'root'} · sel=${[...network.scene.selectedIds].join(',') || '—'}`
})

function loadFixture(name: string, data: unknown): void {
  network.load(parseDocument(data))
  network.layout(name === 'flow' ? 'flow' : 'grid')
  const bounds = contentBounds(network.scene)
  if (bounds !== undefined) {
    network.updateCamera(viewport => { viewport.fitBounds(bounds, 32) })
  }
}

function button(label: string, onClick: () => void): void {
  const el = document.createElement('button')
  el.type = 'button'
  el.textContent = label
  el.addEventListener('click', onClick)
  toolbar.appendChild(el)
}

button('Fleet', () => { loadFixture('fleet', fleet) })
button('Flow', () => { loadFixture('flow', flow) })
button('Teams', () => { loadFixture('teams', teams) })
button('Fit', () => {
  const bounds = contentBounds(network.scene)
  if (bounds !== undefined) network.updateCamera(v => { v.fitBounds(bounds, 32) })
})
button('Zoom +', () => {
  network.updateCamera(v => { v.setZoom(v.state.zoom * 1.15) })
})
button('Zoom −', () => {
  network.updateCamera(v => { v.setZoom(v.state.zoom / 1.15) })
})
button('Patch +node', () => {
  network.apply({
    ops: [{
      op: 'addNode',
      node: { id: `n-${Date.now()}`, type: 'agent', label: 'patched', status: 'idle', x: 40, y: 40 },
    }],
  })
})
button('Alarm', () => {
  const id = [...network.scene.nodes.keys()][0]
  if (id === undefined) return
  network.apply({
    ops: [{
      op: 'setAlarms',
      elementId: id,
      target: 'node',
      alarms: [{ id: 'demo', level: 'error', message: 'demo alarm' }],
    }],
  })
})
button('Enter team-a', () => {
  try {
    network.enterSubNetwork('team-a')
    network.layout('grid')
    const bounds = contentBounds(network.scene)
    if (bounds !== undefined) network.updateCamera(v => { v.fitBounds(bounds, 32) })
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error)
  }
})
button('Exit subnet', () => {
  try {
    network.exitSubNetwork()
    network.layout('grid')
    const bounds = contentBounds(network.scene)
    if (bounds !== undefined) network.updateCamera(v => { v.fitBounds(bounds, 32) })
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error)
  }
})

let debug = false
button('Debug dirty', () => {
  debug = !debug
  network.setDebugPaintRects(debug)
})

loadFixture('fleet', fleet)

if (import.meta.hot) {
  import.meta.hot.dispose(() => { network.destroy() })
}
