# ADR 001: Clerk-to-Supabase JWT Integration for Database-Layer Authorization

## Status
Accepted

## Context
The current architecture relies on application-layer authorization within Next.js API routes (e.g., `/app/api/admin/*`). These routes perform imperative role checks (`if (role !== 'admin')`) and subsequently bypass PostgreSQL Row Level Security (RLS) by executing queries via `createServiceClient()` (which injects the `SERVICE_ROLE_KEY`). 

This pattern introduces a critical security vulnerability: any failure, omission, or accidental bypass of the imperative checks in the Next.js layer results in immediate, unrestricted access to the entire database. It violates zero-trust principles and compromises forensic integrity, as all administrative mutations are logged under the service role rather than the executing user's identity.

## Decision
We will transition from application-layer authorization to database-layer authorization natively enforced by Supabase RLS, utilizing cryptographic trust from our Identity Provider (Clerk).

1. **JWT Integration:** Configure a Clerk JWT template to issue Supabase-compatible tokens containing user metadata (specifically the `role` claim).
2. **Standardized Client:** Implement a `createAuthenticatedClient()` helper in Next.js that securely injects the Clerk JWT into the PostgREST authorization header.
3. **RLS Enforcement:** All user-facing database queries must pass through PostgreSQL RLS. RLS policies will be rewritten to decode the JWT and authorize actions based on `(auth.jwt() ->> 'role')::text`.
4. **Service Client Quarantine:** The use of `createServiceClient()` is strictly prohibited in any `/app/*` route or Server Action invoked by a user. It is quarantined exclusively to server-to-server webhook endpoints (e.g., `/app/api/webhooks/clerk/route.ts`).

## Consequences
* **Positive:** Structural guarantee of zero-trust security. The application tier becomes a stateless relay. Accidental exposure of API endpoints will result in secure defaults (403/Empty Sets) due to database-level rejection.
* **Positive:** Accurate forensic audit logging in PostgreSQL, permanently tied to individual Clerk user IDs.
* **Negative/Effort:** Requires a comprehensive rewrite of `/supabase/migrations/*` RLS policies to align with the Clerk JWT structure.
* **Negative/Effort:** Requires refactoring all `/app/api/admin/*` endpoints to strip the service client and implement robust error handling for PostgREST rejections.