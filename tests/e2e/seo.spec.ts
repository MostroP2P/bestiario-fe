import { expect, test } from '@playwright/test'
import { fixtures, serveRelay } from './relay'

/**
 * What a crawler is handed.
 *
 * These assert against the built site over HTTP, because every one of them is
 * about a file or a header a search engine fetches on its own — not about
 * anything the application renders. A unit test could not tell you whether
 * `robots.txt` survived the build.
 */
const events = fixtures()

const SITE = 'https://mostro.world'

test.describe('the files a crawler asks for by name', () => {
  test('robots.txt is served and points at the sitemap', async ({ request }) => {
    // Act
    const response = await request.get('/robots.txt')

    // Assert
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toContain('User-agent: *')
    expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })

  test('the sitemap is well formed and names the canonical URL', async ({ request }) => {
    // Act
    const response = await request.get('/sitemap.xml')

    // Assert
    expect(response.status()).toBe(200)
    const body = await response.text()
    // The namespace is `sitemaps.org`, plural. Search Console rejects the
    // singular outright, and it is a single letter to get wrong.
    expect(body).toContain('http://www.sitemaps.org/schemas/sitemap/0.9')
    expect(body).toContain(`<loc>${SITE}/</loc>`)
  })

  test('the share card exists at the URL the metadata promises', async ({ request }) => {
    // Act
    const response = await request.get('/og.png')

    // Assert
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')
  })
})

test.describe('the head of the document', () => {
  test('names one canonical URL', async ({ page }) => {
    // Act
    await page.goto('/')

    // Assert
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${SITE}/`,
    )
  })

  test('carries an unfurlable card with absolute image URLs', async ({ page }) => {
    // A relative `og:image` resolves against nothing: the crawler that reads
    // it is not on this page and has no base to resolve it with.
    // Act
    await page.goto('/')

    // Assert
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `${SITE}/`,
    )
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `${SITE}/og.png`,
    )
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    )
  })

  test('describes the site in structured data that parses', async ({ page }) => {
    // Only the fields asserted below: this is a shape check, not a schema.
    type LinkedData = {
      readonly '@type': string
      readonly url: string
      readonly publisher: { readonly name: string }
    }

    // Act
    await page.goto('/')
    const raw = await page.locator('script[type="application/ld+json"]').textContent()

    // Assert
    const data = JSON.parse(raw ?? '') as LinkedData
    expect(data['@type']).toBe('WebSite')
    expect(data.url).toBe(`${SITE}/`)
    expect(data.publisher.name).toBe('Mostro')
  })
})

test.describe('the page before the bundle runs', () => {
  test('says what the site is, in the HTML itself', async ({ request }) => {
    // Not `page.goto`: this is the document as it leaves the server, which is
    // all a crawler that runs no JavaScript will ever have.
    // Act
    const html = await (await request.get('/')).text()

    // Assert
    expect(html).toContain('<h1>bestiario')
    expect(html).toContain('peer-to-peer bitcoin')
    expect(html).toContain('Nostr')
  })

  test('is gone once the application has mounted', async ({ page }) => {
    // Two versions of the same page at once is worse than either.
    // Arrange
    await serveRelay(page, events)

    // Act
    await page.goto('/')
    await expect(page.locator('.b-kpi strong').first()).not.toBeEmpty()

    // Assert
    await expect(page.locator('.b-static')).toHaveCount(0)
    await expect(page.locator('h1')).toHaveCount(1)
  })
})
