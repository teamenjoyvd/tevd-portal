-- ISS-0128: Add contact fields to profiles; add payment submission fields to trip_payments

-- 1. profiles: phone + contact_email
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS contact_email TEXT NULL;

-- 2. trip_payments: proof_url, payment_method, submitted_by_member
ALTER TABLE public.trip_payments
  ADD COLUMN IF NOT EXISTS proof_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NULL,
  ADD COLUMN IF NOT EXISTS submitted_by_member BOOLEAN NOT NULL DEFAULT false;

-- 3. RLS: member INSERT policy for submitted payments
--    WITH CHECK enforces: own profile_id, submitted_by_member=true, status='pending'
--    This prevents members from inserting payments for other users or
--    inserting with a non-pending status (i.e. they cannot self-approve).
CREATE POLICY "Members submit own payments"
  ON public.trip_payments
  FOR INSERT
  TO public
  WITH CHECK (
    profile_id = get_my_profile_id()
    AND submitted_by_member = true
    AND status = 'pending'
  );
