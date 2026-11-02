-- Auto-generated storefront demo catalog (50 pieces)
-- Idempotent: skips existing DEMO-SF-xxx order numbers
START TRANSACTION;

INSERT INTO portal_customer_accounts (contact, password, display_name, created_at, updated_at)
SELECT 'demo-seller-1@duxury.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'atelier.lin', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local');

INSERT INTO portal_customer_accounts (contact, password, display_name, created_at, updated_at)
SELECT 'demo-seller-2@duxury.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'goldleaf.studio', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local');

INSERT INTO portal_customer_accounts (contact, password, display_name, created_at, updated_at)
SELECT 'demo-seller-3@duxury.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'moonrise.jewels', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM portal_customer_accounts WHERE contact = 'demo-seller-3@duxury.local');

INSERT INTO portal_customer_accounts (contact, password, display_name, created_at, updated_at)
SELECT 'demo-seller-4@duxury.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'crystal.forge', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM portal_customer_accounts WHERE contact = 'demo-seller-4@duxury.local');

INSERT INTO portal_customer_accounts (contact, password, display_name, created_at, updated_at)
SELECT 'demo-seller-5@duxury.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'vintage.vault', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM portal_customer_accounts WHERE contact = 'demo-seller-5@duxury.local');

INSERT INTO portal_customer_accounts (contact, password, display_name, created_at, updated_at)
SELECT 'demo-seller-6@duxury.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'northlight.lab', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM portal_customer_accounts WHERE contact = 'demo-seller-6@duxury.local');

-- DEMO-SF-001: Stellar Sapphire Ring
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-001', 'Demo Seller', 'C2C', 382.50, '独立站演示商品种子', 'Stellar Sapphire Ring', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-001');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-001' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Stellar Sapphire Ring', 'Oval sapphire halo in white gold — atelier confirmed model.', 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&h=900&q=80', 'RING',
  382.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 3, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&h=900&q=80', sl.title = 'Stellar Sapphire Ring', sl.description = 'Oval sapphire halo in white gold — atelier confirmed model.',
    sl.jewelry_type = 'RING', sl.sale_price = 382.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-001';

-- DEMO-SF-002: Aurora Ruby Ring
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-002', 'Demo Seller', 'C2C', 445.00, '独立站演示商品种子', 'Aurora Ruby Ring', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-002');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-002' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Aurora Ruby Ring', 'Ruby center with pavé band, rose gold finish.', 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&h=1000&q=80', 'RING',
  445.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 6, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&h=1000&q=80', sl.title = 'Aurora Ruby Ring', sl.description = 'Ruby center with pavé band, rose gold finish.',
    sl.jewelry_type = 'RING', sl.sale_price = 445.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-002';

-- DEMO-SF-003: Lunar Pearl Signet
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-3@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-003', 'Demo Seller', 'C2C', 507.50, '独立站演示商品种子', 'Lunar Pearl Signet', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-003');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-003' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Lunar Pearl Signet', 'Freshwater pearl set in brushed yellow gold signet.', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&h=1100&q=80', 'RING',
  507.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 9, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&h=1100&q=80', sl.title = 'Lunar Pearl Signet', sl.description = 'Freshwater pearl set in brushed yellow gold signet.',
    sl.jewelry_type = 'RING', sl.sale_price = 507.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-003';

-- DEMO-SF-004: Noir Onyx Band
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-4@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-004', 'Demo Seller', 'C2C', 570.00, '独立站演示商品种子', 'Noir Onyx Band', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-004');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-004' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Noir Onyx Band', 'Black onyx inlay geometric band for everyday wear.', 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&h=1200&q=80', 'RING',
  570.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 12, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&h=1200&q=80', sl.title = 'Noir Onyx Band', sl.description = 'Black onyx inlay geometric band for everyday wear.',
    sl.jewelry_type = 'RING', sl.sale_price = 570.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-004';

