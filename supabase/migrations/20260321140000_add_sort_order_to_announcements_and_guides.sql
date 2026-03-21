-- ISS-0165: add sort_order to announcements and guides for drag-to-reorder
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE guides        ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
