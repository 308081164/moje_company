#!/usr/bin/env python3
"""Add missing orders.receiver_city column for xianyu-super-butler (fixes GET /analytics/orders 500)."""
import argparse
import sqlite3
import sys


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "db",
        nargs="?",
        default="",
        help="Path to SQLite DB (e.g. data/xianyu_data.db). If omitted, tries ./data/xianyu_data.db",
    )
    args = p.parse_args()
    path = args.db or "data/xianyu_data.db"
    try:
        conn = sqlite3.connect(path)
    except sqlite3.Error as e:
        print(f"Cannot open database: {path}: {e}", file=sys.stderr)
        return 1
    try:
        cur = conn.execute("PRAGMA table_info(orders)")
        cols = {row[1] for row in cur.fetchall()}
        if "receiver_city" in cols:
            print(f"OK: receiver_city already exists in {path}")
            return 0
        conn.execute("ALTER TABLE orders ADD COLUMN receiver_city TEXT DEFAULT ''")
        conn.commit()
        print(f"OK: added orders.receiver_city in {path}")
        return 0
    except sqlite3.Error as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
