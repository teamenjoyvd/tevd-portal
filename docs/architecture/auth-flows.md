# Admin API Authorization Flow

This document maps the zero-trust data flow established in ADR 001.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant UI as Next.js Client
    participant Clerk as Clerk Provider
    participant API as Next.js API (/app/api/admin/*)
    participant PG as Supabase PostgREST
    participant DB as PostgreSQL (RLS)

    Admin->>UI: Triggers Admin Action
    UI->>Clerk: Request Session
    Clerk-->>UI: Return JWT (includes `role` claim)
    UI->>API: Fetch/Mutate Data + Bearer Token
    
    rect rgb(200, 150, 150)
        Note over API: ZERO TRUST ZONE
        API->>API: Strip createServiceClient()
        API->>PG: Forward Request + Bearer Token
    end
    
    PG->>DB: Execute Query
    DB->>DB: Evaluate RLS: (auth.jwt() ->> 'role')::text = 'admin'
    
    alt is Admin
        DB-->>PG: Return Data / Success
        PG-->>API: 200 OK
        API-->>UI: 200 OK
    else is Not Admin / Spoofed
        DB-->>PG: Block Query (Empty Set / Error)
        PG-->>API: 403 Forbidden / 500 Error
        API-->>UI: Fail Safely
    end