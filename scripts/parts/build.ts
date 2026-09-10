import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp, { type Sharp } from 'sharp'
import { SLOTS, type Manifest, type Part, type Slot } from '../../src/parts/manifest.ts'
import { CANVAS_WIDTH, GEOMETRY } from '../../src/parts/geometry.ts'
import { dominantColor } from './color.ts'
import { loadMeta, nameFromFilename, slugify, type PartMeta } from './meta.ts'
import { writeGeometryJs, writePreview } from './preview.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')
const RAW_DIR = path.join(ROOT, 'assets/raw')
const META_PATH = path.join(ROOT, 'assets/parts.meta.json')
const OUT_DIR = path.join(ROOT, 'public/parts')
const THUMB_SIZE = 160
const ALPHA_THRESHOLD = 200

type Box = { left: number; top: number; width: number; height: number }

// Turn a near-white studio background into transparency (for jpg sources).
async function knockoutWhite(image: Sharp): Promise<Sharp> {
  const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const min = Math.min(r, g, b)
    const bgness = Math.min(1, Math.max(0, (min - 205) / 45))
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = Math.round(255 * (1 - bgness))
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png()
}

// Contiguous occupied range containing `center`, tolerating tiny gaps (anti-aliasing, seams).
function centralSegment(occupied: boolean[], center: number, tolerance = 4): [number, number] {
  let start = center
  while (start >= 0 && !occupied[start]) start -= 1
  if (start < 0) {
    start = occupied.findIndex(Boolean)
    if (start < 0) return [0, occupied.length - 1]
  }
  let end = start
  let gap = 0
  for (let i = start; i < occupied.length; i += 1) {
    if (occupied[i]) {
      end = i
      gap = 0
    } else if (++gap > tolerance) break
  }
  gap = 0
  for (let i = start; i >= 0; i -= 1) {
    if (occupied[i]) {
      start = i
      gap = 0
    } else if (++gap > tolerance) break
  }
  return [start, end]
}

// Bounding box of the blob at the image centre. Ignores stray watermarks in corners.
async function centralBlobBox(image: Sharp): Promise<Box> {
  const { data, info } = await image
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const alphaAt = (x: number, y: number) => data[(y * width + x) * channels + 3]! > ALPHA_THRESHOLD

  let box: Box = { left: 0, top: 0, width, height }
  for (let pass = 0; pass < 2; pass += 1) {
    const cols = Array.from({ length: width }, (_, x) => {
      if (x < box.left || x >= box.left + box.width) return false
      for (let y = box.top; y < box.top + box.height; y += 1) if (alphaAt(x, y)) return true
      return false
    })
    const [x0, x1] = centralSegment(cols, Math.floor(width / 2))
    const rows = Array.from({ length: height }, (_, y) => {
      if (y < box.top || y >= box.top + box.height) return false
      for (let x = x0; x <= x1; x += 1) if (alphaAt(x, y)) return true
      return false
    })
    const [y0, y1] = centralSegment(rows, Math.floor(height / 2))
    box = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
  }
  return box
}

// Lowest opaque row in the central 10% of columns: the torso hem, ignoring hands that hang lower.
async function centralColumnBottom(image: Sharp): Promise<number> {
  const { data, info } = await image
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const x0 = Math.floor(width * 0.45)
  const x1 = Math.ceil(width * 0.55)
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (data[(y * width + x) * channels + 3]! > ALPHA_THRESHOLD) return y + 1
    }
  }
  return height
}

async function loadSource(file: string): Promise<Sharp> {
  const image = sharp(file)
  const meta = await image.metadata()
  return meta.hasAlpha ? image.ensureAlpha() : knockoutWhite(image)
}

type Placed = { buffer: Buffer; left: number; top: number; bottomGap: number }

