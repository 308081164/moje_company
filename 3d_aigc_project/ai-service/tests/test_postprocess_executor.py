"""后处理线程池测试。"""

import os
import sys
import threading
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.postprocess_executor import (
    configure_postprocess_workers,
    get_postprocess_stats,
    submit_postprocess,
)


class TestPostprocessExecutor(unittest.TestCase):
    def test_submit_runs_fn(self):
        configure_postprocess_workers(2)
        seen = []

        def job():
            seen.append(threading.current_thread().name)
            return 42

        fut = submit_postprocess(job)
        self.assertEqual(fut.result(timeout=10), 42)
        self.assertTrue(seen)

    def test_stats_shape(self):
        stats = get_postprocess_stats()
        self.assertIn("max_workers", stats)
        self.assertIn("active_jobs", stats)
        self.assertIn("queued_jobs", stats)


if __name__ == "__main__":
    unittest.main()
