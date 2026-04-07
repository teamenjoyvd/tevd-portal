-- ============================================================
-- BASELINE: tevd-portal full schema snapshot
-- Generated: 2026-04-07 from prod ynykjpnetfwqzdnsgkkg
-- Folds all pre-tracked history (20260315–20260319) into a single
-- idempotent baseline. The 18 tracked migrations in this directory
-- chain on top of this via registered version stamps.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- ── ENUM TYPES ───────────────────────────────────────────────

CREATE TYPE public.user_role AS ENUM ('admin', 'core', 'member', 'guest');
CREATE TYPE public.document_type AS ENUM ('id', 'passport');
CREATE TYPE public.event_category AS ENUM ('N21', 'Personal');
CREATE TYPE public.event_type AS ENUM ('in-person', 'online', 'hybrid');
CREATE TYPE public.notification_type AS ENUM ('role_request', 'trip_request', 'trip_created', 'event_fetched', 'doc_expiry', 'los_digest');
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'denied');

-- ── TABLES ───────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id                    uuid          NOT NULL DEFAULT uuid_generate_v4(),
  clerk_id              text          NOT NULL,
  abo_number            text          NULL,
  role                  public.user_role NOT NULL DEFAULT 'guest',
  first_name            text          NOT NULL,
  last_name             text          NOT NULL,
  display_names         jsonb         NOT NULL DEFAULT '{}',
  document_active_type  public.document_type NOT NULL DEFAULT 'id',
  id_number             text          NULL,
  passport_number       text          NULL,
  valid_through         date          NULL,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  ical_token            text          NULL,
  phone                 text          NULL,
  contact_email         text          NULL,
  upline_abo_number     text          NULL,
  ui_prefs              jsonb         NOT NULL DEFAULT '{}',
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_abo_number_key UNIQUE (abo_number),
  CONSTRAINT profiles_clerk_id_key UNIQUE (clerk_id)
);

CREATE TABLE public.trips (
  id                uuid          NOT NULL DEFAULT uuid_generate_v4(),
  title             text          NOT NULL,
  destination       text          NOT NULL,
  description       text          NOT NULL DEFAULT '',
  image_url         text          NULL,
  start_date        date          NOT NULL,
  end_date          date          NOT NULL,
  currency          text          NOT NULL DEFAULT 'EUR',
  total_cost        numeric       NOT NULL DEFAULT 0,
  milestones        jsonb         NOT NULL DEFAULT '[]',
  created_at        timestamptz   NOT NULL DEFAULT now(),
  visibility_roles  text[]        NOT NULL DEFAULT '{guest,member,core,admin}',
  location          text          NULL,
  accommodation_type text         NULL,
  inclusions        text[]        NOT NULL DEFAULT '{}',
  trip_type         text          NULL,
  CONSTRAINT trips_pkey PRIMARY KEY (id)
);

CREATE TABLE public.trip_registrations (
  id           uuid                      NOT NULL DEFAULT uuid_generate_v4(),
  trip_id      uuid                      NOT NULL,
  profile_id   uuid                      NOT NULL,
  status       public.registration_status NOT NULL DEFAULT 'pending',
  created_at   timestamptz               NOT NULL DEFAULT now(),
  cancelled_at timestamptz               NULL,
  cancelled_by uuid                      NULL,
  CONSTRAINT trip_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT trip_registrations_trip_id_profile_id_key UNIQUE (trip_id, profile_id),
  CONSTRAINT trip_registrations_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id),
  CONSTRAINT trip_registrations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT trip_registrations_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.los_members (
  abo_number            text      NOT NULL,
  sponsor_abo_number    text      NULL,
  abo_level             text      NULL,
  country               text      NULL,
  name                  text      NULL,
  entry_date            date      NULL,
  phone                 text      NULL,
  email                 text      NULL,
  address               text      NULL,
  renewal_date          date      NULL,
  gpv                   numeric   NULL DEFAULT 0,
  ppv                   numeric   NULL DEFAULT 0,
  bonus_percent         numeric   NULL DEFAULT 0,
  gbv                   numeric   NULL DEFAULT 0,
  customer_pv           numeric   NULL DEFAULT 0,
  ruby_pv               numeric   NULL DEFAULT 0,
  customers             integer   NULL DEFAULT 0,
  points_to_next_level  numeric   NULL DEFAULT 0,
  qualified_legs        integer   NULL DEFAULT 0,
  group_size            integer   NULL DEFAULT 0,
  personal_order_count  integer   NULL DEFAULT 0,
  group_orders_count    integer   NULL DEFAULT 0,
  sponsoring            integer   NULL DEFAULT 0,
  annual_ppv            numeric   NULL DEFAULT 0,
  last_synced_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT los_members_pkey PRIMARY KEY (abo_number)
);

CREATE TABLE public.tree_nodes (
  id         uuid    NOT NULL DEFAULT uuid_generate_v4(),
  profile_id uuid    NOT NULL,
  parent_id  uuid    NULL,
  path       ltree   NOT NULL,
  depth      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tree_nodes_pkey PRIMARY KEY (id),
  CONSTRAINT tree_nodes_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT tree_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.tree_nodes(id)
);
CREATE UNIQUE INDEX tree_nodes_profile_id_idx ON public.tree_nodes (profile_id);
CREATE INDEX tree_nodes_path_gist_idx ON public.tree_nodes USING gist (path);

