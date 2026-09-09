import {
  Network,
  contentBounds,
  parseDocument,
  PatchHistory,
  ExternalDropInteraction,
  MoveNodeInteraction,
  MarqueeSelectInteraction,
  type GraphEvent,
  type GraphPatch,
} from '../src/index.ts'
import fleet from '../fixtures/fleet.json'
import flow from '../fixtures/flow.json'
import teams from '../fixtures/teams-root.json'
import editor from '../fixtures/editor.json'

const stage = document.querySelector('#stage') as HTMLDivElement
const toolbar = document.querySelector('#toolbar') as HTMLDivElement
const status = document.querySelector('#status') as HTMLDivElement

type DemoMode = 'observe' | 'edit'

let network: Network | null = null
let history: PatchHistory | null = null
let unsub: (() => void) | null = null
let mode: DemoMode = 'observe'
let debug = false

function setStatus(text: string): void {
  status.textContent = text
}

function summarizeEvent(event: GraphEvent): string {
  switch (event.type) {
    case 'nodeMoved':
      return `nodeMoved · ${event.nodeId} (${event.from.x},${event.from.y}) → (${event.to.x},${event.to.y})`
    case 'groupMembershipChanged':
      return `groupMembershipChanged · ${event.nodeId} ${event.fromGroupId ?? '—'} → ${event.toGroupId ?? '—'}`
    case 'externalDrop':
      return `externalDrop · (${event.x},${event.y}) data=${JSON.stringify(event.data)} group=${event.groupId ?? '—'}`
    default:
      return `${event.type} · network=${network?.scene.currentNetworkId ?? 'root'} · sel=${[...(network?.scene.selectedIds ?? [])].join(',') || '—'}`
  }
}

function applyPatch(patch: GraphPatch): void {
  if (history !== null) {
    history.pushAndApply(patch)
    return
  }
  network?.apply(patch)
}

function bindEvents(n: Network): void {
  unsub?.()
  unsub = n.on(event => {
    if (mode === 'edit' && event.type === 'externalDrop') {
      setStatus(summarizeEvent(event))
      const label = event.data === '' ? 'dropped' : event.data
      applyPatch({
        ops: [{
          op: 'addNode',
          node: {
            id: `drop-${Date.now()}`,
            type: 'unit',
            label,
            x: event.x,
            y: event.y,
            ...(event.groupId !== undefined ? { groupId: event.groupId } : {}),
          },
        }],
      })
      return
    }
    if (
      mode === 'edit'
      && (event.type === 'nodeMoved'
        || event.type === 'groupMembershipChanged'
        || event.type === 'externalDrop')
    ) {
      setStatus(summarizeEvent(event))
      return
    }
    setStatus(summarizeEvent(event))
  })
}

/**
 * Recreate Network. Editor mode adds Move/Drop/Marquee **in addition** to
 * defaults (`PanZoom` + `SelectActivate`) via `options.interactions`.
 */
function recreate(next: DemoMode): void {
  unsub?.()
  unsub = null
  network?.destroy()
  network = null
  history = null
  mode = next

  const nextNetwork = new Network({
    debugPaintRects: debug,
    ...(next === 'edit'
      ? {
          interactions: [
            new ExternalDropInteraction(),
            new MoveNodeInteraction(),
            new MarqueeSelectInteraction(),
          ],
        }
      : {}),
  })
  nextNetwork.mount(stage)

  if (next === 'edit') {
    const rawApply = nextNetwork.apply.bind(nextNetwork)
    history = new PatchHistory(rawApply, () => nextNetwork.toJSON())
    // Route InteractionHost.apply (moves) through PatchHistory without double-apply.
    ;(nextNetwork as { apply: (patch: GraphPatch | unknown) => void }).apply = (patch) => {
      history!.pushAndApply(patch as GraphPatch)
    }
  }

  network = nextNetwork
  bindEvents(nextNetwork)
}

function fitContent(): void {
  if (network === null) return
  const bounds = contentBounds(network.scene)
  if (bounds !== undefined) {
    network.updateCamera(viewport => { viewport.fitBounds(bounds, 32) })
  }
}

function loadObservation(name: string, data: unknown): void {
  recreate('observe')
  if (network === null) return
  network.load(parseDocument(data))
  network.layout(name === 'flow' ? 'flow' : 'grid')
  fitContent()
}

function loadEditor(): void {
  recreate('edit')
  if (network === null) return
  network.load(parseDocument(editor))
  fitContent()
  setStatus('Editor · drag unlocked nodes · Shift+marquee · drop catalog chip')
}

function button(label: string, onClick: () => void): void {
  const el = document.createElement('button')
  el.type = 'button'
  el.textContent = label
  el.addEventListener('click', onClick)
  toolbar.appendChild(el)
}

button('Fleet', () => { loadObservation('fleet', fleet) })
button('Flow', () => { loadObservation('flow', flow) })
button('Teams', () => { loadObservation('teams', teams) })
button('Editor', () => { loadEditor() })
button('Fit', () => { fitContent() })
button('Zoom +', () => {
  network?.updateCamera(v => { v.setZoom(v.state.zoom * 1.15) })
})
button('Zoom −', () => {
  network?.updateCamera(v => { v.setZoom(v.state.zoom / 1.15) })
})
button('Patch +node', () => {
  applyPatch({
    ops: [{
      op: 'addNode',
      node: { id: `n-${Date.now()}`, type: 'agent', label: 'patched', status: 'idle', x: 40, y: 40 },
    }],
  })
})
button('Alarm', () => {
  const id = network === null ? undefined : [...network.scene.nodes.keys()][0]
  if (id === undefined) return
  applyPatch({
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
    if (network === null) return
    network.enterSubNetwork('team-a')
    network.layout('grid')
    fitContent()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error))
  }
})
button('Exit subnet', () => {
  try {
    if (network === null) return
    network.exitSubNetwork()
    network.layout('grid')
    fitContent()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error))
  }
})
button('Undo', () => {
  if (history === null) {
    setStatus('Undo · enter Editor mode first')
    return
  }
  setStatus(history.undo() ? 'Undo' : 'Undo · empty')
})
button('Redo', () => {
  if (history === null) {
    setStatus('Redo · enter Editor mode first')
    return
  }
  setStatus(history.redo() ? 'Redo' : 'Redo · empty')
})
button('Debug dirty', () => {
  debug = !debug
  network?.setDebugPaintRects(debug)
})

const catalogChip = document.createElement('span')
catalogChip.draggable = true
catalogChip.textContent = 'Drag: shell'
catalogChip.title = 'Drop onto the canvas (text/plain or application/aitopo-drop)'
catalogChip.style.cssText = 'cursor: grab; padding: 6px 10px; border-radius: 6px; background: #1e293b; color: #e2e8f0; user-select: none;'
catalogChip.addEventListener('dragstart', event => {
  const transfer = event.dataTransfer
  if (transfer === null) return
  transfer.setData('text/plain', 'shell')
  transfer.setData('application/aitopo-drop', 'shell')
  transfer.effectAllowed = 'copy'
})
toolbar.appendChild(catalogChip)

loadObservation('fleet', fleet)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsub?.()
    network?.destroy()
  })
}
