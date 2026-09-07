/**
 * Pan/zoom viewport via SVG viewBox (crisp at any zoom; no CSS scale blur).
 */

import {
  useCallback, useEffect, useRef, useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from 'react'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 1.15

/** World-space camera: top-left (x,y) and zoom relative to stage pixels. */
export interface CanvasViewport {
  readonly zoom: number
  readonly x: number
  readonly y: number
  readonly stageW: number
  readonly stageH: number
}

/** Controllers returned by {@link useCanvasViewport}. */
export interface CanvasViewportControls {
  readonly viewport: CanvasViewport
  /** SVG `viewBox` string for the stage. */
  readonly viewBox: string
  readonly stageRef: RefObject<SVGSVGElement | null>
  readonly dragging: boolean
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  fit: (contentWidth: number, contentHeight: number) => void
  onWheel: (event: ReactWheelEvent<SVGSVGElement>) => void
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
}

/**
 * Free pan + zoom for an SVG stage. Wheel zooms toward the pointer;
 * primary-button drag pans (node hits still receive click/double-click).
 * @returns viewport state and stage event handlers.
 */
export function useCanvasViewport(): CanvasViewportControls {
  const stageRef = useRef<SVGSVGElement | null>(null)
  const [viewport, setViewport] = useState<CanvasViewport>({
    zoom: 1, x: 0, y: 0, stageW: 1, stageH: 1,
  })
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const clampZoom = (value: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return
    const syncSize = (): void => {
      const rect = stage.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width))
      const h = Math.max(1, Math.round(rect.height))
      setViewport(prev => (prev.stageW === w && prev.stageH === h
        ? prev
        : { ...prev, stageW: w, stageH: h }))
    }
    syncSize()
    const observer = new ResizeObserver(syncSize)
    observer.observe(stage)
    return () => { observer.disconnect() }
  }, [])

  const zoomAt = useCallback((clientX: number, clientY: number, nextZoom: number) => {
    const stage = stageRef.current
    if (stage === null) {
      setViewport(prev => ({ ...prev, zoom: clampZoom(nextZoom) }))
      return
    }
    const rect = stage.getBoundingClientRect()
    setViewport(prev => {
      const zoom = clampZoom(nextZoom)
      const mx = prev.x + (clientX - rect.left) / prev.zoom
      const my = prev.y + (clientY - rect.top) / prev.zoom
      return {
        ...prev,
        zoom,
        x: mx - (clientX - rect.left) / zoom,
        y: my - (clientY - rect.top) / zoom,
      }
    })
  }, [])

  const zoomIn = useCallback(() => {
    const stage = stageRef.current
    if (stage === null) {
      setViewport(prev => ({ ...prev, zoom: clampZoom(prev.zoom * ZOOM_STEP) }))
      return
    }
    const rect = stage.getBoundingClientRect()
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, viewport.zoom * ZOOM_STEP)
  }, [viewport.zoom, zoomAt])

  const zoomOut = useCallback(() => {
    const stage = stageRef.current
    if (stage === null) {
      setViewport(prev => ({ ...prev, zoom: clampZoom(prev.zoom / ZOOM_STEP) }))
      return
    }
    const rect = stage.getBoundingClientRect()
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, viewport.zoom / ZOOM_STEP)
  }, [viewport.zoom, zoomAt])

  const reset = useCallback(() => {
    setViewport(prev => ({ ...prev, zoom: 1, x: 0, y: 0 }))
  }, [])

  const fit = useCallback((contentWidth: number, contentHeight: number) => {
    const stage = stageRef.current
    if (stage === null || contentWidth <= 0 || contentHeight <= 0) {
      reset()
      return
    }
    const rect = stage.getBoundingClientRect()
    const pad = 32
    const scale = clampZoom(Math.min(
      (rect.width - pad) / contentWidth,
      (rect.height - pad) / contentHeight,
      1,
    ))
    const stageW = Math.max(1, Math.round(rect.width))
    const stageH = Math.max(1, Math.round(rect.height))
    setViewport({
      zoom: scale,
      x: (contentWidth - stageW / scale) / 2,
      y: (contentHeight - stageH / scale) / 2,
      stageW,
      stageH,
    })
  }, [reset])

  const onWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    zoomAt(event.clientX, event.clientY, viewport.zoom * factor)
  }, [viewport.zoom, zoomAt])

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target as Element | null
    if (target?.closest?.('[data-canvas-node="true"]') && event.button === 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    }
    setDragging(true)
  }, [viewport.x, viewport.y])

  const onPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const state = drag.current
    if (state === null || state.pointerId !== event.pointerId) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    setViewport(prev => ({
      ...prev,
      x: state.originX - dx / prev.zoom,
      y: state.originY - dy / prev.zoom,
    }))
  }, [])

  const onPointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId === event.pointerId) {
      drag.current = null
      setDragging(false)
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // Capture may already be released.
      }
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return
    const blockGesture = (event: Event): void => { event.preventDefault() }
    stage.addEventListener('gesturestart', blockGesture)
    return () => { stage.removeEventListener('gesturestart', blockGesture) }
  }, [])

  const viewBox = [
    viewport.x,
    viewport.y,
    viewport.stageW / viewport.zoom,
    viewport.stageH / viewport.zoom,
  ].join(' ')

  return {
    viewport,
    viewBox,
    stageRef,
    dragging,
    zoomIn,
    zoomOut,
    reset,
    fit,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}

/** Format zoom for the toolbar badge. */
export function formatZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
