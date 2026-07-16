## Summary

<!-- What and why. Link the issue: Closes #NNN -->

## Checklist

- [ ] CI green and Vercel preview READY (never Done on static analysis alone)
- [ ] New UI surfaces render correctly at 390px
- [ ] **Migrations are expand-only**: backward-compatible with currently deployed code (new tables / nullable columns / indexes). Destructive changes (drop/rename/narrow) are deferred to a follow-up PR — see docs/DEV_WORKFLOW.md "Database"
- [ ] Every new migration carries a `-- ROLLBACK:` comment
- [ ] `docs/CLAIMS.md` row registered (agent workflow)

## Session State

**Status:** IN PROGRESS | DONE
**Completed:**
- [x] ...
**Next:** single specific action for next instance
