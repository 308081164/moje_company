-- Generate task persistence (SQLite / PostgreSQL compatible)

CREATE TABLE IF NOT EXISTS generate_task (
    task_id                     VARCHAR(36) PRIMARY KEY,
    task_type                   VARCHAR(32) NOT NULL,
    status                      VARCHAR(16) NOT NULL DEFAULT 'pending',
    input_image_filename        VARCHAR(512),
    inlay_structure_filename    VARCHAR(512),
    output_filename             VARCHAR(512),
    error_message               TEXT,
    params_json                 TEXT DEFAULT '{}',
    created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at                TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generate_task_asset (
    id              VARCHAR(36) PRIMARY KEY,
    task_id         VARCHAR(36) NOT NULL,
    asset_type      VARCHAR(32) NOT NULL,
    storage_bucket  VARCHAR(64) NOT NULL,
    storage_key     VARCHAR(1024) NOT NULL,
    size_bytes      BIGINT,
    content_type    VARCHAR(128),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES generate_task(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_generate_task_status ON generate_task(status);
CREATE INDEX IF NOT EXISTS idx_generate_task_created ON generate_task(created_at);
CREATE INDEX IF NOT EXISTS idx_generate_task_asset_task ON generate_task_asset(task_id, asset_type);
