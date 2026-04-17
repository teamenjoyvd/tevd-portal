# GCR — Address Gemini Code Review

Invoked via the `GCR` command in a BUILD session. Given a PR number:

1. `get_pull_request_reviews` — fetch the Gemini review summary.
2. `get_pull_request_comments` — fetch all inline comments.
3. Read each affected file at its current branch HEAD (not the diff commit SHA).
4. Apply every HIGH-priority comment. Apply MEDIUM-priority comments unless there is a concrete reason not to — state it explicitly.
5. Push all changes in a single commit to the PR branch. Commit message: `[YYMM]-[TYPE]-[GH#] fix: address Gemini PR<N> review comments`.
6. Report: one line per comment — ✅ Applied / ⚠️ Skipped (reason).