-- DEMO-SF-005: Celeste Diamond Solitaire
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-5@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-005', 'Demo Seller', 'C2C', 632.50, '独立站演示商品种子', 'Celeste Diamond Solitaire', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-005');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-005' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Celeste Diamond Solitaire', 'Classic round brilliant solitaire, platinum setting.', 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&h=950&q=80', 'RING',
  632.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 15, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&h=950&q=80', sl.title = 'Celeste Diamond Solitaire', sl.description = 'Classic round brilliant solitaire, platinum setting.',
    sl.jewelry_type = 'RING', sl.sale_price = 632.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-005';

-- DEMO-SF-006: Garden Moss Agate Ring
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-6@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-006', 'Demo Seller', 'C2C', 695.00, '独立站演示商品种子', 'Garden Moss Agate Ring', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-006');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-006' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Garden Moss Agate Ring', 'Organic moss agate cabochon with vine shoulders.', 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=900&h=1050&q=80', 'RING',
  695.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 18, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=900&h=1050&q=80', sl.title = 'Garden Moss Agate Ring', sl.description = 'Organic moss agate cabochon with vine shoulders.',
    sl.jewelry_type = 'RING', sl.sale_price = 695.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-006';

-- DEMO-SF-007: Heritage Emerald Trilogy
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-007', 'Demo Seller', 'C2C', 582.50, '独立站演示商品种子', 'Heritage Emerald Trilogy', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-007');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-007' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Heritage Emerald Trilogy', 'Three-stone emerald and diamond trilogy ring.', 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&h=1150&q=80', 'RING',
  582.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 21, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&h=1150&q=80', sl.title = 'Heritage Emerald Trilogy', sl.description = 'Three-stone emerald and diamond trilogy ring.',
    sl.jewelry_type = 'RING', sl.sale_price = 582.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-007';

-- DEMO-SF-008: Mirage Opalescent Ring
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-008', 'Demo Seller', 'C2C', 645.00, '独立站演示商品种子', 'Mirage Opalescent Ring', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-008');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-008' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Mirage Opalescent Ring', 'Ethiopian opal with diamond accents.', 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&h=900&q=80', 'RING',
  645.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 24, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&h=900&q=80', sl.title = 'Mirage Opalescent Ring', sl.description = 'Ethiopian opal with diamond accents.',
    sl.jewelry_type = 'RING', sl.sale_price = 645.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-008';

-- DEMO-SF-009: Atlas Wide Gold Band
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-3@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-009', 'Demo Seller', 'C2C', 707.50, '独立站演示商品种子', 'Atlas Wide Gold Band', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-009');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-009' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Atlas Wide Gold Band', 'Chunky 18K yellow gold brushed band.', 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&h=1000&q=80', 'RING',
  707.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 27, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&h=1000&q=80', sl.title = 'Atlas Wide Gold Band', sl.description = 'Chunky 18K yellow gold brushed band.',
    sl.jewelry_type = 'RING', sl.sale_price = 707.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-009';

-- DEMO-SF-010: Petit Heart Ruby
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-4@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-010', 'Demo Seller', 'C2C', 770.00, '独立站演示商品种子', 'Petit Heart Ruby', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-010');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-010' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Petit Heart Ruby', 'Petite heart ruby stacker ring.', 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?auto=format&fit=crop&w=900&h=1100&q=80', 'RING',
  770.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 30, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?auto=format&fit=crop&w=900&h=1100&q=80', sl.title = 'Petit Heart Ruby', sl.description = 'Petite heart ruby stacker ring.',
    sl.jewelry_type = 'RING', sl.sale_price = 770.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-010';

