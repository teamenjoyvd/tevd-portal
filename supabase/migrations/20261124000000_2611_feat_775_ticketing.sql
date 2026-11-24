-- 2611-DEV-775: ticketing schema, redemption, fulfilment, cancellation, anonymising.
-- Expand-only. Dark until launch: nothing reads these until an event is
-- source IN ('zoom','portal') and has an active product (#772, #787).
--
-- Failure SQLSTATEs, mapped in lib/server/tickets/errors.ts:
--   TK001 pass is void             TK006 outside the redemption window
--   TK002 not a ticketed event     TK007 not enough entries left
--   TK003 session cancelled        TK008 full for this mode
--   TK004 product does not cover   TK009 online email already admitted
--   TK005 expired                  TK010 invalid input
--                                  TK011 not found
--
-- ROLLBACK:
--   DROP FUNCTION public.issue_complimentary_pass(uuid, text, text, integer, timestamptz, uuid, text, text);
--   DROP FUNCTION public.anonymise_ticket_holder(text, uuid);
--   DROP FUNCTION public.cancel_ticketed_session(uuid, uuid);
--   DROP FUNCTION public.fulfill_ticket_order(uuid, text, text, text);
--   DROP FUNCTION public.register_free_admission(uuid, text, text, uuid, text, text, uuid, text, text);
--   DROP FUNCTION public.redeem_pass_entries(uuid, uuid, jsonb, text, text, uuid);
--   DROP FUNCTION public.ticket_admit(uuid, uuid, jsonb, text, text, uuid, timestamptz);
--   DROP TABLE public.ticket_audit, public.ticket_admissions, public.ticket_passes,
--              public.stripe_events, public.ticket_orders, public.ticket_products;
--   ALTER TABLE public.calendar_events DROP COLUMN series_key, DROP COLUMN in_person_capacity,
--     DROP COLUMN online_capacity, DROP COLUMN tickets_cancelled_at;

ALTER TABLE public.calendar_events
  ADD COLUMN series_key text,
  ADD COLUMN in_person_capacity integer CHECK (in_person_capacity >= 0),
  ADD COLUMN online_capacity integer CHECK (online_capacity BETWEEN 0 AND 100),
  ADD COLUMN tickets_cancelled_at timestamptz;

CREATE TABLE public.ticket_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('single', 'pack', 'free_registration')),
  series_key text,
  event_id uuid REFERENCES public.calendar_events(id) ON DELETE RESTRICT,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  entries integer NOT NULL CHECK (entries > 0),
  validity_days integer CHECK (validity_days > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(series_key, event_id) = 1),
  CHECK ((kind = 'free_registration') = (price_cents = 0)),
  -- A paid series product has no event to take its expiry from.
  CHECK (kind = 'free_registration' OR series_key IS NULL OR validity_days IS NOT NULL)
);
CREATE UNIQUE INDEX ticket_products_series_kind_key ON public.ticket_products (series_key, kind) WHERE series_key IS NOT NULL;
CREATE UNIQUE INDEX ticket_products_event_kind_key ON public.ticket_products (event_id, kind) WHERE event_id IS NOT NULL;

CREATE TABLE public.ticket_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.ticket_products(id) ON DELETE RESTRICT,
  -- Set when bought from the door QR: fulfilment uses one entry for this event.
  door_event_id uuid REFERENCES public.calendar_events(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  currency text NOT NULL DEFAULT 'eur',
  stripe_checkout_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);
CREATE INDEX ticket_orders_email_idx ON public.ticket_orders (lower(buyer_email));

CREATE TABLE public.stripe_events (
  event_id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz
);

