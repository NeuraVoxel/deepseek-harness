#!/usr/bin/env python3
"""Lightweight Agent Note header checks for active lifecycle folders."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTES = ROOT / ".agents" / "notes"
LIFECYCLES = {
    "proposed": re.compile(r"^Status:\s*proposed\s*$"),
    "implemented": re.compile(r"^Status:\s*implemented\s*$"),
    "rejected": re.compile(r"^Status:\s*rejected\s+—\s+.+$"),
}
TITLE = re.compile(r"^# Agent Note:\s+.+$")


def check_file(path: Path, lifecycle: str) -> list[str]:
    problems: list[str] = []
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if len(lines) < 3:
        return [f"{path}: need title, blank line, Status"]
    if not TITLE.match(lines[0]):
        problems.append(f"{path}: line 1 must be '# Agent Note: …'")
    if lines[1].strip() != "":
        problems.append(f"{path}: line 2 must be blank")
    if not LIFECYCLES[lifecycle].match(lines[2]):
        problems.append(f"{path}: line 3 Status must match lifecycle '{lifecycle}'")
    if "## Problem" not in text:
        problems.append(f"{path}: missing '## Problem'")
    if "## Alternatives considered" not in text:
        problems.append(f"{path}: missing '## Alternatives considered'")
    return problems


def main() -> int:
    problems: list[str] = []
    found = 0
    for lifecycle in LIFECYCLES:
        folder = NOTES / lifecycle
        if not folder.is_dir():
            continue
        for path in sorted(folder.rglob("*.md")):
            if path.name == "README.md":
                continue
            found += 1
            problems.extend(check_file(path, lifecycle))
    if problems:
        for item in problems:
            print(item, file=sys.stderr)
        return 1
    print(f"OK agent notes ({found} file(s) checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
