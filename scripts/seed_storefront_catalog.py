#!/usr/bin/env python3
"""Generate SQL to seed ~50 storefront demo listings with real jewelry image URLs."""
from __future__ import annotations

import json
from pathlib import Path

# HEAD-verified Unsplash jewelry/accessory photo ids (2026-10-28)
_PHOTO_IDS = [
    "1515562141207-7a88fb7ce338",
    "1605100804763-247f67b3557e",
    "1599643478518-a784e5dc4c8f",
    "1535632066927-ab7c9ab60908",
    "1611591437281-460bfbe1220a",
    "1630019852942-f89202989a59",
    "1617038260897-41a1f14a8ca0",
    "1573408301185-9146fe634ad0",
    "1602173574767-37ac01994b2a",
    "1588444837495-c6cfeb53f32d",
    "1622398925373-3f91b1e275f5",
    "1458538977777-0549b2370168",
    "1515405295579-ba7b45403062",
    "1469334031218-e382a71b716b",
    "1487412720507-e7ab37603c6f",
    "1522335789203-aabd1fc54bc9",
    "1523275335684-37898b6baf30",
]

_HEIGHTS = (900, 1000, 1100, 1200, 950, 1050, 1150)

IMAGES = [
    (
        f"https://images.unsplash.com/photo-{pid}"
        f"?auto=format&fit=crop&w=900&h={_HEIGHTS[i % len(_HEIGHTS)]}&q=80"
    )
    for i, pid in enumerate(_PHOTO_IDS)
]

PRODUCTS = [
    ("RING", "Stellar Sapphire Ring", "Oval sapphire halo in white gold — atelier confirmed model."),
    ("RING", "Aurora Ruby Ring", "Ruby center with pavé band, rose gold finish."),
    ("RING", "Lunar Pearl Signet", "Freshwater pearl set in brushed yellow gold signet."),
    ("RING", "Noir Onyx Band", "Black onyx inlay geometric band for everyday wear."),
    ("RING", "Celeste Diamond Solitaire", "Classic round brilliant solitaire, platinum setting."),
    ("RING", "Garden Moss Agate Ring", "Organic moss agate cabochon with vine shoulders."),
    ("RING", "Heritage Emerald Trilogy", "Three-stone emerald and diamond trilogy ring."),
    ("RING", "Mirage Opalescent Ring", "Ethiopian opal with diamond accents."),
    ("RING", "Atlas Wide Gold Band", "Chunky 18K yellow gold brushed band."),
    ("RING", "Petit Heart Ruby", "Petite heart ruby stacker ring."),
    ("NECKLACE", "Emerald Plume Pendant", "Teardrop emerald pendant on fine cable chain."),
    ("NECKLACE", "North Star Diamond Pendant", "Star motif diamond pendant, white gold."),
    ("NECKLACE", "Tide Pearl Strand", "Graduated pearl strand with gold clasp."),
    ("NECKLACE", "Amber Lantern Necklace", "Warm amber drops on twisted chain."),
    ("NECKLACE", "Coin Medallion Gold", "Hammered gold medallion necklace."),
    ("NECKLACE", "Crystal Dew Collar", "Delicate crystal collar necklace."),
    ("NECKLACE", "Velvet Ribbon Choker", "Satin ribbon choker with central diamond."),
    ("NECKLACE", "Ocean Wave Pendant", "Wave-form pendant in mixed metals."),
    ("EARRING", "Celeste Diamond Studs", "Classic diamond studs, screw backs."),
    ("EARRING", "Morning Dew Earrings", "Pearl drop hoops in yellow gold."),
    ("EARRING", "Iris Amethyst Drops", "Amethyst briolette drop earrings."),
    ("EARRING", "Bolt Gold Hoops", "Chunky polished gold hoop earrings."),
    ("EARRING", "Petal Diamond Climbers", "Ear climbers with marquise diamonds."),
    ("EARRING", "Smoke Quartz Huggies", "Smoky quartz huggie hoops."),
    ("EARRING", "Baroque Pearl Twins", "Asymmetric baroque pearl studs."),
    ("EARRING", "Sunburst Studs", "Radiating gold sunburst stud earrings."),
    ("BRACELET", "Lustre Tennis Bracelet", "Full diamond tennis bracelet, white gold."),
    ("BRACELET", "Cuff Open Horizon", "Open cuff with brushed finish."),
    ("BRACELET", "Linked Coin Bracelet", "Coin-link yellow gold bracelet."),
    ("BRACELET", "Silk Cord Charm", "Silk cord with removable gold charm."),
    ("BRACELET", "Bangle Stack Duo", "Pair of slim stacking bangles."),
    ("BRACELET", "River Pearl Bracelet", "Pearl and gold bead bracelet."),
    ("BRACELET", "Mesh Glow Bracelet", "Fine mesh bracelet with clasp."),
    ("BRACELET", "Lock & Key Bracelet", "Padlock motif charm bracelet."),
    ("BROOCH", "Art Deco Brooch Pin", "Geometric art deco brooch."),
    ("BROOCH", "Botanical Leaf Brooch", "Hand-engraved leaf brooch."),
    ("BROOCH", "Vintage Cameo Brooch", "Classic cameo on gold frame."),
    ("BROOCH", "Bee Garden Brooch", "Enamel bee brooch with crystals."),
    ("OTHER", "Keepsake Locket Mini", "Oval locket for photos or notes."),
    ("OTHER", "Charm Cluster Clip", "Multi-charm clip for bags or chains."),
    ("RING", "Twilight Blue Topaz", "Swiss blue topaz oval ring."),
    ("RING", "Ivory Enamel Band", "Enamel and gold patterned band."),
    ("NECKLACE", "Lariat Cross Over", "Lariat necklace with sliding pearl."),
    ("NECKLACE", "Paperclip Gold Chain", "Trendy paperclip chain necklace."),
    ("EARRING", "Threader Silk Lines", "Minimal threader earrings."),
    ("EARRING", "Fan Crystal Ear Cuffs", "No-pierce fan ear cuffs."),
    ("BRACELET", "Identity ID Bracelet", "Engravable ID plate bracelet."),
    ("BRACELET", "Twist Rope Gold", "Twisted rope gold bracelet."),
    ("BROOCH", "Constellation Pin", "Star constellation brooch."),
    ("OTHER", "Pocket Mirror Charm", "Compact mirror charm accessory."),
]