CREATE TABLE public.ticket_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid UNIQUE REFERENCES public.ticket_orders(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.ticket_products(id) ON DELETE RESTRICT,
  holder_name text NOT NULL,
  holder_email text NOT NULL,
  holder_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entries_total integer NOT NULL CHECK (entries_total > 0),
  expires_at timestamptz NOT NULL,
  unlock_code text NOT NULL UNIQUE,
  qr_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  void_reason text,
  email_sent_at timestamptz,
  email_claimed_at timestamptz,
  email_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_passes_email_idx ON public.ticket_passes (lower(holder_email));
CREATE INDEX ticket_passes_profile_idx ON public.ticket_passes (holder_profile_id);

CREATE TABLE public.ticket_admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES public.ticket_passes(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE RESTRICT,
  attendee_name text NOT NULL,
  attendee_email text,
  mode text NOT NULL CHECK (mode IN ('online', 'in_person')),
  status text NOT NULL CHECK (status IN ('pending_zoom', 'active', 'revoked')),
  admitted_via text NOT NULL
    CHECK (admitted_via IN ('registration', 'code', 'qr', 'search', 'walk_in', 'admin', 'door_purchase')),
  zoom_attempted_at timestamptz,
  zoom_attempts integer NOT NULL DEFAULT 0,
  zoom_ref text,
  zoom_join_link text,
  zoom_left_at timestamptz,
  device_token_hash text,
  device_claimed_at timestamptz,
  attended_online_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (mode = 'in_person' OR attendee_email IS NOT NULL)
);
CREATE UNIQUE INDEX ticket_admissions_online_email_key
  ON public.ticket_admissions (event_id, lower(attendee_email))
  WHERE mode = 'online' AND status IN ('pending_zoom', 'active');
CREATE INDEX ticket_admissions_pass_idx ON public.ticket_admissions (pass_id);
CREATE INDEX ticket_admissions_event_idx ON public.ticket_admissions (event_id, mode, status);

CREATE TABLE public.ticket_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  pass_id uuid REFERENCES public.ticket_passes(id) ON DELETE RESTRICT,
  admission_id uuid REFERENCES public.ticket_admissions(id) ON DELETE RESTRICT,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_audit_pass_idx ON public.ticket_audit (pass_id);
CREATE INDEX ticket_audit_admission_idx ON public.ticket_audit (admission_id);

-- RLS on with no policies: service role only.
ALTER TABLE public.ticket_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ticket_products, public.ticket_orders, public.stripe_events,
  public.ticket_passes, public.ticket_admissions, public.ticket_audit FROM anon, authenticated;
GRANT ALL ON public.ticket_products, public.ticket_orders, public.stripe_events,
  public.ticket_passes, public.ticket_admissions, public.ticket_audit TO service_role;

INSERT INTO public.ticket_products (kind, series_key, price_cents, entries, validity_days) VALUES
  ('single', 'tuesday', 500, 1, 60),
  ('pack', 'tuesday', 2500, 5, 60),
  ('free_registration', 'monday', 0, 1, NULL)
ON CONFLICT DO NOTHING;

-- Shared admission check. Lock order is always event, then pass.
-- p_at is the moment the rules are judged at: now(), or an order's created_at
-- for a door purchase, whose payment can land after the window has closed.
CREATE FUNCTION public.ticket_admit(
  p_pass_id uuid, p_event_id uuid, p_attendees jsonb, p_mode text,
  p_admitted_via text, p_actor uuid, p_at timestamptz
) RETURNS SETOF public.ticket_admissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.calendar_events;
  v_pass public.ticket_passes;
  v_product public.ticket_products;
  v_count integer;
  v_capacity integer;
  v_day_start timestamptz;
  v_closes timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM calendar_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found' USING ERRCODE = 'TK011'; END IF;
  SELECT * INTO v_pass FROM ticket_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pass not found' USING ERRCODE = 'TK011'; END IF;
  SELECT * INTO v_product FROM ticket_products WHERE id = v_pass.product_id;

  -- Separate statement: jsonb_array_length errors on a non-array, and AND/OR
  -- does not promise evaluation order.
  IF jsonb_typeof(p_attendees) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'attendees must be an array' USING ERRCODE = 'TK010';
  END IF;
  v_count := jsonb_array_length(p_attendees);
  IF v_count = 0 OR p_at IS NULL OR p_mode IS NULL OR p_mode NOT IN ('online', 'in_person')
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_attendees) a
       WHERE coalesce(btrim(a->>'name'), '') = ''
          OR (p_mode = 'online' AND coalesce(btrim(a->>'email'), '') = '')
     ) THEN
    RAISE EXCEPTION 'invalid attendees or mode' USING ERRCODE = 'TK010';
  END IF;

  IF v_pass.status = 'void' THEN RAISE EXCEPTION 'pass is void' USING ERRCODE = 'TK001'; END IF;
  IF v_event.source::text NOT IN ('zoom', 'portal') THEN
    RAISE EXCEPTION 'not a ticketed event' USING ERRCODE = 'TK002';
  END IF;
  IF v_event.tickets_cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'session is cancelled' USING ERRCODE = 'TK003';
  END IF;
  IF (v_product.event_id = v_event.id) IS NOT TRUE
     AND (v_product.series_key = v_event.series_key) IS NOT TRUE THEN
    RAISE EXCEPTION 'product does not cover event' USING ERRCODE = 'TK004';
  END IF;
  IF p_at >= v_pass.expires_at OR v_event.start_time >= v_pass.expires_at THEN
    RAISE EXCEPTION 'pass has expired' USING ERRCODE = 'TK005';
  END IF;

  v_day_start := date_trunc('day', v_event.start_time AT TIME ZONE 'Europe/Sofia') AT TIME ZONE 'Europe/Sofia';
  v_closes := v_event.end_time + CASE WHEN p_mode = 'in_person' THEN interval '30 minutes' ELSE interval '0' END;
  -- Free registration opens as soon as the product is active, not on the day.
  IF p_at >= v_closes OR (p_at < v_day_start AND p_admitted_via <> 'registration') THEN
    RAISE EXCEPTION 'outside the redemption window' USING ERRCODE = 'TK006';
  END IF;

  IF v_pass.entries_total - (
       SELECT count(*) FROM ticket_admissions
       WHERE pass_id = v_pass.id AND status IN ('pending_zoom', 'active')
     ) < v_count THEN
    RAISE EXCEPTION 'not enough entries left' USING ERRCODE = 'TK007';
  END IF;

  IF p_mode = 'online' AND (
    (SELECT count(DISTINCT lower(btrim(a->>'email'))) FROM jsonb_array_elements(p_attendees) a) < v_count
    OR EXISTS (
      SELECT 1 FROM ticket_admissions t
      JOIN jsonb_array_elements(p_attendees) a ON lower(t.attendee_email) = lower(btrim(a->>'email'))
      WHERE t.event_id = v_event.id AND t.mode = 'online' AND t.status IN ('pending_zoom', 'active')
    )
  ) THEN
    RAISE EXCEPTION 'online email already admitted' USING ERRCODE = 'TK009';
  END IF;

  v_capacity := CASE p_mode WHEN 'online' THEN v_event.online_capacity ELSE v_event.in_person_capacity END;
  IF v_capacity IS NOT NULL AND v_count + (
       SELECT count(*) FROM ticket_admissions
       WHERE event_id = v_event.id AND mode = p_mode AND status IN ('pending_zoom', 'active')
     ) > v_capacity THEN
    RAISE EXCEPTION 'event is full' USING ERRCODE = 'TK008';
  END IF;

  RETURN QUERY
  INSERT INTO ticket_admissions
    (pass_id, event_id, attendee_name, attendee_email, mode, status, admitted_via, checked_in_at, checked_in_by)
  SELECT v_pass.id, v_event.id, btrim(a->>'name'), nullif(btrim(a->>'email'), ''), p_mode,
         CASE p_mode WHEN 'online' THEN 'pending_zoom' ELSE 'active' END, p_admitted_via,
         CASE p_mode WHEN 'in_person' THEN now() END,
         CASE p_mode WHEN 'in_person' THEN p_actor END
  FROM jsonb_array_elements(p_attendees) a
  RETURNING *;
