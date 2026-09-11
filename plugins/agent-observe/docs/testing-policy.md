# Testing policy

Portable testing guidance for repositories initialized with `@neuravoxel/ai-eng`.

## Behavior over correctness

Tests describe behavior, not correctness. Name the observable outcome a change must preserve or reject. When behavior changes deliberately, update the owning tests in the same change and explain why in the PR.

## Coverage gates

Prefer per-`src` coverage gates in CI rather than a single repository-wide percentage that hides uncovered modules. A practical Vitest recipe:

```ts
coverage: {
  include: ['src/**'],
  thresholds: {
    statements: 90,
  },
}
```

Exact thresholds are consumer-chosen. For libraries, start at **statements 90** and raise only when the package's risk justifies it. When selecting local evidence before push, name both the owning tests and the source files those tests must prove.

This kit repository wires that recipe as `pnpm run test:coverage` (CI and `prepublishOnly`). Consumer repos copy the policy via `ai-eng init` and choose their own scripts and thresholds.

## Expected output placement

Owner-local expected output lives next to the owning test (for example under `tests/expected/` or beside the fixture). A top-level snapshot tree is only for full product round-trips the consumer defines and owns.

## Kit closed-loop lanes (this package)

When developing `@neuravoxel/ai-eng` itself:

| Lane | Command |
|---|---|
| Unit | `pnpm test` |
| Coverage | `pnpm run test:coverage` |
| Notes gate | `pnpm run verify-notes` |
| Product smoke | `pnpm run test:smoke` (build + built CLI + `init` → `verify-notes`) |
| Pack / consumer install | `pnpm run test:pack-smoke` (`pnpm pack` → temp project `pnpm add` → `pnpm exec ai-eng` + public import) |

## What this kit does not ship

`@neuravoxel/ai-eng` does **not** ship harness recorded-session replay, session JSONL fixtures, or profile-pinned snapshot harnesses. Consumers that need those mechanisms keep them in their own repository.
