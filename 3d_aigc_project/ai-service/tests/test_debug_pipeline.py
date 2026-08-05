"""
Debug pipeline step-by-step tests (synthetic torus meshes).
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import trimesh
except ImportError:
    trimesh = None

from app.services.debug_pipeline import DebugPipelineService, StepStatus
from app.services.debug_pipeline_steps import DEBUG_STEP_IDS
from tests.test_casa_alignment import _build_ai_source, _build_inlay_target


@unittest.skipIf(trimesh is None, "trimesh not installed")
class TestDebugPipeline(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.mkdtemp(prefix="debug_pipe_")
        self.service = DebugPipelineService()

    def tearDown(self):
        import shutil

        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def _materialize_inputs(self):
        inlay = _build_inlay_target(major_r=11.0)
        ai = _build_ai_source(major_r=11.0, scale=0.55, roll_deg=20.0)
        raw_path = os.path.join(self._tmpdir, "raw_mesh.obj")
        inlay_path = os.path.join(self._tmpdir, "inlay.glb")
        ai.export(raw_path)
        inlay.export(inlay_path)
        return raw_path, inlay_path

    def test_session_step_gating(self):
        raw_path, inlay_path = self._materialize_inputs()
        session = self.service.create_session(
            source_task_id="test-task",
            raw_mesh_path=raw_path,
            inlay_mesh_path=inlay_path,
            session_id="test-session",
            enable_icp=False,
        )
        self.assertEqual(session.current_step_index, 0)
        self.assertEqual(session.step_states["prepare"]["status"], StepStatus.PENDING.value)

        result = self.service.run_step(session.session_id, "prepare")
        self.assertTrue(result.get("success"))
        self.assertEqual(
            session.step_states["prepare"]["status"],
            StepStatus.AWAITING_CONFIRM.value,
        )

        data = self.service.confirm_step(session.session_id, "prepare")
        self.assertEqual(data["current_step_index"], 1)
        self.assertEqual(
            session.step_states["prepare"]["status"],
            StepStatus.CONFIRMED.value,
        )

        with self.assertRaises(RuntimeError):
            self.service.run_step(session.session_id, "align_coarse")

    def test_rerun_awaiting_confirm_current_step(self):
        raw_path, inlay_path = self._materialize_inputs()
        session = self.service.create_session(
            source_task_id="test-task-rerun",
            raw_mesh_path=raw_path,
            inlay_mesh_path=inlay_path,
            session_id="test-rerun",
            enable_icp=False,
        )
        self.service.run_step(session.session_id, "prepare")
        self.service.confirm_step(session.session_id, "prepare")
        first = self.service.run_step(session.session_id, "inlay_sanitize")
        self.assertTrue(first.get("success"))
        second = self.service.run_step(session.session_id, "inlay_sanitize", force=True)
        self.assertTrue(second.get("success"))
        self.assertEqual(
            session.step_states["inlay_sanitize"]["status"],
            StepStatus.AWAITING_CONFIRM.value,
        )

    def test_session_rehydrate_after_service_reload(self):
        raw_path, inlay_path = self._materialize_inputs()
        session = self.service.create_session(
            source_task_id="test-task-reload",
            raw_mesh_path=raw_path,
            inlay_mesh_path=inlay_path,
            session_id="test-reload",
            enable_icp=False,
        )
        self.service.run_step(session.session_id, "prepare")
        self.service.confirm_step(session.session_id, "prepare")
        self.service.run_step(session.session_id, "inlay_sanitize")
        self.service.confirm_step(session.session_id, "inlay_sanitize")
        self.service.run_step(session.session_id, "ai_sanitize")

        reloaded_service = DebugPipelineService()
        reloaded = reloaded_service.get_session(session.session_id)
        self.assertEqual(reloaded.current_step_index, 2)
        self.assertEqual(
            reloaded.step_states["ai_sanitize"]["status"],
            StepStatus.AWAITING_CONFIRM.value,
        )
        rerun = reloaded_service.run_step(reloaded.session_id, "ai_sanitize", force=True)
        self.assertTrue(rerun.get("success"))

    def test_full_pipeline_smoke(self):
        raw_path, inlay_path = self._materialize_inputs()
        session = self.service.create_session(
            source_task_id="test-task-smoke",
            raw_mesh_path=raw_path,
            inlay_mesh_path=inlay_path,
            session_id="test-smoke",
            enable_icp=False,
            enable_ai_part_split=True,
        )
        for step_id in DEBUG_STEP_IDS:
            idx = DEBUG_STEP_IDS.index(step_id)
            self.assertEqual(session.current_step_index, idx)
            result = self.service.run_step(session.session_id, step_id)
            self.assertTrue(
                result.get("success"),
                msg=f"step {step_id} failed: {result.get('message')}",
            )
            preview = result.get("preview_path")
            if preview:
                self.assertTrue(os.path.isfile(preview), msg=f"missing preview for {step_id}")
            self.service.confirm_step(session.session_id, step_id)

        self.assertTrue(session.to_dict()["completed"])


if __name__ == "__main__":
    unittest.main()