-- DEMO-SF-011: Emerald Plume Pendant
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-5@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-011', 'Demo Seller', 'C2C', 832.50, '独立站演示商品种子', 'Emerald Plume Pendant', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-011');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-011' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Emerald Plume Pendant', 'Teardrop emerald pendant on fine cable chain.', 'https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?auto=format&fit=crop&w=900&h=1200&q=80', 'NECKLACE',
  832.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 33, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?auto=format&fit=crop&w=900&h=1200&q=80', sl.title = 'Emerald Plume Pendant', sl.description = 'Teardrop emerald pendant on fine cable chain.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 832.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-011';

-- DEMO-SF-012: North Star Diamond Pendant
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-6@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-012', 'Demo Seller', 'C2C', 895.00, '独立站演示商品种子', 'North Star Diamond Pendant', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-012');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-012' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'North Star Diamond Pendant', 'Star motif diamond pendant, white gold.', 'https://images.unsplash.com/photo-1458538977777-0549b2370168?auto=format&fit=crop&w=900&h=950&q=80', 'NECKLACE',
  895.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 36, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1458538977777-0549b2370168?auto=format&fit=crop&w=900&h=950&q=80', sl.title = 'North Star Diamond Pendant', sl.description = 'Star motif diamond pendant, white gold.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 895.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-012';

-- DEMO-SF-013: Tide Pearl Strand
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-013', 'Demo Seller', 'C2C', 957.50, '独立站演示商品种子', 'Tide Pearl Strand', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-013');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-013' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Tide Pearl Strand', 'Graduated pearl strand with gold clasp.', 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=900&h=1050&q=80', 'NECKLACE',
  957.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 39, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=900&h=1050&q=80', sl.title = 'Tide Pearl Strand', sl.description = 'Graduated pearl strand with gold clasp.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 957.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-013';

-- DEMO-SF-014: Amber Lantern Necklace
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-014', 'Demo Seller', 'C2C', 845.00, '独立站演示商品种子', 'Amber Lantern Necklace', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-014');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-014' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Amber Lantern Necklace', 'Warm amber drops on twisted chain.', 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&h=1150&q=80', 'NECKLACE',
  845.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 2, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&h=1150&q=80', sl.title = 'Amber Lantern Necklace', sl.description = 'Warm amber drops on twisted chain.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 845.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-014';

-- DEMO-SF-015: Coin Medallion Gold
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-3@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-015', 'Demo Seller', 'C2C', 907.50, '独立站演示商品种子', 'Coin Medallion Gold', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-015');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-015' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Coin Medallion Gold', 'Hammered gold medallion necklace.', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&h=900&q=80', 'NECKLACE',
  907.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 5, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&h=900&q=80', sl.title = 'Coin Medallion Gold', sl.description = 'Hammered gold medallion necklace.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 907.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-015';

-- DEMO-SF-016: Crystal Dew Collar
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-4@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-016', 'Demo Seller', 'C2C', 970.00, '独立站演示商品种子', 'Crystal Dew Collar', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-016');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-016' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Crystal Dew Collar', 'Delicate crystal collar necklace.', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&h=1000&q=80', 'NECKLACE',
  970.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 8, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&h=1000&q=80', sl.title = 'Crystal Dew Collar', sl.description = 'Delicate crystal collar necklace.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 970.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-016';

-- DEMO-SF-017: Velvet Ribbon Choker
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-5@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-017', 'Demo Seller', 'C2C', 1032.50, '独立站演示商品种子', 'Velvet Ribbon Choker', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-017');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-017' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Velvet Ribbon Choker', 'Satin ribbon choker with central diamond.', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&h=1100&q=80', 'NECKLACE',
  1032.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 11, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&h=1100&q=80', sl.title = 'Velvet Ribbon Choker', sl.description = 'Satin ribbon choker with central diamond.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 1032.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-017';

-- DEMO-SF-018: Ocean Wave Pendant
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-6@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-018', 'Demo Seller', 'C2C', 1095.00, '独立站演示商品种子', 'Ocean Wave Pendant', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-018');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-018' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Ocean Wave Pendant', 'Wave-form pendant in mixed metals.', 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&h=900&q=80', 'NECKLACE',
  1095.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 14, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&h=900&q=80', sl.title = 'Ocean Wave Pendant', sl.description = 'Wave-form pendant in mixed metals.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 1095.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-018';

