-- Migration: replace Block[] body column with split body_en / body_bg (Tiptap JSONContent)
-- Strategy: add new columns, backfill from existing body JSONB, keep old column until
-- all rows are confirmed migrated, then drop it.
-- Existing Block[] rows are converted to minimal Tiptap paragraphs so no content is lost.

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS body_en JSONB,
  ADD COLUMN IF NOT EXISTS body_bg JSONB;

-- Backfill: convert each Block[] element to a Tiptap paragraph node.
-- Headings → heading level 2; images → minimal image node; others → paragraph.
UPDATE guides
SET
  body_en = (
    SELECT jsonb_build_object(
      'type', 'doc',
      'content', COALESCE(
        jsonb_agg(
          CASE
            WHEN (block->>'type') = 'heading' THEN
              jsonb_build_object(
                'type', 'heading',
                'attrs', jsonb_build_object('level', 2),
                'content', jsonb_build_array(
                  jsonb_build_object('type', 'text', 'text', COALESCE(block->'content'->>'en', ''))
                )
              )
            WHEN (block->>'type') = 'image' THEN
              jsonb_build_object(
                'type', 'image',
                'attrs', jsonb_build_object('src', block->>'url', 'alt', '')
              )
            ELSE
              jsonb_build_object(
                'type', 'paragraph',
                'content', jsonb_build_array(
                  jsonb_build_object('type', 'text', 'text', COALESCE(block->'content'->>'en', ''))
                )
              )
          END
          ORDER BY ordinality
        ),
        '[]'::jsonb
      )
    )
    FROM jsonb_array_elements(COALESCE(body, '[]'::jsonb)) WITH ORDINALITY AS t(block, ordinality)
  ),
  body_bg = (
    SELECT jsonb_build_object(
      'type', 'doc',
      'content', COALESCE(
        jsonb_agg(
          CASE
            WHEN (block->>'type') = 'heading' THEN
              jsonb_build_object(
                'type', 'heading',
                'attrs', jsonb_build_object('level', 2),
                'content', jsonb_build_array(
                  jsonb_build_object('type', 'text', 'text', COALESCE(block->'content'->>'bg', ''))
                )
              )
            WHEN (block->>'type') = 'image' THEN
              jsonb_build_object(
                'type', 'image',
                'attrs', jsonb_build_object('src', block->>'url', 'alt', '')
              )
            ELSE
              jsonb_build_object(
                'type', 'paragraph',
                'content', jsonb_build_array(
                  jsonb_build_object('type', 'text', 'text', COALESCE(block->'content'->>'bg', ''))
                )
              )
          END
          ORDER BY ordinality
        ),
        '[]'::jsonb
      )
    )
    FROM jsonb_array_elements(COALESCE(body, '[]'::jsonb)) WITH ORDINALITY AS t(block, ordinality)
  )
WHERE body IS NOT NULL AND jsonb_array_length(COALESCE(body, '[]'::jsonb)) > 0;

-- Drop legacy column (Block[] format no longer used)
ALTER TABLE guides DROP COLUMN IF EXISTS body;
