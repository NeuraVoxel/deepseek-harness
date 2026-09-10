# Agent Note: Learning notes directory

Status: implemented

English | [中文](2026-09-10-learning-notes-directory.zh.md)

## Problem

Session recaps, rule-reading walkthroughs, and process samples accumulate while people and agents work in this repository. Without a dedicated home, that material either pollutes [Agent Notes](../../README.md) (wrong contract, format gates, and authority), lands under `docs/` as non-current-state narrative, or stays only in chat and disappears.

## Decision

[`.agents/learning/`](../../../learning/README.md) holds learning notes for this repository: session recaps, rule-reading flow, and process samples. The bilingual directory README owns the writing rules.

Boundaries:

- Learning notes are **not** Agent Notes. They do not use the Agent Note header or skeleton and do not run through `verify-agent-note-format` or `verify-agent-note-classification`.
- Learning notes are **not** product or package contracts. Durable facts belong in `docs/`, package READMEs, or Agent Notes.
- Body text prefers Chinese; commands, paths, and identifiers may stay English.
- File names are `yyyy-mm-dd-topic.md`. Machine-local notes live under `.agents/learning/private/`, which the root `.gitignore` ignores.
- After a durable fact is absorbed into an Agent Note or published docs, delete the learning note or mark it absorbed so this tree does not become a second authority.
- `verify-md-links` and `verify-md-wrap` do not include this tree; learning notes are not a mechanically checked authority surface.

The root [AGENTS.md](../../../../AGENTS.md) layout lists `learning/`. [docs/AGENTS.md](../../../../docs/AGENTS.md) routes study material here. [Agent Notes README](../../README.md) states the sibling boundary.

## Alternatives considered

**Record study material as `process` Agent Notes.** Rejected: Agent Notes are decision records with a gated format and present-tense authority once implemented. Session recaps and teaching walkthroughs are the wrong kind of truth for that tree and would inflate mis-hit risk when searching for decisions.

**Keep learning notes only under `private/` and never commit them.** Rejected: a shareable team corpus for how this repository's rules and gates work is useful; privacy remains available via the ignored `private/` subtree.

**Place study material under `docs/` or cookbook.** Rejected: the documentation standard requires current-state product and contributor contracts, not chat-derived study narrative. Cookbook owns procedures with verify steps; learning notes own temporary mental models.

## Consequences

Committed learning notes can be shared and searched, but they lose to Agent Notes and published docs when they disagree. Authors must absorb durable facts into the owning tier instead of treating `.agents/learning/` as standing orders. Markdown link and wrap gates do not police this tree, so broken outbound links inside learning notes are an author responsibility, not a CI failure.
