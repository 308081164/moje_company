ALTER TABLE orders
    ADD COLUMN designer_assist_paid TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN designer_assist_paid_at DATETIME(6) NULL;
