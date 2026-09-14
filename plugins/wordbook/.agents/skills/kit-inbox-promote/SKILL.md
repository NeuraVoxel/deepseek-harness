---
name: kit-inbox-promote
description: >-
  Promotes an open `.agents/inbox/` spark into a formal `proposed/` Agent Note with
  bidirectional links and QUEUE.md checkbox update. Use when the user explicitly
  asks to 升格 / promote an inbox item, or says kit-inbox-promote. Part of the
  kit-* skill family under `skills/kit/`, shipped by `ai-eng init`. Do not use
  for capture-only requests.
---

# Inbox Promote

Promote one open spark to `proposed/`. Contract authority: [inbox README](../../../inbox/README.md) and [Agent Notes README](../../../notes/README.md). Sibling: [kit-inbox-capture](../kit-inbox-capture/SKILL.md). This skill is guidance, not a second contract.

## Inputs

| Input | Required | Notes |
|---|---|---|
| **目标** | yes | Spark path, QUEUE title, or a keyword that uniquely matches one `open` spark |
| **class** | no | One of `feature` / `bug-fix` / `simplification` / `architecture` / `process` / `testing`; ask once if missing or ambiguous |
| **补充** | no | Extra facts for the Agent Note; do not invent beyond spark + 补充 |

If 目标 is missing, or matches zero / multiple `open` sparks, ask once and stop. Do not promote without an explicit promote/升格 request in the turn.

## Steps

1. Resolve the spark file. Require `Status: open`. If `promoted` or `discarded`, stop and report.
2. Choose `class` (from input or one clarifying question).
3. Create `.agents/notes/proposed/<class>/yyyy-mm-dd-<slug>.md` using today's date and a slug from the spark title. Never move or rename the inbox file into notes. If the path exists, adjust slug — never overwrite.
4. Write a full **proposed** Agent Note in English (kit note language), required sections only:

```markdown
# Agent Note: <title>

Status: proposed

## Problem
## Proposal
## Alternatives considered
## Acceptance criteria
## Risks
```

In `## Proposal` (or a short related line), link to the spark with a relative path. Base content on the spark (and 补充); expand into a real proposal without inventing unstated product scope. `## Alternatives considered` must include at least one genuine alternative (from the user, implied by the spark, or an honest “defer / do nothing” with why it loses for now).

5. Update the spark: `Status: promoted`, and a clear link to the new Agent Note.
6. Update the matching `QUEUE.md` row to `[x]` and add `→ [Agent Note](<relative path>)`.
7. Run `pnpm exec ai-eng verify-notes .agents/notes` (or `npx @neuravoxel/ai-eng verify-notes .agents/notes`) and fix format failures before finishing.
8. Report spark path, Agent Note path, and QUEUE line. Do **not** commit unless the user asks. Do **not** implement the proposal.

## Hard stops

- No explicit 升格/promote in this turn → do not write a proposed note.
- Do not discard, do not implement code, do not edit unrelated sparks.
- Do not put the decision under `docs/` or `learning/`.
