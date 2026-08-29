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
 * viewport because that is where the layout bug lived; the reading-order
 * test below runs on the document itself, because a box that has moved on
 * screen has not moved for anyone listening to the page.
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

  test('and a screen reader meets them in that same order', async ({ page }) => {
    // Arrange — the document, not the painted boxes: CSS `order` moves a box
    // and leaves assistive technology walking the old sequence.
    await open(page)

    // Act
    const inReadingOrder = await page.evaluate(() => {
      const nodes = ['.b-brand', '.b-header', '.b-rail-body'].map(
        (selector) => document.querySelector(selector) as Element,
      )
      return nodes.every((node, i) => {
        const next = nodes[i + 1]
        if (next === undefined) return true
        const where = node.compareDocumentPosition(next)
        return (where & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      })
    })

    // Assert — brand, then the controls and figures, then the provenance.
    expect(inReadingOrder).toBe(true)
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
    const label = (await page.locator('.b-map-label').boundingBox())!
    const canvas = (await page.locator('.b-map-canvas').boundingBox())!
    const count = (await page.locator('.b-map-count').boundingBox())!
    const caption = (await page.locator('.b-map-caption').boundingBox())!

    // Assert — four bands, in reading order, none overlapping: what the map
    // is, the map, what it counts, and the caption that qualifies it.
    expect(label.y + label.height).toBeLessThanOrEqual(canvas.y)
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(count.y)
    expect(count.y + count.height).toBeLessThanOrEqual(caption.y)
  })

  test('still gets a map worth looking at', async ({ page }) => {
    await open(page)

    const canvas = (await page.locator('.b-map-canvas').boundingBox())!
    expect(canvas.height).toBeGreaterThan(240)
    await expect(page.locator('.b-map-canvas svg')).toBeVisible()
  })

  /**
   * How wide the page is, against how wide the reader's screen is.
   *
   * Measured after the lower panels have rendered and not at the first
   * figure: the block that overflowed arrives with them, and an assertion
   * that runs before it is an assertion about half a page.
   *
   * `window.innerWidth` is the wrong ruler and is why this went unnoticed —
   * on a phone the layout viewport *grows* to whatever overflowed it, so it
   * reported 443 for a 390px screen and `scrollWidth <= innerWidth` was true
   * of a page a reader had to drag sideways to read. The screen is
   * `documentElement.clientWidth`, which stays 390.
   */
  async function widths(page: Page) {
    await expect(page.locator('.b-split .b-pair').first()).toBeVisible()
    await expect(page.locator('.b-table table, .b-empty').first()).toBeVisible()
    return page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      screen: document.documentElement.clientWidth,
      layout: window.innerWidth,
    }))
  }

  test('never has to scroll sideways to read the page', async ({ page }) => {
    await open(page)

    const { scrollWidth, screen, layout } = await widths(page)

    expect(scrollWidth).toBeLessThanOrEqual(screen)
    // And the viewport itself never widened to accommodate an overflow.
    expect(layout).toBeLessThanOrEqual(screen)
  })

  test('and cannot be slid sideways on a narrower phone either', async ({ page }) => {
    // 320px is the narrowest viewport WCAG 2.2 reflow asks a page to hold.
    await open(page)

    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: PHONE.height })
      const measured = await widths(page)

      expect(measured.scrollWidth, `at ${width}px`).toBeLessThanOrEqual(measured.screen)
      expect(measured.layout, `at ${width}px`).toBeLessThanOrEqual(measured.screen)
    }
  })

  test('and not with the currency cross the fixtures do not publish', async ({
    page,
  }) => {
    // The archive on these fixtures publishes no scoped orders document, so
    // the cross is absent here and the page that shipped was measured without
    // it. On mostro.world it is the widest block on the page, and every empty
    // cell in it carries a visually hidden word — 123 of them, each
    // `position: absolute` with no positioned ancestor, so each was laid out
    // against the initial containing block at its static position inside a
    // table far wider than the screen. That put the *document's* scrollable
    // width at 1128px on a 412px phone, which no wrapper's `overflow-x` and no
    // clip on a static ancestor could contain. This builds the same markup
    // `CurrencyMatrix` emits and measures the page around it.
    await open(page)

    await page.evaluate(() => {
      const codes = Array.from({ length: 13 }, (_, i) => `C${i}`)
      const wrapper = document.createElement('div')
      wrapper.className = 'b-matrix'
      wrapper.tabIndex = 0
      const head = `<tr><th scope="col"><span class="b-visually-hidden">instance</span></th>${codes
        .map((code) => `<th scope="col">${code}</th>`)
        .join('')}</tr>`
      const body = Array.from({ length: 8 }, (_, row) => {
        const cells = codes
          .map(
            () =>
              `<td data-level="0"><span aria-hidden="true">·</span>` +
              `<span class="b-visually-hidden">no orders</span></td>`,
          )
          .join('')
        return `<tr><th scope="row">Mostro ${row} (82fa8cb9)</th>${cells}</tr>`
      }).join('')
      wrapper.innerHTML =
        `<table><caption class="b-visually-hidden">the cross</caption>` +
        `<thead>${head}</thead><tbody>${body}</tbody></table>`
      document.querySelector('.b-lower-main')!.prepend(wrapper)
    })

    const measured = await widths(page)

    expect(measured.scrollWidth).toBeLessThanOrEqual(measured.screen)
    expect(measured.layout).toBeLessThanOrEqual(measured.screen)
  })

  test('and does not start sliding after a rotation or a window change', async ({
    page,
  }) => {
    // The map is sized from a measurement, so a viewport that changed and
    // changed back is the case where a stale one would show.
    await open(page)

    await page.setViewportSize({ width: PHONE.height, height: PHONE.width })
    await page.setViewportSize(PHONE)
    const afterRotation = await widths(page)
    expect(afterRotation.scrollWidth).toBeLessThanOrEqual(afterRotation.screen)
    expect(afterRotation.layout).toBeLessThanOrEqual(afterRotation.screen)

    await page.getByLabel(en.header.windowNav, { exact: true }).selectOption('24h')
    const afterWindow = await widths(page)
    expect(afterWindow.scrollWidth).toBeLessThanOrEqual(afterWindow.screen)
    expect(afterWindow.layout).toBeLessThanOrEqual(afterWindow.screen)
  })

  test('gets targets a thumb can hit', async ({ page }) => {
    // WCAG 2.2 AA 2.5.8 asks 24×24 CSS pixels; a phone deserves the 32 the
    // stylesheet gives it.
    await open(page)

    for (const control of [
      page.getByLabel(en.header.language),
      page.getByLabel(en.header.windowNav, { exact: true }),
    ]) {
      const box = (await control.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(32)
      expect(box.width).toBeGreaterThanOrEqual(24)
    }
  })

  test('keeps the currency columns readable when there are more than fit', async ({
    page,
  }) => {
    // The archive on the fixtures publishes no scoped orders document, so the
    // cross itself is absent here. What is under test is the stylesheet, and
    // this measures it against the same markup `CurrencyMatrix` emits: with a
    // dozen currencies on a phone, a fixed layout at `width: 100%` shared the
    // container out and squeezed every column to a few pixels instead of
    // letting the wrapper scroll.
    await open(page)

    const measured = await page.evaluate(() => {
      const wrapper = document.createElement('div')
      wrapper.className = 'b-matrix'
      const codes = Array.from({ length: 12 }, (_, i) => `C${i}`)
      wrapper.innerHTML = `<table><thead><tr><th></th>${codes
        .map((code) => `<th scope="col">${code}</th>`)
        .join('')}</tr></thead><tbody><tr><th scope="row">Mostro</th>${codes
        .map(() => `<td data-level="0">1</td>`)
        .join('')}</tr></tbody></table>`
      document.querySelector('.b-lower-main')!.append(wrapper)
      const cell = wrapper.querySelector('td')!.getBoundingClientRect().width
      const { scrollWidth, clientWidth } = wrapper
      wrapper.remove()
      return { cell, scrollWidth, clientWidth }
    })

    // The artboard's 38px cell survives, and the overflow it causes is the
    // wrapper's to scroll.
    expect(measured.cell).toBeGreaterThanOrEqual(38)
    expect(measured.scrollWidth).toBeGreaterThan(measured.clientWidth)
  })

  test('has no detectable WCAG A or AA violations', async ({ page }) => {
    await open(page)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
})
