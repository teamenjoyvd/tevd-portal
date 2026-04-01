CREATE TABLE public.role_change_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_by  text NOT NULL, -- admin clerk_id
  old_role    public.user_role NOT NULL,
  new_role    public.user_role NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  note        text
);

ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

-- Admins can insert audit rows (service role bypasses RLS, but explicit policy is correct form)
CREATE POLICY "Admins can insert role_change_audit"
  ON public.role_change_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admins can read all audit rows
CREATE POLICY "Admins can select role_change_audit"
  ON public.role_change_audit
  FOR SELECT
  TO authenticated
  USING (is_admin());
