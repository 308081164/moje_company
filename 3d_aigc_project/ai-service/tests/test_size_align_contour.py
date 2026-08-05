"""
Contour size alignment tests (synthetic torus).
Uses inlay-in-AI overlap (not overlap-pick / refine).
"""

import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import trimesh
except ImportError:
    trimesh = None

from app.services.mesh_processor import MeshProcessor
from app.services.debug_pipeline_steps import DEBUG_STEP_IDS
from tests.test_casa_alignment import _build_ai_source, _build_inlay_target


def _overlap_pick_forbidden(*args, **kwargs):
    raise AssertionError("_pick_casa_scale_by_overlap must not drive size align")


@unittest.skipIf(trimesh is None, "trimesh not installed")
class TestContourSizeAlignment(unittest.TestCase):
    def setUp(self):
        self.processor = MeshProcessor()
        self._tmpdir = tempfile.mkdtemp(prefix="size_align_")

    def tearDown(self):
        import shutil

        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def _run_size_align(self, ai_scale: float, roll_deg: float = 0.0):
        inlay = _build_inlay_target(major_r=11.0)
        ai = _build_ai_source(major_r=11.0, scale=ai_scale, roll_deg=roll_deg)
        inlay_path = os.path.join(self._tmpdir, f"inlay_{ai_scale}.glb")
        ai_path = os.path.join(self._tmpdir, f"ai_{ai_scale}.obj")
        clean_path = os.path.join(self._tmpdir, f"clean_{ai_scale}.glb")
        inlay.export(inlay_path)
        ai.export(ai_path)
        cleaned, _ = self.processor.sanitize_mesh(inlay_path, clean_path, select_primary=True)
        with patch.object(
            self.processor,
            "_pick_casa_scale_by_overlap",
            side_effect=_overlap_pick_forbidden,
        ):
            M, info = self.processor.compute_size_alignment_transform(
                ai_path,
                inlay_path,
                cleaned_base_path=cleaned,
            )
        return M, info

    def _assert_size_metrics(self, info: dict):
        diam = float(info.get("diam_ratio") or 0)
        self.assertGreaterEqual(diam, 0.85, msg=f"diam_ratio={diam}")
        self.assertLessEqual(diam, 1.15, msg=f"diam_ratio={diam}")
        vol_ratio = float(info.get("volume_ratio") or 0)
        self.assertGreaterEqual(vol_ratio, 1.0, msg=f"volume_ratio={vol_ratio}")
        ai_contain = float(info.get("ai_containment_ratio") or 0)
        self.assertLess(ai_contain, 0.92, msg=f"ai_containment={ai_contain}")

    def test_extreme_scale_0_2x(self):
        _, info = self._run_size_align(0.2)
        self._assert_size_metrics(info)

    def test_extreme_scale_5x(self):
        _, info = self._run_size_align(5.0)
        self._assert_size_metrics(info)

    def test_inverted_roll_still_aligns(self):
        _, info = self._run_size_align(0.55, roll_deg=180.0)
        pose = info.get("pose") or {}
        self.assertGreater(float(pose.get("up_cos") or 0), 0.9)
        self._assert_size_metrics(info)

    def test_apply_size_alignment_writes_mesh(self):
        inlay = _build_inlay_target(major_r=11.0)
        ai = _build_ai_source(major_r=11.0, scale=0.35)
        inlay_path = os.path.join(self._tmpdir, "inlay_apply.glb")
        ai_path = os.path.join(self._tmpdir, "ai_apply.obj")
        clean_path = os.path.join(self._tmpdir, "clean_apply.glb")
        inlay.export(inlay_path)
        ai.export(ai_path)
        cleaned, _ = self.processor.sanitize_mesh(inlay_path, clean_path, select_primary=True)
        out_path, info, M = self.processor.apply_size_alignment(
            ai_path,
            inlay_path,
            cleaned,
            self._tmpdir,
            "size-task",
            output_format="glb",
        )
        self.assertTrue(os.path.isfile(out_path))
        self.assertEqual(M.shape, (4, 4))
        self.assertIsNotNone(info.get("scale_final"))

    def test_debug_pipeline_has_twelve_steps(self):
        self.assertEqual(len(DEBUG_STEP_IDS), 12)
        self.assertIn("ai_part_split", DEBUG_STEP_IDS)
        self.assertIn("ai_inlay_detect", DEBUG_STEP_IDS)
        self.assertEqual(DEBUG_STEP_IDS[2], "ai_sanitize")
        self.assertEqual(DEBUG_STEP_IDS[3], "ai_part_split")
        self.assertEqual(DEBUG_STEP_IDS[4], "ai_inlay_detect")
        self.assertEqual(DEBUG_STEP_IDS[5], "size_align")


if __name__ == "__main__":
    unittest.main()
