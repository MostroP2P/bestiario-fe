/**
 * The JavaScript budget of SPEC 11: 120 KB gzipped.
 *
 * Enforced in CI rather than watched, because a budget nobody fails is not a
 * budget. Exceeding it is a review conversation, not a warning to scroll
 * past — so this exits non-zero and the deploy does not happen.
 *
 * Only JavaScript counts. The CSS, the fonts and the 108 KB of country
 * geometry are assets the browser fetches once and caches; the bundle is what
 * has to be parsed and run before anything appears.
 *
 * Run: node scripts/check-bundle-size.mjs [budget-in-kb]
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BUDGET_KB = Number(process.argv[2] ?? 120)
const DIR = 'dist/assets'

function jsFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => join(dir, name))
}

let files
try {
  files = jsFiles(DIR)
} catch {
  console.error(`no ${DIR}: run \`npm run build\` first`)
  process.exit(1)
}

if (files.length === 0) {
  console.error(`no JavaScript in ${DIR}: something is wrong with the build`)
  process.exit(1)
}

let total = 0
const rows = files.map((file) => {
  const gzipped = gzipSync(readFileSync(file)).length
  total += gzipped
  return { file, raw: statSync(file).size, gzipped }
})

for (const row of rows.sort((a, b) => b.gzipped - a.gzipped)) {
  console.log(
    `${row.file.padEnd(48)} ${(row.raw / 1024).toFixed(1).padStart(8)} KB  ${(row.gzipped / 1024).toFixed(2).padStart(8)} KB gzip`,
  )
}

const totalKb = total / 1024
const budget = BUDGET_KB
console.log(
  `\n${'total'.padEnd(48)} ${''.padStart(11)}  ${totalKb.toFixed(2).padStart(8)} KB gzip  (budget ${budget} KB)`,
)

if (totalKb > budget) {
  console.error(
    `\nover budget by ${(totalKb - budget).toFixed(2)} KB. SPEC 11: exceeding it is a review conversation, not a warning.`,
  )
  process.exit(1)
}
console.log(`\n${(budget - totalKb).toFixed(2)} KB to spare.`)
