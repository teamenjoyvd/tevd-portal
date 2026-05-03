# GCR — Address Gemini Code Review

Invoked via the `GCR` command in a BUILD session. Given a PR number:

1. `get_pull_request_reviews` — fetch the Gemini review summary.
2. `get_pull_request_comments` — fetch all inline comments.
3. Read each affected file from the PR's head branch (`PR.head.ref`) — not from `main` and not from the commit SHA. This ensures comments are applied on top of the current PR state, not a stale base.
4. Apply every HIGH-priority comment. Apply MEDIUM-priority comments unless there is a concrete reason not to — state it explicitly.
5. Push all changes in a single commit to the PR branch. Commit message: `[YYMM]-[TYPE]-[GH#] fix: address Gemini PR<N> review comments`.
6. Report: one line per comment — ✅ Applied / ⚠️ Skipped (reason).