-- DEMO-SF-019: Celeste Diamond Studs
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-019', 'Demo Seller', 'C2C', 1157.50, '独立站演示商品种子', 'Celeste Diamond Studs', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-019');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-019' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Celeste Diamond Studs', 'Classic diamond studs, screw backs.', 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&h=1000&q=80', 'EARRING',
  1157.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 17, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&h=1000&q=80', sl.title = 'Celeste Diamond Studs', sl.description = 'Classic diamond studs, screw backs.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 1157.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-019';

-- DEMO-SF-020: Morning Dew Earrings
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-020', 'Demo Seller', 'C2C', 1220.00, '独立站演示商品种子', 'Morning Dew Earrings', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-020');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-020' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Morning Dew Earrings', 'Pearl drop hoops in yellow gold.', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&h=1100&q=80', 'EARRING',
  1220.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 20, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&h=1100&q=80', sl.title = 'Morning Dew Earrings', sl.description = 'Pearl drop hoops in yellow gold.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 1220.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-020';

-- DEMO-SF-021: Iris Amethyst Drops
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-3@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-021', 'Demo Seller', 'C2C', 1107.50, '独立站演示商品种子', 'Iris Amethyst Drops', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-021');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-021' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Iris Amethyst Drops', 'Amethyst briolette drop earrings.', 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&h=1200&q=80', 'EARRING',
  1107.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 23, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&h=1200&q=80', sl.title = 'Iris Amethyst Drops', sl.description = 'Amethyst briolette drop earrings.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 1107.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-021';

-- DEMO-SF-022: Bolt Gold Hoops
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-4@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-022', 'Demo Seller', 'C2C', 1170.00, '独立站演示商品种子', 'Bolt Gold Hoops', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-022');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-022' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Bolt Gold Hoops', 'Chunky polished gold hoop earrings.', 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&h=950&q=80', 'EARRING',
  1170.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 26, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&h=950&q=80', sl.title = 'Bolt Gold Hoops', sl.description = 'Chunky polished gold hoop earrings.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 1170.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-022';

-- DEMO-SF-023: Petal Diamond Climbers
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-5@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-023', 'Demo Seller', 'C2C', 1232.50, '独立站演示商品种子', 'Petal Diamond Climbers', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-023');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-023' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Petal Diamond Climbers', 'Ear climbers with marquise diamonds.', 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=900&h=1050&q=80', 'EARRING',
  1232.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 29, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=900&h=1050&q=80', sl.title = 'Petal Diamond Climbers', sl.description = 'Ear climbers with marquise diamonds.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 1232.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-023';

-- DEMO-SF-024: Smoke Quartz Huggies
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-6@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-024', 'Demo Seller', 'C2C', 1295.00, '独立站演示商品种子', 'Smoke Quartz Huggies', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-024');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-024' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Smoke Quartz Huggies', 'Smoky quartz huggie hoops.', 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&h=1150&q=80', 'EARRING',
  1295.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 32, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&h=1150&q=80', sl.title = 'Smoke Quartz Huggies', sl.description = 'Smoky quartz huggie hoops.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 1295.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-024';

-- DEMO-SF-025: Baroque Pearl Twins
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-025', 'Demo Seller', 'C2C', 1357.50, '独立站演示商品种子', 'Baroque Pearl Twins', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-025');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-025' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Baroque Pearl Twins', 'Asymmetric baroque pearl studs.', 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&h=900&q=80', 'EARRING',
  1357.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 35, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&h=900&q=80', sl.title = 'Baroque Pearl Twins', sl.description = 'Asymmetric baroque pearl studs.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 1357.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-025';