END $$;

CREATE FUNCTION public.redeem_pass_entries(
  p_pass_id uuid, p_event_id uuid, p_attendees jsonb, p_mode text, p_admitted_via text, p_actor uuid
) RETURNS SETOF public.ticket_admissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  -- 'registration' skips the day-of check and belongs to register_free_admission.
  IF p_admitted_via IS NULL OR p_admitted_via NOT IN ('code', 'qr', 'search', 'admin') THEN
    RAISE EXCEPTION 'invalid admitted_via' USING ERRCODE = 'TK010';
  END IF;
  RETURN QUERY SELECT * FROM ticket_admit(p_pass_id, p_event_id, p_attendees, p_mode, p_admitted_via, p_actor, now());
END $$;

-- Returns { created, admission }. Same online email again returns the existing admission.
CREATE FUNCTION public.register_free_admission(
  p_event_id uuid, p_name text, p_email text, p_profile_id uuid, p_mode text,
  p_admitted_via text, p_actor uuid, p_unlock_code text, p_qr_token text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.calendar_events;
  v_product public.ticket_products;
  v_admission public.ticket_admissions;
  v_pass_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_admitted_via IS NULL OR p_admitted_via NOT IN ('registration', 'walk_in')
     OR (p_admitted_via = 'registration') IS DISTINCT FROM (p_mode = 'online')
     OR coalesce(btrim(p_name), '') = '' THEN
    RAISE EXCEPTION 'invalid registration' USING ERRCODE = 'TK010';
  END IF;

  SELECT * INTO v_event FROM calendar_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found' USING ERRCODE = 'TK011'; END IF;
  IF v_event.source::text NOT IN ('zoom', 'portal') THEN
    RAISE EXCEPTION 'not a ticketed event' USING ERRCODE = 'TK002';
  END IF;

  IF p_mode = 'online' THEN
    SELECT * INTO v_admission FROM ticket_admissions
    WHERE event_id = p_event_id AND mode = 'online' AND status IN ('pending_zoom', 'active')
      AND lower(attendee_email) = lower(btrim(p_email));
    IF FOUND THEN RETURN jsonb_build_object('created', false, 'admission', to_jsonb(v_admission)); END IF;
  END IF;

  SELECT * INTO v_product FROM ticket_products
  WHERE kind = 'free_registration' AND active
    AND (event_id = v_event.id OR series_key = v_event.series_key)
  ORDER BY event_id NULLS LAST LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no free registration for event' USING ERRCODE = 'TK004'; END IF;

  INSERT INTO ticket_passes
    (product_id, holder_name, holder_email, holder_profile_id, entries_total, expires_at, unlock_code, qr_token)
  VALUES (v_product.id, btrim(p_name), coalesce(btrim(p_email), ''), p_profile_id, 1,
          v_event.end_time + interval '30 minutes', p_unlock_code, p_qr_token)
  RETURNING id INTO v_pass_id;

  SELECT * INTO v_admission FROM ticket_admit(
    v_pass_id, p_event_id, jsonb_build_array(jsonb_build_object('name', p_name, 'email', p_email)),
    p_mode, p_admitted_via, p_actor, now());
  RETURN jsonb_build_object('created', true, 'admission', to_jsonb(v_admission));
END $$;

-- Returns { just_fulfilled, pass, door_admission_id, door_error }.
CREATE FUNCTION public.fulfill_ticket_order(
  p_order_id uuid, p_session_id text, p_unlock_code text, p_qr_token text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.ticket_orders;
  v_product public.ticket_products;
  v_pass public.ticket_passes;
  v_just boolean;
  v_expires timestamptz;
  v_door uuid;
  v_door_error text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE ticket_orders SET status = 'paid', fulfilled_at = now()
  WHERE id = p_order_id AND stripe_checkout_session_id = p_session_id AND status IN ('pending', 'expired')
  RETURNING * INTO v_order;
  v_just := FOUND;

  IF v_just THEN
    SELECT * INTO v_product FROM ticket_products WHERE id = v_order.product_id;
    IF v_product.validity_days IS NOT NULL THEN
      v_expires := now() + make_interval(days => v_product.validity_days);
    ELSE
      SELECT end_time + interval '30 minutes' INTO v_expires FROM calendar_events WHERE id = v_product.event_id;
    END IF;

    INSERT INTO ticket_passes
      (order_id, product_id, holder_name, holder_email, holder_profile_id, entries_total, expires_at, unlock_code, qr_token)
    VALUES (v_order.id, v_product.id, v_order.buyer_name, v_order.buyer_email, v_order.buyer_profile_id,
            v_product.entries, v_expires, p_unlock_code, p_qr_token)
    RETURNING * INTO v_pass;

    IF v_order.door_event_id IS NOT NULL THEN
      -- The money is taken: a refused admission must not undo the pass.
      BEGIN
        SELECT a.id INTO v_door FROM ticket_admit(
          v_pass.id, v_order.door_event_id,
          jsonb_build_array(jsonb_build_object('name', v_order.buyer_name)),
          'in_person', 'door_purchase', NULL, v_order.created_at) a;
      EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE NOT LIKE 'TK%' THEN RAISE; END IF;
        v_door_error := SQLSTATE;
      END;
    END IF;
  ELSE
    SELECT p.* INTO v_pass FROM ticket_passes p JOIN ticket_orders o ON o.id = p.order_id
    WHERE o.id = p_order_id AND o.stripe_checkout_session_id = p_session_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING ERRCODE = 'TK011'; END IF;
    SELECT id INTO v_door FROM ticket_admissions WHERE pass_id = v_pass.id AND admitted_via = 'door_purchase';
  END IF;

  RETURN jsonb_build_object('just_fulfilled', v_just, 'pass', to_jsonb(v_pass),
                            'door_admission_id', v_door, 'door_error', v_door_error);
END $$;

-- Returns the admissions it revoked, so the caller can cancel them in Zoom.
CREATE FUNCTION public.cancel_ticketed_session(p_event_id uuid, p_actor uuid)
RETURNS SETOF public.ticket_admissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.calendar_events;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM calendar_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found' USING ERRCODE = 'TK011'; END IF;
  IF v_event.source::text NOT IN ('zoom', 'portal') THEN
    RAISE EXCEPTION 'not a ticketed event' USING ERRCODE = 'TK002';
  END IF;
  IF v_event.tickets_cancelled_at IS NOT NULL THEN RETURN; END IF;

  UPDATE calendar_events SET tickets_cancelled_at = now() WHERE id = p_event_id;

  WITH extended AS (
    UPDATE ticket_passes p SET expires_at = p.expires_at + interval '7 days'
    FROM ticket_products t
    WHERE t.id = p.product_id AND t.series_key = v_event.series_key AND t.validity_days IS NOT NULL
      AND p.status = 'active' AND p.expires_at > v_event.start_time AND p.created_at < v_event.end_time
    RETURNING p.id, p.expires_at
  )
  INSERT INTO ticket_audit (actor_profile_id, action, pass_id, before, after)
  SELECT p_actor, 'session_cancelled_extend', id,
         jsonb_build_object('expires_at', expires_at - interval '7 days'),
         jsonb_build_object('expires_at', expires_at, 'event_id', p_event_id)
  FROM extended;

  RETURN QUERY
  UPDATE ticket_admissions SET status = 'revoked'
  WHERE event_id = p_event_id AND status IN ('pending_zoom', 'active')
  RETURNING *;
END $$;

-- Removes one person's data; money and attendance stay. Returns the online
-- admissions to events that have not ended, so the caller can cancel them in Zoom.
CREATE FUNCTION public.anonymise_ticket_holder(p_email text, p_actor uuid)
RETURNS SETOF public.ticket_admissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_passes uuid[];
  v_admissions uuid[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'email required' USING ERRCODE = 'TK010'; END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_passes FROM ticket_passes WHERE lower(holder_email) = v_email;
  -- In-person admissions may have no email: on the person's own passes, match by name.
  SELECT coalesce(array_agg(a.id), '{}') INTO v_admissions
  FROM ticket_admissions a JOIN ticket_passes p ON p.id = a.pass_id
  WHERE lower(a.attendee_email) = v_email
     OR (a.attendee_email IS NULL AND p.id = ANY (v_passes) AND lower(a.attendee_name) = lower(p.holder_name));

  UPDATE ticket_orders SET buyer_name = 'Deleted user', buyer_profile_id = NULL,
    buyer_email = 'deleted-' || id || '@deleted.invalid'
  WHERE lower(buyer_email) = v_email;

  UPDATE ticket_audit SET before = NULL, after = NULL
  WHERE pass_id = ANY (v_passes) OR admission_id = ANY (v_admissions);
  INSERT INTO ticket_audit (actor_profile_id, action, pass_id)
  SELECT p_actor, 'anonymise', unnest(v_passes);
  INSERT INTO ticket_audit (actor_profile_id, action, admission_id)
  SELECT p_actor, 'anonymise', unnest(v_admissions);

  UPDATE ticket_passes SET holder_name = 'Deleted user', holder_profile_id = NULL,
    holder_email = 'deleted-' || id || '@deleted.invalid', status = 'void', void_reason = 'anonymised'
  WHERE id = ANY (v_passes);

  RETURN QUERY
  WITH changed AS (
    UPDATE ticket_admissions a SET attendee_name = 'Deleted user',
      attendee_email = CASE WHEN a.attendee_email IS NULL THEN NULL ELSE 'deleted-' || a.id || '@deleted.invalid' END,
      zoom_join_link = NULL, device_token_hash = NULL,
      status = CASE WHEN e.end_time > now() AND a.attended_online_at IS NULL AND a.checked_in_at IS NULL
                    THEN 'revoked' ELSE a.status END
    FROM calendar_events e
    WHERE e.id = a.event_id AND a.id = ANY (v_admissions)
    RETURNING a.*
  )
  SELECT c.* FROM changed c JOIN calendar_events e ON e.id = c.event_id
  WHERE e.end_time > now() AND c.mode = 'online';
END $$;

-- Pass and audit row in one transaction: no free pass without a record of who gave it.
CREATE FUNCTION public.issue_complimentary_pass(
  p_product_id uuid, p_name text, p_email text, p_entries integer, p_expires_at timestamptz,
  p_actor uuid, p_unlock_code text, p_qr_token text
) RETURNS public.ticket_passes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pass public.ticket_passes;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_actor IS NULL OR coalesce(btrim(p_name), '') = '' OR coalesce(btrim(p_email), '') = ''
     OR p_entries IS NULL OR p_entries < 1 OR p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'invalid complimentary pass' USING ERRCODE = 'TK010';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ticket_products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'TK011';
  END IF;

  INSERT INTO ticket_passes (product_id, holder_name, holder_email, entries_total, expires_at, unlock_code, qr_token)
  VALUES (p_product_id, btrim(p_name), btrim(p_email), p_entries, p_expires_at, p_unlock_code, p_qr_token)
  RETURNING * INTO v_pass;
  INSERT INTO ticket_audit (actor_profile_id, action, pass_id, after)
  VALUES (p_actor, 'complimentary_pass', v_pass.id,
          to_jsonb(v_pass) - 'unlock_code' - 'qr_token');
  RETURN v_pass;
END $$;

-- Not load-bearing (Supabase re-grants EXECUTE): the in-body check is the gate.
REVOKE EXECUTE ON FUNCTION public.ticket_admit(uuid, uuid, jsonb, text, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_pass_entries(uuid, uuid, jsonb, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_free_admission(uuid, text, text, uuid, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fulfill_ticket_order(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_ticketed_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_complimentary_pass(uuid, text, text, integer, timestamptz, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.anonymise_ticket_holder(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_admit(uuid, uuid, jsonb, text, text, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_pass_entries(uuid, uuid, jsonb, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_free_admission(uuid, text, text, uuid, text, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_ticket_order(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_ticketed_session(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_complimentary_pass(uuid, text, text, integer, timestamptz, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.anonymise_ticket_holder(text, uuid) TO service_role;
