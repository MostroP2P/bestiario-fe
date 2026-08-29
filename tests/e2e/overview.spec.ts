import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { dOf, fixtures, serveRelay } from './relay'
import { en } from '../../src/i18n/en'

const events = fixtures()

test.describe('the overview', () => {
  test.beforeEach(async ({ page }) => {
    await serveRelay(page, events)
  })

  test('renders the figures the publisher signed', async ({ page }) => {
    // Arrange / Act
    await page.goto('/')

    // Assert — the KPI figures arrive, verified, into the shell.
    const kpis = page.locator('.b-kpi strong')
    await expect(kpis).toHaveCount(4)
    await expect(kpis.first()).not.toBeEmpty()
    await expect(page.locator('.b-stream')).toHaveText('VERIFIED')
  })

  test('shows skeletons before them, never a spinner', async ({ page }) => {
    // Arrange — the relay takes its time, which is the state a reader on a
    // slow connection sees and the one the shell has to hold.
    await serveRelay(page, events, 4000)

    // Act
    await page.goto('/')

    // Assert — the shell is whole, the figures are skeletons, and nothing
    // anywhere is a spinner.
    await expect(page.locator('.b-skeleton-map')).toBeVisible()
    await expect(page.locator('.b-skeleton').first()).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Loading')
    await expect(page.locator('.b-rail')).toBeVisible()
    await expect(page.locator('.b-kpi strong')).toHaveCount(0)
  })

  test('switches documents when the window changes', async ({ page }) => {
    // Arrange
    await page.goto('/')
    const orders = page.locator('.b-kpi strong').first()
    await expect(orders).not.toBeEmpty()
    const before = await orders.textContent()

    // Act — 24 h is a different document, not a recomputation.
    const window = page.getByLabel(en.header.windowNav, { exact: true })
    await window.selectOption('24h')

    // Assert
    await expect(window).toHaveValue('24h')
    await expect(orders).not.toHaveText(before ?? '')
  })

  test('draws a market on the map for every currency it can place', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('[data-layer="currencies"] > g').first()).toBeVisible()
    await expect(page.locator('[data-layer="arcs"] path').first()).toBeVisible()
  })

  test('keeps the explanation off the drawing at every width', async ({ page }) => {
    // Arrange — the caption was written for the artboard's empty ocean, and
    // the ocean runs out as the box narrows: by 1024 the projection fills it
    // edge to edge and the paragraph sat on North America and on the very
    // node it was describing. 1024 is where that first bites, 1440 is the
    // artboard's own width.
    await page.goto('/')
    await expect(page.locator('.b-kpi strong').first()).not.toBeEmpty()

    for (const width of [1024, 1280, 1440]) {
      // Act
      await page.setViewportSize({ width, height: 900 })
      const caption = (await page.locator('.b-map-caption').boundingBox())!
      const canvas = (await page.locator('.b-map-canvas').boundingBox())!

      // Assert — the words are below the globe, never over it.
      expect(canvas.y + canvas.height, `at ${width}px`).toBeLessThanOrEqual(caption.y)
    }
  })
})

test.describe('absence', () => {
  test.beforeEach(async ({ page }) => {
    await serveRelay(page, events)
  })

  test('never renders an em dash without saying which absence it is', async ({
    page,
  }) => {
    // The rule, not one figure: which figures are absent depends on the
    // archive, and the archive moves. What must hold on every render is that
    // a dash a reader can see is a dash a screen reader can read.
    await page.goto('/')
    await expect(page.locator('.b-kpi strong').first()).not.toBeEmpty()

    const absent = page.locator('.b-figure[data-absent="true"]')
    for (let i = 0; i < (await absent.count()); i++) {
      const figure = absent.nth(i)
      await expect(figure).toContainText('—')
      await expect(figure.locator('.b-visually-hidden')).not.toBeEmpty()
    }
  })

  test('never renders a figure as a zero it was not given', async ({ page }) => {
    // A dash and a zero mean different things, and the one thing this map
    // must never do is turn the first into the second.
    await page.goto('/')
    await expect(page.locator('.b-kpi strong').first()).not.toBeEmpty()

    const absent = page.locator('.b-figure[data-absent="true"]')
    for (let i = 0; i < (await absent.count()); i++) {
      await expect(absent.nth(i)).not.toHaveText(/^0/)
    }
  })
})

test.describe('inferred figures', () => {
  test.beforeEach(async ({ page }) => {
    await serveRelay(page, events)
  })

  test('are distinguished by a marker and not by a colour alone', async ({ page }) => {
    await page.goto('/')
    const row = page.locator('.b-pair', { hasText: 'implied volume' })

    await expect(row.locator('.b-inferred-mark')).toBeVisible()
    await expect(row.locator('.b-inferred-mark')).toContainText('inf')
  })

  test('reach their assumption by keyboard, not only under a pointer', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/')
    const mark = page
      .locator('.b-pair', { hasText: 'implied volume' })
      .locator('.b-inferred-mark')
    await expect(mark).toBeVisible()
    const tooltip = mark.locator('.b-tooltip')
    await expect(tooltip).toBeHidden()

    // Act — focus, no pointer involved.
    await mark.focus()

    // Assert
    await expect(tooltip).toBeVisible()
    await expect(tooltip).not.toBeEmpty()
  })

  test('carry the assumption in their accessible name', async ({ page }) => {
    await page.goto('/')
    const mark = page
      .locator('.b-pair', { hasText: 'implied volume' })
      .locator('.b-inferred-mark')

    await expect(mark).toHaveAttribute('aria-label', /^Inferred figure\. .+/)
  })
})

test.describe('what the site says about its own trust', () => {
  test('names the publisher, the relays and the archive it read', async ({ page }) => {
    await serveRelay(page, events)
    await page.goto('/')

    const rail = page.locator('.b-rail')
    await expect(rail).toContainText('PUBLISHER')
    await expect(rail).toContainText('relay.mostro.network')
    await expect(rail).toContainText('ARCHIVE')
    await expect(rail).toContainText('SNAPSHOT')
    // A signature proves who published, and nothing about correctness.
    await expect(rail).toContainText('not that they are right')
  })

  test('shows the failure and no figure when nothing verifies', async ({ page }) => {
    // Arrange — every relay silent.
    await serveRelay(page, [])

    // Act
    await page.goto('/')

    // Assert
    await expect(page.getByRole('alert')).toContainText('No verified figures')
    await expect(page.locator('.b-kpi strong')).toHaveCount(0)
  })

  test('refuses an index signed by anybody else', async ({ page }) => {
    // Arrange — the documents are genuine; the index is not this publisher's.
    const index = events.find((event) => dOf(event) === 'index')!
    const forged = { ...index, pubkey: 'f'.repeat(64) }
    await serveRelay(page, [forged, ...events.filter((e) => dOf(e) !== 'index')])

    // Act
    await page.goto('/')

    // Assert — fatal, and no figure at all.
    await expect(page.getByRole('alert')).toContainText('No verified figures')
    await expect(page.locator('.b-kpi strong')).toHaveCount(0)
  })
})

test.describe('accessibility', () => {
  test('has no detectable WCAG A or AA violations', async ({ page }) => {
    await serveRelay(page, events)
    await page.goto('/')
    await expect(page.locator('.b-kpi strong').first()).not.toBeEmpty()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual(
      [],
    )
  })
})
