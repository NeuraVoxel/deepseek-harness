# Testing

| Lane | Command | Role |
|---|---|---|
| Schema | `make check-schemas` | Fixtures validate against `schemas/` |
| Unit | `make test` | Parse + closed-loop fixture expectations |
| Agent notes | `python3 scripts/verify_agent_notes.py` | Header/status shape when notes exist |
| Live bridges / full bags | (future) | Self-skip without credentials; not on PR critical path |

Prefer small fixtures in CI. Real vehicle data belongs in optional or nightly jobs.
