-- ROLLBACK: ALTER TABLE guest_registrations DROP COLUMN lang; ALTER TABLE event_share_links DROP COLUMN lang;

-- 2607-DEV-589: Guest-invite T3 (bilingual workflow). Store the guest's / sharer's
-- language preference at write time (sourced from the tevd_lang cookie) so every
-- downstream email/page render can use it instead of hardcoding English.
-- Additive, backward-compatible: NOT NULL with a default, safe same-release.

ALTER TABLE guest_registrations
  ADD COLUMN lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'bg'));

ALTER TABLE event_share_links
  ADD COLUMN lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'bg'));
