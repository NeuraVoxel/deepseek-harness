/**
 * Optional undo/redo stack as forward/inverse GraphPatch pairs (AT-E8).
 */

import { invertPatch } from './invert.ts'
import type { GraphPatch, GraphPatchOp } from './patch.ts'
import type { GraphDocument } from './types.ts'

interface HistoryEntry {
  readonly forward: GraphPatch
  readonly inverseOps: readonly GraphPatchOp[]
}

/**
 * Records applied patches and restores prior document state via inverse apply.
 */
export class PatchHistory {
  private readonly undoStack: HistoryEntry[] = []
  private readonly redoStack: HistoryEntry[] = []

  /**
   * @param apply - host apply (e.g. `network.apply` or `doc = applyPatch(doc, patch)`).
   * @param getDoc - current document snapshot used to compute inverses.
   */
  constructor(
    private readonly apply: (patch: GraphPatch) => void,
    private readonly getDoc: () => GraphDocument,
  ) {}

  /**
   * Snapshot doc, apply forward, store `{ forward, inverse }`.
   * On apply throw, the stack is unchanged.
   * @param forward - patch to apply and record.
   */
  pushAndApply(forward: GraphPatch): void {
    const inverseOps = invertPatch(structuredClone(this.getDoc()), forward)
    this.apply(forward)
    this.undoStack.push({ forward, inverseOps })
    this.redoStack.length = 0
  }

  /**
   * Record a forward patch without applying it.
   * `getDoc()` must still be the pre-apply document when this runs.
   * @param forward - patch already applied (or about to be applied) by the caller.
   */
  pushApplied(forward: GraphPatch): void {
    const inverseOps = invertPatch(structuredClone(this.getDoc()), forward)
    this.undoStack.push({ forward, inverseOps })
    this.redoStack.length = 0
  }

  /**
   * Apply the inverse of the last pushed patch.
   * @returns false when the undo stack is empty.
   */
  undo(): boolean {
    const entry = this.undoStack[this.undoStack.length - 1]
    if (entry === undefined) return false
    if (entry.inverseOps.length > 0) {
      this.apply({ ops: [...entry.inverseOps] })
    }
    this.undoStack.pop()
    this.redoStack.push(entry)
    return true
  }

  /**
   * Re-apply the last undone forward patch.
   * @returns false when the redo stack is empty.
   */
  redo(): boolean {
    const entry = this.redoStack[this.redoStack.length - 1]
    if (entry === undefined) return false
    this.apply(entry.forward)
    this.redoStack.pop()
    this.undoStack.push(entry)
    return true
  }

  /** Drop undo and redo stacks. */
  clear(): void {
    this.undoStack.length = 0
    this.redoStack.length = 0
  }
}
