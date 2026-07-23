import { test, expect, type Locator, type Page } from '@playwright/test'

/**
 * Unauthenticated smoke over the public /calendar page (see lib/public-routes.ts).
 * Covers: month load, month navigation, event popup, agenda view, category filter.
 *
 * Deliberately excluded from the `authenticated` Playwright project — that
 * project is a CI skip when Clerk/Supabase seed secrets are absent (see
 * project_ci_authenticated_e2e_is_a_skip); this spec needs no auth so it runs
 * for real under `mobile-390`/`desktop` instead.
 *
 * CalendarClient renders both the mobile and desktop DOM trees at once (one
 * hidden via CSS per breakpoint, not unmounted) — every role/text query below
 * is narrowed to the one visible instance for the active viewport.
 */
function visible(page: Page, locator: Locator): Locator {
  return locator.and(page.locator(':visible'))
}

test.describe('calendar', () => {
  test('loads month view, navigates months, opens a popup, switches to agenda, and applies a filter', async ({ page }) => {
    const response = await page.goto('/calendar')
    expect(response, 'no response for /calendar').not.toBeNull()
    expect(response!.status(), 'HTTP status for /calendar').toBeLessThan(400)

    const grid = visible(page, page.getByRole('grid', { name: 'Month' }))
    await expect(grid).toBeVisible()

    const periodLabel = visible(page, page.getByText(/^[A-Z][a-z]+ \d{4}$/)).first()
    const initialLabel = await periodLabel.textContent()

    await visible(page, page.getByRole('button', { name: 'Next month' })).click()
    await expect(periodLabel).not.toHaveText(initialLabel ?? '')

    await visible(page, page.getByRole('button', { name: 'Previous month' })).click()
    await expect(periodLabel).toHaveText(initialLabel ?? '')

    // Fails loudly rather than silently skipping popup coverage — this repo's
    // public calendar always has upcoming club events in the current month,
    // so 0 here is itself a bug, not an empty fixture to route around.
    // Event pill/bar buttons are row-level siblings of the gridcells, not
    // their DOM children — spanning bars must share the week's CSS Grid to
    // lay out across multiple day columns (2607-DEV-653) — so the selector
    // is scoped to the row rather than the cell. Gridcells themselves are
    // plain divs (never <button>), so this still matches only event pills.
    const firstEvent = visible(page, page.locator('[role="row"] button')).first()
    await expect(firstEvent, 'no calendar events found in the current month view').toBeVisible()
    await firstEvent.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await visible(page, page.getByRole('button', { name: 'Agenda' })).click()
    await expect(grid).not.toBeVisible()

    const filterButton = visible(page, page.getByRole('button', { name: 'In-person' }))
    await filterButton.click()
    await expect(filterButton).toHaveAttribute('aria-pressed', 'true')
  })
})
