/**
 * Zod schemas for GraphDocument and GraphPatch at the protocol boundary.
 */

import { z } from 'zod'

const alarmSchema = z.object({
  id: z.string().min(1),
  level: z.enum(['info', 'warn', 'error']),
  message: z.string(),
  ts: z.string().optional(),
})

const graphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  label: z.string(),
  status: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  parentId: z.string().optional(),
  groupId: z.string().optional(),
  networkId: z.string().optional(),
  locked: z.boolean().optional(),
  alarms: z.array(alarmSchema).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const graphEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.string().optional(),
  alarms: z.array(alarmSchema).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const graphGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  memberIds: z.array(z.string()),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  style: z.object({
    stroke: z.string().optional(),
    strokeWidth: z.number().positive().optional(),
    strokeDash: z.array(z.number()).optional(),
    fill: z.string().optional(),
  }).optional(),
})

const graphViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
})

const graphMetaSchema = z.object({
  title: z.string().optional(),
  kind: z.enum(['topology', 'flow', 'custom']).optional(),
}).passthrough()

/** Lazy document schema so nested `networks` can recurse. */
export const graphDocumentSchema: z.ZodType<import('./types.ts').GraphDocument> = z.lazy(() =>
  z.object({
    version: z.literal(1),
    meta: graphMetaSchema.optional(),
    nodes: z.array(graphNodeSchema),
    edges: z.array(graphEdgeSchema),
    groups: z.array(graphGroupSchema).optional(),
    networks: z.record(z.string(), graphDocumentSchema).optional(),
    viewport: graphViewportSchema.optional(),
  }),
) as z.ZodType<import('./types.ts').GraphDocument>

const patchOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('addNode'), node: graphNodeSchema }),
  z.object({ op: z.literal('updateNode'), id: z.string().min(1), patch: graphNodeSchema.partial().omit({ id: true }) }),
  z.object({ op: z.literal('removeNode'), id: z.string().min(1) }),
  z.object({ op: z.literal('addEdge'), edge: graphEdgeSchema }),
  z.object({ op: z.literal('updateEdge'), id: z.string().min(1), patch: graphEdgeSchema.partial().omit({ id: true }) }),
  z.object({ op: z.literal('removeEdge'), id: z.string().min(1) }),
  z.object({ op: z.literal('addGroup'), group: graphGroupSchema }),
  z.object({ op: z.literal('updateGroup'), id: z.string().min(1), patch: graphGroupSchema.partial().omit({ id: true }) }),
  z.object({ op: z.literal('removeGroup'), id: z.string().min(1) }),
  z.object({
    op: z.literal('setAlarms'),
    elementId: z.string().min(1),
    target: z.enum(['node', 'edge']),
    alarms: z.array(alarmSchema),
  }),
  z.object({ op: z.literal('setViewport'), viewport: graphViewportSchema }),
  z.object({ op: z.literal('setSelection'), selectedIds: z.array(z.string()) }),
  z.object({ op: z.literal('enterSubNetwork'), id: z.string().min(1) }),
  z.object({ op: z.literal('exitSubNetwork') }),
])

/** Validated patch payload: ordered ops applied atomically. */
export const graphPatchSchema = z.object({
  ops: z.array(patchOpSchema).min(1),
})

export type GraphPatchOp = z.infer<typeof patchOpSchema>
export type GraphPatch = z.infer<typeof graphPatchSchema>
