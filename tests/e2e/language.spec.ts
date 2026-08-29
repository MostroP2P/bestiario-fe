import { expect, test } from '@playwright/test'
import { fixtures, serveRelay } from './relay'
import { es } from '../../src/i18n/es'
import { pt } from '../../src/i18n/pt'
import { fr } from '../../src/i18n/fr'
import { it } from '../../src/i18n/it'
import { en } from '../../src/i18n/en'

/**
 * The language a reader gets, decided by their browser and nothing else.
 *
 * These run a real browser with a real `Accept-Language`, which is the only
 * way to know the detection works where it has to: `navigator.languages`, in
 * a page that has already shipped.
 */
const events = fixtures()

// Read from the catalogues: a wording correction is not a regression, and a
// test that pins the words would call one.
const cases = [
  { locale: 'es-AR', strings: es },
  { locale: 'pt-BR', strings: pt },
  { locale: 'fr-CA', strings: fr },
  { locale: 'it-IT', strings: it },
] as const

for (const spoken of cases) {
  test.describe(`a reader whose browser is ${spoken.locale}`, () => {
    test.use({ locale: spoken.locale })

    test('gets the site in their language', async ({ page }) => {
      // Arrange
      await serveRelay(page, events)

      // Act
      await page.goto('/')
      await expect(page.locator('.b-kpi strong').first()).not.toBeEmpty()

      // Assert
      await expect(page.locator('.b-stream')).toHaveText(spoken.strings.header.verified)
      await expect(page.locator('.b-rail')).toContainText(spoken.strings.rail.publisher)
    })

    test('and the page says which language it is in', async ({ page }) => {
      // A screen reader pronounces the words with this; getting it wrong is
      // worse than either language alone.
      await serveRelay(page, events)
      await page.goto('/')

      await expect(page.locator('html')).toHaveAttribute('lang', spoken.strings.locale)
    })
  })
}

test.describe('a reader whose browser this site does not speak', () => {
  test.use({ locale: 'de-DE' })

  test('gets English rather than nothing', async ({ page }) => {
    await serveRelay(page, events)
    await page.goto('/')
    await expect(page.locator('.b-kpi strong').first()).not.toBeEmpty()

    await expect(page.locator('.b-stream')).toHaveText(en.header.verified)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

test.describe('a reader with more than one language', () => {
  test('gets the first one this site speaks, not the first one it has', async ({
    page,
  }) => {
    // Arrange — Japanese first, then Canadian French. `locale` sets a single
    // tag, so the list is installed before any application code runs.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'fr-CA'],
        configurable: true,
      })
    })
    await serveRelay(page, events)

    // Act
    await page.goto('/')
    await expect(page.locator('.b-kpi strong').first()).not.toBeEmpty()

    // Assert — Japanese is skipped and French is reached through its region.
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page.locator('.b-stream')).toHaveText(fr.header.verified)
  })

  test('is not overruled by a language it happens to have', async ({ page }) => {
    // Italian is available, but this reader asked for French first.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['fr', 'it'],
        configurable: true,
      })
    })
    await serveRelay(page, events)

    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })

  test('gets English when this site speaks none of them', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ko-KR', 'zh-Hans-CN'],
        configurable: true,
      })
    })
    await serveRelay(page, events)

    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

test.describe('the tab and the shared link', () => {
  test.use({ locale: 'es-AR' })

  test('follow the page, so the title does not contradict it', async ({ page }) => {
    // index.html ships an English title; a Spanish page under it says two
    // different things to a reader and to whoever quotes the link.
    await serveRelay(page, events)
    await page.goto('/')

    await expect(page).toHaveTitle(es.document.title)
    const description = page.locator('meta[name="description"]')
    await expect(description).toHaveAttribute('content', es.document.description)
  })
})
