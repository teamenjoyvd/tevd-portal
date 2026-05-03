-- waiting_list: email capture for launch notifications
CREATE TABLE public.waiting_list (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  email      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waiting_list_pkey PRIMARY KEY (id),
  CONSTRAINT waiting_list_email_key UNIQUE (email)
);

-- No RLS — only accessible via service role from the API route
ALTER TABLE public.waiting_list DISABLE ROW LEVEL SECURITY;
