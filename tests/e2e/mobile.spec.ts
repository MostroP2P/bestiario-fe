import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fixtures, serveRelay } from './relay'
import { en } from '../../src/i18n/en'

/**
 * The site on a phone.
 *
 * Stacked in source order, the provenance rail came first and every control
 * — the window tabs, the language picker — landed around 500px down the
 * page, below anything a reader would scroll to. These run at a phone's
 * viewport because that is the only place the bug existed: nothing about the
 * markup was wrong, only what the layout did with it.
 */
const events = fixtures()
const PHONE = { width: 390, height: 844 }

test.use({ viewport: PHONE, isMobile: true, hasTouch: true })

async function open(page: Page) {
  await serveRelay(page, events)
  await page.goto('/')
  await expect(page.locator('.b-kpi strong').first()).not.toBeEmpty()
}

test.describe('a reader on a phone', () => {
  test('can reach the language picker without scrolling', async ({ page }) => {
    // Arrange
    await open(page)

    // Act
    const box = (await page.getByLabel(en.header.language).boundingBox())!
    const relays = (await page.locator('.b-relays').boundingBox())!

    // Assert — on the first screen, and above the provenance the reader used
    // to have to scroll past to reach it.
    expect(box.y + box.height).toBeLessThan(PHONE.height)
    expect(box.y).toBeLessThan(relays.y)
  })

  test('meets the figures and the controls before the provenance', async ({ page }) => {
    await open(page)

    const header = (await page.locator('.b-header').boundingBox())!
    const railBody = (await page.locator('.b-rail-body').boundingBox())!

    // The brand still opens the page; the rest of the rail follows the
    // figures it is evidence for.
    const brand = (await page.locator('.b-brand').boundingBox())!
    expect(brand.y).toBeLessThan(header.y)
    expect(header.y).toBeLessThan(railBody.y)
  })

  test('and the picker still changes the language', async ({ page }) => {
    await open(page)

    await page.getByLabel(en.header.language).selectOption('es')

    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  })

  test('reads the map caption beside the map, not on top of it', async ({ page }) => {
    // Arrange — the caption was written for the artboard's empty ocean, and
    // a phone has none: over the globe it covered the countries it was
    // describing and ran into the count coming the other way.
    await open(page)

    // Act
    const caption = (await page.locator('.b-map-caption').boundingBox())!
    const canvas = (await page.locator('.b-map-canvas').boundingBox())!
    const count = (await page.locator('.b-map-count').boundingBox())!

    // Assert — three bands, in reading order, none overlapping.
    expect(caption.y + caption.height).toBeLessThanOrEqual(canvas.y)
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(count.y)
  })

  test('still gets a map worth looking at', async ({ page }) => {
    await open(page)

    const canvas = (await page.locator('.b-map-canvas').boundingBox())!
    expect(canvas.height).toBeGreaterThan(240)
    await expect(page.locator('.b-map-canvas svg')).toBeVisible()
  })

  test('never has to scroll sideways to read the page', async ({ page }) => {
    await open(page)

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
  })

  test('gets targets a thumb can hit', async ({ page }) => {
    // WCAG 2.2 AA 2.5.8 asks 24×24 CSS pixels; a phone deserves the 32 the
    // stylesheet gives it.
    await open(page)

    for (const control of [
      page.getByLabel(en.header.language),
      page.getByRole('button', { name: en.header.windows['7d'] }),
    ]) {
      const box = (await control.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(32)
      expect(box.width).toBeGreaterThanOrEqual(24)
    }
  })

  test('has no detectable WCAG A or AA violations', async ({ page }) => {
    await open(page)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
})
