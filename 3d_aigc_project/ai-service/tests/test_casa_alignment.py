"""
CASA 对齐算法单元测试（合成戒圈 mesh，极端尺度 0.2x / 5x）。
"""

import os
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import trimesh
except ImportError:
    trimesh = None

from app.config import AlignmentConfig
from app.services.mesh_processor import MeshProcessor


def _make_torus_ring(major_r: float = 10.0, minor_r: float = 1.2, sections: int = 48):
    """合成戒圈 mesh（trimesh torus）。"""
    mesh = trimesh.creation.torus(
        major_radius=major_r,
        minor_radius=minor_r,
        major_sections=sections,
        minor_sections=24,
    )
    return mesh


def _make_setting_blob(center, size: float = 2.5):
    """镶口小块（立方体）。"""
    box = trimesh.creation.box(extents=[size, size, size * 1.4])
    box.apply_translation(center)
    return box


def _build_inlay_target(major_r: float = 10.0, setting_size: float = 2.0):
    shank = _make_torus_ring(major_r=major_r, minor_r=1.0)
    tip = np.array([0.0, major_r + 2.0, 0.0])
    setting = _make_setting_blob(tip, size=setting_size)
    return trimesh.util.concatenate([shank, setting])


def _build_prong_only_inlay(major_r: float = 10.0):
    """小 shank + 大 setting，模拟 prong-only 测量场景。"""
    shank = _make_torus_ring(major_r=major_r, minor_r=0.55, sections=36)
    tip = np.array([0.0, major_r + 2.5, 0.0])
    setting = _make_setting_blob(tip, size=5.5)
    return trimesh.util.concatenate([shank, setting])


def _build_ai_source(major_r: float = 10.0, scale: float = 1.0, roll_deg: float = 0.0):
    shank = _make_torus_ring(major_r=major_r * scale, minor_r=1.1 * scale)
    tip = np.array([0.0, major_r * scale + 2.2 * scale, 0.0])
    setting = _make_setting_blob(tip, size=2.2 * scale)
    mesh = trimesh.util.concatenate([shank, setting])
    if abs(roll_deg) > 1e-6:
        T = trimesh.transformations.rotation_matrix(
            np.radians(roll_deg), [0.0, 0.0, 1.0], point=[0.0, 0.0, 0.0]
        )
        mesh.apply_transform(T)
    return mesh


