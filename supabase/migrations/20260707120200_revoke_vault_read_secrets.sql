-- AUDIT #475 (CRITICAL): vault_read_secrets() decrypts the Google service-account
-- credential and sync_secret from vault.decrypted_secrets, and was EXECUTE-granted
-- to anon/authenticated. No app-code caller exists in the repo — revoke entirely.
-- NOTE: this migration does not rotate the exposed credentials; that must be done
-- manually via Google Cloud Console + Supabase Vault (tracked separately in #475).
REVOKE EXECUTE ON FUNCTION public.vault_read_secrets() FROM PUBLIC, anon, authenticated;
