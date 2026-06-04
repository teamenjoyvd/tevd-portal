# Project Developer Rules Reference (FUAR)

This unified handbook serves as the master developer instructions for all AI coding assistants (including **Claude.ai** and **Antigravity**) and human contributors.

---

## 1. Core Architectural Constraints

- **Edge Proxy Gating:**
  - Route protection and custom routing logic live in `proxy.ts`.
  - **NEVER** create `middleware.ts` in the project root.
- **Client/Server Isolation:**
  - The Supabase Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) is highly confidential.
  - **NEVER** expose or reference this key in any client-bundled code or components.
- **Clerk Authentication:**
  - All protected routes must asynchronously check `userId` from `@clerk/nextjs/server`:
    ```typescript
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    ```
  - **NEVER** bypass, mock, or omit authentication checks on protected endpoints.

---

## 2. Database Gating & RLS (Pattern A)

- **RLS Policy Gating Helpers:**
  - Database access policies must ONLY reference Pattern A sql helper functions:
    - `get_my_clerk_id()`
    - `get_my_profile_id()`
  - **NEVER** write inline `auth.jwt()` logic inside RLS policies.
- **Detail Table Access Gating:**
  - Tables that don't possess a `profile_id` (e.g. `call_details`, `email_details`, `note_details`) must gate access using an `EXISTS` check on their parent `interactions` table:
    ```sql
    EXISTS (
      SELECT 1 FROM interactions
      WHERE interactions.id = interaction_id
      AND interactions.profile_id = get_my_profile_id()
    )
    ```
- **Supabase Cookie method type mapping:**
  - Do not derive database types from `CookieMethodsServer['setAll']` (breaks since `setAll` is optional).
  - Use the explicit type: `{ name: string; value: string; options?: Record<string, unknown> }`.
- **Database Write Safety:**
  - **NEVER** write data or execute database modifications to Supabase from a Vercel Preview URL, as preview environments hit the production database. Avoid running mutation scripts from preview deployments.

---

## 3. UI Styling & Component Standards

- **390px Mobile-First Constraint:**
  - Every user interface must render correctly without overflow or structural breaks at a **390px width**.
- **Dual Layout Law:**
  - **NEVER** construct a single complex layout file attempting to handle both mobile and desktop via media queries.
  - You must construct **two separate, dedicated layouts** (one mobile, one desktop).
  - Canonical Reference: `app/(dashboard)/dashboard/page.tsx`.
- **Interactive Primitives:**
  - Interactive widgets (popovers, sheets, comboboxes, dialogs, selects, etc.) must utilize **shadcn/ui** primitives exclusively.
- **Component Co-location:**
  - Keep route-specific components in `app/[route]/components/`.
  - Promote components to the global shared `/components` directory **ONLY** if used by 2 or more entirely unrelated routes.

---

## 4. Multi-Agent Coexistence Rules

- **Shared State Tracking:**
  - Antigravity and Claude.ai must align and synchronize on execution state.
  - Claude.ai should read the brain directory's `implementation_plan.md` to pick up prior research.
  - Antigravity must format its planning mode `implementation_plan.md` artifact to exactly match the `PLAN` output layout from `docs/ai/PLAN.md`.
  - PR descriptors must include an `Agent Type: Antigravity | Claude` tag in their session state block.
