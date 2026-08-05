"""CLI views manifest 解析测试。"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cli.views_manifest import (
    VIEW_KEYS,
    collect_views,
    iter_jsonl_manifest,
    normalize_job_views,
    parse_view_arg,
)


class TestViewsManifest(unittest.TestCase):
    def test_parse_view_arg(self):
        key, path = parse_view_arg("front=./a.png")
        self.assertEqual(key, "front")
        self.assertIn("a.png", path)

    def test_invalid_view_key(self):
        with self.assertRaises(ValueError):
            parse_view_arg("diagonal=x.png")

    def test_collect_views(self):
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(b"x")
            p = f.name
        try:
            views = collect_views([f"front={p}", f"back={p}"])
            self.assertEqual(set(views.keys()), {"front", "back"})
        finally:
            os.unlink(p)

    def test_jsonl_manifest(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False, encoding="utf-8") as f:
            f.write('{"sample_id":"s1","views":{"front":"a.png","back":"b.png"}}\n')
            path = f.name
        try:
            rows = list(iter_jsonl_manifest(path))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["sample_id"], "s1")
        finally:
            os.unlink(path)

    def test_view_keys_complete(self):
        self.assertEqual(len(VIEW_KEYS), 6)


if __name__ == "__main__":
    unittest.main()
