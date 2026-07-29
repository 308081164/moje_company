#!/usr/bin/env python3
"""Quick mesh topology analysis for hole diagnosis."""
import json
import sys
from pathlib import Path

import trimesh
from trimesh import grouping


def load_mesh(path: Path) -> trimesh.Trimesh:
    m = trimesh.load(str(path), process=False)
    if isinstance(m, trimesh.Scene):
        m = trimesh.util.concatenate(tuple(m.geometry.values()))
    return m


def analyze(path: Path) -> dict:
    m = load_mesh(path)
    edge_groups = grouping.group_rows(m.edges_sorted, require_count=True)
    boundary = int((edge_groups == 1).sum())
    nonmanifold = int((edge_groups > 2).sum())
    areas = m.area_faces if hasattr(m, "area_faces") else []
    deg = int((areas <= 1e-14).sum()) if len(areas) else 0
    import numpy as np

    median_area = float(np.median(areas)) if len(areas) else 0.0
    comps = m.split(only_watertight=False)
    tiny = sum(1 for c in comps if len(c.faces) < 20)
    return {
        "path": str(path),
        "verts": len(m.vertices),
        "faces": len(m.faces),
        "watertight": bool(m.is_watertight),
        "euler": int(m.euler_number),
        "boundary_edges": boundary,
        "nonmanifold_edges": nonmanifold,
        "degenerate_faces": deg,
        "median_face_area": median_area,
        "components": len(comps),
        "tiny_components_lt20faces": tiny,
    }


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("outputs")
    tasks = sorted(root.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    for td in tasks[:5]:
        if not td.is_dir():
            continue
        print(f"\n=== TASK {td.name} ===")
        for name in (
            "raw_mesh.obj",
            "finished_raw.obj",
            "generated.glb",
            "final.glb",
            "preview.glb",
            "ai_repaired.glb",
        ):
            fp = td / name
            if fp.is_file():
                print(json.dumps(analyze(fp), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
