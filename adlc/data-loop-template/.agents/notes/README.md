# Agent Notes

Decision records for this repository. Path encodes status and class:

```text
.agents/notes/{proposed|implemented|rejected}/<class>/YYYY-MM-DD-kebab-title.md
```

Suggested classes: `feature`, `architecture`, `process`, `testing`, `bug-fix`, `simplification`, `integration`.

## When to write one

Every non-trivial change adds or updates a note in the same PR. Update the owning note instead of duplicating.

## File format

First three lines:

```markdown
# Agent Note: <title>

Status: proposed
```

`Status` must match the folder: `proposed`, `implemented`, or `rejected — <one-line reason>`.

### proposed/

```markdown
## Problem
## Proposal
## Alternatives considered
## Acceptance criteria
## Risks
```

### implemented/

```markdown
## Problem
## Decision
## Alternatives considered
## Consequences
```

Use present tense for shipped reality. Move the file when status changes; do not leave a stale copy.

## Lightweight check

```sh
python3 scripts/verify_agent_notes.py
```
