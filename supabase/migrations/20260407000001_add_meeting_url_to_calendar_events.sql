ALTER TABLE calendar_events ADD COLUMN meeting_url text;

-- Backfill: extract href from existing rows where description contains an anchor tag
UPDATE calendar_events
SET
  meeting_url = (regexp_match(description, '<a\s[^>]*href=[\'"](http[^\'"]+)[\'"]'))[1],
  description = regexp_replace(
    regexp_replace(description, '<[^>]+>', '', 'g'),
    '&amp;', '&', 'g'
  )
WHERE description IS NOT NULL AND description LIKE '%<%';
