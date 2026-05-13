-- Migration: scheduled_reminders table + guest reminder trigger
-- Ticket: 2505-FEAT-346

-- 1. New enum
CREATE TYPE reminder_type AS ENUM ('1_hour', '15_min');

-- 2. Table
CREATE TABLE scheduled_reminders (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id uuid NOT NULL REFERENCES guest_registrations(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  reminder_type   reminder_type NOT NULL,
  send_at         timestamptz NOT NULL,
  sent_at         timestamptz,
  UNIQUE(registration_id, reminder_type)
);

CREATE INDEX scheduled_reminders_send_at_idx
  ON scheduled_reminders(send_at)
  WHERE sent_at IS NULL;

-- 3. RLS — service role only
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access"
  ON scheduled_reminders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Trigger function — inserts two reminder rows when a guest registration is confirmed
CREATE OR REPLACE FUNCTION fn_schedule_guest_reminders()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_start_time timestamptz;
BEGIN
  -- Only act on confirmed registrations
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Get event start time
  SELECT start_time INTO v_start_time
  FROM calendar_events
  WHERE id = NEW.event_id;

  IF v_start_time IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert 1-hour reminder
  INSERT INTO scheduled_reminders (registration_id, event_id, reminder_type, send_at)
  VALUES (NEW.id, NEW.event_id, '1_hour', v_start_time - INTERVAL '1 hour')
  ON CONFLICT (registration_id, reminder_type) DO NOTHING;

  -- Insert 15-minute reminder
  INSERT INTO scheduled_reminders (registration_id, event_id, reminder_type, send_at)
  VALUES (NEW.id, NEW.event_id, '15_min', v_start_time - INTERVAL '15 minutes')
  ON CONFLICT (registration_id, reminder_type) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. Attach trigger
CREATE TRIGGER trg_schedule_guest_reminders
  AFTER INSERT OR UPDATE OF status
  ON guest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION fn_schedule_guest_reminders();
