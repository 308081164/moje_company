#!/usr/bin/env python3
"""将本地「镶嵌结构数据库」文件夹递归上传到阿里云 OSS（初始归档）。

读取仓库根目录 `.env` 中的 OSS 配置，与后端 application.yml 一致：
  OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET_NAME 或 OSS_BUCKET,
  ALIYUN_OSS_ENDPOINT 或 OSS_ENDPOINT

对象前缀默认 inlay-structure-library/，可用环境变量 INLAY_STRUCTURE_OSS_PREFIX 覆盖。
空目录会写入 .dir 占位对象，与后端 InlayStructureLibraryService 一致。

用法:
  python scripts/upload_inlay_structure_library_to_oss.py
  python scripts/upload_inlay_structure_library_to_oss.py --source "镶嵌结构数据库" --dry-run
"""
from __future__ import annotations

import argparse
import mimetypes
import os
import sys
from pathlib import Path


def load_dotenv(env_path: Path) -> None:
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def default_source_dir(root: Path) -> Path | None:
    for name in ("镶嵌结构数据库", "inlay-structure-library"):
        p = root / name
        if p.is_dir():
            return p
    return None


def oss_prefix() -> str:
    p = os.environ.get("INLAY_STRUCTURE_OSS_PREFIX", "inlay-structure-library/").strip()
    if not p.endswith("/"):
        p += "/"
    return p


def rel_key(root_prefix: str, rel: str) -> str:
    rel = rel.replace("\\", "/").lstrip("/")
    return root_prefix + rel


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default="",
        help="本地文件夹路径（默认：仓库下「镶嵌结构数据库」）",
    )
    parser.add_argument("--dry-run", action="store_true", help="仅打印将要上传的对象，不上传")
    parser.add_argument("--skip-existing", action="store_true", help="若 OSS 已存在同名对象则跳过")
    args = parser.parse_args()

    root = repo_root()
    load_dotenv(root / ".env")

    try:
        import oss2
    except ImportError:
        print("请先安装: pip install oss2", file=sys.stderr)
        return 1

    ak = os.environ.get("OSS_ACCESS_KEY_ID", "").strip()
    sk = os.environ.get("OSS_ACCESS_KEY_SECRET", "").strip()
    bucket = (os.environ.get("OSS_BUCKET_NAME") or os.environ.get("OSS_BUCKET") or "").strip()
    endpoint = (os.environ.get("ALIYUN_OSS_ENDPOINT") or os.environ.get("OSS_ENDPOINT") or "").strip()
    if not all([ak, sk, bucket, endpoint]):
        print("OSS 配置不完整，请在 .env 中填写 OSS_ACCESS_KEY_ID/SECRET、OSS_BUCKET_NAME、ALIYUN_OSS_ENDPOINT", file=sys.stderr)
        return 1

    source = Path(args.source).resolve() if args.source else default_source_dir(root)
    if source is None or not source.is_dir():
        print("未找到源目录。请用 --source 指定「镶嵌结构数据库」路径。", file=sys.stderr)
        return 1

    prefix = oss_prefix()
    auth = oss2.Auth(ak, sk)
    bucket_obj = oss2.Bucket(auth, f"https://{endpoint}", bucket)

    uploaded = 0
    skipped = 0
    placeholders = 0

    all_dirs: set[Path] = {source}
    all_files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(source):
        dp = Path(dirpath)
        all_dirs.add(dp)
        for fn in filenames:
            all_files.append(dp / fn)

    for local_dir in sorted(all_dirs):
        rel_dir = local_dir.relative_to(source).as_posix()
        if rel_dir == ".":
            oss_dir = prefix
        else:
            oss_dir = rel_key(prefix, rel_dir + "/")
        placeholder_key = oss_dir + ".dir"
        if args.dry_run:
            print(f"[dir] {placeholder_key}")
            placeholders += 1
            continue
        if args.skip_existing and bucket_obj.object_exists(placeholder_key):
            skipped += 1
        else:
            bucket_obj.put_object(placeholder_key, b"")
            placeholders += 1

    for fp in sorted(all_files):
        rel = fp.relative_to(source).as_posix()
        key = rel_key(prefix, rel)
        if args.dry_run:
            print(f"[file] {key}  <-  {fp}")
            uploaded += 1
            continue
        if args.skip_existing and bucket_obj.object_exists(key):
            skipped += 1
            continue
        mime, _ = mimetypes.guess_type(fp.name)
        headers = {"Content-Type": mime} if mime else None
        with fp.open("rb") as f:
            bucket_obj.put_object(key, f, headers=headers)
        uploaded += 1
        if uploaded % 50 == 0:
            print(f"已上传 {uploaded} 个文件…")

    print(
        f"完成。源目录: {source}\n"
        f"  OSS 前缀: {prefix}\n"
        f"  文件: {uploaded} 上传"
        + (f", {skipped} 跳过" if skipped else "")
        + f"\n  目录占位 .dir: {placeholders}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