CREATE TABLE public.calendar_events (
  id              uuid                   NOT NULL DEFAULT uuid_generate_v4(),
  google_event_id text                   NULL,
  title           text                   NOT NULL,
  description     text                   NULL,
  start_time      timestamptz            NOT NULL,
  end_time        timestamptz            NOT NULL,
  category        public.event_category  NOT NULL DEFAULT 'N21',
  visibility_roles public.user_role[]   NOT NULL DEFAULT ARRAY['admin'::user_role,'core'::user_role,'member'::user_role,'guest'::user_role],
  week_number     integer                NOT NULL,
  created_at      timestamptz            NOT NULL DEFAULT now(),
  event_type      public.event_type      NULL,
  created_by      uuid                   NULL,
  meeting_url     text                   NULL,
  CONSTRAINT calendar_events_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_events_google_event_id_key UNIQUE (google_event_id),
  CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.event_role_requests (
  id         uuid                       NOT NULL DEFAULT uuid_generate_v4(),
  event_id   uuid                       NOT NULL,
  profile_id uuid                       NOT NULL,
  role_label text                       NOT NULL,
  status     public.registration_status NOT NULL DEFAULT 'pending',
  created_at timestamptz                NOT NULL DEFAULT now(),
  note       text                       NULL,
  CONSTRAINT event_role_requests_pkey PRIMARY KEY (id),
  CONSTRAINT event_role_requests_event_id_profile_id_key UNIQUE (event_id, profile_id),
  CONSTRAINT event_role_requests_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id),
  CONSTRAINT event_role_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.notifications (
  id         uuid                     NOT NULL DEFAULT uuid_generate_v4(),
  profile_id uuid                     NOT NULL,
  is_read    boolean                  NOT NULL DEFAULT false,
  type       public.notification_type NOT NULL,
  title      text                     NOT NULL,
  message    text                     NOT NULL,
  action_url text                     NULL,
  created_at timestamptz              NOT NULL DEFAULT now(),
  deleted_at timestamptz              NULL,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.announcements (
  id          uuid          NOT NULL DEFAULT uuid_generate_v4(),
  titles      jsonb         NOT NULL DEFAULT '{}',
  contents    jsonb         NOT NULL DEFAULT '{}',
  access_level public.user_role[] NOT NULL DEFAULT ARRAY['member'::user_role,'core'::user_role,'admin'::user_role],
  is_active   boolean       NOT NULL DEFAULT true,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  sort_order  integer       NOT NULL DEFAULT 0,
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

CREATE TABLE public.home_settings (
  id                       uuid        NOT NULL DEFAULT uuid_generate_v4(),
  show_caret_1             boolean     NOT NULL DEFAULT true,
  show_caret_2             boolean     NOT NULL DEFAULT true,
  show_caret_3             boolean     NOT NULL DEFAULT true,
  caret_1_text             text        NOT NULL DEFAULT '',
  caret_2_text             text        NOT NULL DEFAULT '',
  caret_3_text             text        NOT NULL DEFAULT '',
  featured_announcement_id uuid        NULL,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_settings_pkey PRIMARY KEY (id),
  CONSTRAINT home_settings_featured_announcement_id_fkey FOREIGN KEY (featured_announcement_id) REFERENCES public.announcements(id)
);

CREATE TABLE public.bento_config (
  tile_key   text        NOT NULL,
  max_items  integer     NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bento_config_pkey PRIMARY KEY (tile_key)
);

CREATE TABLE public.guides (
  id              uuid    NOT NULL DEFAULT gen_random_uuid(),
  slug            text    NOT NULL,
  title           jsonb   NOT NULL DEFAULT '{"bg": "", "en": ""}',
  cover_image_url text    NULL,
  emoji           text    NULL,
  body            jsonb   NOT NULL DEFAULT '[]',
  access_roles    text[]  NOT NULL DEFAULT '{guest,member,core,admin}',
  is_published    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  sort_order      integer NOT NULL DEFAULT 0,
  CONSTRAINT howtos_pkey PRIMARY KEY (id),
  CONSTRAINT howtos_slug_key UNIQUE (slug)
);

CREATE TABLE public.links (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  label        jsonb       NOT NULL DEFAULT '{"bg": "", "en": ""}',
  url          text        NOT NULL,
  access_roles text[]      NOT NULL DEFAULT '{guest,member,core,admin}',
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT links_pkey PRIMARY KEY (id)
);

CREATE TABLE public.social_posts (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  platform      text        NOT NULL,
  post_url      text        NOT NULL,
  caption       text        NULL,
  thumbnail_url text        NULL,
  is_visible    boolean     NOT NULL DEFAULT true,
  is_pinned     boolean     NOT NULL DEFAULT false,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_posts_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_social_posts_pinned ON public.social_posts (is_pinned) WHERE (is_pinned = true);

CREATE TABLE public.vital_sign_definitions (
  id         uuid    NOT NULL DEFAULT gen_random_uuid(),
  category   text    NOT NULL,
  label      text    NULL,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vital_sign_definitions_pkey PRIMARY KEY (id),
  CONSTRAINT vital_sign_definitions_category_unique UNIQUE (category)
);

CREATE TABLE public.member_vital_signs (
  id            uuid    NOT NULL DEFAULT gen_random_uuid(),
  profile_id    uuid    NOT NULL,
  definition_id uuid    NOT NULL,
  recorded_at   date    NOT NULL DEFAULT CURRENT_DATE,
  recorded_by   uuid    NOT NULL,
  note          text    NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_vital_signs_pkey PRIMARY KEY (id),
  CONSTRAINT member_vital_signs_unique UNIQUE (profile_id, definition_id),
  CONSTRAINT member_vital_signs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT member_vital_signs_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.vital_sign_definitions(id),
  CONSTRAINT member_vital_signs_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.abo_verification_requests (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  profile_id        uuid        NOT NULL,
  claimed_abo       text        NULL,
  claimed_upline_abo text       NOT NULL,
  status            text        NOT NULL DEFAULT 'pending',
  admin_note        text        NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz NULL,
  request_type      text        NOT NULL DEFAULT 'standard',
  CONSTRAINT abo_verification_requests_pkey PRIMARY KEY (id),
  CONSTRAINT abo_verification_requests_profile_id_key UNIQUE (profile_id),
  CONSTRAINT abo_verification_requests_request_type_check CHECK (request_type IN ('standard', 'manual')),
  CONSTRAINT abo_verification_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.payable_items (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  description    text        NULL,
  amount         numeric     NOT NULL,
  currency       text        NOT NULL DEFAULT 'EUR',
  item_type      text        NOT NULL,
  linked_trip_id uuid        NULL,
  is_active      boolean     NOT NULL DEFAULT true,
  created_by     uuid        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  properties     jsonb       NOT NULL DEFAULT '{}',
  CONSTRAINT payable_items_pkey PRIMARY KEY (id),
  CONSTRAINT payable_items_linked_trip_id_fkey FOREIGN KEY (linked_trip_id) REFERENCES public.trips(id),
  CONSTRAINT payable_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.payments (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  profile_id           uuid        NOT NULL,
  payable_item_id      uuid        NULL,
  amount               numeric     NOT NULL,
  transaction_date     date        NOT NULL,
  payment_method       text        NULL,
  proof_url            text        NULL,
  note                 text        NULL,
  admin_note           text        NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  trip_id              uuid        NULL,
  currency             text        NOT NULL DEFAULT 'EUR',
  logged_by_admin      uuid        NULL,
  properties           jsonb       NOT NULL DEFAULT '{}',
  admin_status         text        NOT NULL DEFAULT 'pending',
  member_status        text        NOT NULL DEFAULT 'pending',
  admin_reject_reason  text        NULL,
  member_reject_reason text        NULL,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT payments_logged_by_admin_fkey FOREIGN KEY (logged_by_admin) REFERENCES public.profiles(id),
  CONSTRAINT payments_payable_item_id_fkey FOREIGN KEY (payable_item_id) REFERENCES public.payable_items(id),
  CONSTRAINT payments_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id)
);

CREATE TABLE public.role_change_audit (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  profile_id  uuid        NOT NULL,
  changed_by  text        NOT NULL,
  old_role    public.user_role NOT NULL,
  new_role    public.user_role NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  note        text        NULL,
  CONSTRAINT role_change_audit_pkey PRIMARY KEY (id),
  CONSTRAINT role_change_audit_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.trip_attachments (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  trip_id    uuid        NOT NULL,
  file_url   text        NOT NULL,
  file_name  text        NOT NULL,
  file_type  text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid        NOT NULL,
  CONSTRAINT trip_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT trip_attachments_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id),
  CONSTRAINT trip_attachments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- ── HELPER FUNCTIONS (Pattern A) ────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_clerk_id()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'user_id';
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'user_role')::public.user_role,
    'guest'::public.user_role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM public.profiles
  WHERE clerk_id = public.get_my_clerk_id()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.get_my_role() = 'admin';
$$;

-- ── BUSINESS FUNCTIONS ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.abo_to_ltree_label(abo text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT regexp_replace(abo, '[^a-zA-Z0-9]', '_', 'g');
$$;

CREATE OR REPLACE FUNCTION public.upsert_tree_node(
  p_profile_id         uuid,
  p_abo_number         text,
  p_sponsor_abo_number text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
declare
  v_parent_id      uuid;
  v_parent_path    ltree;
  v_path           ltree;
  v_depth          integer;
  v_label          text;
  v_had_placeholder boolean;
begin
  if p_abo_number is null then
    v_label     := 'p_' || replace(p_profile_id::text, '-', '');
    v_path      := v_label::ltree;
    v_depth     := 0;
    v_parent_id := null;
    insert into public.tree_nodes (profile_id, parent_id, path, depth)
    values (p_profile_id, v_parent_id, v_path, v_depth)
    on conflict (profile_id) do update set
      parent_id = excluded.parent_id,
      path      = excluded.path,
      depth     = excluded.depth;
    return;
  end if;

  select (path::text like 'p_%')
  into   v_had_placeholder
  from   public.tree_nodes
  where  profile_id = p_profile_id
  limit  1;

  v_label := public.abo_to_ltree_label(p_abo_number);

  if p_sponsor_abo_number is null then
    v_path      := v_label::ltree;
    v_depth     := 0;
    v_parent_id := null;
  else
    select tn.id, tn.path, tn.depth
    into   v_parent_id, v_parent_path, v_depth
    from   public.tree_nodes tn
    join   public.profiles p on p.id = tn.profile_id
    where  p.abo_number = p_sponsor_abo_number
    limit  1;

    if v_parent_id is null then
      v_path  := v_label::ltree;
      v_depth := 0;
    else
      v_path  := v_parent_path || v_label::ltree;
      v_depth := v_depth + 1;
    end if;
  end if;

  insert into public.tree_nodes (profile_id, parent_id, path, depth)
  values (p_profile_id, v_parent_id, v_path, v_depth)
  on conflict (profile_id) do update set
    parent_id = excluded.parent_id,
    path      = excluded.path,
    depth     = excluded.depth;

  if v_had_placeholder is true then
    perform public.rebuild_tree_paths();
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_tree_paths()
RETURNS void LANGUAGE plpgsql AS $$
declare
  r record;
begin
  for i in 1..10 loop
    for r in
      select p.id as profile_id, p.abo_number, lm.sponsor_abo_number
      from public.profiles p
      join public.los_members lm on lm.abo_number = p.abo_number
      where p.abo_number is not null
      order by lm.sponsor_abo_number nulls first
    loop
      perform public.upsert_tree_node(r.profile_id, r.abo_number, r.sponsor_abo_number);
    end loop;
  end loop;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_core_ancestors(p_profile_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id
  FROM tree_nodes tn_self
  JOIN tree_nodes tn_anc
    ON tn_anc.path @> tn_self.path
   AND tn_anc.path::text != tn_self.path::text
  JOIN profiles p ON p.id = tn_anc.profile_id
  WHERE tn_self.profile_id = p_profile_id
    AND p.role = 'core';
$$;

CREATE OR REPLACE FUNCTION public.get_los_members_with_profiles()
RETURNS TABLE(
  abo_number text, sponsor_abo_number text, abo_level text, name text,
  country text, gpv numeric, ppv numeric, bonus_percent numeric,
  group_size integer, qualified_legs integer, annual_ppv numeric,
  renewal_date date, last_synced_at timestamptz,
  profile_id uuid, first_name text, last_name text, role text, depth integer
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT m.abo_number, m.sponsor_abo_number, m.abo_level, m.name, m.country,
    m.gpv, m.ppv, m.bonus_percent, m.group_size, m.qualified_legs,
    m.annual_ppv, m.renewal_date, m.last_synced_at,
    p.id, p.first_name, p.last_name, p.role::text, t.depth
  FROM public.los_members m
  LEFT JOIN public.profiles p ON p.abo_number = m.abo_number
  LEFT JOIN public.tree_nodes t ON t.profile_id = p.id
  ORDER BY m.abo_level::integer, m.abo_number;
$$;

CREATE OR REPLACE FUNCTION public.import_los_members(rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  r              jsonb;
  v_inserted     integer := 0;
  v_errors       jsonb   := '[]'::jsonb;
  v_entry_date   date;
  v_renewal_date date;
begin
  for r in select * from jsonb_array_elements(rows)
  loop
    begin
      v_entry_date := case
        when nullif(r->>'entry_date', '') is null then null
        when r->>'entry_date' ~ '^\d{4}-\d{2}-\d{2}$' then (r->>'entry_date')::date
        else null
      end;
      v_renewal_date := case
        when nullif(r->>'renewal_date', '') is null then null
        when r->>'renewal_date' ~ '^\d{4}-\d{2}-\d{2}$' then (r->>'renewal_date')::date
        else null
      end;
      insert into public.los_members (
        abo_number, sponsor_abo_number, abo_level, country, name,
        entry_date, phone, email, address, renewal_date,
        gpv, ppv, bonus_percent, gbv, customer_pv, ruby_pv,
        customers, points_to_next_level, qualified_legs, group_size,
        personal_order_count, group_orders_count, sponsoring,
        annual_ppv, last_synced_at
      ) values (
        r->>'abo_number', nullif(r->>'sponsor_abo_number', ''), r->>'abo_level',
        r->>'country', r->>'name', v_entry_date, r->>'phone', r->>'email',
        r->>'address', v_renewal_date,
        coalesce(nullif(r->>'gpv','')::numeric,0),
        coalesce(nullif(r->>'ppv','')::numeric,0),
        coalesce(nullif(r->>'bonus_percent','')::numeric,0),
        coalesce(nullif(r->>'gbv','')::numeric,0),
        coalesce(nullif(r->>'customer_pv','')::numeric,0),
        coalesce(nullif(r->>'ruby_pv','')::numeric,0),
        coalesce(nullif(r->>'customers','')::integer,0),
        coalesce(nullif(r->>'points_to_next_level','')::numeric,0),
        coalesce(nullif(r->>'qualified_legs','')::integer,0),
        coalesce(nullif(r->>'group_size','')::integer,0),
        coalesce(nullif(r->>'personal_order_count','')::integer,0),
        coalesce(nullif(r->>'group_orders_count','')::integer,0),
        coalesce(nullif(r->>'sponsoring','')::integer,0),
        coalesce(nullif(r->>'annual_ppv','')::numeric,0),
        now()
      )
      on conflict (abo_number) do update set
        sponsor_abo_number=excluded.sponsor_abo_number,abo_level=excluded.abo_level,
        country=excluded.country,name=excluded.name,entry_date=excluded.entry_date,
        phone=excluded.phone,email=excluded.email,address=excluded.address,
        renewal_date=excluded.renewal_date,gpv=excluded.gpv,ppv=excluded.ppv,
        bonus_percent=excluded.bonus_percent,gbv=excluded.gbv,
        customer_pv=excluded.customer_pv,ruby_pv=excluded.ruby_pv,
        customers=excluded.customers,points_to_next_level=excluded.points_to_next_level,
        qualified_legs=excluded.qualified_legs,group_size=excluded.group_size,
        personal_order_count=excluded.personal_order_count,
        group_orders_count=excluded.group_orders_count,
        sponsoring=excluded.sponsoring,annual_ppv=excluded.annual_ppv,
        last_synced_at=now();
      v_inserted := v_inserted + 1;
    exception when others then
      v_errors := v_errors || jsonb_build_object('abo_number',r->>'abo_number','error',sqlerrm);
    end;
  end loop;
  return jsonb_build_object('inserted',v_inserted,'errors',v_errors);
end;
$$;

CREATE OR REPLACE FUNCTION public.get_trip_team_attendees(p_trip_id uuid, p_viewer_profile uuid)
RETURNS TABLE(profile_id uuid, first_name text, last_name text, role text, abo_number text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT pr.id, pr.first_name, pr.last_name, pr.role::text, pr.abo_number
  FROM profiles pr
  JOIN tree_nodes tn ON tn.profile_id = pr.id
  WHERE tn.path <@ (SELECT path FROM tree_nodes WHERE profile_id = p_viewer_profile LIMIT 1)
    AND pr.id != p_viewer_profile
    AND pr.id IN (
      SELECT profile_id FROM trip_registrations
      WHERE trip_id = p_trip_id AND status = 'approved' AND cancelled_at IS NULL
    )
  ORDER BY pr.first_name, pr.last_name;
$$;

CREATE OR REPLACE FUNCTION public.vault_read_secrets()
RETURNS TABLE(name text, secret text) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT name, decrypted_secret AS secret
  FROM vault.decrypted_secrets
  WHERE name IN ('google_service_account', 'google_calendar_id', 'sync_secret');
$$;

CREATE OR REPLACE FUNCTION public.pin_social_post(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE social_posts SET is_pinned = false WHERE is_pinned = true AND id != p_id;
  UPDATE social_posts SET is_pinned = true WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_los_digest()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_core       RECORD;
  v_trip_count int;
  v_doc_count  int;
  v_message    text;
BEGIN
  FOR v_core IN
    SELECT id, abo_number FROM public.profiles
    WHERE role = 'core' AND abo_number IS NOT NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE profile_id = v_core.id AND type = 'los_digest'
        AND created_at >= current_date AND deleted_at IS NULL
    ) THEN CONTINUE; END IF;

    SELECT COUNT(*)::int INTO v_trip_count
    FROM public.notifications n
    JOIN public.profiles p ON p.id = n.profile_id
    JOIN public.los_members lm ON lm.abo_number = p.abo_number
    WHERE lm.sponsor_abo_number = v_core.abo_number
      AND n.type = 'trip_request'
      AND n.created_at >= now() - interval '24 hours'
      AND n.deleted_at IS NULL;

    SELECT COUNT(*)::int INTO v_doc_count
    FROM public.profiles p
    JOIN public.los_members lm ON lm.abo_number = p.abo_number
    WHERE lm.sponsor_abo_number = v_core.abo_number
      AND p.valid_through IS NOT NULL
      AND p.valid_through < (current_date + interval '30 days');

    IF v_trip_count > 0 OR v_doc_count > 0 THEN
      v_message := '';
      IF v_trip_count > 0 THEN
        v_message := v_trip_count::text || ' trip request' ||
          CASE WHEN v_trip_count > 1 THEN 's' ELSE '' END || ' updated in your direct downline.';
      END IF;
      IF v_doc_count > 0 THEN
        IF v_message != '' THEN v_message := v_message || ' '; END IF;
        v_message := v_message || v_doc_count::text || ' member' ||
          CASE WHEN v_doc_count > 1 THEN 's' ELSE '' END ||
          ' in your direct downline ' ||
          CASE WHEN v_doc_count > 1 THEN 'have' ELSE 'has' END || ' expiring documents.';
      END IF;
      INSERT INTO public.notifications (profile_id, type, title, message, action_url)
      VALUES (v_core.id, 'los_digest', 'Daily LOS summary', v_message, '/los');
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_member_verification(
  p_request_id uuid, p_admin_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_req public.abo_verification_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.abo_verification_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request % not found', p_request_id;
  END IF;
  IF v_req.request_type = 'manual' THEN
    UPDATE public.profiles SET role='member', upline_abo_number=v_req.claimed_upline_abo
    WHERE id = v_req.profile_id;
  ELSE
    UPDATE public.profiles SET role='member', abo_number=v_req.claimed_abo
    WHERE id = v_req.profile_id;
  END IF;
  UPDATE public.abo_verification_requests
  SET status='approved', resolved_at=now(), admin_note=p_admin_note
  WHERE id = p_request_id;
  PERFORM public.upsert_tree_node(
    p_profile_id         => v_req.profile_id,
    p_abo_number         => v_req.claimed_abo,
    p_sponsor_abo_number => v_req.claimed_upline_abo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.patch_member_role(
  p_profile_id uuid, p_new_role user_role,
  p_changed_by text, p_note text DEFAULT NULL
)
RETURNS SETOF profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_old_role user_role;
BEGIN
  SELECT role INTO v_old_role FROM profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found: %', p_profile_id; END IF;
  UPDATE profiles SET role = p_new_role WHERE id = p_profile_id;
  INSERT INTO role_change_audit (profile_id, changed_by, old_role, new_role, note)
  VALUES (p_profile_id, p_changed_by, v_old_role, p_new_role, p_note);
  RETURN QUERY SELECT * FROM profiles WHERE id = p_profile_id;
END;
$$;

-- ── TRIGGER FUNCTIONS ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  insert into public.notifications (profile_id, type, title, message, action_url)
  select p.id, 'trip_created', 'New trip available',
    NEW.title || ' — ' || NEW.destination || ' is now open for registration.', '/trips'
  from public.profiles p where p.role in ('member','core','admin');
  return NEW;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_trip_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_trip_title text;
  v_member_name text;
begin
  select title into v_trip_title from public.trips where id = NEW.trip_id;
  select first_name || ' ' || last_name into v_member_name from public.profiles where id = NEW.profile_id;
  insert into public.notifications (profile_id, type, title, message, action_url)
  select p.id, 'trip_request', 'New trip request',
    v_member_name || ' requested to join ' || v_trip_title, '/admin/approval-hub'
  from public.profiles p where p.role = 'admin';
  return NEW;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_registration_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_trip_title text;
begin
  if OLD.status = NEW.status then return NEW; end if;
  select title into v_trip_title from public.trips where id = NEW.trip_id;
  insert into public.notifications (profile_id, type, title, message, action_url)
  values (
    NEW.profile_id, 'trip_request',
    case NEW.status when 'approved' then 'Trip request approved'
      when 'denied' then 'Trip request denied' else 'Trip request updated' end,
    case NEW.status when 'approved' then 'Your request to join ' || v_trip_title || ' has been approved.'
      when 'denied' then 'Your request to join ' || v_trip_title || ' has been declined.'
      else 'Your request for ' || v_trip_title || ' has been updated.' end,
    '/trips'
  );
  return NEW;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_role_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_event_title text;
  v_member_name text;
begin
  select title into v_event_title from public.calendar_events where id = NEW.event_id;
  select first_name || ' ' || last_name into v_member_name from public.profiles where id = NEW.profile_id;
  insert into public.notifications (profile_id, type, title, message, action_url)
  select p.id, 'role_request', 'New role request',
    v_member_name || ' requested ' || NEW.role_label || ' for ' || v_event_title, '/admin/approval-hub'
  from public.profiles p where p.role = 'admin';
  insert into public.notifications (profile_id, type, title, message, action_url)
  select anc_id, 'role_request', 'Role request in your network',
    v_member_name || ' requested ' || NEW.role_label || ' for ' || v_event_title, '/admin/approval-hub'
  from get_core_ancestors(NEW.profile_id) AS anc_id;
  return NEW;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_role_request_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_event_title text;
begin
  if OLD.status = NEW.status then return NEW; end if;
  select title into v_event_title from public.calendar_events where id = NEW.event_id;
  insert into public.notifications (profile_id, type, title, message, action_url)
  values (
    NEW.profile_id, 'role_request',
    case NEW.status when 'approved' then 'Role request approved'
      when 'denied' then 'Role request declined' else 'Role request updated' end,
    case NEW.status when 'approved' then 'Your ' || NEW.role_label || ' request for ' || v_event_title || ' has been approved.'
      when 'denied' then 'Your ' || NEW.role_label || ' request for ' || v_event_title || ' has been declined.'
      else 'Your role request for ' || v_event_title || ' has been updated.' end,
    '/calendar'
  );
  return NEW;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_doc_expiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  if NEW.valid_through is null then return NEW; end if;
  if OLD.valid_through = NEW.valid_through then return NEW; end if;
  if NEW.valid_through <= (current_date + interval '6 months') then
    insert into public.notifications (profile_id, type, title, message, action_url)
    values (NEW.id, 'doc_expiry', 'Document expiring soon',
      'Your ' || case NEW.document_active_type when 'passport' then 'passport' else 'national ID' end ||
      ' expires on ' || to_char(NEW.valid_through, 'DD Mon YYYY') || '. Please update your documents.',
      '/profile');
  end if;
  return NEW;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_calendar_event_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_creator_role  text;
  v_creator_name  text;
  v_creator_path  ltree;
  v_event_date    text;
BEGIN
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;
  SELECT role, first_name || ' ' || last_name INTO v_creator_role, v_creator_name
  FROM public.profiles WHERE id = NEW.created_by;
  IF v_creator_role IS DISTINCT FROM 'core' THEN RETURN NEW; END IF;
  v_event_date := to_char(NEW.start_time AT TIME ZONE 'Europe/Sofia', 'DD Mon YYYY');
  SELECT path INTO v_creator_path FROM public.tree_nodes WHERE profile_id = NEW.created_by;
  IF v_creator_path IS NOT NULL THEN
    INSERT INTO public.notifications (profile_id, type, title, message, action_url)
    SELECT DISTINCT p.id, 'event_fetched', 'New event in your network',
      NEW.title || ' — ' || v_event_date, '/calendar'
    FROM public.tree_nodes tn_desc
    JOIN public.profiles p ON p.id = tn_desc.profile_id
    WHERE tn_desc.path <@ v_creator_path
      AND tn_desc.path::text != v_creator_path::text
      AND p.id != NEW.created_by
      AND p.role = ANY(NEW.visibility_roles);
  END IF;
  INSERT INTO public.notifications (profile_id, type, title, message, action_url)
  SELECT anc_id, 'event_fetched', 'Event created in your network',
    v_creator_name || ' created ' || NEW.title || ' — ' || v_event_date, '/calendar'
  FROM public.get_core_ancestors(NEW.created_by) AS anc_id
  WHERE anc_id != NEW.created_by;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_verification_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_name text;
begin
  SELECT first_name || ' ' || last_name INTO v_name
  FROM public.profiles WHERE id = NEW.profile_id;
  INSERT INTO public.notifications (profile_id, type, title, message, action_url)
  SELECT id, 'role_request', 'ABO verification request',
    v_name || ' is requesting verification for ABO ' || NEW.claimed_abo, '/admin/members'
  FROM public.profiles WHERE role = 'admin';
  RETURN NEW;
end;
$$;

CREATE OR REPLACE FUNCTION public.update_bento_config_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.update_howtos_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.update_vital_signs_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── TRIGGERS ─────────────────────────────────────────────────

CREATE TRIGGER on_trip_created
  AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

CREATE TRIGGER on_trip_registration_insert
  AFTER INSERT ON public.trip_registrations
  FOR EACH ROW EXECUTE FUNCTION public.notify_trip_request();

CREATE TRIGGER on_trip_registration_status_change
  AFTER UPDATE ON public.trip_registrations
  FOR EACH ROW EXECUTE FUNCTION public.notify_registration_status_change();

CREATE TRIGGER on_event_role_request_insert
  AFTER INSERT ON public.event_role_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_role_request();

CREATE TRIGGER on_event_role_request_status_change
  AFTER UPDATE ON public.event_role_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_role_request_status_change();

CREATE TRIGGER on_profile_doc_expiry_check
  AFTER UPDATE OF valid_through ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_doc_expiry();

CREATE TRIGGER on_calendar_event_created
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_calendar_event_created();

CREATE TRIGGER on_verification_request_created
  AFTER INSERT ON public.abo_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_verification_request();

CREATE TRIGGER bento_config_updated_at
  BEFORE UPDATE ON public.bento_config
  FOR EACH ROW EXECUTE FUNCTION public.update_bento_config_updated_at();

CREATE TRIGGER howtos_updated_at
  BEFORE UPDATE ON public.guides
  FOR EACH ROW EXECUTE FUNCTION public.update_howtos_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.los_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_role_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bento_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vital_sign_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abo_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payable_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Admins full profile access" ON public.profiles FOR ALL USING (is_admin());
CREATE POLICY "Admins see all profiles" ON public.profiles FOR SELECT USING (is_admin());
CREATE POLICY "Members see own profile" ON public.profiles FOR SELECT USING (clerk_id = get_my_clerk_id());
CREATE POLICY "Members update own profile" ON public.profiles FOR UPDATE USING (clerk_id = get_my_clerk_id());
CREATE POLICY "Members see downline profiles" ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM (tree_nodes viewer JOIN tree_nodes target ON (target.path <@ viewer.path))
    WHERE viewer.profile_id = get_my_profile_id() AND target.profile_id = profiles.id
  ));

-- trips
CREATE POLICY "Admins manage trips" ON public.trips FOR ALL USING (is_admin());
CREATE POLICY "Authenticated users view trips" ON public.trips FOR SELECT
  USING (get_my_role() = ANY (ARRAY['member'::user_role,'core'::user_role,'admin'::user_role]));

-- trip_registrations
CREATE POLICY "Admins full registration access" ON public.trip_registrations FOR ALL USING (is_admin());
CREATE POLICY "Members insert own registration" ON public.trip_registrations FOR INSERT WITH CHECK (profile_id = get_my_profile_id());
CREATE POLICY "Members view own registrations" ON public.trip_registrations FOR SELECT USING (profile_id = get_my_profile_id());

-- trip_attachments
CREATE POLICY "admin_all_trip_attachments" ON public.trip_attachments FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "attendee_select_trip_attachments" ON public.trip_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_registrations tr
    WHERE tr.trip_id = trip_attachments.trip_id AND tr.profile_id = get_my_profile_id() AND tr.status = 'approved'
  ));

-- los_members
CREATE POLICY "Admins full LOS access" ON public.los_members FOR ALL USING (is_admin());
CREATE POLICY "Members view own LOS data" ON public.los_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.clerk_id = get_my_clerk_id() AND p.abo_number = los_members.abo_number));

-- tree_nodes
CREATE POLICY "Admins manage tree" ON public.tree_nodes FOR ALL USING (is_admin());
CREATE POLICY "Members view own subtree" ON public.tree_nodes FOR SELECT
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM tree_nodes viewer
    WHERE viewer.profile_id = get_my_profile_id() AND tree_nodes.path <@ viewer.path
  ));

-- calendar_events
CREATE POLICY "Admins manage events" ON public.calendar_events FOR ALL USING (is_admin());
CREATE POLICY "N21 events visible to all" ON public.calendar_events FOR SELECT USING (category = 'N21');
CREATE POLICY "Personal events visible to member+" ON public.calendar_events FOR SELECT
  USING (category = 'Personal' AND get_my_role() = ANY (ARRAY['member'::user_role,'core'::user_role,'admin'::user_role]));

-- event_role_requests
CREATE POLICY "Admins full request access" ON public.event_role_requests FOR ALL USING (is_admin());
CREATE POLICY "Members insert own requests" ON public.event_role_requests FOR INSERT WITH CHECK (profile_id = get_my_profile_id());
CREATE POLICY "Members view own requests" ON public.event_role_requests FOR SELECT USING (profile_id = get_my_profile_id());

-- notifications
CREATE POLICY "Admins full notification access" ON public.notifications FOR ALL USING (is_admin());
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT
  USING (profile_id = get_my_profile_id() AND deleted_at IS NULL);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (profile_id = get_my_profile_id());

-- announcements
CREATE POLICY "Active announcements by role" ON public.announcements FOR SELECT
  USING (is_active = true AND get_my_role() = ANY (access_level));
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL USING (is_admin());

-- home_settings
CREATE POLICY "Anyone reads home settings" ON public.home_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage home settings" ON public.home_settings FOR ALL USING (is_admin());

-- bento_config
CREATE POLICY "bento_config_select" ON public.bento_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "bento_config_update" ON public.bento_config FOR UPDATE USING (is_admin());

-- guides
CREATE POLICY "howtos_select_published" ON public.guides FOR SELECT
  USING (is_published = true AND (get_my_role())::text = ANY (access_roles));
CREATE POLICY "howtos_select_admin_core" ON public.guides FOR SELECT
  USING (get_my_role() = ANY (ARRAY['admin'::user_role,'core'::user_role]));
CREATE POLICY "howtos_insert_admin" ON public.guides FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "howtos_update_admin" ON public.guides FOR UPDATE USING (is_admin());
CREATE POLICY "howtos_delete_admin" ON public.guides FOR DELETE USING (is_admin());

-- links
CREATE POLICY "links_select_by_role" ON public.links FOR SELECT USING ((get_my_role())::text = ANY (access_roles));
CREATE POLICY "links_admin_all" ON public.links FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- social_posts
CREATE POLICY "social_posts_select_authenticated" ON public.social_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "social_posts_insert_admin" ON public.social_posts FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "social_posts_update_admin" ON public.social_posts FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "social_posts_delete_admin" ON public.social_posts FOR DELETE USING (is_admin());

-- vital_sign_definitions
CREATE POLICY "vsd_select_authenticated" ON public.vital_sign_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "vsd_insert_admin" ON public.vital_sign_definitions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "vsd_update_admin" ON public.vital_sign_definitions FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "vsd_delete_admin" ON public.vital_sign_definitions FOR DELETE USING (is_admin());

-- member_vital_signs (NOTE: mvs_insert/delete use raw auth.jwt — pre-pattern-A debt carried forward faithfully)
CREATE POLICY "mvs_select" ON public.member_vital_signs FOR SELECT
  USING (profile_id = get_my_profile_id() OR is_admin());
CREATE POLICY "mvs_insert_admin" ON public.member_vital_signs FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');
CREATE POLICY "mvs_delete_admin" ON public.member_vital_signs FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

-- abo_verification_requests
CREATE POLICY "owner can read own request" ON public.abo_verification_requests FOR SELECT USING (profile_id = get_my_profile_id());
CREATE POLICY "owner can insert own request" ON public.abo_verification_requests FOR INSERT WITH CHECK (profile_id = get_my_profile_id());
CREATE POLICY "owner can delete own pending request" ON public.abo_verification_requests FOR DELETE
  USING (profile_id = get_my_profile_id() AND status = 'pending');

-- payable_items
CREATE POLICY "payable_items_admin_core_all" ON public.payable_items FOR ALL
  USING (get_my_role() = ANY (ARRAY['admin'::user_role,'core'::user_role]));
CREATE POLICY "payable_items_member_read" ON public.payable_items FOR SELECT USING (is_active = true);

-- payments (NOTE: payments_admin_core_all uses raw auth.jwt — pre-pattern-A debt carried forward faithfully)
CREATE POLICY "payments_admin_core_all" ON public.payments FOR ALL
  USING ((auth.jwt() ->> 'user_role') = ANY (ARRAY['admin','core']));
CREATE POLICY "payments_member_select" ON public.payments FOR SELECT USING (profile_id = get_my_profile_id());
CREATE POLICY "payments_member_insert" ON public.payments FOR INSERT
  WITH CHECK (profile_id = get_my_profile_id() AND logged_by_admin IS NULL);
CREATE POLICY "payments_member_update" ON public.payments FOR UPDATE
  USING (profile_id = get_my_profile_id() AND logged_by_admin IS NOT NULL);

-- role_change_audit
CREATE POLICY "Admins can select role_change_audit" ON public.role_change_audit FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can insert role_change_audit" ON public.role_change_audit FOR INSERT TO authenticated WITH CHECK (is_admin());

-- ── pg_cron JOBS ─────────────────────────────────────────────
-- NOTE: sync-google-calendar URL uses THIS project's ID (iymwxdewcpvpjgzewtzk).
-- When applying to a different project, update the URL accordingly.

SELECT cron.schedule(
  'los-digest-daily',
  '0 6 * * *',
  $$SELECT public.run_los_digest()$$
);

SELECT cron.schedule(
  'sync-google-calendar',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iymwxdewcpvpjgzewtzk.supabase.co/functions/v1/sync-google-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'sync_secret' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
