---
name: dsh-learning-note
description: Use when capturing a learning note for this repository — a session retrospective, a process walkthrough, or an observed fact about how the harness behaves — especially after finishing work, when the user says 记学习笔记 / 新建学习笔记 / record a learning / retrospective, or asks to write down what this session just learned. Writes one dated entry into `.agents/learning/`. Not for decisions, which are Agent Notes, and not for durable contracts, which belong in READMEs, `docs/`, or Agent Notes.
---

# Learning note

Capture one learning note. The [learning README](../../learning/README.md) owns the contract; this skill is the capture procedure, never a second contract.

## Inputs

| Input | Required | Notes |
|---|---|---|
| **Topic** | yes | What was learned; short title, any language |
| **Body** | no | Retro body; when missing, summarize the session from context — what happened, what was learned, what to do differently |
| **slug** | no | `kebab-case`; derive from the topic when missing |

If the topic is missing, ask once and stop. Do not interview for optional fields.

## Steps

1. Confirm `.agents/learning/README.md` exists; if not, stop and say learning is not initialized.
2. Date = today (`yyyy-mm-dd`). Path: `.agents/learning/{date}-{slug}.md`. If the path exists, adjust the slug (`-2`, `-3`, …) — never overwrite.
3. Write the note: a `# <title>` heading plus a short body, in Chinese by default; terms, paths, and commands stay English. No Agent Note header, no `Status:` line, no proposal skeleton.
4. Content that must not leave the machine goes to `.agents/learning/private/`, ignored by that directory's `.gitignore`.
5. If the note surfaces an idea worth formal review, do not queue it inside the note: say so and leave the Agent Note decision to an explicit request, per [Agent Notes](../../notes/README.md).
6. Report the created path. Do **not** commit unless the user asks.

## Hard stops

- Do not write, move, or edit anything under `.agents/notes/`, and do not run the Agent Note gates on `.agents/learning/` entries: they are outside those gates by contract.
- Do not put consumer-facing contracts, shipped behavior, or durable decisions in a note; those live in `README.md`, `docs/`, or an Agent Note.
- Do not let this directory become a second authority: when its durable facts land elsewhere, delete the note or mark it absorbed at its top.
- Editing the learning README means editing its bilingual counterpart in the same pass and re-recording the pair with `pnpm run verify-translation-pairing --write .agents/learning/README.md`, per [the pairing contract](../../../docs/i18n/README.md).
