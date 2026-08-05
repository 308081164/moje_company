"""独立调试会话与 step-direct API 测试。"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import trimesh
except ImportError:
    trimesh = None

from app.services.debug_pipeline import DebugPipelineService
from tests.test_casa_alignment import _build_ai_source, _build_inlay_target


@unittest.skipIf(trimesh is None, "trimesh not installed")
class TestDebugStandalone(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.mkdtemp(prefix="debug_standalone_")
        self.service = DebugPipelineService()

    def tearDown(self):
        import shutil

        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def _paths(self):
        inlay = _build_inlay_target(major_r=11.0)
        ai = _build_ai_source(major_r=11.0, scale=0.55, roll_deg=20.0)
        raw_path = os.path.join(self._tmpdir, "raw_mesh.obj")
        inlay_path = os.path.join(self._tmpdir, "inlay.glb")
        ai.export(raw_path)
        inlay.export(inlay_path)
        return raw_path, inlay_path

    def test_standalone_session_no_source_task(self):
        raw_path, inlay_path = self._paths()
        session = self.service.create_standalone_session(
            raw_mesh_path=raw_path,
            inlay_mesh_path=inlay_path,
            session_id="standalone-test",
            enable_icp=False,
        )
        self.assertEqual(session.source_task_id, "")
        data = session.to_dict()
        self.assertEqual(data["session_id"], "standalone-test")

    def test_step_direct_prepare(self):
        raw_path, inlay_path = self._paths()
        result = self.service.run_step_direct(
            "prepare",
            raw_path,
            inlay_path,
        )
        self.assertTrue(result.get("success"))
        self.assertEqual(result.get("step_id"), "prepare")
        self.assertIn("output_dir", result)


if __name__ == "__main__":
    unittest.main()
