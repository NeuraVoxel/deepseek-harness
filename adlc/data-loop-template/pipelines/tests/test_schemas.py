"""Schema verifier covers the closed-loop fixture map."""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_verify_schemas_exits_zero() -> None:
    script = ROOT / "scripts" / "verify_schemas.py"
    # runpy does not set exit code; execute as module via path
    ns = runpy.run_path(str(script), run_name="not_main")
    assert ns["main"]() == 0