-- DEMO-SF-026: Sunburst Studs
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-026', 'Demo Seller', 'C2C', 1420.00, '独立站演示商品种子', 'Sunburst Studs', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-026');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-026' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Sunburst Studs', 'Radiating gold sunburst stud earrings.', 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&h=1000&q=80', 'EARRING',
  1420.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 38, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&h=1000&q=80', sl.title = 'Sunburst Studs', sl.description = 'Radiating gold sunburst stud earrings.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 1420.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-026';

-- DEMO-SF-027: Lustre Tennis Bracelet
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-3@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-027', 'Demo Seller', 'C2C', 1482.50, '独立站演示商品种子', 'Lustre Tennis Bracelet', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-027');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-027' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Lustre Tennis Bracelet', 'Full diamond tennis bracelet, white gold.', 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?auto=format&fit=crop&w=900&h=1100&q=80', 'BRACELET',
  1482.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 1, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?auto=format&fit=crop&w=900&h=1100&q=80', sl.title = 'Lustre Tennis Bracelet', sl.description = 'Full diamond tennis bracelet, white gold.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 1482.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-027';

-- DEMO-SF-028: Cuff Open Horizon
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-4@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-028', 'Demo Seller', 'C2C', 1370.00, '独立站演示商品种子', 'Cuff Open Horizon', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-028');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-028' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Cuff Open Horizon', 'Open cuff with brushed finish.', 'https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?auto=format&fit=crop&w=900&h=1200&q=80', 'BRACELET',
  1370.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 4, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?auto=format&fit=crop&w=900&h=1200&q=80', sl.title = 'Cuff Open Horizon', sl.description = 'Open cuff with brushed finish.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 1370.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-028';

-- DEMO-SF-029: Linked Coin Bracelet
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-5@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-029', 'Demo Seller', 'C2C', 1432.50, '独立站演示商品种子', 'Linked Coin Bracelet', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-029');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-029' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Linked Coin Bracelet', 'Coin-link yellow gold bracelet.', 'https://images.unsplash.com/photo-1458538977777-0549b2370168?auto=format&fit=crop&w=900&h=950&q=80', 'BRACELET',
  1432.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 7, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1458538977777-0549b2370168?auto=format&fit=crop&w=900&h=950&q=80', sl.title = 'Linked Coin Bracelet', sl.description = 'Coin-link yellow gold bracelet.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 1432.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-029';

-- DEMO-SF-030: Silk Cord Charm
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-6@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-030', 'Demo Seller', 'C2C', 1495.00, '独立站演示商品种子', 'Silk Cord Charm', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-030');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-030' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Silk Cord Charm', 'Silk cord with removable gold charm.', 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=900&h=1050&q=80', 'BRACELET',
  1495.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 10, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=900&h=1050&q=80', sl.title = 'Silk Cord Charm', sl.description = 'Silk cord with removable gold charm.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 1495.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-030';

-- DEMO-SF-031: Bangle Stack Duo
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-031', 'Demo Seller', 'C2C', 1557.50, '独立站演示商品种子', 'Bangle Stack Duo', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-031');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-031' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Bangle Stack Duo', 'Pair of slim stacking bangles.', 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&h=1150&q=80', 'BRACELET',
  1557.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 13, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&h=1150&q=80', sl.title = 'Bangle Stack Duo', sl.description = 'Pair of slim stacking bangles.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 1557.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-031';

-- DEMO-SF-032: River Pearl Bracelet
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-032', 'Demo Seller', 'C2C', 1620.00, '独立站演示商品种子', 'River Pearl Bracelet', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-032');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-032' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'River Pearl Bracelet', 'Pearl and gold bead bracelet.', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&h=900&q=80', 'BRACELET',
  1620.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 16, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&h=900&q=80', sl.title = 'River Pearl Bracelet', sl.description = 'Pearl and gold bead bracelet.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 1620.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-032';

