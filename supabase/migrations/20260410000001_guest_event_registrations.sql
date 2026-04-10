-- SEQ349: Guest event registration — magic-link flow
-- Migration already applied to prod DB. File kept for version history.
CREATE TYPE guest_registration_status AS ENUM ('pending', 'confirmed');

ALTER TABLE calendar_events
  ADD COLUMN allow_guest_registration boolean NOT NULL DEFAULT false;

CREATE TABLE guest_registrations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  email       text NOT NULL,
  name        text NOT NULL,
  token       text NOT NULL UNIQUE,
  status      guest_registration_status NOT NULL DEFAULT 'pending',
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guest_registrations_token_idx    ON guest_registrations(token);
CREATE INDEX guest_registrations_event_id_idx ON guest_registrations(event_id);

ALTER TABLE guest_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_direct_access"
  ON guest_registrations FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
