"""Tests for multi-view CAD sheet splitting."""

import unittest

import cv2
import numpy as np
from PIL import Image

from app.services.preprocess.split_multi_view import split_multi_view_sheet


def _draw_ring_view(canvas: np.ndarray, cx: int, cy: int, radius: int) -> None:
    cv2.circle(canvas, (cx, cy), radius, (220, 190, 80), 2, cv2.LINE_AA)
    cv2.circle(canvas, (cx, cy), max(4, radius // 3), (220, 190, 80), 2, cv2.LINE_AA)


def _make_grid_sheet(
    cols: int = 2,
    rows: int = 2,
    width: int = 1200,
    height: int = 900,
    dark_bg: bool = True,
    connect_views: bool = False,
) -> Image.Image:
    bg = 24 if dark_bg else 245
    rgb = np.full((height, width, 3), bg, dtype=np.uint8)
    cell_w = width // cols
    cell_h = height // rows
    for r in range(rows):
        for c in range(cols):
            cx = c * cell_w + cell_w // 2
            cy = r * cell_h + cell_h // 2
            radius = min(cell_w, cell_h) // 5
            _draw_ring_view(rgb, cx, cy, radius)
    if connect_views:
        cv2.line(rgb, (0, height // 2), (width, height // 2), (220, 190, 80), 1, cv2.LINE_AA)
        cv2.line(rgb, (width // 2, 0), (width // 2, height), (220, 190, 80), 1, cv2.LINE_AA)
    return Image.fromarray(rgb, mode="RGB")


class TestSplitMultiView(unittest.TestCase):
    def test_split_dark_background_2x2(self):
        img = _make_grid_sheet(dark_bg=True, connect_views=False)
        crops, images = split_multi_view_sheet(img)
        self.assertGreaterEqual(len(crops), 2)
        self.assertEqual(len(crops), len(images))

    def test_split_connected_views_projection_fallback(self):
        img = _make_grid_sheet(dark_bg=True, connect_views=True)
        crops, images = split_multi_view_sheet(img)
        self.assertGreaterEqual(len(crops), 2)
        self.assertEqual(len(crops), len(images))

    def test_split_light_background_2x2(self):
        img = _make_grid_sheet(dark_bg=False, connect_views=False)
        crops, images = split_multi_view_sheet(img)
        self.assertGreaterEqual(len(crops), 2)

    def test_split_rgba_transparent(self):
        base = _make_grid_sheet(dark_bg=True)
        rgba = base.convert("RGBA")
        arr = np.array(rgba)
        arr[:, :, 3] = 255
        arr[0:20, :, 3] = 0
        img = Image.fromarray(arr, mode="RGBA")
        crops, _ = split_multi_view_sheet(img)
        self.assertGreaterEqual(len(crops), 2)


if __name__ == "__main__":
    unittest.main()
