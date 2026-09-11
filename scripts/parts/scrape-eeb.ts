// Reads the extraextrabricks.com catalogue into docs/eeb-candidates.json, which feeds the picker.
// The shop photographs every part alone on white, or worn by a plain white display figure, always
// straight on — no composites, no watermark. Its robots.txt asks for one request a second.
// Usage: pnpm tsx scripts/parts/scrape-eeb.ts
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Slot } from '../../src/parts/manifest.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')
const OUT_PATH = path.join(ROOT, 'docs/eeb-candidates.json')
const ORIGIN = 'https://extraextrabricks.com'
const CRAWL_DELAY = 1_000
const AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) minifigs-configurator/1.0'

// `worn` marks a category shot on the white display figure, which the build has to key out.
type Source = { path: string; slot: Slot; group: string; worn: boolean }

const SOURCES: Source[] = [
  { path: '/LEGO-Minifigure-Parts/hair', slot: 'hair', group: 'hair', worn: true },
  { path: '/LEGO-Minifigure-Headgear', slot: 'hair', group: 'headgear', worn: true },
  { path: '/LEGO-Minifigure-Parts/torsos', slot: 'body', group: 'torso', worn: false },
  { path: '/LEGO-Minifigure-Parts/legs', slot: 'pants', group: 'legs', worn: false },
]

export type Candidate = {
  id: number
  slot: Slot
  group: string
  title: string
  category: string
  image: string
  worn: boolean
}

const TILE = '<product-tile product-id='
const HEAD = /^"(\d+)" name="([^"]*)"[\s\S]{0,600}?category="([^"]*)"/
// The tile serves a webp through <source srcset> and a jpg through <img>, both off the same
// cached path; only the path is worth keeping, and the jpg always exists.
const IMAGE = /\/environment\/cache\/images\/(productGfx_\d+_\d+_\d+\/[^"\s]+?)\.(?:jpe?g|webp|png)/
const PAGES = /Page 1 of (\d+)/

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

async function page(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': AGENT } })
  if (!response.ok) throw new Error(`${response.status} for ${url}`)
  return response.text()
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function parse(html: string, source: Source): Candidate[] {
  const found: Candidate[] = []
  for (const chunk of html.split(TILE).slice(1)) {
    const head = HEAD.exec(chunk)
    const image = IMAGE.exec(chunk)
    if (!head || !image) continue
    found.push({
      id: Number(head[1]),
      slot: source.slot,
      group: source.group,
      title: decode(head[2] ?? ''),
      category: decode(head[3] ?? ''),
      image: `${ORIGIN}/environment/cache/images/${image[1]}.jpg`,
      worn: source.worn,
    })
  }
  return found
}

async function main(): Promise<void> {
  const candidates: Candidate[] = []
  const seen = new Set<number>()
  for (const source of SOURCES) {
    const first = await page(ORIGIN + source.path)
    const pages = Number(PAGES.exec(first)?.[1] ?? 1)
    let added = 0
    for (let n = 1; n <= pages; n += 1) {
      const html = n === 1 ? first : (await wait(CRAWL_DELAY), await page(`${ORIGIN}${source.path}/${n}`))
      for (const candidate of parse(html, source)) {
        if (seen.has(candidate.id)) continue
        seen.add(candidate.id)
        candidates.push(candidate)
        added += 1
      }
    }
    console.log(`${source.path} · ${pages} pages · ${added} candidates`)
    await wait(CRAWL_DELAY)
  }
  await writeFile(OUT_PATH, JSON.stringify(candidates, null, 2) + '\n')
  console.log(`\n${candidates.length} candidates -> docs/eeb-candidates.json`)
}

await main()
