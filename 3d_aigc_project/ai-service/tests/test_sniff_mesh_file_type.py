"""sniff_mesh_file_type / mesh load mismatch handling."""

import os
import struct
import tempfile
import unittest

import trimesh

from app.services.mesh_processor import get_mesh_processor
from app.utils.file_utils import (
    describe_mesh_format_mismatch,
    sniff_mesh_file_type,
    validate_mesh_file,
)


def _write_binary_stl(path: str, tri_count: int = 1) -> None:
    header = b"\0" * 80
    tri = struct.pack(
        "<3f3f3f3fH",
        0.0, 0.0, 1.0,
        0.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0,
    )
    with open(path, "wb") as f:
        f.write(header)
        f.write(struct.pack("<I", tri_count))
        f.write(tri * tri_count)


class TestSniffMeshFileType(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.mkdtemp(prefix="sniff_mesh_")

    def _path(self, name: str) -> str:
        return os.path.join(self._tmpdir, name)

    def test_obj_mislabeled_as_glb(self):
        path = self._path("bad.glb")
        with open(path, "w", encoding="utf-8") as f:
            f.write("# OBJ\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
        self.assertEqual(sniff_mesh_file_type(path), "obj")
        self.assertTrue(validate_mesh_file(path))

    def test_binary_stl_mislabeled_as_glb(self):
        path = self._path("bad.glb")
        _write_binary_stl(path)
        self.assertEqual(sniff_mesh_file_type(path), "stl")
        self.assertTrue(validate_mesh_file(path))

    def test_json_error_not_treated_as_glb(self):
        path = self._path("error.glb")
        with open(path, "w", encoding="utf-8") as f:
            f.write('{"detail":"incorrect header on GLB file"}')
        self.assertIsNone(sniff_mesh_file_type(path))
        self.assertFalse(validate_mesh_file(path))
        msg = describe_mesh_format_mismatch(path)
        self.assertIn("glTF", msg)

    def test_valid_glb(self):
        path = self._path("ok.glb")
        box = trimesh.creation.box()
        box.export(path, file_type="glb")
        self.assertEqual(sniff_mesh_file_type(path), "glb")
        self.assertTrue(validate_mesh_file(path))

    def test_load_trimesh_mesh_clear_error_for_fake_glb(self):
        path = self._path("fake.glb")
        with open(path, "wb") as f:
            f.write(b"not-a-glb")
        processor = get_mesh_processor()
        with self.assertRaises(ValueError) as ctx:
            processor._load_trimesh_mesh(path)
        self.assertNotIn("incorrect header on GLB file", str(ctx.exception))
        self.assertIn("glTF", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
