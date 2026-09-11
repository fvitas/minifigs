// Downloads the photos chosen in scripts/parts/picker into assets/raw and registers them in
// assets/parts.meta.json. Usage: pnpm tsx scripts/parts/import-picks.ts ~/Downloads/picks.json
import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { SLOTS, type Slot } from '../../src/parts/manifest.ts'
import { loadMeta, nameFromFilename, slugify, type MetaFile, type PartMeta } from './meta.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')
const RAW_DIR = path.join(ROOT, 'assets/raw')
const META_PATH = path.join(ROOT, 'assets/parts.meta.json')

type Pick = {
  id: number
  slot: Slot
  title: string
  handle: string
  image: string
  crop?: PartMeta['crop']
}

// "Dual-Sided Minifigure Head with Smile (3626pb3013)" -> "Smile"
function cleanName(title: string): string {
  const cleaned = title
    .replace(/\(?\b\d{3,}[a-z0-9]*\b\)?/gi, '')
    .replace(/\/[^/]*\b(arms?|hands?)\b[^/]*/gi, '')
    .replace(
      /\bminifigure,?\b|\bminifig\b|\blego\b|\bdual[- ]sided\b|\bpattern\b|\bprint\b|®|™/gi,
      '',
    )
    .replace(/\bhips (and|&) legs\b|\bhips and\b|\bhead\b|\btorso\b|\blegs\b|\bfaces?\b/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,)])/g, '$1')
    .replace(/^[\s,:–\-/&(]+|[\s,:–\-/&(]+$/g, '')
    .replace(/^(female )?with /i, '$1')
    .replace(/ (with|and|&)$/i, '')
    .trim()
  return cleaned || title.match(/\b\d{3,}[a-z0-9]*\b/)?.[0] || title
}

function isPick(value: unknown): value is Pick {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.title === 'string' &&
    typeof v.image === 'string' &&
    typeof v.slot === 'string' &&
    (SLOTS as readonly string[]).includes(v.slot)
  )
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  )
}

// Part ids come from names, so a second "Smirk" in the same slot becomes "Smirk 2".
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

async function main(): Promise<void> {
  const picksPath = process.argv[2]
  if (!picksPath) throw new Error('Pass the path to picks.json exported from the picker')
  const parsed: unknown = JSON.parse(await readFile(picksPath, 'utf8'))
  if (!Array.isArray(parsed) || !parsed.every(isPick))
    throw new Error('picks.json has an unexpected shape')
  const picks: Pick[] = parsed
  const meta: MetaFile = await loadMeta(META_PATH)
  const taken = await takenNames(meta)

  let added = 0
  for (const pick of picks) {
    const ext = path.extname(new URL(pick.image).pathname) || '.jpg'
    const filename = `cab-${slugify(pick.title)}${ext}`
    const key = `${pick.slot}/${filename}`
    const target = path.join(RAW_DIR, pick.slot, filename)
    if (await exists(target)) {
      console.log(`= ${key} already present`)
    } else {
      const response = await fetch(pick.image)
      if (!response.ok) throw new Error(`${response.status} for ${pick.image}`)
      await writeFile(target, Buffer.from(await response.arrayBuffer()))
      console.log(`+ ${key}`)
      added += 1
    }
    meta[key] = {
      ...meta[key],
      name: meta[key]?.name ?? uniqueName(cleanName(pick.title), taken[pick.slot]),
      ...(pick.crop && { crop: pick.crop }),
    }
  }

  await writeFile(META_PATH, JSON.stringify(meta, null, 2) + '\n')
  console.log(`\n${added} new photos, ${picks.length} picks registered. Run: pnpm parts`)
}

await main()
