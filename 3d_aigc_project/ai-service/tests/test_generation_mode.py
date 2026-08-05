"""Generation mode resolution tests (fast / quality / custom / ultra)."""

import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import (
    resolve_generation_mode,
    resolve_mc_algo,
    UltraModeDisabledError,
    ULTRA_MODE_DISABLED_MESSAGE,
)


class TestGenerationMode(unittest.TestCase):
    def test_fast_aliases(self):
        for raw in ("fast", "speed", "急速", "快速"):
            settings = resolve_generation_mode(raw)
            self.assertFalse(settings.apply_cad_reverse)
            self.assertEqual(settings.config.octree_resolution, 256)

    def test_quality_unlimited_faces(self):
        settings = resolve_generation_mode("quality")
        self.assertFalse(settings.apply_cad_reverse)
        self.assertEqual(settings.config.jewelry_target_faces, 0)
        self.assertGreaterEqual(settings.config.octree_resolution, 512)
        self.assertGreaterEqual(settings.config.num_inference_steps, 65)

    def test_custom_target_faces(self):
        settings = resolve_generation_mode(
            "custom", params={"custom_target_faces": 80000}
        )
        self.assertEqual(settings.config.jewelry_target_faces, 80000)
        self.assertFalse(settings.apply_cad_reverse)

    def test_custom_overrides_octree_steps(self):
        settings = resolve_generation_mode(
            "custom",
            params={
                "custom_target_faces": 0,
                "custom_octree_resolution": 384,
                "custom_inference_steps": 50,
            },
        )
        self.assertEqual(settings.config.jewelry_target_faces, 0)
        self.assertEqual(settings.config.octree_resolution, 384)
        self.assertEqual(settings.config.num_inference_steps, 50)

    @patch.dict(os.environ, {"ULTRA_MODE_ENABLED": "1"})
    def test_ultra_enables_cad_reverse_when_enabled(self):
        settings = resolve_generation_mode("ultra")
        self.assertTrue(settings.apply_cad_reverse)
        self.assertIsNotNone(settings.ultra_cad)
        self.assertEqual(settings.config.octree_resolution, 512)
        self.assertEqual(settings.config.jewelry_coarse_faces, 0)

    @patch.dict(os.environ, {"ULTRA_MODE_ENABLED": "0"})
    def test_ultra_disabled_raises(self):
        with self.assertRaises(UltraModeDisabledError) as ctx:
            resolve_generation_mode("ultra")
        self.assertEqual(str(ctx.exception), ULTRA_MODE_DISABLED_MESSAGE)

    @patch.dict(os.environ, {"ULTRA_MODE_ENABLED": "1"})
    def test_ultra_aliases(self):
        for raw in ("cad", "step", "ultra_cad", "超高精度"):
            settings = resolve_generation_mode(raw)
            self.assertTrue(settings.apply_cad_reverse)

    @patch("app.config.dmc_surface_extractor_available", return_value=False)
    def test_resolve_mc_algo_dmc_without_diso(self, _mock_dmc):
        self.assertIsNone(resolve_mc_algo("dmc"))

    def test_resolve_mc_algo_mc_is_default(self):
        self.assertIsNone(resolve_mc_algo("mc"))
        self.assertIsNone(resolve_mc_algo(None))

    def test_resolve_mc_algo_dmc_when_diso_available(self):
        from app.config import dmc_surface_extractor_available

        if not dmc_surface_extractor_available():
            self.skipTest("diso not installed in this environment")
        self.assertEqual(resolve_mc_algo("dmc"), "dmc")


if __name__ == "__main__":
    unittest.main()
