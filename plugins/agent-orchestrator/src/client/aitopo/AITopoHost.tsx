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
  contentBounds,
  type GraphDocument,
  type GraphEvent,
} from '@neuravoxel/aitopo'

const ZOOM_STEP = 1.15

/** Imperative zoom / SubNetwork controls for the toolbar. */
export interface AITopoHostHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  fitContent: () => void
  enterSubNetwork: (id: string) => void
  exitSubNetwork: () => void
  getZoom: () => number
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
  /** Selection to apply after each load. */
  readonly selectedIds?: readonly string[] | undefined
}

/**
 * Mounts Network for the lifetime of the component; reloads on document change.
 */
export const AITopoHost = forwardRef(function AITopoHost(
  props: AITopoHostProps,
  ref: React.Ref<AITopoHostHandle>,
): ReactElement {
  const { document: graphDoc, className, ariaLabel, onEvent, fitToken, selectedIds } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
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
  }), [])

  useEffect(() => {
    const parent = containerRef.current
    if (parent === null) return
    const network = new Network()
    networkRef.current = network
    const unsubscribe = network.on(event => { onEventRef.current?.(event) })
    network.mount(parent)
    return () => {
      unsubscribe()
      network.destroy()
      networkRef.current = null
    }
  }, [])

  useEffect(() => {
    const network = networkRef.current
    if (network === null) return
    network.load(graphDoc)
    if (selectedIds !== undefined) network.setSelection(selectedIds)
    fitNetwork(network)
  }, [graphDoc, selectedIds, fitToken])

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
