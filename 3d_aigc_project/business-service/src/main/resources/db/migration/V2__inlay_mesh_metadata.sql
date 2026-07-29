-- Add mesh metadata columns for real vs proxy geometry distinction

ALTER TABLE inlay_item ADD COLUMN mesh_method VARCHAR(32);
ALTER TABLE inlay_item ADD COLUMN mesh_is_proxy BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_inlay_item_mesh_is_proxy ON inlay_item(mesh_is_proxy);
