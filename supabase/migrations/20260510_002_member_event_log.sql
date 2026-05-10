CREATE TABLE public.member_event_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  actor_id    text        NOT NULL, -- 'system' or a Clerk user ID
  subject_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type  text        NOT NULL,
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status      text        NOT NULL DEFAULT 'ok'
);

-- No RLS — service role only. Never exposed to client directly.
ALTER TABLE public.member_event_log DISABLE ROW LEVEL SECURITY;

CREATE INDEX member_event_log_subject_idx ON public.member_event_log (subject_id);
CREATE INDEX member_event_log_event_type_idx ON public.member_event_log (event_type);
CREATE INDEX member_event_log_created_at_idx ON public.member_event_log (created_at DESC);
