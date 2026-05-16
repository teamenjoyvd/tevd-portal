-- Migrate trips.description from text to jsonb (Tiptap JSONContent).
-- Drop the ''::text default first (incompatible with jsonb).
-- Existing plain-text descriptions are wrapped in a minimal valid doc node.
-- Empty strings and NULLs map to NULL.

ALTER TABLE trips ALTER COLUMN description DROP DEFAULT;

ALTER TABLE trips
  ALTER COLUMN description TYPE jsonb
  USING CASE
    WHEN description IS NULL OR description = ''
    THEN NULL
    ELSE jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', description)
          )
        )
      )
    )
  END;
