#!/usr/bin/env python3
"""Lightweight structural validator for Aquians examples without external deps."""
import json
from pathlib import Path

SCHEMA_PATH = Path("schema/aquians_article_response_v1.schema.json")
EXAMPLES_PATH = Path("examples/aquians_article_response_v1.examples.json")


def fail(msg: str) -> None:
    raise SystemExit(f"VALIDATION FAILED: {msg}")


def main() -> None:
    schema = json.loads(SCHEMA_PATH.read_text())
    examples = json.loads(EXAMPLES_PATH.read_text())

    if schema.get("properties", {}).get("version", {}).get("const") != "1.0":
        fail("schema version const must be 1.0")

    if not isinstance(examples, list) or len(examples) != 5:
        fail("expected exactly 5 examples")

    required = schema["required"]
    for i, ex in enumerate(examples, 1):
        missing = [k for k in required if k not in ex]
        if missing:
            fail(f"example {i} missing required keys: {missing}")

        objections = ex["objections"]
        replies = ex["replies"]
        if not (2 <= len(objections) <= 5):
            fail(f"example {i} objections count out of range")
        if len(replies) != len(objections):
            fail(f"example {i} replies should match objections count")

        indices = [o["index"] for o in objections]
        if indices != list(range(1, len(objections) + 1)):
            fail(f"example {i} objection indices must be contiguous starting at 1")

        reply_targets = sorted(r["to_objection"] for r in replies)
        if reply_targets != indices:
            fail(f"example {i} replies must target each objection exactly once")

    print("Aquians examples validation passed.")


if __name__ == "__main__":
    main()
