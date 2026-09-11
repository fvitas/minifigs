// Applies the verdicts from the assembled review page: parts marked "not good" get
// `"exclude": true` in assets/parts.meta.json, parts marked good lose it. The raw photo stays, so
// a verdict is always reversible. Usage: pnpm tsx scripts/parts/apply-review.ts
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { SLOTS, type Slot } from '../../src/parts/manifest.ts'
import { loadMeta, nameFromFilename, slugify, type MetaFile } from './meta.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')
const RAW_DIR = path.join(ROOT, 'assets/raw')
const META_PATH = path.join(ROOT, 'assets/parts.meta.json')
const REVIEW_PATH = path.join(ROOT, 'docs/part-review.json')
const IMAGE = /\.(png|jpe?g|webp)$/i

type Verdict = 'good' | 'bad'
type ReviewEntry = { id: string; slot: Slot; name: string; verdict: Verdict }

function isEntry(value: unknown): value is ReviewEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    (SLOTS as readonly string[]).includes(entry.slot as string) &&
    (entry.verdict === 'good' || entry.verdict === 'bad')
  )
}

// Part ids are slugs of the part name, so the meta key behind an id has to be derived the same way
// the pipeline derives it.
async function keyById(meta: MetaFile): Promise<Map<string, string>> {
  const keys = new Map<string, string>()
  for (const slot of SLOTS) {
    for (const filename of await readdir(path.join(RAW_DIR, slot))) {
      if (!IMAGE.test(filename)) continue
      const key = `${slot}/${filename}`.normalize('NFC')
      keys.set(`${slot}:${slugify(meta[key]?.name ?? nameFromFilename(filename))}`, key)
    }
  }
  return keys
}

async function main(): Promise<void> {
  const parsed: unknown = JSON.parse(await readFile(REVIEW_PATH, 'utf8'))
  const entries = (parsed as { parts?: unknown }).parts
  if (!Array.isArray(entries) || !entries.every(isEntry))
    throw new Error(`${REVIEW_PATH} has an unexpected shape`)
  const meta: MetaFile = await loadMeta(META_PATH)
  const keys = await keyById(meta)

  let excluded = 0
  let restored = 0
  for (const entry of entries as ReviewEntry[]) {
    const key = keys.get(`${entry.slot}:${entry.id}`)
    if (!key) {
      console.warn(`? ${entry.slot}/${entry.id} has no raw photo, skipped`)
      continue
    }
    if (entry.verdict === 'bad' && !meta[key]?.exclude) {
      meta[key] = { ...meta[key], exclude: true }
      console.log(`- ${key} (${entry.name})`)
      excluded += 1
    }
    if (entry.verdict === 'good' && meta[key]?.exclude) {
      const { exclude: _, ...rest } = meta[key]
      meta[key] = rest
      console.log(`+ ${key} (${entry.name})`)
      restored += 1
    }
  }

  await writeFile(META_PATH, JSON.stringify(meta, null, 2) + '\n')
  console.log(`\n${excluded} excluded, ${restored} restored. Run: pnpm parts`)
}

await main()