async function placeOnCanvas(part: Sharp, slot: Slot, meta: PartMeta): Promise<Placed> {
  const geometry = GEOMETRY[slot]
  const { width = 1, height = 1 } = await part.metadata()
  const bottomInset = geometry.bottomInset ?? 0
  const anchorHeight = geometry.anchor === 'hem' ? await centralColumnBottom(part) : height
  const factor =
    (geometry.targetWidth
      ? geometry.targetWidth / width
      : (geometry.targetHeight ?? anchorHeight) / anchorHeight) * (meta.scale ?? 1)
  const sw = Math.max(1, Math.round(width * factor))
  const sh = Math.max(1, Math.round(height * factor))
  const canvasH = geometry.canvasHeight
  let left = Math.round((CANVAS_WIDTH - sw) / 2 + (meta.offsetX ?? 0) * CANVAS_WIDTH)
  let top = Math.round(
    canvasH - bottomInset - anchorHeight * factor + (meta.offsetY ?? 0) * canvasH,
  )

  let scaled = part.clone().resize(sw, sh, { kernel: 'lanczos3' })
  // sharp cannot composite an overlay that spills outside the base; crop the spill.
  const cropLeft = Math.max(0, -left)
  const cropTop = Math.max(0, -top)
  const visibleW = Math.min(sw - cropLeft, CANVAS_WIDTH - Math.max(0, left))
  const visibleH = Math.min(sh - cropTop, canvasH - Math.max(0, top))
  if (cropLeft || cropTop || visibleW < sw || visibleH < sh) {
    console.warn(`  ! part spills outside canvas by ${sw - visibleW}x${sh - visibleH}px, cropping`)
    scaled = sharp(await scaled.png().toBuffer()).extract({
      left: cropLeft,
      top: cropTop,
      width: visibleW,
      height: visibleH,
    })
    left = Math.max(0, left)
    top = Math.max(0, top)
  }
  return {
    buffer: await scaled.png().toBuffer(),
    left,
    top,
    bottomGap: Math.max(0, canvasH - (top + visibleH)),
  }
}

async function processFile(slot: Slot, filename: string, meta: PartMeta): Promise<Part> {
  const name = meta.name ?? nameFromFilename(filename)
  const id = slugify(name)
  const source = await loadSource(path.join(RAW_DIR, slot, filename))
  const box = await centralBlobBox(source)
  const trimmed = sharp(await source.extract(box).png().toBuffer())
  const geometry = GEOMETRY[slot]
  const placed = await placeOnCanvas(trimmed, slot, meta)

  const canvas = sharp({
    create: {
      width: CANVAS_WIDTH,
      height: geometry.canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: placed.buffer, left: placed.left, top: placed.top }])
  const canvasPng = await canvas.png().toBuffer()

  const outDir = path.join(OUT_DIR, slot)
  await writeFile(path.join(outDir, `${id}.png`), canvasPng)
  await sharp(canvasPng)
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(path.join(outDir, `${id}.webp`))
  await trimmed
    .clone()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 82 })
    .toFile(path.join(outDir, `${id}.thumb.webp`))

  return {
    id,
    slot,
    name,
    src: `/parts/${slot}/${id}.webp`,
    png: `/parts/${slot}/${id}.png`,
    thumb: `/parts/${slot}/${id}.thumb.webp`,
    color: await dominantColor(trimmed),
    width: CANVAS_WIDTH,
    height: geometry.canvasHeight,
    bottomGap: placed.bottomGap,
  }
}

const UNORDERED = 1_000

async function main(): Promise<void> {
  const meta = await loadMeta(META_PATH)
  await rm(OUT_DIR, { recursive: true, force: true })
  const parts: Part[] = []

  for (const slot of SLOTS) {
    await mkdir(path.join(OUT_DIR, slot), { recursive: true })
    const files = (await readdir(path.join(RAW_DIR, slot)))
      .filter((f) => /\.(png|jpe?g)$/i.test(f))
      .sort()
      .map((filename) => {
        const key = `${slot}/${filename}`.normalize('NFC')
        return { key, filename, partMeta: meta[key] ?? {} }
      })
      // Explicit `order` first, then filename order.
      .sort((a, b) => (a.partMeta.order ?? UNORDERED) - (b.partMeta.order ?? UNORDERED))
    const seen = new Set<string>()
    for (const { key, filename, partMeta } of files) {
      if (partMeta.exclude) {
        console.log(`- skip ${key}`)
        continue
      }
      console.log(`+ ${key}`)
      const part = await processFile(slot, filename, partMeta)
      if (seen.has(part.id)) throw new Error(`Duplicate id "${part.id}" in slot ${slot}`)
      seen.add(part.id)
      parts.push(part)
    }
  }

  const manifest: Manifest = { generatedAt: new Date().toISOString(), slots: SLOTS, parts }
  await writeFile(path.join(OUT_DIR, 'parts.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writePreview(path.join(ROOT, 'mockups/parts-preview.html'), manifest)
  await writeGeometryJs(path.join(ROOT, 'mockups/_geometry.js'))
  console.log(`\n${parts.length} parts -> public/parts/parts.json`)
}

await main()