@unittest.skipIf(trimesh is None, "trimesh not installed")
class TestCasaAlignmentHelpers(unittest.TestCase):
    def setUp(self):
        self.processor = MeshProcessor()

    def test_angular_profile_cross_correlation_peak(self):
        bins = 36
        inner = {
            "inner_r": np.linspace(8.0, 9.0, bins),
            "valid": np.ones(bins, dtype=bool),
            "bins": bins,
        }
        outer = {
            "outer_r": np.roll(np.linspace(0.8, 0.9, bins), 5),
            "valid": np.ones(bins, dtype=bool),
            "bins": bins,
        }
        roll_deg, peak_ratio, corr = self.processor._angular_profile_cross_correlation(
            inner, outer
        )
        self.assertGreater(peak_ratio, 0.0)
        self.assertAlmostEqual(roll_deg, 50.0, delta=15.0)
        self.assertGreater(float(np.max(corr)), 0.0)

    def test_envelope_scale_uses_posed_diameter_after_normalization(self):
        """When M_pose includes unit-ring T_norm, fallback scale must use posed diameter."""
        inlay = _build_inlay_target(major_r=12.0)
        ai = _build_ai_source(major_r=12.0, scale=0.2, roll_deg=15.0)
        shank, setting = self.processor._split_shank_and_setting(inlay)
        fi0 = self.processor._estimate_ring_frame(shank)
        up = self.processor._geometric_setting_up(fi0, setting)
        fi = self.processor._frame_with_up(fi0, up)
        fa0 = self.processor._estimate_ring_frame(ai)
        M_pose, p1 = self.processor._compute_contour_anchored_pose(
            ai, shank, setting, fa0, fi0
        )
        self.assertIsNotNone(M_pose, msg=f"pose failed: {p1}")
        self.assertGreater(float(p1.get("norm_inv_scale", 0.0)), 0.0)
        s, p2 = self.processor._compute_casa_envelope_scale(
            ai, shank, fi, M_pose, clearance_mm=0.05
        )
        tgt_d = float(fi["diameter"])
        self.assertGreater(s, tgt_d * 0.35)
        self.assertLess(s, tgt_d * 2.5)
        if p2.get("fallback") == "diameter_ratio":
            self.assertEqual(p2.get("scale_source"), "posed_diameter_ratio")
            self.assertLess(float(p2.get("src_diameter_posed", 999)), tgt_d * 0.35)

    def test_envelope_scale_recovers_extreme_ratios(self):
        inlay = _build_inlay_target(major_r=12.0)
        for scale_factor in (0.2, 5.0):
            ai = _build_ai_source(major_r=12.0, scale=scale_factor, roll_deg=15.0)
            shank, setting = self.processor._split_shank_and_setting(inlay)
            fi0 = self.processor._estimate_ring_frame(shank)
            up = self.processor._geometric_setting_up(fi0, setting)
            fi = self.processor._frame_with_up(fi0, up)
            fa0 = self.processor._estimate_ring_frame(ai)
            M_pose, p1 = self.processor._compute_contour_anchored_pose(
                ai, shank, setting, fa0, fi0
            )
            self.assertIsNotNone(M_pose, msg=f"pose failed at scale={scale_factor}: {p1}")
            s, p2 = self.processor._compute_casa_envelope_scale(
                ai, shank, fi, M_pose, clearance_mm=0.05
            )
            tgt_d = float(fi["diameter"])
            self.assertGreater(s, tgt_d * 0.35)
            self.assertLess(s, tgt_d * 2.5)
            if int(p2.get("n_valid_sectors", 0)) >= 6:
                self.assertIn("s_uniform", p2)
            else:
                self.assertEqual(p2.get("fallback"), "diameter_ratio")

    def test_inlay_overlap_ratio_detects_misalignment(self):
        inlay = _build_inlay_target(major_r=11.0)
        ai = _build_ai_source(major_r=11.0, scale=1.0)
        shank, setting = self.processor._split_shank_and_setting(inlay)
        fi0 = self.processor._estimate_ring_frame(shank)
        up = self.processor._geometric_setting_up(fi0, setting)
        fi = self.processor._frame_with_up(fi0, up)
        ratio_ok, info_ok = self.processor._compute_inlay_ai_overlap_ratio(
            inlay,
            ai,
            shank_mesh=shank,
            setting_mesh=setting,
            frame=fi,
            full_ring=False,
        )
        ai_bad = ai.copy()
        ai_bad.apply_translation([80.0, 0.0, 0.0])
        ratio_bad, info_bad = self.processor._compute_inlay_ai_overlap_ratio(
            inlay,
            ai_bad,
            shank_mesh=shank,
            setting_mesh=setting,
            frame=fi,
            full_ring=False,
        )
        self.assertGreater(ratio_ok, ratio_bad)
        self.assertLess(ratio_bad, 0.5)
        self.assertEqual(info_ok.get("region"), "shank_inner_wall")

    def test_prong_refine_reaches_80_percent_overlap(self):
        inlay = _build_prong_only_inlay(major_r=11.0)
        ai = inlay.copy()
        ai.apply_translation([0.15, -0.12, 0.08])
        ai.apply_transform(
            trimesh.transformations.rotation_matrix(
                np.radians(3.5), [0.0, 0.0, 1.0], point=[0.0, 0.0, 0.0]
            )
        )
        shank, setting = self.processor._split_shank_and_setting(inlay)
        fi0 = self.processor._estimate_ring_frame(shank)
        up = self.processor._geometric_setting_up(fi0, setting)
        fi = self.processor._frame_with_up(fi0, up)
        ring_M, ring_info = self.processor._compute_ring_alignment_transform(ai, inlay)
        self.assertIsNotNone(ring_M, msg=f"ring-frame init failed: {ring_info}")
        refined_M, info = self.processor._refine_alignment_inlay_overlap(
            ai,
            inlay,
            shank,
            setting,
            fi,
            ring_M,
            full_ring=False,
            target_ratio=0.80,
        )
        self.assertGreaterEqual(float(info.get("overlap_after", 0.0)), 0.80)
        self.assertIsNotNone(refined_M)

    def test_rescue_fixes_inverted_head_overlap(self):
        inlay = _build_inlay_target(major_r=11.0)
        ai = _build_ai_source(major_r=11.0, scale=0.45, roll_deg=35.0)
        shank, setting = self.processor._split_shank_and_setting(inlay)
        fi0 = self.processor._estimate_ring_frame(shank)
        up = self.processor._geometric_setting_up(fi0, setting)
        fi = self.processor._frame_with_up(fi0, up)
        ring_M, _ = self.processor._compute_ring_alignment_transform(ai, inlay)
        self.assertIsNotNone(ring_M)
        flip = self.processor._rotation_about_axis_matrix(
            np.asarray(fi["axis"], dtype=np.float64),
            np.asarray(fi["center"], dtype=np.float64),
            np.pi,
        )
        bad_M = flip @ ring_M
        before = self.processor._eval_alignment_pose_metrics(
            ai, inlay, shank, setting, fi, bad_M
        )
        self.assertLess(float(before.get("up_cos", 1.0)), 0.0)
        rescued_M, rescue_info = self.processor._rescue_poor_alignment_pose(
            ai,
            inlay,
            shank,
            setting,
            fi,
            bad_M,
            full_ring=False,
        )
        after = rescue_info.get("after") or {}
        self.assertTrue(rescue_info.get("rescued"))
        self.assertGreaterEqual(float(after.get("up_cos", -1.0)), 0.25)
        self.assertGreaterEqual(float(after.get("overlap", 0.0)), 0.80)
        self.assertIsNotNone(rescued_M)

    def test_pick_casa_scale_by_overlap_smoke(self):
        inlay = _build_inlay_target(major_r=11.0)
        ai = _build_ai_source(major_r=11.0, scale=1.0, roll_deg=10.0)
        shank, setting = self.processor._split_shank_and_setting(inlay)
        fi0 = self.processor._estimate_ring_frame(shank)
        up = self.processor._geometric_setting_up(fi0, setting)
        fi = self.processor._frame_with_up(fi0, up)
        fa0 = self.processor._estimate_ring_frame(ai)
        M_pose, _ = self.processor._compute_contour_anchored_pose(
            ai, shank, setting, fa0, fi0
        )
        self.assertIsNotNone(M_pose)
        s_env, _ = self.processor._compute_casa_envelope_scale(
            ai, shank, fi, M_pose, clearance_mm=0.05
        )
        s_pick, pick_info = self.processor._pick_casa_scale_by_overlap(
            ai,
            inlay,
            shank,
            setting,
            fi,
            M_pose,
            [s_env * 0.55, s_env, s_env * 1.8],
            full_ring=False,
        )
        self.assertEqual(len(pick_info.get("candidates", [])), 3)
        self.assertGreater(float(s_pick), 0.0)
        self.assertEqual(pick_info.get("scale_source"), "overlap_pick")


