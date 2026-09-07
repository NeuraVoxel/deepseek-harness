/**
 * GraphEvent payloads emitted by Network to hosts / agents.
 */

import type { Alarm, GraphViewport } from './types.ts'

/** Selection set changed. */
export interface SelectionChangedEvent {
  readonly type: 'selectionChanged'
  readonly selectedIds: readonly string[]
}

/** Hover target changed (undefined clears). */
export interface HoverChangedEvent {
  readonly type: 'hoverChanged'
  readonly hoverId?: string
}

/** Click or double-click on a node. */
export interface NodeActivatedEvent {
  readonly type: 'nodeActivated'
  readonly nodeId: string
  readonly detail: 'click' | 'dblclick'
}

/** Camera changed. */
export interface ViewportChangedEvent {
  readonly type: 'viewportChanged'
  readonly viewport: GraphViewport
}

/** Layout wrote coordinates. */
export interface LayoutCompletedEvent {
  readonly type: 'layoutCompleted'
  readonly name: string
  readonly positions: Readonly<Record<string, { x: number; y: number }>>
}

/** Alarms on an element changed. */
export interface AlarmChangedEvent {
  readonly type: 'alarmChanged'
  readonly elementId: string
  readonly alarms: readonly Alarm[]
}

/** SubNetwork enter/exit. */
export interface SubNetworkChangedEvent {
  readonly type: 'subNetworkChanged'
  readonly activeNetworkId: string | null
  readonly stack: readonly string[]
}

/** Durable document fields changed (optional host notification). */
export interface DocumentChangedEvent {
  readonly type: 'documentChanged'
  readonly reason: string
}

/** Discriminated event union for `Network.on`. */
export type GraphEvent =
  | SelectionChangedEvent
  | HoverChangedEvent
  | NodeActivatedEvent
  | ViewportChangedEvent
  | LayoutCompletedEvent
  | AlarmChangedEvent
  | SubNetworkChangedEvent
  | DocumentChangedEvent
