/**
 * The card this site shows when someone shares it.
 *
 * Run by hand, not by CI: the output is committed, so what a crawler fetches
 * is a file that was looked at once rather than a render nobody saw. Chromium
 * comes from the Playwright install the end-to-end suite already needs.
 *
 *   node scripts/gen-og-image.mjs
 *
 * Two files come out: the 1200x630 share card, and the 180x180 PNG iOS wants
 * when someone adds the site to a home screen — the one icon format that
 * cannot be the SVG everything else uses.
 *
 * 1200x630 is the size every unfurler crops from — X, Telegram, Slack, and
 * the Nostr clients that follow OpenGraph. Anything else gets cropped by
 * someone else's rules.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = new URL('..', import.meta.url)
const at = (path) => fileURLToPath(new URL(path, root))

const dataUri = async (path, mime) =>
  `data:${mime};base64,${(await readFile(at(path))).toString('base64')}`

// Mostro's own mark, not bestiario's book: the card is a claim about whose
// network these figures describe, and the icon is what people recognise.
const logo = await dataUri('assets/brand/mostro-icon-green.svg', 'image/svg+xml')
const mono = await dataUri(
  'node_modules/@fontsource/martian-mono/files/martian-mono-latin-500-normal.woff2',
  'font/woff2',
)
const sans = await dataUri(
  'node_modules/@fontsource/archivo/files/archivo-latin-400-normal.woff2',
  'font/woff2',
)

const page = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family: Mono; src: url(${mono}) format('woff2'); }
  @font-face { font-family: Sans; src: url(${sans}) format('woff2'); }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; display: flex; flex-direction: column;
    justify-content: space-between; padding: 72px 80px;
    background: #060f16; color: #dbe7ee;
    background-image:
      linear-gradient(#0e1a22 1px, transparent 1px),
      linear-gradient(90deg, #0e1a22 1px, transparent 1px);
    background-size: 60px 60px;
  }
  .top { display: flex; align-items: center; gap: 28px; }
  img { height: 132px; }
  .mark { font-family: Mono; font-size: 64px; letter-spacing: -2px; color: #f0f7fb; }
  .tagline {
    font-family: Mono; font-size: 20px; letter-spacing: 6px; color: #2bd9ff;
    margin-top: 10px;
  }
  h1 {
    font-family: Sans; font-size: 54px; line-height: 1.15; font-weight: 400;
    max-width: 940px; color: #f0f7fb;
  }
  p { font-family: Sans; font-size: 27px; line-height: 1.45; color: #a9bfcc; max-width: 900px; margin-top: 22px; }
  .foot {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: Mono; font-size: 22px; letter-spacing: 2px;
    color: #677f90; border-top: 1px solid #16242e; padding-top: 26px;
  }
  .foot strong { color: #2bd9ff; font-weight: 500; }
</style>
<div class="top">
  <img src="${logo}" alt="">
  <div>
    <div class="mark">bestiario</div>
    <div class="tagline">MOSTRO NETWORK OBSERVATORY</div>
  </div>
</div>
<div>
  <h1>The Mostro network, in the open.</h1>
  <p>Peer-to-peer bitcoin trading statistics, read from signed Nostr events and verified in your browser.</p>
</div>
<div class="foot"><span><strong>mostro.world</strong></span><span>NO TRACKERS &middot; NO BACKEND &middot; VERIFIABLE</span></div>
`

const browser = await chromium.launch()
const tab = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
})
await tab.setContent(page)
await tab.evaluate(() => document.fonts.ready)
const shot = await tab.screenshot({ type: 'png' })
await browser.close()

await writeFile(at('public/og.png'), shot)
console.log(`public/og.png — ${(shot.length / 1024).toFixed(1)} KB`)

// The touch icon, from the same favicon the tab shows, on the site's own
// panel colour: iOS composites onto white otherwise and the mark loses its
// edges. Rendered here rather than by hand so the two never drift apart.
const favicon = await dataUri('public/favicon.svg', 'image/svg+xml')
const icon = await chromium.launch()
const iconTab = await icon.newPage({
  viewport: { width: 180, height: 180 },
  deviceScaleFactor: 1,
})
await iconTab.setContent(
  `<style>
     *{margin:0}
     body{width:180px;height:180px;display:flex;align-items:center;
          justify-content:center;background:#060f16}
     img{width:148px;height:148px}
   </style>
   <img src="${favicon}" alt="">`,
)
const iconShot = await iconTab.screenshot({ type: 'png' })
await icon.close()

await writeFile(at('public/apple-touch-icon.png'), iconShot)
console.log(`public/apple-touch-icon.png — ${(iconShot.length / 1024).toFixed(1)} KB`)
