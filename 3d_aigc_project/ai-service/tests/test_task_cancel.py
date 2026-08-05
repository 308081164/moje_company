"""Cancel in-flight generation tasks."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.schemas import TaskStatus
from app.services.generator import GeneratorService


class TestTaskCancel(unittest.TestCase):
    def setUp(self):
        self.service = GeneratorService()
        self.service.initialize()

    def test_request_cancel_active_task(self):
        task = self.service.create_task("image_to_3d", {"image_path": "/tmp/x.png"})
        result = self.service.request_cancel(task.task_id)
        self.assertTrue(result.get("cancelled"))
        updated = self.service.get_task(task.task_id)
        self.assertEqual(updated.status, TaskStatus.CANCELLED)

    def test_request_cancel_unknown_task(self):
        result = self.service.request_cancel("missing-task-id")
        self.assertFalse(result.get("cancelled"))
        self.assertEqual(result.get("reason"), "not_found")

    def test_request_cancel_idempotent(self):
        task = self.service.create_task("image_to_3d", {"image_path": "/tmp/y.png"})
        self.service.request_cancel(task.task_id)
        again = self.service.request_cancel(task.task_id)
        self.assertEqual(again.get("reason"), "already_terminal")


if __name__ == "__main__":
    unittest.main()
