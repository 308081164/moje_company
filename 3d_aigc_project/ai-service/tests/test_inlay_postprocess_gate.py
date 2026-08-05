"""镶嵌后处理门控测试（enable_inlay_postprocess 默认关 + 旧字段兼容）."""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import resolve_enable_inlay_postprocess


class TestInlayPostprocessGate(unittest.TestCase):
    def test_default_off(self):
        self.assertFalse(resolve_enable_inlay_postprocess({}))

    def test_explicit_false(self):
        self.assertFalse(
            resolve_enable_inlay_postprocess({"enable_inlay_postprocess": False})
        )

    def test_explicit_true(self):
        self.assertTrue(
            resolve_enable_inlay_postprocess({"enable_inlay_postprocess": True})
        )

    def test_legacy_enable_mesh_fusion_true(self):
        with patch("app.config.logger") as mock_logger:
            result = resolve_enable_inlay_postprocess({"enable_mesh_fusion": True})
            self.assertTrue(result)
            mock_logger.warning.assert_called_once()

    def test_new_field_overrides_legacy(self):
        with patch("app.config.logger") as mock_logger:
            result = resolve_enable_inlay_postprocess(
                {
                    "enable_inlay_postprocess": False,
                    "enable_mesh_fusion": True,
                }
            )
            self.assertFalse(result)
            mock_logger.warning.assert_not_called()

    def test_generator_skips_postprocess_when_disabled(self):
        from app.services import generator as gen_mod

        svc = gen_mod.GeneratorService()
        task_id = "test-inlay-gate-off"
        svc.create_task(
            request_type="image_to_3d",
            params={
                "image_path": "/nonexistent/image.png",
                "generation_mode": "fast",
                "enable_inlay_postprocess": False,
                "setting_mesh_path": "/nonexistent/inlay.glb",
            },
            task_id=task_id,
        )

        with patch.object(svc, "_run_gpu_phase") as mock_gpu:
            mock_gpu.return_value = {
                "success": True,
                "output_path": "/tmp/out.glb",
                "raw_path": "/tmp/raw.obj",
                "condition_mode": "image_only",
            }
            with patch("app.services.generator.get_mesh_processor") as mock_proc:
                processor = MagicMock()
                mock_proc.return_value = processor

                import asyncio

                asyncio.get_event_loop().run_until_complete(
                    svc._process_image_to_3d(task_id)
                )
                processor.process_generated_mesh.assert_not_called()


if __name__ == "__main__":
    unittest.main()
