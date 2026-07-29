"""Re-run mesh post-process (align/crop/repair/merge) on an existing task without regen."""
import argparse
import json
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("task_id", help="Task UUID under OUTPUT_DIR")
    parser.add_argument(
        "--output-dir",
        default=os.environ.get("OUTPUT_DIR", "/app/outputs"),
    )
    parser.add_argument(
        "--base",
        default=None,
        help="Inlay/base mesh path (default: uploads/<task>/inlay or similar)",
    )
    args = parser.parse_args()

    sys.path.insert(0, os.environ.get("PYTHONPATH", "/app"))
    from app.services.mesh_processor import MeshProcessor

    task_dir = os.path.join(args.output_dir, args.task_id)
    raw = os.path.join(task_dir, "raw_mesh.obj")
    if not os.path.isfile(raw):
        raw = os.path.join(task_dir, "generated.glb")
    if not os.path.isfile(raw):
        print("No raw_mesh.obj or generated.glb in", task_dir, file=sys.stderr)
        return 1

    base = args.base
    if not base:
        upl = os.path.join("/app/uploads", args.task_id)
        for name in ("inlay.stl", "inlay.glb", "base.stl", "base.glb", "inlay_mesh.stl"):
            p = os.path.join(upl, name)
            if os.path.isfile(p):
                base = p
                break
    if not base or not os.path.isfile(base):
        cleaned = os.path.join(task_dir, "inlay_clean.glb")
        if os.path.isfile(cleaned):
            base = cleaned
    if not base or not os.path.isfile(base):
        print("Base/inlay mesh not found; pass --base", file=sys.stderr)
        return 1

    mp = MeshProcessor()
    result = mp.process_generated_mesh(
        generated_mesh_path=raw,
        base_mesh_path=base,
        output_dir=args.output_dir,
        task_id=args.task_id,
        fusion_method="colored_merge",
        enable_icp=True,
        enable_repair=True,
        output_format="glb",
        apply_jewelry_repair_smooth=True,
    )
    print(json.dumps(result, indent=2, default=str))
    return 0 if result.get("success") else 2


if __name__ == "__main__":
    raise SystemExit(main())
