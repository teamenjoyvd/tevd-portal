# GCR — General Code Review

Applies reviewer feedback on a PR — from any review bot (e.g. CodeRabbit) or human reviewer. (Historical note: "GCR" originally stood for Gemini Code Review; the Gemini bot is retired, the acronym and workflow remain.)

Invoked via the `GCR` command in a BUILD session. Given a PR number:

## Steps
1. **Fetch:** Call `get_pull_request_reviews` and `get_pull_request_comments` to fetch all inline feedback.
2. **Checkout:** Read affected files from the PR's head branch (`PR.head.ref`) — not from `main` and not from the commit SHA. This ensures comments are applied on top of the current PR state, not a stale base.
3. **Address:** Apply all HIGH-priority comments. Apply MEDIUM-priority comments unless there is a concrete reason not to — state it explicitly.
4. **Commit:** Push all fixes in a single commit. Commit message: `[YYMM-DEV-GH#] fix: address PR<N> review comments`.
5. **Report:** Provide a simple status list: ✅ Applied / ⚠️ Skipped (reason) for each comment.
6. **Resolve:** After the commit is pushed, walk every review thread:
   - Applied -> call `pull_request_review_write` (`method: resolve_thread`) with the thread's `threadId`.
   - Skipped -> call `add_reply_to_pull_request_comment` stating the reason, then leave the thread unresolved for human follow-up.
   Never resolve a thread before its fix is pushed.
7. **Post-merge tail (Done ≠ Merged):** after the PR merges — remove the issue's row from `docs/CLAIMS.md`, apply the dev-verified migration to prod (once the prod-migration workflow lands, this becomes approving the `production` environment run), smoke-check `https://www.teamenjoyvd.com`, then close the issue.