SELLERS = [
    "atelier.lin",
    "goldleaf.studio",
    "moonrise.jewels",
    "crystal.forge",
    "vintage.vault",
    "northlight.lab",
]


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "''")


def main() -> None:
    assert len(PRODUCTS) >= 50
    assert len(IMAGES) >= 15
    products = PRODUCTS[:50]
    root = Path(__file__).resolve().parents[1]
    sql_path = root / "scripts" / "seed_storefront_catalog.sql"
    json_path = root / "b2c-web" / "js" / "demo-catalog.json"

    catalog = []
    for i, (jt, title, desc) in enumerate(products, start=1):
        catalog.append(
            {
                "demoKey": f"DEMO-SF-{i:03d}",
                "title": title,
                "description": desc,
                "jewelryType": jt,
                "salePrice": round(320 + (i * 37.5) % 2100 + (i % 7) * 25, 2),
                "coverImageUrl": IMAGES[(i - 1) % len(IMAGES)],
                "sellerDisplayName": SELLERS[(i - 1) % len(SELLERS)],
                "soldCount": (i * 3) % 40,
            }
        )

    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    # BCrypt for "password" (demo sellers; public feed does not require login)
    pw = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
    lines = [
        "-- Auto-generated storefront demo catalog (50 pieces)",
        "-- Idempotent: skips existing DEMO-SF-xxx order numbers",
        "START TRANSACTION;",
        "",
    ]
    for idx, seller in enumerate(SELLERS):
        contact = f"demo-seller-{idx + 1}@duxury.local"
        lines += [
            "INSERT INTO portal_customer_accounts (contact, password, display_name, created_at, updated_at)",
            f"SELECT '{contact}', '{pw}', '{esc(seller)}', NOW(), NOW()",
            f"WHERE NOT EXISTS (SELECT 1 FROM portal_customer_accounts WHERE contact = '{contact}');",
            "",
        ]

    for i, item in enumerate(catalog, start=1):
        onum = item["demoKey"]
        title = esc(item["title"])
        desc = esc(item["description"])
        img = esc(item["coverImageUrl"])
        jt = item["jewelryType"]
        price = f"{item['salePrice']:.2f}"
        sold = item["soldCount"]
        seller_contact = f"demo-seller-{((i - 1) % len(SELLERS)) + 1}@duxury.local"
        lines += [
            f"-- {onum}: {item['title']}",
            f"SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = '{seller_contact}' LIMIT 1);",
            "INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)",
            f"SELECT '{onum}', 'Demo Seller', 'C2C', {price}, '独立站演示商品种子', '{title}', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()",
            f"WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = '{onum}');",
            "",
            f"SET @oid := (SELECT id FROM orders WHERE order_number = '{onum}' LIMIT 1);",
            "",
            "INSERT INTO storefront_listing (",
            "  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,",
            "  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,",
            "  status, sold_count, created_at, updated_at",
            ")",
            f"SELECT @oid, @seller_id, '{title}', '{desc}', '{img}', '{jt}',",
            f"  {price}, 180.00, 680.00, 15.00, 45.00,",
            f"  'PUBLISHED', {sold}, NOW(), NOW()",
            "WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL",
            "  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);",
            "",
            "UPDATE storefront_listing sl",
            "INNER JOIN orders o ON o.id = sl.source_order_id",
            f"SET sl.cover_image_url = '{img}', sl.title = '{title}', sl.description = '{desc}',",
            f"    sl.jewelry_type = '{jt}', sl.sale_price = {price}, sl.status = 'PUBLISHED', sl.updated_at = NOW()",
            f"WHERE o.order_number = '{onum}';",
            "",
        ]

    lines.append("COMMIT;")
    lines.append("")
    lines.append(
        "SELECT COUNT(*) AS published_listings FROM storefront_listing WHERE status='PUBLISHED';"
    )
    sql_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {sql_path}")
    print(f"wrote {json_path}")
    print(f"products={len(catalog)} images={len(IMAGES)}")


if __name__ == "__main__":
    main()
