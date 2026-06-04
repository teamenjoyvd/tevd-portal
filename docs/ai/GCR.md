# GCR — Gemini Code Review

Invoked via the `GCR` command in a BUILD session. Given a PR number:

## Steps
1. **Fetch:** Call `get_pull_request_reviews` and `get_pull_request_comments` to fetch all inline feedback.
2. **Checkout:** Read affected files from the PR's head branch (`PR.head.ref`) — not from `main` and not from the commit SHA. This ensures comments are applied on top of the current PR state, not a stale base.
3. **Address:** Apply all HIGH-priority comments. Apply MEDIUM-priority comments unless there is a concrete reason not to — state it explicitly.
4. **Commit:** Push all fixes in a single commit. Commit message: `[YYMM]-[TYPE]-[GH#] fix: address Gemini PR<N> review comments`.
5. **Report:** Provide a simple status list: ✅ Applied / ⚠️ Skipped (reason) for each comment.
