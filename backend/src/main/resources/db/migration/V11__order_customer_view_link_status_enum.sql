-- Align status column with Hibernate schema validation (native ENUM, same pattern as order_access_links.status).
ALTER TABLE order_customer_view_link
    MODIFY COLUMN status ENUM('ACTIVE', 'EXPIRED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/EXPIRED/DISABLED';
