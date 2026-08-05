"""Smoke tests for Ultra CAD reverse pipeline (synthetic torus)."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import trimesh
except ImportError:
    trimesh = None

from app.config import UltraCadConfig
from app.services.cad_reverse import cad_reverse_mesh
from app.services.cad_reverse.surface_fit import occ_available


@unittest.skipIf(trimesh is None, "trimesh not installed")
class TestCadReverseSmoke(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.mkdtemp(prefix="cad_rev_")
        self.session_id = "smoke-session"

    def tearDown(self):
        import shutil

        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def _write_torus_obj(self) -> str:
        mesh = trimesh.creation.torus(major_radius=12.0, minor_radius=3.0, major_sections=48, minor_sections=24)
        path = os.path.join(self._tmpdir, "torus.obj")
        mesh.export(path)
        return path

    def test_pipeline_runs_without_crash(self):
        mesh_path = self._write_torus_obj()
        cfg = UltraCadConfig(enabled=True, max_surfaces=20, fit_tolerance_mm=0.2)
        result = cad_reverse_mesh(mesh_path, self._tmpdir, self.session_id, ultra_cad=cfg)
        self.assertIn("success", result)
        self.assertIn("occ_available", result)
        if not occ_available():
            self.assertFalse(result.get("success"))
            self.assertIn("pythonocc", str(result.get("error", "")) + str(result.get("warning", "")))
            return
        if result.get("success"):
            self.assertTrue(os.path.isfile(result.get("step_path", "")))
            report_path = result.get("report_path")
            if report_path:
                self.assertTrue(os.path.isfile(report_path))


if __name__ == "__main__":
    unittest.main()
