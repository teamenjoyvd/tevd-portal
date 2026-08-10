import type { Reporter, TestCase, TestResult, FullResult, FullConfig } from '@playwright/test/reporter'

/**
 * Aborts the run when the failures are the dev server's fault, not the code's
 * (2608-DEV-722).
 *
 * Playwright attaches to whatever answers the port (`webServer.reuseExistingServer`)
 * and never supervises it. When that process dies mid-run — observed twice on
 * 2026-08-10, exit 127 — every remaining test burns its full 60s timeout and
 * the report shows a spread of unrelated red specs that reads exactly like a
 * code regression. Diagnosing one such run cost ~40 minutes of clean-tree
 * bisection to establish that nothing was actually broken.
 *
 * So: on the FIRST failure, probe the server. If it does not answer, say so in
 * terms nobody can misread and stop the run immediately.
 *
 * Exiting the process is the only way a reporter can halt a run — Playwright
 * offers no abort hook — and it is the right trade here: every result after
 * the server dies is noise, and a truncated HTML report costs nothing next to
 * a misattributed failure. CI never takes this path (see `enabled`): there the
 * server is workflow-managed, and a hard exit would hide a real failure.
 */
export default class ServerWatchdogReporter implements Reporter {
  private baseURL = 'http://localhost:3000'
  private enabled = false
  private probing = false

  onBegin(config: FullConfig): void {
    // `use.baseURL` is per-project; every project in this repo inherits the
    // top-level one, so the first project carrying it is authoritative.
    const fromProject = config.projects.find(p => p.use.baseURL !== undefined)?.use.baseURL
    if (fromProject !== undefined && fromProject !== '') this.baseURL = fromProject

    // Local only. In CI the server's lifetime is the workflow's business, and
    // killing the run on a probe failure would mask genuine test failures.
    this.enabled = !process.env.CI
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    if (!this.enabled || this.probing) return
    if (result.status !== 'failed' && result.status !== 'timedOut') return

    // onTestEnd is not awaited (testReporter.d.ts:228), so the probe runs
    // detached and reports for itself.
    this.probing = true
    void this.probe()
  }

  private async probe(): Promise<void> {
    if (await this.isUp()) {
      // A real failure against a healthy server: stand down and let the run
      // continue reporting normally. Re-arm so a later crash is still caught.
      this.probing = false
      return
    }
    this.report()
    process.exit(1)
  }

  private async isUp(): Promise<boolean> {
    // Any HTTP answer proves the process is alive — a 404 or a 500 is still a
    // server. Only a transport-level failure means it is gone.
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5_000)
      try {
        await fetch(this.baseURL, { signal: controller.signal })
        return true
      } finally {
        clearTimeout(timer)
      }
    } catch {
      return false
    }
  }

  private report(): void {
    const line = '='.repeat(72)
    process.stderr.write(
      `\n${line}\n` +
        `  DEV SERVER DOWN — NOT A TEST FAILURE\n` +
        `${line}\n` +
        `  ${this.baseURL} stopped answering, so this run was aborted.\n` +
        `  Every failure printed above is the server's absence, not your code.\n` +
        `  Restart it and re-run before diagnosing anything:\n\n` +
        `      npm run dev\n\n` +
        `${line}\n\n`,
    )
  }

  // Covers the narrow race where the server dies during the very last test and
  // the detached probe has not resolved by then.
  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | void> {
    if (!this.enabled || result.status !== 'failed') return
    if (await this.isUp()) return
    this.report()
    return { status: 'failed' }
  }
}