-- DEMO-SF-033: Mesh Glow Bracelet
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-3@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-033', 'Demo Seller', 'C2C', 1682.50, '独立站演示商品种子', 'Mesh Glow Bracelet', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-033');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-033' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Mesh Glow Bracelet', 'Fine mesh bracelet with clasp.', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&h=1000&q=80', 'BRACELET',
  1682.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 19, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&h=1000&q=80', sl.title = 'Mesh Glow Bracelet', sl.description = 'Fine mesh bracelet with clasp.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 1682.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-033';

-- DEMO-SF-034: Lock & Key Bracelet
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-4@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-034', 'Demo Seller', 'C2C', 1745.00, '独立站演示商品种子', 'Lock & Key Bracelet', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-034');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-034' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Lock & Key Bracelet', 'Padlock motif charm bracelet.', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&h=1100&q=80', 'BRACELET',
  1745.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 22, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&h=1100&q=80', sl.title = 'Lock & Key Bracelet', sl.description = 'Padlock motif charm bracelet.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 1745.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-034';

-- DEMO-SF-035: Art Deco Brooch Pin
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-5@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-035', 'Demo Seller', 'C2C', 1632.50, '独立站演示商品种子', 'Art Deco Brooch Pin', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-035');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-035' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Art Deco Brooch Pin', 'Geometric art deco brooch.', 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&h=900&q=80', 'BROOCH',
  1632.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 25, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&h=900&q=80', sl.title = 'Art Deco Brooch Pin', sl.description = 'Geometric art deco brooch.',
    sl.jewelry_type = 'BROOCH', sl.sale_price = 1632.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-035';

-- DEMO-SF-036: Botanical Leaf Brooch
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-6@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-036', 'Demo Seller', 'C2C', 1695.00, '独立站演示商品种子', 'Botanical Leaf Brooch', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-036');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-036' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Botanical Leaf Brooch', 'Hand-engraved leaf brooch.', 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&h=1000&q=80', 'BROOCH',
  1695.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 28, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&h=1000&q=80', sl.title = 'Botanical Leaf Brooch', sl.description = 'Hand-engraved leaf brooch.',
    sl.jewelry_type = 'BROOCH', sl.sale_price = 1695.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-036';

-- DEMO-SF-037: Vintage Cameo Brooch
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-037', 'Demo Seller', 'C2C', 1757.50, '独立站演示商品种子', 'Vintage Cameo Brooch', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-037');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-037' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Vintage Cameo Brooch', 'Classic cameo on gold frame.', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&h=1100&q=80', 'BROOCH',
  1757.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 31, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&h=1100&q=80', sl.title = 'Vintage Cameo Brooch', sl.description = 'Classic cameo on gold frame.',
    sl.jewelry_type = 'BROOCH', sl.sale_price = 1757.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-037';

-- DEMO-SF-038: Bee Garden Brooch
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-038', 'Demo Seller', 'C2C', 1820.00, '独立站演示商品种子', 'Bee Garden Brooch', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-038');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-038' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Bee Garden Brooch', 'Enamel bee brooch with crystals.', 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&h=1200&q=80', 'BROOCH',
  1820.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 34, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&h=1200&q=80', sl.title = 'Bee Garden Brooch', sl.description = 'Enamel bee brooch with crystals.',
    sl.jewelry_type = 'BROOCH', sl.sale_price = 1820.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-038';

-- DEMO-SF-039: Keepsake Locket Mini
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-3@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-039', 'Demo Seller', 'C2C', 1882.50, '独立站演示商品种子', 'Keepsake Locket Mini', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-039');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-039' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Keepsake Locket Mini', 'Oval locket for photos or notes.', 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&h=950&q=80', 'OTHER',
  1882.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 37, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&h=950&q=80', sl.title = 'Keepsake Locket Mini', sl.description = 'Oval locket for photos or notes.',
    sl.jewelry_type = 'OTHER', sl.sale_price = 1882.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-039';

