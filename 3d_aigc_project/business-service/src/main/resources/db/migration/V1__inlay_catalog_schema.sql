-- Inlay catalog schema (SQLite / PostgreSQL compatible)

CREATE TABLE IF NOT EXISTS category (
    id              VARCHAR(36) PRIMARY KEY,
    parent_id       VARCHAR(36),
    name            VARCHAR(256) NOT NULL,
    slug            VARCHAR(256),
    sort_order      INT NOT NULL DEFAULT 0,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tag (
    id              VARCHAR(36) PRIMARY KEY,
    name            VARCHAR(128) NOT NULL UNIQUE,
    color           VARCHAR(32),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inlay_item (
    id                  VARCHAR(36) PRIMARY KEY,
    code                VARCHAR(64),
    display_name        VARCHAR(512) NOT NULL,
    primary_format      VARCHAR(16) NOT NULL DEFAULT 'JCD',
    stone_diameter_mm   REAL,
    inlay_type          VARCHAR(32),
    status              VARCHAR(16) NOT NULL DEFAULT 'active',
    legacy_path         VARCHAR(1024) UNIQUE,
    source_library      VARCHAR(128),
    category_id         VARCHAR(36),
    mesh_ready          BOOLEAN NOT NULL DEFAULT FALSE,
    has_preview         BOOLEAN NOT NULL DEFAULT FALSE,
    preview_quality     REAL,
    preview_method      VARCHAR(32),
    metadata_json       TEXT DEFAULT '{}',
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES category(id)
);

CREATE TABLE IF NOT EXISTS inlay_asset (
    id              VARCHAR(36) PRIMARY KEY,
    inlay_id        VARCHAR(36) NOT NULL,
    asset_type      VARCHAR(32) NOT NULL,
    storage_bucket  VARCHAR(64) NOT NULL,
    storage_key     VARCHAR(1024) NOT NULL,
    content_hash    VARCHAR(64),
    size_bytes      BIGINT,
    version         INT NOT NULL DEFAULT 1,
    preview_method  VARCHAR(32),
    quality_score   REAL,
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,
    generated_at    TIMESTAMP,
    FOREIGN KEY (inlay_id) REFERENCES inlay_item(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inlay_tag (
    inlay_id    VARCHAR(36) NOT NULL,
    tag_id      VARCHAR(36) NOT NULL,
    PRIMARY KEY (inlay_id, tag_id),
    FOREIGN KEY (inlay_id) REFERENCES inlay_item(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inlay_alias (
    id          VARCHAR(36) PRIMARY KEY,
    inlay_id    VARCHAR(36) NOT NULL,
    alias_path  VARCHAR(1024) NOT NULL,
    FOREIGN KEY (inlay_id) REFERENCES inlay_item(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inlay_job_log (
    id          VARCHAR(36) PRIMARY KEY,
    job_type    VARCHAR(32),
    inlay_id    VARCHAR(36),
    status      VARCHAR(16),
    method      VARCHAR(32),
    detail_json TEXT DEFAULT '{}',
    duration_ms INT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inlay_preview_job (
    id          VARCHAR(36) PRIMARY KEY,
    inlay_id    VARCHAR(36) NOT NULL,
    job_type    VARCHAR(32) NOT NULL DEFAULT 'preview',
    priority    INT NOT NULL DEFAULT 0,
    status      VARCHAR(16) NOT NULL DEFAULT 'pending',
    attempts    INT NOT NULL DEFAULT 0,
    error_msg   TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inlay_item_status ON inlay_item(status);
CREATE INDEX IF NOT EXISTS idx_inlay_item_category ON inlay_item(category_id);
CREATE INDEX IF NOT EXISTS idx_inlay_item_mesh_ready ON inlay_item(mesh_ready);
CREATE INDEX IF NOT EXISTS idx_inlay_item_legacy ON inlay_item(legacy_path);
CREATE INDEX IF NOT EXISTS idx_inlay_item_display_name ON inlay_item(display_name);
CREATE INDEX IF NOT EXISTS idx_inlay_asset_inlay ON inlay_asset(inlay_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_inlay_preview_job_status ON inlay_preview_job(status, priority);
