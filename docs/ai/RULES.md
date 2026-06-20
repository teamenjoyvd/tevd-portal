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
    - `is_admin()`
    - `get_my_role()`
  - **NEVER** write inline `auth.jwt()` logic inside RLS policies.
- **Detail Table Access Gating:**
  - This project's schema does not have an `interactions`-style detail-table pattern (no `call_details` / `email_details` / `note_details` tables exist). If a future table needs gating via a parent-row `EXISTS` check rather than a direct `profile_id` column, model it on the real comparable case in this codebase: the `payments` table's two-FK ambiguity to `profiles` (see §5 Schema in `docs/ai/REF.md` — any PostgREST join MUST use `profiles!profile_id(...)`).
- **Supabase Cookie method type mapping:**
  - Do not derive database types from `CookieMethodsServer['setAll']` (breaks since `setAll` is optional).
  - Use the explicit type: `{ name: string; value: string; options?: Record<string, unknown> }`.
- **Database Write Safety:**
  - **NEVER** write data or execute database modifications to Supabase from a Vercel Preview URL, as preview environments hit the production database. Avoid running mutation scripts from preview deployments.

---

## 3. UI Styling & Component Standards

- **390px Mobile-First Constraint:**
  - Every user interface must render correctly without overflow or structural breaks at a **390px width**.
- **Layout Decision Rules (Quantitative):**
  - **Default: Single responsive layout.** Stack vertically on mobile, widen on desktop using standard Tailwind responsive modifiers (`md:`, `lg:`).
  - Dual layout (separate files) is required **only** when a trigger is present: tables with 5+ columns, complex touch vs mouse drag-and-drop, persistent sidebar layouts, or interactive canvases/maps/rich-text editors. Refer to `.cursor/rules/frontend.mdc` for precise triggers.
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
