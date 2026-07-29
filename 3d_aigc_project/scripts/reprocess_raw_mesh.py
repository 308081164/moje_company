#!/usr/bin/env python3
"""Re-run jewelry_finish_mesh on an existing raw_mesh.obj for validation."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-service"))

from app.config import get_config
from app.services.mesh_processor import get_mesh_processor


def analyze(path: Path) -> dict:
    import trimesh
    from trimesh import grouping

    m = trimesh.load(str(path), process=False)
    if isinstance(m, trimesh.Scene):
        m = trimesh.util.concatenate(tuple(m.geometry.values()))
    edge_groups = grouping.group_rows(m.edges_sorted, require_count=True)
    return {
        "path": str(path),
        "verts": len(m.vertices),
        "faces": len(m.faces),
        "watertight": bool(m.is_watertight),
        "boundary_edges": int((edge_groups == 1).sum()),
        "nonmanifold_edges": int((edge_groups > 2).sum()),
    }


def main() -> int:
    task_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "outputs" / "2e20bc88-b432-4fef-8a60-a9a9587586d9"
    raw = task_dir / "raw_mesh.obj"
    out = task_dir / "finished_raw_repaired.obj"
    if not raw.is_file():
        print(f"missing {raw}", file=sys.stderr)
        return 1

    print("BEFORE raw:", json.dumps(analyze(raw), indent=2))
    proc = get_mesh_processor()
    gen_cfg = get_config().generation
    stats = proc.repair_mesh(
        str(raw),
        str(out),
        apply_jewelry_smooth=True,
        generation_config=gen_cfg,
    )
    print("repair_stats:", json.dumps(stats, indent=2, default=str))
    print("AFTER repaired:", json.dumps(analyze(out), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
