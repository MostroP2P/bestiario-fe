import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fixtures, serveRelay } from './relay'
import { en } from '../../src/i18n/en'

/**
 * The three sections of SPEC 8, as a reader moves between them.
 *
 * A section is a place: it has a link, the link survives a reload, and the
 * back button returns to where the reader was. These run against the built
 * bundle because a hash route is a thing only a real browser has.
 */
const events = fixtures()

async function open(page: Page, hash = '') {
  await serveRelay(page, events)
  await page.goto(`/${hash}`)
  await expect(page.locator('.b-stream')).toHaveText(en.header.verified)
}

test.describe('moving between sections', () => {
  test('opens on the overview, with its map', async ({ page }) => {
    // Arrange / Act
    await open(page)

    // Assert
    await expect(page.locator('.b-map')).toBeVisible()
    await expect(page.getByRole('link', { name: en.nav.overview })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('follows a link to orders and says so in the address bar', async ({ page }) => {
    await open(page)

    await page.getByRole('link', { name: en.nav.orders }).click()

    await expect(page).toHaveURL(/#\/orders$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      en.ordersView.heading,
    )
    // The overview's map belongs to the overview and is not fetched here.
    await expect(page.locator('.b-map')).toHaveCount(0)
  })

  test('opens a deep link straight into volume', async ({ page }) => {
    await open(page, '#/volume?w=7d')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      en.volumeView.heading,
    )
    await expect(page.getByLabel(en.header.windowNav, { exact: true })).toHaveValue('7d')
  })

  test('carries the window from section to section', async ({ page }) => {
    // Arrange
    await open(page)
    await page.getByLabel(en.header.windowNav, { exact: true }).selectOption('24h')

    // Act
    await page.getByRole('link', { name: en.nav.volume }).click()

    // Assert — the link a reader would send says both things.
    await expect(page).toHaveURL(/#\/volume\?w=24h$/)
    await expect(page.getByLabel(en.header.windowNav, { exact: true })).toHaveValue('24h')
  })

  test('comes back where the reader was when they go back', async ({ page }) => {
    await open(page)
    await page.getByRole('link', { name: en.nav.orders }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      en.ordersView.heading,
    )

    await page.goBack()

    await expect(page.locator('.b-map')).toBeVisible()
  })
})

test.describe('narrowing a section', () => {
  test('shows one currency when the reader asks for one', async ({ page }) => {
    // Arrange
    await open(page, '#/volume')
    const rows = page.locator('.b-table tbody tr')
    const all = await rows.count()
    expect(all).toBeGreaterThan(1)

    // Act
    await page.getByLabel(en.filters.fiat, { exact: true }).selectOption('ARS')

    // Assert
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('ARS')
  })

  test('says plainly that volume is not published per instance', async ({ page }) => {
    await open(page, '#/volume')

    await page.getByLabel(en.filters.instance).selectOption({ index: 1 })

    await expect(page.locator('.b-filter-note')).toHaveText(en.filters.noInstanceVolume)
  })

  test('says which instance publishes no orders of its own', async ({ page }) => {
    // SPEC 14.3: scoped documents are not published yet. The filter is
    // offered and answered, rather than showing the network's figures under
    // one instance's name.
    await open(page, '#/orders')

    await page.getByLabel(en.filters.instance).selectOption({ index: 1 })

    await expect(page.locator('.b-filter-note')).toContainText('does not publish')
  })

  test('has no detectable WCAG A or AA violations on either section', async ({
    page,
  }) => {
    for (const hash of ['#/orders', '#/volume']) {
      await open(page, hash)
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      expect(results.violations, hash).toEqual([])
    }
  })
})
