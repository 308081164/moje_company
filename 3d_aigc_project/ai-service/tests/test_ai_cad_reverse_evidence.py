"""ai_cad_reverse 重载证据检测测试。"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.debug_pipeline import _preview_path_from_ctx, _step_has_evidence
from app.services.debug_pipeline_steps import DebugPipelineContext


class TestAiCadReverseEvidence(unittest.TestCase):
    def test_preview_mapping_without_file(self):
        ctx = DebugPipelineContext(
            session_id="s1",
            source_task_id="",
            output_dir=tempfile.mkdtemp(),
            raw_mesh_path="/tmp/raw.obj",
            inlay_mesh_path="/tmp/inlay.glb",
            cleaned_ai_path="/tmp/cleaned.obj",
        )
        path = _preview_path_from_ctx(ctx, "ai_cad_reverse")
        self.assertEqual(path, "/tmp/cleaned.obj")

    def test_has_evidence_with_report(self):
        tmp = tempfile.mkdtemp()
        report = os.path.join(tmp, "cad_fit_report.json")
        with open(report, "w", encoding="utf-8") as f:
            f.write("{}")
        ctx = DebugPipelineContext(
            session_id="s1",
            source_task_id="",
            output_dir=tmp,
            raw_mesh_path="/tmp/raw.obj",
            inlay_mesh_path="/tmp/inlay.glb",
        )
        self.assertTrue(_step_has_evidence(ctx, "ai_cad_reverse"))


if __name__ == "__main__":
    unittest.main()