-- DEMO-SF-040: Charm Cluster Clip
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-4@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-040', 'Demo Seller', 'C2C', 1945.00, '独立站演示商品种子', 'Charm Cluster Clip', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-040');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-040' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Charm Cluster Clip', 'Multi-charm clip for bags or chains.', 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=900&h=1050&q=80', 'OTHER',
  1945.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 0, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=900&h=1050&q=80', sl.title = 'Charm Cluster Clip', sl.description = 'Multi-charm clip for bags or chains.',
    sl.jewelry_type = 'OTHER', sl.sale_price = 1945.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-040';

-- DEMO-SF-041: Twilight Blue Topaz
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-5@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-041', 'Demo Seller', 'C2C', 2007.50, '独立站演示商品种子', 'Twilight Blue Topaz', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-041');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-041' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Twilight Blue Topaz', 'Swiss blue topaz oval ring.', 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&h=1150&q=80', 'RING',
  2007.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 3, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&h=1150&q=80', sl.title = 'Twilight Blue Topaz', sl.description = 'Swiss blue topaz oval ring.',
    sl.jewelry_type = 'RING', sl.sale_price = 2007.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-041';

-- DEMO-SF-042: Ivory Enamel Band
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-6@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-042', 'Demo Seller', 'C2C', 1895.00, '独立站演示商品种子', 'Ivory Enamel Band', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-042');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-042' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Ivory Enamel Band', 'Enamel and gold patterned band.', 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&h=900&q=80', 'RING',
  1895.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 6, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&h=900&q=80', sl.title = 'Ivory Enamel Band', sl.description = 'Enamel and gold patterned band.',
    sl.jewelry_type = 'RING', sl.sale_price = 1895.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-042';

-- DEMO-SF-043: Lariat Cross Over
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-043', 'Demo Seller', 'C2C', 1957.50, '独立站演示商品种子', 'Lariat Cross Over', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-043');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-043' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Lariat Cross Over', 'Lariat necklace with sliding pearl.', 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&h=1000&q=80', 'NECKLACE',
  1957.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 9, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&h=1000&q=80', sl.title = 'Lariat Cross Over', sl.description = 'Lariat necklace with sliding pearl.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 1957.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-043';

-- DEMO-SF-044: Paperclip Gold Chain
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-044', 'Demo Seller', 'C2C', 2020.00, '独立站演示商品种子', 'Paperclip Gold Chain', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-044');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-044' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Paperclip Gold Chain', 'Trendy paperclip chain necklace.', 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?auto=format&fit=crop&w=900&h=1100&q=80', 'NECKLACE',
  2020.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 12, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?auto=format&fit=crop&w=900&h=1100&q=80', sl.title = 'Paperclip Gold Chain', sl.description = 'Trendy paperclip chain necklace.',
    sl.jewelry_type = 'NECKLACE', sl.sale_price = 2020.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-044';

-- DEMO-SF-045: Threader Silk Lines
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-3@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-045', 'Demo Seller', 'C2C', 2082.50, '独立站演示商品种子', 'Threader Silk Lines', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-045');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-045' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Threader Silk Lines', 'Minimal threader earrings.', 'https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?auto=format&fit=crop&w=900&h=1200&q=80', 'EARRING',
  2082.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 15, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?auto=format&fit=crop&w=900&h=1200&q=80', sl.title = 'Threader Silk Lines', sl.description = 'Minimal threader earrings.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 2082.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-045';

-- DEMO-SF-046: Fan Crystal Ear Cuffs
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-4@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-046', 'Demo Seller', 'C2C', 2145.00, '独立站演示商品种子', 'Fan Crystal Ear Cuffs', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-046');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-046' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Fan Crystal Ear Cuffs', 'No-pierce fan ear cuffs.', 'https://images.unsplash.com/photo-1458538977777-0549b2370168?auto=format&fit=crop&w=900&h=950&q=80', 'EARRING',
  2145.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 18, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1458538977777-0549b2370168?auto=format&fit=crop&w=900&h=950&q=80', sl.title = 'Fan Crystal Ear Cuffs', sl.description = 'No-pierce fan ear cuffs.',
    sl.jewelry_type = 'EARRING', sl.sale_price = 2145.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-046';

