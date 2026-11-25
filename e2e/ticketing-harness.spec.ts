import { expect, test } from '@playwright/test'
import { TicketRun, randomIp, requireFakes } from './ticket-fixtures'

/** Proves the ticketing fakes are in the path (2611-DEV-803). Needs no sign-in. */
test.use({ viewport: { width: 390, height: 844 } })

const run = new TicketRun()
test.beforeAll(async ({ request }) => requireFakes(request))
test.afterAll(async () => run.cleanup())

test('a free registration reaches the fake Zoom and the fake inbox', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const event = await run.event()
  await run.product(event.id, 'free_registration')
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { 'x-forwarded-for': randomIp() } })
  const page = await context.newPage()
  await page.goto(`/events/${event.id}/register?lang=en`)
  await page.locator('#ticket-name').fill('Ann Lee')
  await page.locator('#ticket-email').fill(run.email('ann'))
  await page.locator('form button[type=submit]').click()

  const [email] = await run.emailsTo(run.email('ann'))
  expect(email.html).toContain(`/events/${event.id}/join`)
  const [registrant] = (await run.state()).registrants.filter((r) => r.session === event.session)
  expect(registrant).toMatchObject({ email: run.email('ann'), name: 'Ann Lee', status: 'approved' })
  expect(email.html).not.toContain(registrant.link)

  await page.getByRole('button', { name: 'Join', exact: false }).click()
  await page.waitForURL(registrant.link)
  await context.close()
})
