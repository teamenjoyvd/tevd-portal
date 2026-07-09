-- Documents orphaned tables per issue #495 audit. No DROP TABLE — dropping is explicitly
-- out of scope for this ticket (destructive, requires separate explicit approval).
-- email_log and scheduled_reminders already carry DEPRECATED comments from #486; not touched here.

COMMENT ON TABLE public.bento_config IS 'ORPHANED: no live app reference since /api/admin/bento-config route removal. See issue #495.';
COMMENT ON TABLE public.waiting_list IS 'ORPHANED: RLS-enabled-no-policy, never wired to any code. See issue #495.';
COMMENT ON TABLE public.verification_log IS 'ORPHANED: superseded by member_event_log / abo_verification_requests. See issue #495.';
COMMENT ON TABLE public.approval_jobs IS 'ORPHANED: documented for Inngest job lifecycle, but no Inngest code exists in this repo. See issue #495.';
