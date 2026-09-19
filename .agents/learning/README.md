# Learning notes

English | [中文](README.zh.md)

This directory holds learning notes for this repository: session retrospectives, process walkthroughs, and observed facts about how the repository behaves in practice.

## Boundary

- **Not Agent Notes.** Nothing here enters `.agents/notes/`, uses the Agent Note header or skeleton, or counts as a decision record; see [Agent Notes](../notes/README.md).
- **Not a todo entry.** An idea worth formal review becomes an Agent Note under `notes/proposed/` when the human asks for it; a learning note links over and never becomes a queue of its own.
- **Not consumer documentation.** Durable contracts for adopters live in `README.md`, `docs/`, or an Agent Note — never here.

## Entry language

Write an entry in Chinese by default; terms, paths, and commands stay English. This README itself stays a bilingual pair under [the i18n contract](../../docs/i18n/README.md).

## Layout

- Entries are named `NNN-topic.md`, numbered `001`, `002`, … in creation order, zero-padded to three digits; the next entry takes the highest existing number plus one, and numbers are never reused. A `kebab-case` topic slug follows the number. Capture one with [dsh-learning-note](../skills/dsh-learning-note/SKILL.md).
- Notes that must not leave the machine go to `.agents/learning/private/`, which the sibling `.gitignore` ignores: never commit that subtree.
- When a note's durable facts have been absorbed into an Agent Note or shipped documentation, delete the note or mark it absorbed at its top, so this directory never becomes a second authority.
