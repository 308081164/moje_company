#!/usr/bin/env python3
"""
POC: synthetic mesh → B-spline patches → STEP (AP214).

Usage (inside ai-service container or venv):
  python scripts/poc_cad_reverse.py [--mesh path.obj] [--out out.step]
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import trimesh

from app.config import UltraCadConfig
from app.services.cad_reverse import cad_reverse_mesh
from app.services.cad_reverse.surface_fit import occ_available


def main() -> int:
    parser = argparse.ArgumentParser(description="CAD reverse POC (mesh → STEP)")
    parser.add_argument("--mesh", help="Input OBJ/GLB mesh path")
    parser.add_argument("--out-dir", default=None, help="Output directory")
    args = parser.parse_args()

    if not occ_available():
        print("ERROR: pythonocc-core not available")
        return 1

    out_dir = args.out_dir or tempfile.mkdtemp(prefix="poc_cad_")
    task_id = "poc"

    if args.mesh:
        mesh_path = args.mesh
    else:
        mesh = trimesh.creation.icosphere(subdivisions=3, radius=10.0)
        mesh_path = os.path.join(out_dir, "input.obj")
        mesh.export(mesh_path)
        print(f"Generated icosphere: {mesh_path}")

    cfg = UltraCadConfig(enabled=True, max_surfaces=30)
    result = cad_reverse_mesh(mesh_path, out_dir, task_id, ultra_cad=cfg)
    print(result)
    step = result.get("step_path")
    if step and os.path.isfile(step):
        print(f"STEP written: {step}")
        print("Import into Rhino 7+ or SolidWorks to verify NURBS surfaces.")
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