@unittest.skipIf(trimesh is None, "trimesh not installed")
class TestCasaAlignmentIntegration(unittest.TestCase):
    def setUp(self):
        self.processor = MeshProcessor()
        self._tmpdir = tempfile.mkdtemp(prefix="casa_test_")
        self._align_cfg = AlignmentConfig(
            alignment_mode="casa",
            casa_soft_accept=False,
            casa_min_peak_ratio=0.08,
            casa_min_pose_confidence=0.08,
            casa_min_inlay_overlap_ratio=0.80,
        )
        self.processor._get_alignment_config = lambda: self._align_cfg

    def tearDown(self):
        import shutil

        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def _run_align(self, ai_scale: float, roll_deg: float = 20.0):
        inlay = _build_inlay_target(major_r=11.0)
        ai = _build_ai_source(major_r=11.0, scale=ai_scale, roll_deg=roll_deg)
        inlay_path = os.path.join(self._tmpdir, f"inlay_{ai_scale}.glb")
        ai_path = os.path.join(self._tmpdir, f"ai_{ai_scale}.glb")
        out_path = os.path.join(self._tmpdir, f"aligned_{ai_scale}.glb")
        inlay.export(inlay_path)
        ai.export(ai_path)
        path, transform, info = self.processor.align_generated_to_base(
            ai_path,
            inlay_path,
            out_path,
            enable_icp=False,
        )
        self.assertTrue(os.path.isfile(path))
        return path, transform, info

    def test_casa_align_small_ai(self):
        _, _, info = self._run_align(ai_scale=0.25, roll_deg=30.0)
        self.assertIn(
            info.get("method"),
            ("casa", "casa_pca_fallback", "ring_frame_fallback"),
        )
        fq = info.get("final_quality") or {}
        overlap = float(info.get("inlay_overlap_ratio", 0.0))
        if info.get("method") == "casa":
            self.assertLess(float(fq.get("diam_ratio", 999)), 1.6)
            self.assertGreaterEqual(overlap, 0.80)

    def test_casa_align_large_ai(self):
        _, _, info = self._run_align(ai_scale=4.0, roll_deg=-25.0)
        self.assertIn(
            info.get("method"),
            ("casa", "casa_pca_fallback", "ring_frame_fallback"),
        )
        casa = info.get("casa") or {}
        overlap = float(info.get("inlay_overlap_ratio", 0.0))
        if casa.get("ok"):
            ang = (casa.get("angular_gap") or {}).get("max_protrusion_mm", 0.0)
            self.assertLess(float(ang), 2.0)
            self.assertGreaterEqual(overlap, 0.80)

    def test_overlap_gate_reports_ratio_after_successful_align(self):
        _, _, info = self._run_align(ai_scale=1.0, roll_deg=0.0)
        overlap = float(info.get("inlay_overlap_ratio", 0.0))
        self.assertGreaterEqual(overlap, 0.80)
        self.assertIn(info.get("inlay_overlap_final", {}).get("region"), (
            "shank_inner_wall",
            "shank",
        ))

    def test_overlap_gate_failed_does_not_raise(self):
        """Soft gate: 未达 80% 仍返回对齐结果并标记 overlap_gate_failed。"""
        inlay = _build_inlay_target(major_r=11.0)
        ai = _build_ai_source(major_r=11.0, scale=0.12, roll_deg=40.0)
        inlay_path = os.path.join(self._tmpdir, "inlay_gate.glb")
        ai_path = os.path.join(self._tmpdir, "ai_gate.glb")
        out_path = os.path.join(self._tmpdir, "aligned_gate.glb")
        inlay.export(inlay_path)
        ai.export(ai_path)
        path, _, info = self.processor.align_generated_to_base(
            ai_path,
            inlay_path,
            out_path,
            enable_icp=False,
        )
        self.assertTrue(os.path.isfile(path))
        overlap = float(info.get("inlay_overlap_ratio", 1.0))
        if overlap < 0.80:
            self.assertTrue(info.get("overlap_gate_failed"))
        else:
            self.assertFalse(info.get("overlap_gate_failed"))

    def test_ring_frame_fallback_applies_overlap_refine(self):
        strict = AlignmentConfig(
            alignment_mode="casa",
            casa_soft_accept=False,
            casa_min_peak_ratio=0.99,
            casa_min_pose_confidence=0.99,
            casa_min_inlay_overlap_ratio=0.80,
        )
        self.processor._get_alignment_config = lambda: strict
        _, _, info = self._run_align(ai_scale=0.35, roll_deg=12.0)
        if info.get("method") == "ring_frame_fallback":
            refine = info.get("overlap_refine_ring_frame") or {}
            self.assertIn("overlap_after", refine)


if __name__ == "__main__":
    unittest.main()
