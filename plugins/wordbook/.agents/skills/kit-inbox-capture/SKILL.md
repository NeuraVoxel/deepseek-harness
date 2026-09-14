---
name: kit-inbox-capture
description: >-
  Captures an uncommitted inspiration into `.agents/inbox/` (spark file + QUEUE.md
  checkbox). Use when the user wants to record a spark, idea, or inbox item; says
  kit-inbox-capture / 记到 inbox / 记灵感; or gives only spark body and asks to queue
  it without promoting to an Agent Note. Part of the kit-* skill family under
  `skills/kit/`, shipped by `ai-eng init`.
---

# Inbox Capture

Record one spark. Contract authority: [inbox README](../../../inbox/README.md). Sibling: [kit-inbox-promote](../kit-inbox-promote/SKILL.md). This skill is guidance, not a second contract.

## Inputs

| Input | Required | Notes |
|---|---|---|
| **主体** (spark body) | yes | Idea + why capture now; Chinese preferred |
| **标题** | no | Short Chinese title; derive from 主体 if missing |
| **slug** | no | `kebab-case` English/pinyin; derive from 标题 if missing |
| **Notes** | no | Optional context only — not a Proposal skeleton |

If 主体 is missing, ask once and stop. Do not interview for optional fields.

## Steps

1. Confirm `.agents/inbox/README.md` and `QUEUE.md` exist; if not, stop and say inbox is not initialized.
2. Date = today (`yyyy-mm-dd`). Path: `.agents/inbox/{date}-{slug}.md`. If that path exists, adjust slug (`-2`, `-3`, …) — never overwrite.
3. Write the spark file (Chinese body; terms/paths/Status values may stay English):

```markdown
# Inbox: <标题>

Status: open

## Spark
<主体，可略作整理，不扩写成方案>

## Notes
<仅当用户给了 Notes；否则省略本整节>
```

4. Prepend to `QUEUE.md` (newest first), after the `# Inbox queue` heading:

```markdown
- [ ] [<标题>](./{date}-{slug}.md)
```

5. Report the created path and QUEUE line. Do **not** commit unless the user asks.

## Hard stops

- Do not promote to `proposed/`, write Agent Notes, or put todos in `.agents/learning/`.
- Do not invent dimensions, architecture, or acceptance criteria beyond what the user wrote.
- Do not run `verify-notes` for inbox (inbox is outside that gate).
