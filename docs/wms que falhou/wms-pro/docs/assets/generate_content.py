#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "content.js"


def build_tree(paths: list[str]) -> list[dict]:
    root: list[dict] = []

    def sort_nodes(nodes: list[dict]) -> None:
        nodes.sort(key=lambda node: (node["type"] != "dir", node["name"].lower()))
        for node in nodes:
            if node["type"] == "dir":
                sort_nodes(node["children"])

    for path in paths:
        parts = path.split("/")
        cursor = root
        current = []
        for index, part in enumerate(parts):
            current.append(part)
            is_file = index == len(parts) - 1
            if is_file:
                cursor.append({"type": "file", "name": part, "path": path})
                continue
            dir_path = "/".join(current)
            existing = next((node for node in cursor if node["type"] == "dir" and node["path"] == dir_path), None)
            if not existing:
                existing = {"type": "dir", "name": part, "path": dir_path, "children": []}
                cursor.append(existing)
            cursor = existing["children"]

    sort_nodes(root)
    return root


def main() -> None:
    pages: dict[str, str] = {}
    md_files = sorted(path for path in ROOT.rglob("*.md") if path.is_file())

    for file_path in md_files:
        relative = file_path.relative_to(ROOT).as_posix()
        pages[relative] = file_path.read_text(encoding="utf-8")

    payload = {"tree": build_tree(list(pages.keys())), "pages": pages}
    OUTPUT.write_text(
        "window.DOCS_CONTENT = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
