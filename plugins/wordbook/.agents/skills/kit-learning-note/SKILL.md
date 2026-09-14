---
name: kit-learning-note
description: >-
  Records a learning note — session retrospective, process walkthrough, or
  how-this-repo-behaves finding — into `.agents/learning/`. Use when the user
  says 新建学习笔记 / 记学习笔记 / record a learning / retrospective, or asks to
  capture what was just learned after finishing work. Part of the kit-* skill
  family under `skills/kit/`, shipped by `ai-eng init`. For uncommitted sparks
  and todos use kit-inbox-capture instead.
---

# Learning Note

Record one learning note. Contract authority: [learning README](../../../learning/README.md). Sibling: [kit-inbox-capture](../kit-inbox-capture/SKILL.md). This skill is guidance, not a second contract.

## Inputs

| Input | Required | Notes |
|---|---|---|
| **主题** (topic) | yes | What was learned; Chinese preferred, short title |
| **正文** | no | Retro body; if missing, summarize the session from context — what happened, what was learned, what to do differently |
| **slug** | no | `kebab-case` English/pinyin; derive from 主题 if missing |

If 主题 is missing, ask once and stop. Do not interview for optional fields.

## Steps

1. Confirm `.agents/learning/README.md` exists; if not, stop and say learning is not initialized.
2. Date = today (`yyyy-mm-dd`). Path: `.agents/learning/{date}-{slug}.md`. If that path exists, adjust slug (`-2`, `-3`, …) — never overwrite.
3. Write the note (Chinese body; terms, paths, and commands may stay English): a `# <标题>` heading plus a short body. No Agent Note header, no `Status:` line, no skeleton — learning notes are outside the `verify-notes` gate.
4. If the note surfaces an uncommitted spark or todo, capture it in `.agents/inbox/` ([kit-inbox-capture](../kit-inbox-capture/SKILL.md)) and link from the note — never turn learning into a todo list.
5. Content that must not leave the machine goes to `.agents/learning/private/` (gitignored by the scoped `.gitignore` `init` wrote).
6. Report the created path. Do **not** commit unless the user asks.

## Hard stops

- Do not write Agent Notes or touch `.agents/notes/`; do not run `verify-notes` on `.agents/learning/`.
- Do not promote learnings into proposals — that is [kit-inbox-promote](../kit-inbox-promote/SKILL.md)'s job, via an inbox spark.
- Do not put consumer-facing contracts or durable decisions here; those live in `README.md`, `docs/`, or Agent Notes.
