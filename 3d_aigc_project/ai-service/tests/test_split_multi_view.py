"""Tests for multi-view CAD sheet splitting (OpenCV connected components)."""

import unittest

import cv2
import numpy as np
from PIL import Image

from app.services.preprocess.split_multi_view import split_multi_view_sheet


def _draw_filled_view(canvas: np.ndarray, cx: int, cy: int, radius: int) -> None:
    """实心视图块，与旧版连通域切分算法匹配。"""
    cv2.circle(canvas, (cx, cy), radius, (220, 190, 80), -1, cv2.LINE_AA)
    cv2.circle(canvas, (cx, cy), max(6, radius // 3), (180, 150, 60), -1, cv2.LINE_AA)


def _make_grid_sheet(
    cols: int = 2,
    rows: int = 2,
    width: int = 1200,
    height: int = 900,
    dark_bg: bool = True,
) -> Image.Image:
    bg = 24 if dark_bg else 245
    rgb = np.full((height, width, 3), bg, dtype=np.uint8)
    cell_w = width // cols
    cell_h = height // rows
    for r in range(rows):
        for c in range(cols):
            cx = c * cell_w + cell_w // 2
            cy = r * cell_h + cell_h // 2
            radius = min(cell_w, cell_h) // 4
            _draw_filled_view(rgb, cx, cy, radius)
    return Image.fromarray(rgb, mode="RGB")


class TestSplitMultiView(unittest.TestCase):
    def test_split_dark_background_2x2(self):
        img = _make_grid_sheet(dark_bg=True)
        crops, images = split_multi_view_sheet(img)
        self.assertGreaterEqual(len(crops), 2)
        self.assertEqual(len(crops), len(images))

    def test_split_light_background_2x2(self):
        img = _make_grid_sheet(dark_bg=False)
        crops, images = split_multi_view_sheet(img)
        self.assertGreaterEqual(len(crops), 2)


if __name__ == "__main__":
    unittest.main()
