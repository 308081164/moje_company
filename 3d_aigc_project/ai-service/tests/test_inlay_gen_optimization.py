"""
Tests for inlay-aware generation pipeline optimizations.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import numpy as np
    import trimesh
except ImportError:
    np = None
    trimesh = None

from app.services.inlay_gen_strategy import (
    InlayGenStrategy,
    resolve_inlay_gen_strategy,
    strategy_runs_post_mv_omni,
)
from app.services.multi_view import canonicalize_views_for_hy3d
from app.services.pointcloud_conditioner import (
    apply_inverse_transform_to_mesh,
    build_omni_condition_points,
)


@unittest.skipIf(np is None, "numpy not installed")
class TestInlayGenStrategy(unittest.TestCase):
    def test_mv_inlay_default_omni_refine(self):
        s = resolve_inlay_gen_strategy(
            {},
            use_multi_view=True,
            has_inlay=True,
            omni_enabled=True,
        )
        self.assertEqual(s, InlayGenStrategy.MV_THEN_OMNI_REFINE)
        self.assertTrue(strategy_runs_post_mv_omni(s))

    def test_explicit_mv_only(self):
        s = resolve_inlay_gen_strategy(
            {"inlay_gen_strategy": "mv_only"},
            use_multi_view=True,
            has_inlay=True,
            omni_enabled=True,
        )
        self.assertEqual(s, InlayGenStrategy.MV_ONLY)


class TestMultiViewCanonical(unittest.TestCase):
    def test_canonical_order(self):
        views = {
            "right": "/a.png",
            "front": "/b.png",
            "left": "/c.png",
        }
        canon = canonicalize_views_for_hy3d(views)
        self.assertEqual(list(canon.keys()), ["front", "left", "right"])


@unittest.skipIf(np is None or trimesh is None, "numpy/trimesh not installed")
class TestPointCloudOmniHelpers(unittest.TestCase):
    def test_inverse_transform_restores_extent(self):
        box = trimesh.creation.box(extents=[2.0, 4.0, 6.0])
        inv = {"center": [1.0, 2.0, 3.0], "scale": 10.0, "omni_scale": 0.98}
        restored = apply_inverse_transform_to_mesh(box, inv)
        ext = restored.bounds[1] - restored.bounds[0]
        self.assertTrue(float(ext.max()) > 5.0)

    def test_contact_weighted_selection(self):
        norm = np.random.randn(512, 3).astype(np.float32)
        markers = np.zeros((512, 1), dtype=np.float32)
        markers[:120] = 1.0
        pts, info = build_omni_condition_points(
            {"normalized_points": norm, "contact_markers": markers},
            num_points=256,
        )
        self.assertEqual(len(pts), 256)
        self.assertEqual(info.get("mode"), "contact_weighted")


if __name__ == "__main__":
    unittest.main()
