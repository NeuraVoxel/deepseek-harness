# Learning notes

English | [中文](README.zh.md)

This directory holds study notes for this repository: session recaps, rule-reading walkthroughs, and process samples.

## Boundaries

- **Not an Agent Note.** Do not put these under [`.agents/notes/`](../notes/README.md). They do not run through `verify-agent-note-format` / `verify-agent-note-classification` and do not use the Agent Note header or skeleton.
- **Not product documentation.** Durable contracts live in `docs/`, package READMEs, or Agent Notes — not here.
- **Outside doc link/wrap gates.** `verify-md-links` / `verify-md-wrap` globs do not include this directory; learning notes do not carry mechanically checked authority-link obligations.

Authority vs study corpus: [learning notes decision](../notes/implemented/process/2026-09-10-learning-notes-directory.md).

## Language

Prefer Chinese for note bodies. Keep English for proper nouns, commands, paths, and identifiers (for example Agent Note, `doc-sync`, `AGENTS.md`, capability seam).

## Layout

File names: `yyyy-mm-dd-topic.md` (date of first drafting).

Machine-local notes live under `.agents/learning/private/` (ignored by the repository root `.gitignore`; do not commit them).

When a durable fact has been absorbed into an Agent Note or published docs, delete the learning note or mark it absorbed at the top so this directory does not become a second authority.
