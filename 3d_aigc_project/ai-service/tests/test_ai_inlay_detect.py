"""Tests for AI inlay analogue detection (NRICP + part split)."""

import os
import tempfile
import unittest

import numpy as np
import trimesh

from app.services.debug_pipeline_steps import (
    DebugPipelineContext,
    debug_step_ai_part_split,
)
from app.services.mesh_processor import MeshProcessor


def _make_torus_ring(
    major_r: float = 8.0,
    minor_r: float = 1.2,
    major_sections: int = 64,
    minor_sections: int = 48,
) -> trimesh.Trimesh:
    return trimesh.creation.torus(
        major_radius=major_r,
        minor_radius=minor_r,
        major_sections=major_sections,
        minor_sections=minor_sections,
    )


def _make_prong_head(
    center=(0.0, 0.0, 9.0),
    scale=(1.0, 1.0, 2.5),
) -> trimesh.Trimesh:
    box = trimesh.creation.box(extents=(2.2 * scale[0], 2.2 * scale[1], 3.0 * scale[2]))
    box.apply_translation(center)
    return box


class TestAiInlayDetect(unittest.TestCase):
    def setUp(self):
        self.processor = MeshProcessor()

    def test_detect_covers_head_and_shank_when_misaligned(self):
        """Misplaced AI ring should still get broad mask (NRICP or fallback)."""
        inlay_shank = _make_torus_ring()
        inlay_head = _make_prong_head(center=(0.0, 0.0, 9.5))
        inlay = trimesh.util.concatenate([inlay_shank, inlay_head])

        ai_shank = _make_torus_ring(major_r=8.4, minor_r=1.15)
        ai_head = _make_prong_head(center=(0.0, 0.0, 9.8), scale=(1.05, 1.05, 2.4))
        ai = trimesh.util.concatenate([ai_shank, ai_head])
        ai.apply_transform(trimesh.transformations.translation_matrix([3.5, -2.0, 1.2]))
        ai.apply_transform(trimesh.transformations.rotation_matrix(np.radians(35.0), [0, 0, 1]))

        mask, info = self.processor._detect_ai_inlay_analogue(ai, inlay)

        self.assertTrue(info.get("alignment_applied"))
        self.assertIn(
            info.get("detect_method"), ("nricp", "envelope_fallback")
        )
        self.assertGreater(float(info["detect_ratio"]), 0.04)
        self.assertGreater(int(info["n_detected"]), 80)

        ai_pts = np.asarray(ai.vertices, dtype=np.float64)
        up_hint = np.array([0.0, 0.0, 1.0])
        head_hits = float(mask[(ai_pts @ up_hint) > np.percentile(ai_pts @ up_hint, 70)].mean())
        shank_hits = float(mask[(ai_pts @ up_hint) < np.percentile(ai_pts @ up_hint, 45)].mean())
        self.assertGreater(head_hits, 0.08, "head region should be partially detected")
        self.assertGreater(shank_hits, 0.05, "shank region should be partially detected")

    def test_nricp_detect_on_aligned_ring(self):
        inlay_shank = _make_torus_ring()
        inlay_head = _make_prong_head(center=(0.0, 0.0, 9.5))
        inlay = trimesh.util.concatenate([inlay_shank, inlay_head])
        ai = trimesh.util.concatenate([_make_torus_ring(major_r=8.2), _make_prong_head()])

        mask, info = self.processor._detect_ai_inlay_analogue_nricp(ai, inlay)
        self.assertEqual(info.get("detect_method"), "nricp")
        self.assertTrue(info.get("nricp_success"))
        self.assertGreater(float(info.get("label_transfer_ratio", 0)), 0.05)
        self.assertGreater(int(mask.sum()), 50)

    def test_part_split_produces_two_regions(self):
        ai_shank = _make_torus_ring()
        ai_head = _make_prong_head(center=(0.0, 0.0, 9.5))
        ai = trimesh.util.concatenate([ai_shank, ai_head])
        shank_mask, setting_mask, info = self.processor.split_ai_ring_parts(ai)
        self.assertGreater(int(info["n_shank"]), 0)
        self.assertGreater(int(info["n_setting"]), 0)
        self.assertIn(info["method"], ("connected_components", "ring_band"))
        self.assertFalse(np.any(shank_mask & setting_mask))

    def test_part_split_skipped_when_disabled(self):
        processor = self.processor
        tmp = tempfile.mkdtemp(prefix="part_split_skip_")
        try:
            ai = trimesh.util.concatenate([_make_torus_ring(), _make_prong_head()])
            ai_path = os.path.join(tmp, "ai.glb")
            ai.export(ai_path)
            ctx = DebugPipelineContext(
                session_id="s1",
                source_task_id="t1",
                output_dir=tmp,
                raw_mesh_path=ai_path,
                inlay_mesh_path=ai_path,
                cleaned_ai_path=ai_path,
                enable_ai_part_split=False,
            )
            result = debug_step_ai_part_split(processor, ctx)
            self.assertTrue(result["success"])
            self.assertTrue(result["metrics"].get("skipped"))
        finally:
            import shutil

            shutil.rmtree(tmp, ignore_errors=True)

    def test_smooth_mask_expands_face_neighbors(self):
        mesh = trimesh.creation.icosphere(subdivisions=2, radius=1.0)
        mask = np.zeros(len(mesh.vertices), dtype=bool)
        mask[0] = True
        expanded = self.processor._smooth_vertex_mask_on_mesh(
            mesh, mask, face_min_hits=1, dilate_rings=1
        )
        self.assertGreater(int(expanded.sum()), 1)


if __name__ == "__main__":
    unittest.main()
