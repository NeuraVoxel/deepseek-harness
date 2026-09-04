"""Closed-loop MVP: raw fixture → parse → dataset revision."""

from __future__ import annotations

import json
from pathlib import Path

from parse.parse_clip import build_dataset_revision, parse_clip

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures" / "closed-loop"


def _load(name: str) -> dict:
    with (FIXTURES / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def test_parse_clip_matches_fixture() -> None:
    raw = _load("raw_clip.json")
    expected = _load("parsed_clip.json")
    assert parse_clip(raw) == expected


def test_dataset_revision_fixture_shape() -> None:
    parsed = _load("parsed_clip.json")
    expected = _load("dataset_revision.json")
    built = build_dataset_revision(
        revision_id=expected["revision_id"],
        dataset_id=expected["dataset_id"],
        clip_ids=[parsed["clip_id"]],
        created_at=expected["created_at"],
        parent_revision_ids=[],
        lineage_note=expected["lineage_note"],
    )
    assert built == expected


def test_revision_ids_are_stable_references() -> None:
    revision = _load("dataset_revision.json")
    assert revision["clip_ids"] == ["clip-demo-001"]
    assert revision["parent_revision_ids"] == []