-- DEMO-SF-047: Identity ID Bracelet
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-5@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-047', 'Demo Seller', 'C2C', 2207.50, '独立站演示商品种子', 'Identity ID Bracelet', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-047');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-047' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Identity ID Bracelet', 'Engravable ID plate bracelet.', 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=900&h=1050&q=80', 'BRACELET',
  2207.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 21, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=900&h=1050&q=80', sl.title = 'Identity ID Bracelet', sl.description = 'Engravable ID plate bracelet.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 2207.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-047';

-- DEMO-SF-048: Twist Rope Gold
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-6@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-048', 'Demo Seller', 'C2C', 2270.00, '独立站演示商品种子', 'Twist Rope Gold', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-048');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-048' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Twist Rope Gold', 'Twisted rope gold bracelet.', 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&h=1150&q=80', 'BRACELET',
  2270.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 24, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&h=1150&q=80', sl.title = 'Twist Rope Gold', sl.description = 'Twisted rope gold bracelet.',
    sl.jewelry_type = 'BRACELET', sl.sale_price = 2270.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-048';

-- DEMO-SF-049: Constellation Pin
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-1@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-049', 'Demo Seller', 'C2C', 2157.50, '独立站演示商品种子', 'Constellation Pin', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-049');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-049' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Constellation Pin', 'Star constellation brooch.', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&h=900&q=80', 'BROOCH',
  2157.50, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 27, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&h=900&q=80', sl.title = 'Constellation Pin', sl.description = 'Star constellation brooch.',
    sl.jewelry_type = 'BROOCH', sl.sale_price = 2157.50, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-049';

-- DEMO-SF-050: Pocket Mirror Charm
SET @seller_id := (SELECT id FROM portal_customer_accounts WHERE contact = 'demo-seller-2@duxury.local' LIMIT 1);
INSERT INTO orders (order_number, customer_name, source, deposit, basic_requirements, style_info, status, is_b2b, service_type, order_time, created_at, updated_at)
SELECT 'DEMO-SF-050', 'Demo Seller', 'C2C', 2220.00, '独立站演示商品种子', 'Pocket Mirror Charm', 'COMPLETED', 0, 'STOREFRONT', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'DEMO-SF-050');

SET @oid := (SELECT id FROM orders WHERE order_number = 'DEMO-SF-050' LIMIT 1);

INSERT INTO storefront_listing (
  source_order_id, seller_account_id, title, description, cover_image_url, jewelry_type,
  sale_price, production_fee_min, production_fee_max, shipping_fee_min, shipping_fee_max,
  status, sold_count, created_at, updated_at
)
SELECT @oid, @seller_id, 'Pocket Mirror Charm', 'Compact mirror charm accessory.', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&h=1000&q=80', 'OTHER',
  2220.00, 180.00, 680.00, 15.00, 45.00,
  'PUBLISHED', 30, NOW(), NOW()
WHERE @oid IS NOT NULL AND @seller_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM storefront_listing WHERE source_order_id = @oid);

UPDATE storefront_listing sl
INNER JOIN orders o ON o.id = sl.source_order_id
SET sl.cover_image_url = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&h=1000&q=80', sl.title = 'Pocket Mirror Charm', sl.description = 'Compact mirror charm accessory.',
    sl.jewelry_type = 'OTHER', sl.sale_price = 2220.00, sl.status = 'PUBLISHED', sl.updated_at = NOW()
WHERE o.order_number = 'DEMO-SF-050';

COMMIT;

SELECT COUNT(*) AS published_listings FROM storefront_listing WHERE status='PUBLISHED';