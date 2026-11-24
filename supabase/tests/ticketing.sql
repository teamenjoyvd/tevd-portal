-- 2611-DEV-775. Run by scripts/test-ticket-sql.mjs inside BEGIN ... ROLLBACK.
-- Every check raises on failure, so psql ON_ERROR_STOP is the test result.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

CREATE FUNCTION pg_temp.ok(p_label text, p_cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF;
  RAISE NOTICE 'ok %', p_label;
END $$;

-- Runs p_sql and requires it to fail with exactly p_code.
CREATE FUNCTION pg_temp.fails(p_label text, p_code text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_got text := 'no error';
BEGIN
  BEGIN EXECUTE p_sql; EXCEPTION WHEN OTHERS THEN v_got := SQLSTATE; END;
  IF v_got <> p_code THEN RAISE EXCEPTION 'FAIL: % (expected %, got %)', p_label, p_code, v_got; END IF;
  RAISE NOTICE 'ok %', p_label;
END $$;

CREATE FUNCTION pg_temp.event(p_start timestamptz, p_end timestamptz, p_series text DEFAULT 'tuesday',
  p_source text DEFAULT 'zoom', p_online int DEFAULT NULL, p_room int DEFAULT NULL) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO calendar_events (title, start_time, end_time, week_number, source, series_key, online_capacity, in_person_capacity)
  VALUES ('ticket test', p_start, p_end, 1, p_source::calendar_event_source, p_series, p_online, p_room) RETURNING id $$;

CREATE FUNCTION pg_temp.product(p_series text, p_kind text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM ticket_products WHERE series_key = p_series AND kind = p_kind $$;

CREATE FUNCTION pg_temp.pass(p_entries int DEFAULT 1, p_expires timestamptz DEFAULT now() + interval '60 days',
  p_email text DEFAULT 'holder@example.com', p_product uuid DEFAULT NULL, p_status text DEFAULT 'active') RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO ticket_passes (product_id, holder_name, holder_email, entries_total, expires_at, unlock_code, qr_token, status, created_at)
  VALUES (coalesce(p_product, pg_temp.product('tuesday', 'single')), 'Holder', p_email, p_entries, p_expires,
          gen_random_uuid()::text, gen_random_uuid()::text, p_status, now() - interval '1 day') RETURNING id $$;

CREATE FUNCTION pg_temp.redeem(p_pass uuid, p_event uuid, p_mode text DEFAULT 'in_person',
  p_who jsonb DEFAULT '[{"name":"Ann","email":"ann@example.com"}]') RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM redeem_pass_entries(p_pass, p_event, p_who, p_mode, 'code', NULL) $$;

-- now() is fixed inside the transaction, so every time below is relative to it.
CREATE TEMP TABLE f AS SELECT
  pg_temp.event(now() - interval '1 hour', now() + interval '1 hour') AS live,
  pg_temp.event(now() + interval '2 days', now() + interval '2 days 1 hour') AS future,
  pg_temp.event(now() - interval '2 hours', now() - interval '10 minutes') AS just_ended,
  pg_temp.event(now() - interval '3 hours', now() - interval '31 minutes') AS closed,
  pg_temp.event(now() - interval '1 hour', now() + interval '1 hour', 'tuesday', 'google') AS google,
  pg_temp.event(now() - interval '1 hour', now() + interval '1 hour', 'other') AS other,
  pg_temp.event(now() - interval '1 hour', now() + interval '1 hour', 'tuesday', 'zoom', 1, 1) AS small,
  pg_temp.event(now() + interval '2 days', now() + interval '2 days 1 hour', 'monday', 'zoom', 1) AS monday;

-- Redemption
SELECT pg_temp.ok('in person redeems', pg_temp.redeem(pg_temp.pass(), live) = 1) FROM f;
SELECT pg_temp.ok('in person is active and checked in', status = 'active' AND checked_in_at IS NOT NULL) FROM ticket_admissions;
DELETE FROM ticket_admissions;
SELECT pg_temp.ok('online redeems', pg_temp.redeem(pg_temp.pass(), live, 'online') = 1) FROM f;
SELECT pg_temp.ok('online is pending_zoom', status = 'pending_zoom' AND checked_in_at IS NULL) FROM ticket_admissions;
DELETE FROM ticket_admissions;

SELECT pg_temp.fails('void pass', 'TK001', format('SELECT pg_temp.redeem(%L, %L)', pg_temp.pass(p_status => 'void'), live)) FROM f;
SELECT pg_temp.fails('google event', 'TK002', format('SELECT pg_temp.redeem(%L, %L)', pg_temp.pass(), google)) FROM f;
SELECT pg_temp.fails('product does not cover event', 'TK004', format('SELECT pg_temp.redeem(%L, %L)', pg_temp.pass(), other)) FROM f;
SELECT pg_temp.fails('expired now', 'TK005', format('SELECT pg_temp.redeem(%L, %L)', pg_temp.pass(p_expires => now()), live)) FROM f;
SELECT pg_temp.fails('event starts after expiry', 'TK005', format('SELECT pg_temp.redeem(%L, %L)', pg_temp.pass(p_expires => now() + interval '1 day'), future)) FROM f;
SELECT pg_temp.fails('before the day', 'TK006', format('SELECT pg_temp.redeem(%L, %L)', pg_temp.pass(), future)) FROM f;
SELECT pg_temp.ok('door open 10 minutes after end', pg_temp.redeem(pg_temp.pass(), just_ended) = 1) FROM f;
SELECT pg_temp.fails('online closed at end', 'TK006', format('SELECT pg_temp.redeem(%L, %L, ''online'')', pg_temp.pass(), just_ended)) FROM f;
SELECT pg_temp.fails('door closed 31 minutes after end', 'TK006', format('SELECT pg_temp.redeem(%L, %L)', pg_temp.pass(), closed)) FROM f;
SELECT pg_temp.fails('over-redemption', 'TK007', format('SELECT pg_temp.redeem(%L, %L, ''in_person'', ''[{"name":"A"},{"name":"B"}]'')', pg_temp.pass(), live)) FROM f;
SELECT pg_temp.fails('same online email twice in one call', 'TK009', format('SELECT pg_temp.redeem(%L, %L, ''online'', ''[{"name":"A","email":"x@example.com"},{"name":"B","email":"X@example.com"}]'')', pg_temp.pass(2), live)) FROM f;
SELECT pg_temp.redeem(pg_temp.pass(), live, 'online', '[{"name":"A","email":"dup@example.com"}]') FROM f;
SELECT pg_temp.fails('online email already in from another pass', 'TK009', format('SELECT pg_temp.redeem(%L, %L, ''online'', ''[{"name":"B","email":"DUP@example.com"}]'')', pg_temp.pass(), live)) FROM f;
SELECT pg_temp.fails('no attendees', 'TK010', format('SELECT pg_temp.redeem(%L, %L, ''in_person'', ''[]'')', pg_temp.pass(), live)) FROM f;
SELECT pg_temp.fails('attendees not an array', 'TK010', format('SELECT pg_temp.redeem(%L, %L, ''in_person'', ''{}'')', pg_temp.pass(), live)) FROM f;
SELECT pg_temp.fails('blank name', 'TK010', format('SELECT pg_temp.redeem(%L, %L, ''in_person'', ''[{"name":" "}]'')', pg_temp.pass(), live)) FROM f;
SELECT pg_temp.fails('online without email', 'TK010', format('SELECT pg_temp.redeem(%L, %L, ''online'', ''[{"name":"A"}]'')', pg_temp.pass(), live)) FROM f;
SELECT pg_temp.fails('redeem cannot claim registration', 'TK010', format('SELECT * FROM redeem_pass_entries(%L, %L, ''[{"name":"A"}]'', ''in_person'', ''registration'', NULL)', pg_temp.pass(), future)) FROM f;
SELECT pg_temp.redeem(pg_temp.pass(), small, 'online', '[{"name":"A","email":"s1@example.com"}]') FROM f;
SELECT pg_temp.fails('online full', 'TK008', format('SELECT pg_temp.redeem(%L, %L, ''online'', ''[{"name":"B","email":"s2@example.com"}]'')', pg_temp.pass(), small)) FROM f;
SELECT pg_temp.ok('room capacity is separate', pg_temp.redeem(pg_temp.pass(), small) = 1) FROM f;
SELECT pg_temp.fails('room full', 'TK008', format('SELECT pg_temp.redeem(%L, %L)', pg_temp.pass(), small)) FROM f;

-- Free registration
SELECT pg_temp.ok('free registration days ahead', (register_free_admission(monday, 'Ann', 'ann@example.com', NULL, 'online', 'registration', NULL, 'FREE0001', 'q1')->>'created')::boolean) FROM f;
SELECT pg_temp.ok('same email returns the existing one', NOT (register_free_admission(monday, 'Ann', 'ANN@example.com', NULL, 'online', 'registration', NULL, 'FREE0002', 'q2')->>'created')::boolean) FROM f;
SELECT pg_temp.fails('free registration full', 'TK008', format('SELECT register_free_admission(%L, ''Bob'', ''bob@example.com'', NULL, ''online'', ''registration'', NULL, ''FREE0003'', ''q3'')', monday)) FROM f;
SELECT pg_temp.ok('full leaves no pass behind', NOT EXISTS (SELECT 1 FROM ticket_passes WHERE unlock_code IN ('FREE0002', 'FREE0003')));
SELECT pg_temp.fails('no free product on a paid series', 'TK004', format('SELECT register_free_admission(%L, ''Bob'', ''bob@example.com'', NULL, ''online'', ''registration'', NULL, ''FREE0004'', ''q4'')', live)) FROM f;

-- Fulfilment
CREATE FUNCTION pg_temp.ord(p_session text, p_door uuid DEFAULT NULL, p_created timestamptz DEFAULT now(), p_status text DEFAULT 'pending', p_kind text DEFAULT 'single') RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO ticket_orders (buyer_name, buyer_email, product_id, total_cents, stripe_checkout_session_id, door_event_id, created_at, status)
  VALUES ('Buyer', 'buyer@example.com', pg_temp.product('tuesday', p_kind), 500, p_session, p_door, p_created, p_status) RETURNING id $$;
CREATE TEMP TABLE o AS SELECT pg_temp.ord('s1') AS plain, pg_temp.ord('s2', p_status => 'expired') AS expired,
  pg_temp.ord('s3', live, p_kind => 'pack') AS door,
  pg_temp.ord('s4', closed, now() - interval '15 minutes') AS late,
  pg_temp.ord('s5', small) AS full_room, pg_temp.ord('s6', closed) AS too_late FROM f;
SELECT pg_temp.ok('fulfils', (fulfill_ticket_order(plain, 's1', 'c1', 'fq1')->>'just_fulfilled')::boolean) FROM o;
SELECT pg_temp.ok('second call does not fulfil and returns the same pass', r->>'just_fulfilled' = 'false' AND r->'pass'->>'unlock_code' = 'c1')
  FROM o, LATERAL fulfill_ticket_order(plain, 's1', 'c1b', 'fq1b') r;
SELECT pg_temp.fails('wrong session', 'TK011', format('SELECT fulfill_ticket_order(%L, ''nope'', ''c9'', ''fq9'')', plain)) FROM o;
SELECT pg_temp.ok('an expired order fulfils', (fulfill_ticket_order(expired, 's2', 'c2', 'fq2')->>'just_fulfilled')::boolean) FROM o;
SELECT pg_temp.ok('door purchase admits one', r->>'door_admission_id' IS NOT NULL AND r->>'door_error' IS NULL) FROM o, LATERAL fulfill_ticket_order(door, 's3', 'c3', 'fq3') r;
SELECT fulfill_ticket_order(door, 's3', 'c3b', 'fq3b') FROM o;
SELECT pg_temp.ok('door purchase uses exactly one entry', count(*) = 1) FROM ticket_admissions a JOIN ticket_passes p ON p.id = a.pass_id WHERE p.unlock_code = 'c3';
SELECT pg_temp.ok('ordered in time, paid after close, admitted', r->>'door_admission_id' IS NOT NULL) FROM o, LATERAL fulfill_ticket_order(late, 's4', 'c4', 'fq4') r;
SELECT pg_temp.ok('ordered after close: paid, not admitted', r->>'door_error' = 'TK006' AND r->'pass'->>'id' IS NOT NULL) FROM o, LATERAL fulfill_ticket_order(too_late, 's6', 'c6', 'fq6') r;
SELECT pg_temp.ok('full room still fulfils', r->>'door_error' = 'TK008' AND r->'pass'->>'id' IS NOT NULL) FROM o, LATERAL fulfill_ticket_order(full_room, 's5', 'c5', 'fq5') r;
SELECT pg_temp.ok('full room keeps the entry', NOT EXISTS (SELECT 1 FROM ticket_admissions a JOIN ticket_passes p ON p.id = a.pass_id WHERE p.unlock_code = 'c5'));

-- Cancelling a session
CREATE TEMP TABLE c AS SELECT pg_temp.event(now() - interval '1 hour', now() + interval '1 hour') AS ev,
  pg_temp.pass(p_expires => now() + interval '10 days', p_email => 'maria@example.com') AS used,
  pg_temp.pass(p_expires => now() - interval '2 hours', p_email => 'old@example.com') AS lapsed,
  pg_temp.pass(p_expires => now() + interval '10 days', p_product => pg_temp.product('monday', 'free_registration')) AS free;
SELECT pg_temp.redeem(used, ev, 'online', '[{"name":"Maria","email":"maria@example.com"}]') FROM c;
SELECT pg_temp.ok('cancel returns the revoked admission', count(*) = 1 AND bool_and(status = 'revoked')) FROM c, LATERAL cancel_ticketed_session(ev, NULL);
SELECT pg_temp.ok('expiry moves 7 days', expires_at = now() + interval '17 days') FROM ticket_passes, c WHERE id = used;
SELECT pg_temp.ok('lapsed pass is not extended', expires_at = now() - interval '2 hours') FROM ticket_passes, c WHERE id = lapsed;
SELECT pg_temp.ok('free pass is not extended', expires_at = now() + interval '10 days') FROM ticket_passes, c WHERE id = free;
SELECT pg_temp.ok('second cancel does nothing', count(*) = 0) FROM c, LATERAL cancel_ticketed_session(ev, NULL);
SELECT pg_temp.ok('still 7 days', expires_at = now() + interval '17 days') FROM ticket_passes, c WHERE id = used;
SELECT pg_temp.ok('the entry came back', pg_temp.redeem(used, live, 'online', '[{"name":"Maria","email":"maria@example.com"}]') = 1) FROM c, f;
SELECT pg_temp.fails('cancelled session refuses entry', 'TK003', format('SELECT pg_temp.redeem(%L, %L)', pg_temp.pass(), ev)) FROM c;

-- Anonymising
INSERT INTO ticket_orders (buyer_name, buyer_email, product_id, total_cents) SELECT 'Maria Ivanova', 'Maria@example.com', pg_temp.product('tuesday', 'single'), 500;
INSERT INTO ticket_audit (action, pass_id, before) SELECT 'correct_email', used, '{"holder_email":"maria@example.com"}' FROM c;
CREATE TEMP TABLE totals AS SELECT (SELECT sum(total_cents) FROM ticket_orders) AS cents, (SELECT count(*) FROM ticket_admissions) AS n;
SELECT pg_temp.ok('live online admissions are handed back for Zoom', count(*) >= 1) FROM anonymise_ticket_holder(' MARIA@example.com ', NULL);
SELECT pg_temp.ok('no trace in orders, passes, admissions or audit', NOT EXISTS (
  SELECT 1 FROM (SELECT to_jsonb(t)::text j FROM ticket_orders t UNION ALL SELECT to_jsonb(t)::text FROM ticket_passes t
    UNION ALL SELECT to_jsonb(t)::text FROM ticket_admissions t UNION ALL SELECT to_jsonb(t)::text FROM ticket_audit t) x WHERE j ILIKE '%maria%'));
SELECT pg_temp.ok('money and attendance are unchanged', cents = (SELECT sum(total_cents) FROM ticket_orders) AND n = (SELECT count(*) FROM ticket_admissions)) FROM totals;
SELECT pg_temp.ok('their pass is void', status = 'void') FROM ticket_passes, c WHERE id = used;
SELECT pg_temp.ok('other people are untouched', EXISTS (SELECT 1 FROM ticket_passes WHERE holder_email = 'holder@example.com' AND status = 'active'));

-- Complimentary passes
INSERT INTO profiles (id, clerk_id, first_name, last_name, role) VALUES ('00000000-0000-4000-8000-000000000775', 'ticket_test', 'T', 'T', 'admin');
SELECT pg_temp.ok('complimentary pass', (issue_complimentary_pass(pg_temp.product('tuesday', 'single'), 'Guest', 'g@example.com', 2, now() + interval '1 day', '00000000-0000-4000-8000-000000000775', 'COMP0001', 'cq1')).entries_total = 2);
SELECT pg_temp.ok('audited, without the codes', count(*) = 1 AND bool_and(a.after::text NOT LIKE '%COMP0001%')) FROM ticket_audit a JOIN ticket_passes p ON p.id = a.pass_id WHERE p.unlock_code = 'COMP0001' AND a.action = 'complimentary_pass' AND a.actor_profile_id IS NOT NULL;
SELECT pg_temp.fails('complimentary needs an actor', 'TK010', format('SELECT issue_complimentary_pass(%L, ''G'', ''g@example.com'', 1, now() + interval ''1 day'', NULL, ''COMP0002'', ''cq2'')', pg_temp.product('tuesday', 'single')));
SELECT pg_temp.fails('complimentary cannot be already expired', 'TK010', format('SELECT issue_complimentary_pass(%L, ''G'', ''g@example.com'', 1, now(), ''00000000-0000-4000-8000-000000000775'', ''COMP0003'', ''cq3'')', pg_temp.product('tuesday', 'single')));

-- Access: re-grant EXECUTE first, because Supabase does. The body check must hold alone.
GRANT EXECUTE ON FUNCTION ticket_admit(uuid, uuid, jsonb, text, text, uuid, timestamptz), redeem_pass_entries(uuid, uuid, jsonb, text, text, uuid),
  register_free_admission(uuid, text, text, uuid, text, text, uuid, text, text), fulfill_ticket_order(uuid, text, text, text),
  cancel_ticketed_session(uuid, uuid), anonymise_ticket_holder(text, uuid),
  issue_complimentary_pass(uuid, text, text, integer, timestamptz, uuid, text, text) TO anon, authenticated;
CREATE FUNCTION pg_temp.refused(p_role text, p_claims text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_sql text; v_table text; v_n int; v_got text;
BEGIN
  PERFORM set_config('request.jwt.claims', p_claims, true);
  FOREACH v_sql IN ARRAY ARRAY[
    'SELECT * FROM ticket_admit(gen_random_uuid(), gen_random_uuid(), ''[]'', ''online'', ''code'', NULL, now())',
    'SELECT * FROM redeem_pass_entries(gen_random_uuid(), gen_random_uuid(), ''[]'', ''online'', ''code'', NULL)',
    'SELECT register_free_admission(gen_random_uuid(), ''a'', ''a'', NULL, ''online'', ''registration'', NULL, ''a'', ''a'')',
    'SELECT fulfill_ticket_order(gen_random_uuid(), ''a'', ''a'', ''a'')',
    'SELECT * FROM cancel_ticketed_session(gen_random_uuid(), NULL)',
    'SELECT * FROM anonymise_ticket_holder(''a'', NULL)',
    'SELECT issue_complimentary_pass(gen_random_uuid(), ''a'', ''a'', 1, now(), NULL, ''a'', ''a'')'] LOOP
    v_got := 'no error';
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', p_role);
      EXECUTE v_sql;
    EXCEPTION WHEN OTHERS THEN v_got := SQLERRM; END;
    EXECUTE 'RESET ROLE';
    IF v_got <> 'Unauthorized' THEN RAISE EXCEPTION 'FAIL: % got "%" from %', p_role, v_got, v_sql; END IF;
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY['ticket_products','ticket_orders','stripe_events','ticket_passes','ticket_admissions','ticket_audit'] LOOP
    v_n := 0;
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', p_role);
      EXECUTE format('SELECT count(*) FROM %I', v_table) INTO v_n;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    EXECUTE 'RESET ROLE';
    IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL: % reads %', p_role, v_table; END IF;
  END LOOP;
  RAISE NOTICE 'ok % % is refused everywhere', p_role, p_claims;
END $$;
SELECT pg_temp.refused('anon', '');
SELECT pg_temp.refused('anon', '{"role":"anon"}');
SELECT pg_temp.refused('authenticated', '{"role":"authenticated","user_role":"admin"}');
