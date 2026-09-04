"""Parse a raw clip metadata record into a normalized catalog-oriented record."""

from __future__ import annotations

from typing import Any


def parse_clip(raw: dict[str, Any], *, frame_count: int = 2, duration_ms: int = 200) -> dict[str, Any]:
    """Return a parsed clip dict derived from raw upload metadata.

    @param raw: Clip metadata matching clip-metadata/v1 (plus optional fields ignored).
    @param frame_count: Synthetic frame count for the MVP fixture path.
    @param duration_ms: Synthetic duration for the MVP fixture path.
    @returns: Parsed clip including a ``parsed`` block and stable ``clip_id``.
    """
    clip_id = raw["clip_id"]
    vehicle_id = raw["vehicle_id"]
    return {
        "clip_id": clip_id,
        "schema_version": "clip-metadata/v1",
        "vehicle_id": vehicle_id,
        "captured_at": raw["captured_at"],
        "sensors": list(raw["sensors"]),
        "object_uri": raw.get("object_uri"),
        "parsed": {
            "frame_count": frame_count,
            "duration_ms": duration_ms,
            "norm_uri": f"s3://example-norm/{vehicle_id}/{clip_id}/",
        },
    }


def build_dataset_revision(
    *,
    revision_id: str,
    dataset_id: str,
    clip_ids: list[str],
    created_at: str,
    parent_revision_ids: list[str] | None = None,
    lineage_note: str | None = None,
) -> dict[str, Any]:
    """Build an immutable dataset revision payload (dataset-revision/v1)."""
    payload: dict[str, Any] = {
        "revision_id": revision_id,
        "schema_version": "dataset-revision/v1",
        "dataset_id": dataset_id,
        "created_at": created_at,
        "clip_ids": list(clip_ids),
        "parent_revision_ids": list(parent_revision_ids or []),
    }
    if lineage_note is not None:
        payload["lineage_note"] = lineage_note
    return payload
