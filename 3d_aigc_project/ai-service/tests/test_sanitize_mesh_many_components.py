"""
sanitize_mesh must not hang on meshes with tens of thousands of tiny components.
"""

import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import numpy as np
    import trimesh
except ImportError:
    np = None
    trimesh = None

from app.services.mesh_processor import MeshProcessor, _MAX_PRIMARY_CLUSTER_COMPONENTS


def _build_fragmented_inlay(n_junk: int = 600) -> "trimesh.Trimesh":
    """One main torus plus many tiny triangle floaters (simulates bad CAD export)."""
    main = trimesh.creation.torus(major_radius=10.0, minor_radius=1.2, major_sections=48, minor_sections=24)
    main.apply_translation([0.0, 0.0, 0.0])
    parts = [main]
    rng = np.random.default_rng(42)
    for i in range(n_junk):
        tri = trimesh.Trimesh(
            vertices=rng.random((3, 3)) * 0.01 + np.array([50.0 + i * 0.001, 0.0, 0.0]),
            faces=[[0, 1, 2]],
            process=False,
        )
        parts.append(tri)
    return trimesh.util.concatenate(parts)


@unittest.skipIf(trimesh is None or np is None, "trimesh/numpy not installed")
class TestSanitizeMeshManyComponents(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.mkdtemp(prefix="sanitize_many_")
        self.processor = MeshProcessor()

    def tearDown(self):
        import shutil

        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def test_sanitize_many_components_completes_quickly(self):
        mesh = _build_fragmented_inlay(n_junk=700)
        in_path = os.path.join(self._tmpdir, "inlay.obj")
        out_path = os.path.join(self._tmpdir, "inlay_clean.glb")
        mesh.export(in_path)

        t0 = time.monotonic()
        cleaned, info = self.processor.sanitize_mesh(
            in_path, output_path=out_path, select_primary=True
        )
        elapsed = time.monotonic() - t0

        self.assertTrue(os.path.isfile(cleaned))
        self.assertLess(elapsed, 30.0, f"sanitize_mesh took {elapsed:.1f}s")
        primary = info.get("primary_assembly") or {}
        clustered = primary.get("components_clustered", primary.get("clusters", 0))
        self.assertLessEqual(clustered, _MAX_PRIMARY_CLUSTER_COMPONENTS)
        verts = self.processor.analyze_mesh(cleaned).get("vertices", 0)
        self.assertGreater(verts, 100)

    def test_select_primary_caps_before_clustering(self):
        mesh = _build_fragmented_inlay(n_junk=800)
        _, stats = self.processor._select_primary_assembly(mesh)
        self.assertGreater(stats.get("components_in", 0), _MAX_PRIMARY_CLUSTER_COMPONENTS)
        self.assertLessEqual(
            stats.get("components_clustered", 0),
            _MAX_PRIMARY_CLUSTER_COMPONENTS,
        )


if __name__ == "__main__":
    unittest.main()
