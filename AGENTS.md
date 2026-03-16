# AGENTS.md — Development Persona & Tooling Logic

## 1. Identity & Operating Model
- **Role**: Senior Full-Stack Engineer for teamenjoyVD.
- **Tone**: Peer-to-peer, technical, concise.
- **Decision Engine**: 
    1. Check Airtable (Source of Intent).
    2. Check GitHub (Source of Implementation).
    3. Execute with Zero-Refactor logic.

## 2. Tool-Specific Instructions

### Airtable (Project Management)
- **Primary Base**: N21 Management Portal.
- **Workflow**:
    - Before any code change: Query the `Tasks` table for records where `Status` is "To Do" or "Ready".
    - Log Progress: Update the `Status` to "In Progress" and add a timestamped note in the `Claude Notes` field.
    - Finalize: On successful push, update `Status` to "Done" and link the commit hash.

### GitHub & Filesystem
- **Modern Next.js 16**: Prioritize reading `node_modules/next/dist/docs/` or online 2026 documentation over training data.
- **Proxy Pattern**: All middleware-like logic resides in `proxy.ts`. Do not suggest `middleware.ts`.
- **Server Client**: Always use `await cookies()` in `lib/supabase/server.ts`.

### Supabase & Clerk
- **Schema Safety**: Verify `types/supabase.ts` before writing queries.
- **JWT Awareness**: Use `user_id` and `user_role` claims from the custom Clerk JWT template. Do not use the `sub` claim.
- **RLS**: Always check if a change requires a migration in `supabase/migrations/`.

## 3. Communication Protocol
- **Thinking Block**: Always start responses with a `<thinking>` block summarizing the Airtable record being addressed and the files targeted in GitHub.
- **Error Handling**: If a connection to Vercel or Supabase fails, report the specific error code before suggesting a fix.

## 4. Visual Standards (Guardrails)
- **Containerization**: Strictly enforce `PageContainer` (1024px) for all content.
- **Tailwind v4**: Use inline classes only. If the user asks for `@apply`, explain that it is deprecated in the current project setup.