"""Tests for quality-mode jewelry mesh refine (decimate + loop + taubin)."""

import unittest

import trimesh

from app.config import GenerationConfig
from app.services.mesh_processor import MeshProcessor


class TestJewelryDecimate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.processor = MeshProcessor()

    def test_refine_reduces_and_refinishes_high_face_mesh(self):
        if not self.processor._open3d_available:
            self.skipTest("Open3D not available")

        dense = trimesh.creation.icosphere(subdivisions=6)
        self.assertGreater(len(dense.faces), 30_000)

        cfg = GenerationConfig(
            jewelry_coarse_faces=12_000,
            jewelry_subdivide_loop_iterations=1,
            jewelry_target_faces=48_000,
            jewelry_decimate_min_input_faces=30_000,
            jewelry_post_decimate_taubin_iterations=4,
            jewelry_taubin_iterations=0,
        )
        out = self.processor._decimate_jewelry_mesh(dense, cfg)
        self.assertLess(len(out.faces), len(dense.faces))
        self.assertGreater(len(out.faces), 20_000)
        self.assertLessEqual(len(out.faces), 55_000)

    def test_refine_skipped_for_fast_mode(self):
        dense = trimesh.creation.icosphere(subdivisions=4)
        cfg = GenerationConfig(jewelry_coarse_faces=0)
        out = self.processor._decimate_jewelry_mesh(dense, cfg)
        self.assertEqual(len(out.faces), len(dense.faces))


if __name__ == "__main__":
    unittest.main()
