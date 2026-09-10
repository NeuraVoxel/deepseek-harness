/**
 * React host that mounts an AITopo Network into a DOM container.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactElement,
} from 'react'
import {
  Network,
  PatchHistory,
  contentBounds,
  MarqueeSelectInteraction,
  MoveNodeInteraction,
  ResizeNodeInteraction,
  type GraphDocument,
  type GraphEvent,
  type GraphPatch,
} from '@neuravoxel/aitopo'

const ZOOM_STEP = 1.15

/** Imperative zoom / selection / undo controls for the toolbar. */
export interface AITopoHostHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  fitContent: () => void
  enterSubNetwork: (id: string) => void
  exitSubNetwork: () => void
  getZoom: () => number
  /** Update selection without reloading the document. */
  setSelection: (ids: readonly string[]) => void
  /** Undo last editor apply when `editable` (no-op otherwise). */
  undo: () => boolean
  /** Redo last undone apply when `editable` (no-op otherwise). */
  redo: () => boolean
  /** Snapshot node top-lefts from the live Network document. */
  captureNodePositions: () => Readonly<Record<string, { readonly x: number; readonly y: number }>>
}

export interface AITopoHostProps {
  /** Document to load (re-loads when reference identity changes). */
  readonly document: GraphDocument
  readonly className?: string | undefined
  readonly ariaLabel?: string | undefined
  /** Called for every GraphEvent from the Network. */
  readonly onEvent?: ((event: GraphEvent) => void) | undefined
  /** When this token changes, fit content after load. */
  readonly fitToken?: string | number | undefined
  /**
   * When true, pack Resize → Move → Marquee and route `apply` through `PatchHistory`.
   * Remounts the Network when the flag changes.
   */
  readonly editable?: boolean | undefined
}

/**
 * Mounts Network for the lifetime of the component; reloads on document change.
 */
export const AITopoHost = forwardRef(function AITopoHost(
  props: AITopoHostProps,
  ref: React.Ref<AITopoHostHandle>,
): ReactElement {
  const {
    document: graphDoc,
    className,
    ariaLabel,
    onEvent,
    fitToken,
    editable = false,
  } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const historyRef = useRef<PatchHistory | null>(null)
  const graphDocRef = useRef(graphDoc)
  graphDocRef.current = graphDoc
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const network = networkRef.current
      if (network === null) return
      const { zoom, width, height } = network.viewport.state
      network.updateCamera(vp => {
        vp.zoomAt({ x: width / 2, y: height / 2 }, zoom * ZOOM_STEP)
      })
    },
    zoomOut: () => {
      const network = networkRef.current
      if (network === null) return
      const { zoom, width, height } = network.viewport.state
      network.updateCamera(vp => {
        vp.zoomAt({ x: width / 2, y: height / 2 }, zoom / ZOOM_STEP)
      })
    },
    resetZoom: () => {
      networkRef.current?.updateCamera(vp => {
        vp.setCamera({ x: 0, y: 0, zoom: 1 })
      })
    },
    fitContent: () => { fitNetwork(networkRef.current) },
    enterSubNetwork: (id: string) => { networkRef.current?.enterSubNetwork(id) },
    exitSubNetwork: () => { networkRef.current?.exitSubNetwork() },
    getZoom: () => networkRef.current?.viewport.state.zoom ?? 1,
    setSelection: (ids: readonly string[]) => {
      networkRef.current?.setSelection(ids)
    },
    undo: () => historyRef.current?.undo() ?? false,
    redo: () => historyRef.current?.redo() ?? false,
    captureNodePositions: () => {
      const network = networkRef.current
      if (network === null) return {}
      const positions: Record<string, { x: number; y: number }> = {}
      for (const node of network.toJSON().nodes) {
        if (node.x === undefined || node.y === undefined) continue
        positions[node.id] = { x: node.x, y: node.y }
      }
      return positions
    },
  }), [])

  useEffect(() => {
    const parent = containerRef.current
    if (parent === null) return
    const network = new Network(editable
      ? {
        interactions: [
          new ResizeNodeInteraction(),
          new MoveNodeInteraction(),
          new MarqueeSelectInteraction(),
        ],
      }
      : {})
    networkRef.current = network
    historyRef.current = null
    if (editable) {
      const rawApply = network.apply.bind(network)
      const history = new PatchHistory(rawApply, () => network.toJSON())
      historyRef.current = history
      ;(network as { apply: (patch: GraphPatch | unknown) => void }).apply = (patch) => {
        history.pushAndApply(patch as GraphPatch)
      }
    }
    const unsubscribe = network.on(event => { onEventRef.current?.(event) })
    network.mount(parent)
    network.load(graphDocRef.current)
    return () => {
      unsubscribe()
      network.destroy()
      networkRef.current = null
      historyRef.current = null
    }
  }, [editable])

  useEffect(() => {
    const network = networkRef.current
    if (network === null) return
    network.load(graphDoc)
  }, [graphDoc])

  useEffect(() => {
    fitNetwork(networkRef.current)
  }, [fitToken])

  return (
    <div
      ref={containerRef}
      className={className}
      role="region"
      aria-label={ariaLabel}
      style={{ flex: 1, minHeight: 0, width: '100%', height: '100%', position: 'relative' }}
    />
  )
})

function fitNetwork(network: Network | null): void {
  if (network === null) return
  const bounds = contentBounds(network.scene)
  if (bounds === undefined) return
  network.updateCamera(vp => {
    vp.fitBounds(bounds, 32)
  })
}

/** Format zoom for the toolbar badge. */
export function formatZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}

export type { GraphEvent }
