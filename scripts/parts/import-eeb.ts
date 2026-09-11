// Downloads the extraextrabricks catalogue scraped by scrape-eeb.ts into assets/raw and registers
// it in assets/parts.meta.json. Photos of a worn piece get `keyOut: 'white'` so the build segments
// the display figure away. Already-present files are left alone, so this is safe to re-run.
// Usage: pnpm tsx scripts/parts/import-eeb.ts [hair|body|pants ...]
import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { SLOTS, type Slot } from '../../src/parts/manifest.ts'
import { loadMeta, nameFromFilename, slugify, type MetaFile } from './meta.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')
const RAW_DIR = path.join(ROOT, 'assets/raw')
const META_PATH = path.join(ROOT, 'assets/parts.meta.json')
const CANDIDATES_PATH = path.join(ROOT, 'docs/eeb-candidates.json')
const CRAWL_DELAY = 1_000
const AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) minifigs-configurator/1.0'

type Candidate = {
  id: number
  slot: Slot
  group: string
  title: string
  category: string
  image: string
  worn: boolean
}

// The slot word only leads the title ("hair - female, black, curly"); "mask" or "hat" in a headgear
// title is the piece itself and stays.
const SLOT_WORD = /^(hair|torso|legs|leg|head)\b[\s-]*/i

// "LEGO minifigure hair - female, black, curly" -> "Female Black Curly"
export function cleanName(title: string): string {
  const cleaned = title
    .replace(/®|™/g, '')
    .replace(/\blego\b|\bminifigures?\b|\bminifig\b|\bfigurine\b|\bfigure\b/gi, '')
    .replace(/\s*[-–]\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^-\s*/, '')
    .replace(SLOT_WORD, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
  return cleaned || title
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  )
}

// Part ids come from names, so a second "Black Curly" in the same slot becomes "Black Curly 2".
async function takenNames(meta: MetaFile): Promise<Record<Slot, Set<string>>> {
  const taken = Object.fromEntries(SLOTS.map((slot) => [slot, new Set<string>()])) as Record<
    Slot,
    Set<string>
  >
  for (const slot of SLOTS) {
    for (const filename of await readdir(path.join(RAW_DIR, slot))) {
      const key = `${slot}/${filename}`.normalize('NFC')
      taken[slot].add(slugify(meta[key]?.name ?? nameFromFilename(filename)))
    }
  }
  return taken
}

function uniqueName(base: string, taken: Set<string>): string {
  let name = base
  for (let n = 2; taken.has(slugify(name)); n += 1) name = `${base} ${n}`
  taken.add(slugify(name))
  return name
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main(): Promise<void> {
  const only = process.argv.slice(2).filter((slot): slot is Slot =>
    (SLOTS as readonly string[]).includes(slot),
  )
  const parsed: unknown = JSON.parse(await readFile(CANDIDATES_PATH, 'utf8'))
  if (!Array.isArray(parsed)) throw new Error(`${CANDIDATES_PATH} must be an array`)
  const candidates = (parsed as Candidate[]).filter(
    (candidate) => !only.length || only.includes(candidate.slot),
  )
  const meta: MetaFile = await loadMeta(META_PATH)
  const taken = await takenNames(meta)

  let added = 0
  let failed = 0
  for (const candidate of candidates) {
    const filename = `eeb-${candidate.id}-${slugify(candidate.title)}.jpg`
    const key = `${candidate.slot}/${filename}`.normalize('NFC')
    const target = path.join(RAW_DIR, candidate.slot, filename)
    if (await exists(target)) {
      console.log(`= ${key}`)
    } else {
      await wait(CRAWL_DELAY)
      const response = await fetch(candidate.image, { headers: { 'User-Agent': AGENT } })
      if (!response.ok) {
        console.log(`! ${response.status} for ${candidate.image}`)
        failed += 1
        continue
      }
      await writeFile(target, Buffer.from(await response.arrayBuffer()))
      console.log(`+ ${key}`)
      added += 1
    }
    meta[key] = {
      ...meta[key],
      name: meta[key]?.name ?? uniqueName(cleanName(candidate.title), taken[candidate.slot]),
      ...(candidate.worn && { keyOut: 'white' as const }),
    }
  }

  await writeFile(META_PATH, JSON.stringify(meta, null, 2) + '\n')
  console.log(`\n${added} new photos, ${failed} failed, ${candidates.length} registered. Run: pnpm parts`)
}

await main()
