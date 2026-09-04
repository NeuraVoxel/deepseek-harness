#!/usr/bin/env python3
"""Validate fixtures/ against schemas/. Exit non-zero on the first failure."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError, ValidationError

ROOT = Path(__file__).resolve().parents[1]

# Explicit fixture → schema mapping keeps the MVP gate obvious.
FIXTURE_SCHEMA: dict[str, str] = {
    "fixtures/closed-loop/raw_clip.json": "schemas/clip-metadata/v1.json",
    "fixtures/closed-loop/parsed_clip.json": "schemas/parsed-clip/v1.json",
    "fixtures/closed-loop/dataset_revision.json": "schemas/dataset-revision/v1.json",
}


def load_json(path: Path) -> object:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    errors = 0
    for fixture_rel, schema_rel in FIXTURE_SCHEMA.items():
        fixture_path = ROOT / fixture_rel
        schema_path = ROOT / schema_rel
        if not fixture_path.is_file():
            print(f"FAIL missing fixture: {fixture_rel}", file=sys.stderr)
            errors += 1
            continue
        if not schema_path.is_file():
            print(f"FAIL missing schema: {schema_rel}", file=sys.stderr)
            errors += 1
            continue
        try:
            schema = load_json(schema_path)
            instance = load_json(fixture_path)
            Draft202012Validator.check_schema(schema)
            Draft202012Validator(schema).validate(instance)
        except (OSError, json.JSONDecodeError, SchemaError, ValidationError) as exc:
            print(f"FAIL {fixture_rel} vs {schema_rel}: {exc}", file=sys.stderr)
            errors += 1
            continue
        print(f"OK   {fixture_rel} → {schema_rel}")
    if errors:
        print(f"{errors} schema check(s) failed", file=sys.stderr)
        return 1
    print("All mapped fixtures valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
