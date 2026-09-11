<!-- ai-eng:begin -->
# AGENTS.md

Standing orders for AI-assisted work in this repository.

- Non-trivial changes add or update an Agent Note under `.agents/notes/` in the same change ([format](.agents/notes/README.md)).
- Design specs and brainstorming output land in `.agents/notes/proposed/` (Agent Note format), or `.agents/inbox/` then promote when the repo has an inbox — not under `docs/superpowers/specs/` and not as standing agent checklists under `docs/` ([placement](.agents/notes/README.md#design-drafts-and-checklists)).
- Registrations and durable decisions state contracts; do not leave reasoning transcripts in comments or docs.
- Prefer explicit resolve/default steps at package boundaries over hidden `??` inside run paths.
- Misconfiguration fails loud at the earliest resolvable point.
- Tests describe behavior, not "correctness."
- Run the smallest relevant checks before push (`ai-eng verify-notes` when notes change; package tests for code). Add a `verify-notes` script that runs `ai-eng verify-notes .agents/notes` when helpful.

Product-specific runtime rules belong in this file only when this repository owns that runtime.

<!-- ai-eng:end -->

## DeepSeek Harness plugin (agent-observe)

This package is an opt-in plugin inside the `deepseek-harness` monorepo.

- Harness plugin standing orders (do not edit `packages/` or `vendor/` to make this plugin work): [../AGENTS.md](../AGENTS.md).
- Non-trivial **observe-only** decisions live under `.agents/notes/` (kit English format, `pnpm run verify-notes`). Plugin-only PRs do **not** require a root harness Agent Note.
- Changes that alter harness product contracts still need a root `.agents/notes/` entry in the same PR.
- `docs/testing-policy.md` is advisory for note/process only. Package tests remain `pnpm test` / `pnpm run typecheck`; kit ~90% coverage guidance does not apply here.
