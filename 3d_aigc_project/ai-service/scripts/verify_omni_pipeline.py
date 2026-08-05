#!/usr/bin/env python3
"""Verify Hunyuan3D-Omni pipeline API and local weight paths."""

import json
import os
import sys

# Spike script: allow running without GPU for API inspection only
os.environ.setdefault("REQUIRE_GPU", "0")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.conditional_generator import verify_omni_pipeline_api


def main() -> int:
    report = verify_omni_pipeline_api()
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if not report.get("hy3dshape_available"):
        print(
            "\nNote: hy3dshape ships with Hunyuan3D-Omni repo (separate from hy3dgen).",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
