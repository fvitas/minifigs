import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp, { type Sharp } from 'sharp'
import { SLOTS, type Manifest, type Part, type Slot } from '../../src/parts/manifest.ts'
import { CANVAS_WIDTH, GEOMETRY } from '../../src/parts/geometry.ts'
import { dominantColor } from './color.ts'
import { loadMeta, nameFromFilename, slugify, type PartMeta } from './meta.ts'
import { eraseKey, readStrokes, type EraseFile, type Stroke } from './strokes.ts'
import { writeGeometryJs, writePreview } from './preview.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')
const RAW_DIR = path.join(ROOT, 'assets/raw')
const META_PATH = path.join(ROOT, 'assets/parts.meta.json')
const ERASE_PATH = path.join(ROOT, 'assets/parts.erase.json')
const MASK_DIR = path.join(ROOT, 'assets/masks')
const OUT_DIR = path.join(ROOT, 'public/parts')
const THUMB_SIZE = 160
const ALPHA_THRESHOLD = 200

type Box = { left: number; top: number; width: number; height: number }

// The studio background is pure white: every jpg source has its border sitting at 250+. So the
// background is not "everything pale" but the pale region you reach walking in from the border. A
// white sleeve is just as pale as the paper but is never reachable from outside, so it stays opaque
// instead of ghosting the way a plain brightness key leaves it.
const BG_KEY = 246
// Jpeg ringing darkens the paper for a few pixels around a hard edge, too dark for the key to walk
// through. Let the background creep that far on a looser one, short of any garment but past the ring.
const BG_FRINGE = 3
// How far the key is eroded before the walk, and dilated back after it.
const BG_ERODE = 3
const FRINGE_OPAQUE = 205
const FRINGE_CLEAR = 250

// Torsos only for now: the other slots are retouched against the old key and must not shift.
const RECLAIM_SLOTS = new Set<Slot>(['body'])

const ramp = (value: number, opaque: number, clear: number) =>
  Math.round(255 * (1 - Math.min(1, Math.max(0, (value - opaque) / (clear - opaque)))))

// The narrow key is what the part is made of; `guide` carries the old wide key, which is only ever
// read for geometry. The wide key eats the jpeg ringing around an edge, so the gap between the two
// photos of a front+back composite stays empty and the split and the bounding box still find it.
type Keyed = { image: Sharp; guide?: Sharp }

async function knockoutWhite(image: Sharp, reclaim: boolean): Promise<Keyed> {
  const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const pixels = width * height
  const min = new Uint8Array(pixels)
  for (let i = 0, o = 0; i < data.length; i += 3, o += 1) {
    min[o] = Math.min(data[i]!, data[i + 1]!, data[i + 2]!)
  }

  const wideKey = () => {
    const flat = Buffer.alloc(pixels * 4)
    for (let i = 0, o = 0; i < pixels; i += 1, o += 4) {
      flat[o] = data[i * 3]!
      flat[o + 1] = data[i * 3 + 1]!
      flat[o + 2] = data[i * 3 + 2]!
      flat[o + 3] = ramp(min[i]!, FRINGE_OPAQUE, FRINGE_CLEAR)
    }
    return sharp(flat, { raw: { width, height, channels: 4 } }).png()
  }

  if (!reclaim) return { image: wideKey() }

  const keyed = new Uint8Array(pixels)
  for (let i = 0; i < pixels; i += 1) keyed[i] = min[i]! > BG_KEY ? 1 : 0

  // What holds a white sleeve apart from the paper is not its brightness, which is the same, but
  // that the seam between them is a neck one or two anti-aliased pixels wide. Erode the keyed region
  // before the walk and that neck pinches shut, so the flood can no longer squeeze through into a
  // specular highlight; the paper is far too wide for the erosion to reach across.
  let seed = keyed
  for (let step = 0; step < BG_ERODE; step += 1) {
    const next = new Uint8Array(pixels)
    for (let i = 0; i < pixels; i += 1) {
      if (!seed[i]) continue
      const x = i % width
      const y = (i - x) / width
      // Off the frame counts as keyed, or the border the walk starts from would erode away.
      if (x > 0 && !seed[i - 1]) continue
      if (x < width - 1 && !seed[i + 1]) continue
      if (y > 0 && !seed[i - width]) continue
      if (y < height - 1 && !seed[i + width]) continue
      next[i] = 1
    }
    seed = next
  }

  let front: number[] = []
  // Grow `mark` out of `front` through everything `allow` admits, `steps` rings deep.
  const grow = (mark: Uint8Array, allow: (i: number) => boolean, steps: number) => {
    for (let step = 0; step < steps && front.length; step += 1) {
      const batch = front
      front = []
      for (const i of batch) {
        const x = i % width
        const y = (i - x) / width
        const take = (j: number) => {
          if (mark[j] || !allow(j)) return
          mark[j] = 1
          front.push(j)
        }
        if (x > 0) take(i - 1)
        if (x < width - 1) take(i + 1)
        if (y > 0) take(i - width)
        if (y < height - 1) take(i + width)
      }
    }
  }
  const queue = (test: (i: number) => boolean) => {
    front = []
    for (let i = 0; i < pixels; i += 1) if (test(i)) front.push(i)
  }
  const onBorder = (i: number) =>
    i < width || i >= pixels - width || i % width === 0 || i % width === width - 1

  const outside = new Uint8Array(pixels)
  queue((i) => seed[i] === 1 && onBorder(i))
  for (const i of front) outside[i] = 1
  grow(outside, (i) => seed[i] === 1, Infinity)
  // Give back the rim the erosion took. It stops short of the neck, which is narrower than the bite.
  queue((i) => outside[i] === 1)
  grow(outside, (i) => keyed[i] === 1, BG_ERODE)

  const fringe = new Uint8Array(pixels)
  queue((i) => outside[i] === 1)
  grow(fringe, (i) => !outside[i] && min[i]! > FRINGE_OPAQUE, BG_FRINGE)

  const out = Buffer.alloc(pixels * 4)
  for (let i = 0, o = 0; i < pixels; i += 1, o += 4) {
    out[o] = data[i * 3]!
    out[o + 1] = data[i * 3 + 1]!
    out[o + 2] = data[i * 3 + 2]!
    // The narrow key only decides what counts as background; what it is worth is the old wide ramp,
    // or the paper itself comes back as a pale halo everywhere it sits a shade under 254.
    out[o + 3] = outside[i] || fringe[i] ? ramp(min[i]!, FRINGE_OPAQUE, FRINGE_CLEAR) : 255
  }
  return { image: sharp(out, { raw: { width, height, channels: 4 } }).png(), guide: wideKey() }
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

// Front+back composites: two tall blocks separated by a low stretch that is empty or holds only
// touching hands (bottom-heavy). Only the upper 60% of rows count, so hands barely register.
// A single pair of legs also has a low stretch, but it holds the hips (top-heavy).
// Returns the column to split at, or null for a single photo.
async function splitColumn(image: Sharp): Promise<number | null> {
  const { data, info } = await image
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const opaque = (x: number, y: number) => data[(y * width + x) * channels + 3]! > ALPHA_THRESHOLD
  const rows = Math.floor(height * 0.6)
  const occupancy = Array.from({ length: width }, (_, x) => {
    let count = 0
    for (let y = 0; y < rows; y += 1) if (opaque(x, y)) count += 1
    return count
  })
  const peak = Math.max(...occupancy)
  const tall = (x: number) => occupancy[x]! >= peak * 0.5
  // The stretch must lie between blocks, not at the edge of an off-centre single photo.
  const firstTall = occupancy.findIndex((_, x) => tall(x))
  const lastTall = occupancy.findLastIndex((_, x) => tall(x))
  let best: [number, number] | null = null
  for (
    let x = Math.max(firstTall + 1, Math.floor(width * 0.3));
    x <= Math.min(lastTall - 1, Math.ceil(width * 0.7));
    x += 1
  ) {
    if (tall(x)) continue
    let end = x
    while (!tall(end + 1)) end += 1
    if (!best || end - x > best[1] - best[0]) best = [x, end]
    x = end
  }
  if (!best || best[1] - best[0] < 2) return null
  const [start, end] = best
  const stretch = occupancy.slice(start, end + 1)
  if (Math.min(...stretch) < peak * 0.1) return Math.round((start + end) / 2)
  let ySum = 0
  let count = 0
  for (let x = start; x <= end; x += 1) {
    for (let y = 0; y < rows; y += 1) {
      if (!opaque(x, y)) continue
      ySum += y
      count += 1
    }
  }
  return ySum / count > rows / 2 ? Math.round((start + end) / 2) : null
}

type Source = Keyed & { stand?: StandAnchor }

// Corners are rounded by this much of the rectangle's shorter side: the openings worth cutting by
// hand are moulded recesses, and a square corner would read as a slot punched through the piece.
const CUT_RADIUS = 0.2

async function cutOpenings(source: Source, cuts: PartMeta['cut']): Promise<Source> {
  if (!cuts?.length) return source
  return {
    ...source,
    image: await cutImage(source.image, cuts),
    guide: source.guide && (await cutImage(source.guide, cuts)),
  }
}

async function cutImage(image: Sharp, cuts: NonNullable<PartMeta['cut']>): Promise<Sharp> {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const out = Buffer.from(data)
  for (const [x, y, w, h] of cuts) {
    const left = Math.max(0, Math.round(x * width))
    const top = Math.max(0, Math.round(y * height))
    const right = Math.min(width, Math.round((x + w) * width))
    const bottom = Math.min(height, Math.round((y + h) * height))
    const radius = CUT_RADIUS * Math.min(right - left, bottom - top)
    for (let row = top; row < bottom; row += 1) {
      for (let col = left; col < right; col += 1) {
        const dx = Math.max(left + radius - col, col - (right - 1 - radius), 0)
        const dy = Math.max(top + radius - row, row - (bottom - 1 - radius), 0)
        if (dx * dx + dy * dy > radius * radius) continue
        out[(row * width + col) * channels + 3] = 0
      }
    }
  }
  return sharp(out, { raw: { width, height, channels } }).png()
}

async function loadSource(slot: Slot, file: string, meta: PartMeta): Promise<Source> {
  return cutOpenings(await readSource(slot, file, meta), meta.cut)
}

// Photos whose subject was cut by `pnpm masks` wear that mask as their alpha. The mask is a source
// asset like the photo itself, so the build stays plain sharp and needs nothing from macOS.
async function wearMask(
  image: Sharp,
  slot: Slot,
  file: string,
  keep: PartMeta['keep'],
): Promise<Sharp> {
  const name = `${path.basename(file).replace(/\.[^.]+$/, '')}.png`
  const cut = await sharp(path.join(MASK_DIR, slot, name))
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch(() => {
      throw new Error(`no mask for ${slot}/${name}, run \`pnpm masks\``)
    })
  const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  if (cut.info.width !== width || cut.info.height !== height) {
    throw new Error(
      `mask for ${slot}/${name} is ${cut.info.width}x${cut.info.height}, photo is ${width}x${height}`,
    )
  }
  // The key is no use over a white sleeve, but inside a `keep` rectangle it is the only thing that
  // still sees the piece the mask dropped, and it never calls plastic paper.
  const boxes = keep ?? []
  const kept = boxes.length
    ? (await (await knockoutWhite(image, true)).image.raw().toBuffer()).filter(
        (_, i) => i % 4 === 3,
      )
    : null
  const out = Buffer.alloc(width * height * 4)
  for (let i = 0, o = 0; i < width * height; i += 1, o += 4) {
    out[o] = data[i * 3]!
    out[o + 1] = data[i * 3 + 1]!
    out[o + 2] = data[i * 3 + 2]!
    const x = i % width
    const y = (i - x) / width
    const restore = kept !== null && boxes.some(inside(x / width, y / height))
    out[o + 3] = restore ? Math.max(cut.data[i]!, kept[i]!) : cut.data[i]!
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png()
}

const inside =
  (x: number, y: number) =>
  ([left, top, width, height]: [number, number, number, number]) =>
    x >= left && x < left + width && y >= top && y < top + height

async function readSource(slot: Slot, file: string, meta: PartMeta): Promise<Source> {
  const raw = sharp(file)
  const { width = 0, height = 0, hasAlpha } = await raw.metadata()
  const { image, guide } = meta.subject
    ? { image: await wearMask(raw, slot, file, meta.keep), guide: undefined }
    : hasAlpha
      ? { image: raw.ensureAlpha(), guide: undefined }
      : await knockoutWhite(raw, RECLAIM_SLOTS.has(slot))
  if (meta.keyOut === 'red') return keyOutRedStand(image)
  const segment = meta.keyOut === 'white'
  if (!meta.crop) return segment ? segmentPiece(image, meta.keyFloor) : { image, guide }
  const split = await splitColumn(guide ?? image)
  if (split === null) {
    console.log('  · single photo, crop ignored')
    return { image, guide }
  }
  const box =
    meta.crop === 'left'
      ? { left: 0, top: 0, width: split, height }
      : { left: split, top: 0, width: width - split, height }
  const cropped = sharp(await image.extract(box).png().toBuffer()).ensureAlpha()
  if (segment) return segmentPiece(cropped, meta.keyFloor)
  return { image: cropped, guide: guide && sharp(await guide.extract(box).png().toBuffer()) }
}

// Where the display figure's head is in the photo: `chinRow` is the head's lowest row, `centerX`
// its axis, `headWidth` its width (`estimated` when hair hides the sides of the head).
type StandAnchor = { headWidth: number; estimated: boolean; centerX: number; chinRow: number }

// Saturated red, but not orange (orange hair shading has g well above b).
const isRed = (r: number, g: number, b: number) =>
  r > 60 && g < 0.45 * r && b < 0.45 * r && r - Math.max(g, b) > 35 && g - b < 0.15 * r

// Longest run of `test` pixels in a row, as [start, end] or null.
function longestRun(test: (x: number) => boolean, width: number): [number, number] | null {
  let best: [number, number] | null = null
  for (let x = 0; x < width; x += 1) {
    if (!test(x)) continue
    let end = x
    while (end + 1 < width && test(end + 1)) end += 1
    if (!best || end - x > best[1] - best[0]) best = [x, end]
    x = end
  }
  return best
}

async function keyOutRedStand(image: Sharp): Promise<Source> {
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const red = (x: number, y: number) => {
    const i = (y * width + x) * channels
    return isRed(data[i]!, data[i + 1]!, data[i + 2]!)
  }
  // Beyond the head's pink fringe there is either background or a piece covering the side.
  const background = (x: number, y: number) => {
    if (x < 0 || x >= width) return true
    const i = (y * width + x) * channels
    return data[i + 3]! < 50 || Math.min(data[i]!, data[i + 1]!, data[i + 2]!) > 150
  }
  const runs = Array.from({ length: height }, (_, y) => longestRun((x) => red(x, y), width))
  const runWidth = (y: number) => (runs[y] ? runs[y]![1] - runs[y]![0] + 1 : 0)

  // Walk down from the first red row: the head (or the face between hair) is the widest red run
  // until it narrows into the neck. Below the neck a red torso widens again; a black one shows
  // nothing and has to be cropped away.
  const top = runs.findIndex((run) => run && run[1] - run[0] > width * 0.05)
  if (top < 0) throw new Error('no red display figure found')
  const rowsBelow = (y: number, count: number) =>
    Array.from({ length: count }, (_, i) => runWidth(Math.min(height - 1, y + i)))
  // Strands, a mohawk's gap or a hood's rim dent the run for a few rows; the neck narrows for
  // good. A face seen through an opening widens slowly, so the head must be tall before it ends.
  let plateau = 0
  let widest = top
  let fullRows = 0
  let neckRow = height
  for (let y = top; y < height; y += 1) {
    if (runWidth(y) > plateau) {
      plateau = runWidth(y)
      widest = y
    }
    if (runWidth(y) >= plateau * 0.8) fullRows += 1
    if (fullRows >= plateau * 0.3 && rowsBelow(y, 8).every((w) => w < plateau * 0.8)) {
      neckRow = y
      break
    }
  }
  if (neckRow === height) throw new Error('display head never narrows into a neck')
  // Seen from above, the head's bottom edge is an arc, so the run keeps narrowing until the neck,
  // where it turns flat, jumps wider (torso) or vanishes. The chin is the narrowest row before that.
  const flatAt = (y: number) => Math.max(...rowsBelow(y, 10)) - Math.min(...rowsBelow(y, 10)) <= 4
  let chinRow = neckRow
  let end = height - 1
  for (let y = neckRow; y < height; y += 1) {
    const w = runWidth(y)
    if (flatAt(y) || w < plateau * 0.3 || w > runWidth(y - 1) + plateau * 0.05) {
      end = y
      break
    }
    if (w < runWidth(chinRow)) chinRow = y
  }
  const neckWidth = flatAt(end) && runWidth(end) < plateau * 0.8 ? runWidth(end) : 0
  const torsoRow = runs.findIndex((_, y) => y > chinRow && runWidth(y) > plateau * 0.8)
  // Hair hiding both sides of the head in every row makes the widest run narrower than the head.
  const sidesVisible = runs.some(
    (run, y) =>
      run &&
      y >= top &&
      y <= chinRow &&
      run[1] - run[0] + 1 >= plateau * 0.97 &&
      background(run[0] - 16, y) &&
      background(run[1] + 16, y),
  )
  const [left, right] = runs[widest]!
  // The neck is 0.62 of this figure's head; with the neck hidden too the face is a lower bound.
  const stand: StandAnchor = {
    headWidth: sidesVisible ? plateau : Math.max(plateau, Math.round(neckWidth / 0.62)),
    estimated: !sidesVisible,
    centerX: (left + right) / 2,
    chinRow,
  }
  const keepRows = torsoRow >= 0 ? height : Math.min(height, chinRow + 3)

  const out = Buffer.from(data.subarray(0, width * keepRows * channels))
  const clear = (x: number, y: number) => {
    if (x >= 0 && x < width && y >= 0 && y < keepRows) out[(y * width + x) * channels + 3] = 0
  }
  // The figure's shaded rim and anti-aliased edge are dark red and pink rather than red, so the
  // keyed area grows from the red pixels into every connected reddish pixel (never into tan,
  // brown or orange: those have green well above blue). A small halo then catches the last fringe.
  const rgb = (i: number) => [data[i * channels]!, data[i * channels + 1]!, data[i * channels + 2]!]
  const reddish = (i: number) => {
    const [r, g, b] = rgb(i)
    return r > g + 20 && r > b + 20 && Math.abs(g - b) < 0.1 * r
  }
  const keyed = new Uint8Array(width * keepRows)
  const queue: number[] = []
  for (let i = 0; i < keyed.length; i += 1) {
    if (!red(i % width, Math.floor(i / width))) continue
    keyed[i] = 1
    queue.push(i)
  }
  while (queue.length) {
    const i = queue.pop()!
    const [x, y] = [i % width, Math.floor(i / width)]
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const [nx, ny] = [x + dx!, y + dy!]
      if (nx < 0 || nx >= width || ny < 0 || ny >= keepRows) continue
      const n = ny * width + nx
      if (keyed[n] || !reddish(n)) continue
      keyed[n] = 1
      queue.push(n)
    }
  }
  const light = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= keepRows) return false
    return Math.min(...rgb(y * width + x)) > 160
  }
  for (let i = 0; i < keyed.length; i += 1) {
    if (!keyed[i]) continue
    const [x, y] = [i % width, Math.floor(i / width)]
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const near = Math.abs(dx) <= 2 && Math.abs(dy) <= 2
        if (near || light(x + dx, y + dy)) clear(x + dx, y + dy)
      }
    }
  }
  return {
    image: sharp(out, { raw: { width, height: keepRows, channels: 4 } }).png(),
    stand,
  }
}

// extraextrabricks photographs a hat or hair worn by a plain white display figure. The figure and
// the backdrop are both white and meet in a soft ramp, while the piece meets either of them at a
// hard edge, so the prop floods away from the frame border and the piece is what the flood cannot
// reach. It then lands on the canvas against that figure's head.
const FLOOD_STEP = 6 // the prop's shading is a ramp; the edge of a piece is a cliff
const FLOOD_MIN = 140 // never leak into a dark piece
const FLOOD_SAT = 45 // nor into a coloured one
// Eye slits and mouth holes show white plastic the flood cannot reach from the border. Only a
// sizable patch of it is prop; a highlight on a pale piece reads the same but stays small.
const PROP_PATCH = 0.004
const PATCH_GROW = 2
// Eroding drops the soft seam where the piece meets the figure; the regrow is wider so the piece
// keeps the rim the erosion ate.
const ERODE = 3
// Where the flood stopped a pixel short of a soft edge the mask keeps a pale rim of display figure:
// a halo along a hairline, a band of neck under a mask, a sliver inside an eye slit. Peeling clears
// mask pixels that are as light and colourless as the figure and touch its outside, over and over,
// so a rim is eaten from the outside in and a pocket of face through the hole it opens onto.
const PEEL_VALUE = 168
const PEEL_SAT = 26
// The band where piece and figure blend is darker and faintly tinted, and reads as a grey hairline.
// It is only ever a few pixels wide, so it is peeled by depth rather than by colour alone.
const PEEL_DIM_VALUE = 140
const PEEL_DIM_SAT = 42
const PEEL_DEPTH = 3
// Inside an opening the figure is shadowed rather than light, but it is still far lighter than the
// black plastic that frames it, so the rim of an eye slit or a mouth peels on a much lower bar.
const FACE_VALUE = 70
const FACE_DEPTH = 3
// How far in from the silhouette the white key's ramp is still the piece's soft edge rather than a
// hole in it, and so how far in a segmented piece is made solid again.
const EDGE_RAMP = 2

// The figure stands in the same spot in every one of these photos, but any single landmark can be
// hidden by the piece being worn, so the anchor is fixed rather than measured: these fractions of
// the frame come from averaging the figure masks of all the hair photos together.
const WHITE_HEAD_WIDTH = 0.61
const WHITE_CENTER_X = 0.5
const WHITE_CHIN_ROW = 0.905

// Separable min (erode) or max (dilate) filter over a binary mask. Out-of-frame neighbours are
// skipped, so a piece running off the edge of the crop is not eaten away there.
function morph(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
  erode: boolean,
): Uint8Array {
  const pass = (source: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(width * height)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let value = erode ? 1 : 0
        for (let d = -radius; d <= radius; d += 1) {
          const nx = horizontal ? x + d : x
          const ny = horizontal ? y : y + d
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const neighbour = source[ny * width + nx]!
          value = erode ? Math.min(value, neighbour) : Math.max(value, neighbour)
        }
        out[y * width + x] = value
      }
    }
    return out
  }
  return pass(pass(mask, true), false)
}

type Blobs = { label: Int32Array; areas: number[] }

// 4-connected labelling of a binary mask.
function blobs(mask: Uint8Array, width: number): Blobs {
  const label = new Int32Array(mask.length).fill(-1)
  const areas: number[] = []
  const stack: number[] = []
  for (let seed = 0; seed < mask.length; seed += 1) {
    if (!mask[seed] || label[seed]! >= 0) continue
    const id = areas.length
    areas.push(0)
    label[seed] = id
    stack.push(seed)
    while (stack.length) {
      const p = stack.pop()!
      areas[id] += 1
      const x = p % width
      const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]
      for (const q of neighbours) {
        if (q < 0 || q >= mask.length || !mask[q] || label[q]! >= 0) continue
        label[q] = id
        stack.push(q)
      }
    }
  }
  return { label, areas }
}

// The single biggest blob; the rest is glare and the odd speck of shadow.
function largestBlob(mask: Uint8Array, width: number): Uint8Array | null {
  const { label, areas } = blobs(mask, width)
  if (!areas.length) return null
  let best = 0
  for (let i = 1; i < areas.length; i += 1) if (areas[i]! > areas[best]!) best = i
  const blob = new Uint8Array(mask.length)
  for (let i = 0; i < blob.length; i += 1) if (label[i] === best) blob[i] = 1
  return blob
}

// Everything the frame border reaches without crossing an edge: backdrop, display figure, and the
// shadow the figure casts, which shade into one another.
function floodProp(
  value: Uint8Array,
  saturation: Uint8Array,
  width: number,
  height: number,
  floor: number,
): Uint8Array {
  const prop = new Uint8Array(width * height)
  const stack: number[] = []
  const open = (i: number) => value[i]! >= floor && saturation[i]! <= FLOOD_SAT
  const seed = (i: number) => {
    if (prop[i] || !open(i)) return
    prop[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < width; x += 1) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width)
    seed(y * width + width - 1)
  }
  while (stack.length) {
    const i = stack.pop()!
    const x = i % width
    const neighbours = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]
    for (const q of neighbours) {
      if (q < 0 || q >= prop.length || prop[q] || !open(q)) continue
      if (Math.abs(value[q]! - value[i]!) > FLOOD_STEP) continue
      prop[q] = 1
      stack.push(q)
    }
  }
  return prop
}

// 4-connected neighbours, with -1 where the neighbour would fall outside the frame.
function neighbours(i: number, width: number, length: number): number[] {
  const x = i % width
  const up = i - width
  const down = i + width
  return [
    x > 0 ? i - 1 : -1,
    x < width - 1 ? i + 1 : -1,
    up >= 0 ? up : -1,
    down < length ? down : -1,
  ]
}

// The face an opening frames keeps a lit rim the widened hole does not reach; from the hole outward
// a few pixels of anything achromatic and lighter than the plastic are that rim. Bounded, because a
// grey part of the piece — a goggle lens, a helmet visor — reads exactly the same past the rim.
function peelHole(
  mask: Uint8Array,
  hole: Uint8Array,
  value: Uint8Array,
  saturation: Uint8Array,
  width: number,
): void {
  const face = (i: number) => value[i]! >= FACE_VALUE && saturation[i]! <= PEEL_DIM_SAT
  const queue: number[] = []
  const depth = new Int32Array(mask.length)
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || !face(i)) continue
    if (neighbours(i, width, mask.length).some((q) => q >= 0 && hole[q])) {
      depth[i] = 1
      queue.push(i)
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head]!
    if (!mask[i] || depth[i]! > FACE_DEPTH) continue
    mask[i] = 0
    for (const q of neighbours(i, width, mask.length)) {
      if (q < 0 || !mask[q] || depth[q] || !face(q)) continue
      depth[q] = depth[i]! + 1
      queue.push(q)
    }
  }
}

// Out-of-frame neighbours do not count as outside, so a piece running off the crop keeps that edge.
function peelProp(
  mask: Uint8Array,
  value: Uint8Array,
  saturation: Uint8Array,
  width: number,
): void {
  const pale = (i: number) => value[i]! >= PEEL_VALUE && saturation[i]! <= PEEL_SAT
  const dim = (i: number) => value[i]! >= PEEL_DIM_VALUE && saturation[i]! <= PEEL_DIM_SAT
  const queue: number[] = []
  const depth = new Int32Array(mask.length)
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || !dim(i)) continue
    if (neighbours(i, width, mask.length).some((q) => q >= 0 && !mask[q])) {
      depth[i] = 1
      queue.push(i)
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head]!
    if (!mask[i] || (depth[i]! > PEEL_DEPTH && !pale(i))) continue
    mask[i] = 0
    for (const q of neighbours(i, width, mask.length)) {
      if (q < 0 || !mask[q] || depth[q] || !dim(q)) continue
      depth[q] = depth[i]! + 1
      queue.push(q)
    }
  }
}

// A face the flood never reached, because the piece frames it on every side: a patch of anything
// bright and achromatic, big enough not to be a highlight. Widened, because an opening keeps a lit
// rim of the face it frames.
function findHoles(
  prop: Uint8Array,
  value: Uint8Array,
  saturation: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const pixels = width * height
  const patch = new Uint8Array(pixels)
  for (let i = 0; i < pixels; i += 1) {
    if (!prop[i] && value[i]! >= 150 && saturation[i]! <= 30) patch[i] = 1
  }
  const { label, areas } = blobs(patch, width)
  const hole = new Uint8Array(pixels)
  for (let i = 0; i < pixels; i += 1) {
    if (patch[i] && areas[label[i]!]! > pixels * PROP_PATCH) hole[i] = 1
  }
  return morph(hole, width, height, PATCH_GROW, false)
}

async function segmentPiece(image: Sharp, keyFloor?: number): Promise<Source> {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const pixels = width * height
  const value = new Uint8Array(pixels)
  const saturation = new Uint8Array(pixels)
  for (let i = 0; i < pixels; i += 1) {
    const r = data[i * channels]!
    const g = data[i * channels + 1]!
    const b = data[i * channels + 2]!
    const min = Math.min(r, g, b)
    value[i] = min
    saturation[i] = Math.max(r, g, b) - min
  }
  const prop = floodProp(value, saturation, width, height, keyFloor ?? FLOOD_MIN)
  // The patch hunt looks for a face the flood could not reach, by brightness. Inside a piece pale
  // enough to need a floor the only thing that bright is the piece's own highlight — the helmet's
  // lit dome — so it is left alone and whatever face it frames comes off by hand.
  const holes =
    keyFloor === undefined
      ? findHoles(prop, value, saturation, width, height)
      : new Uint8Array(pixels)
  for (let i = 0; i < pixels; i += 1) if (holes[i]) prop[i] = 1
  const piece = new Uint8Array(pixels)
  for (let i = 0; i < pixels; i += 1) piece[i] = prop[i] ? 0 : 1
  const core = largestBlob(morph(piece, width, height, ERODE, true), width)
  if (!core) throw new Error('no piece found on the display figure')
  const grown = morph(core, width, height, ERODE + 1, false)
  const kept = new Uint8Array(pixels)
  for (let i = 0; i < pixels; i += 1) kept[i] = grown[i] && !prop[i] ? 1 : 0
  peelHole(kept, holes, value, saturation, width)
  // The peel reads a pale piece as a rim of display figure and eats it to nothing, so a photo that
  // needed a floor keeps its edges and is cleaned up by hand instead.
  if (keyFloor === undefined) peelProp(kept, value, saturation, width)
  const out = Buffer.from(data)
  for (let i = 0; i < pixels; i += 1) if (!kept[i]) out[i * channels + 3] = 0
  // The white key ran first and cleared everything as pale as the paper, which on a pale piece is
  // its own lit dome: holes punched before the segmentation had a say. Away from the silhouette,
  // where the ramp is the antialiasing, what the segmentation kept is solid.
  if (keyFloor !== undefined) {
    const inside = morph(kept, width, height, EDGE_RAMP, true)
    for (let i = 0; i < pixels; i += 1) if (inside[i]) out[i * channels + 3] = 255
  }
  // Both tests read a pale piece as the figure: the helmet under its horns is narrow and grey, so
  // the trim eats it to the horns. A photo that needed a floor keeps its tail and is cleaned by hand.
  if (keyFloor === undefined) trimStandTail(out, width, height, channels)
  return {
    image: sharp(out, { raw: { width, height, channels } }).png(),
    stand: {
      headWidth: width * WHITE_HEAD_WIDTH,
      estimated: false,
      centerX: width * WHITE_CENTER_X,
      chinRow: height * WHITE_CHIN_ROW,
    },
  }
}

// The piece keeps whatever of the display figure's neck it was sitting on: a narrow stub under a
// shape that is otherwise as wide as the piece. Rows are dropped from the bottom until one is wide
// enough to be the piece itself, which costs a couple of rows of taper on a clean photo.
const TAIL_WIDTH = 0.45
// A wide stub is still the figure if it is the figure's colour: the neck under a full-face mask is
// as broad as the mask and only gives itself away by being pale next to the plastic.
const TAIL_PALE = 0.5

function trimStandTail(out: Buffer, width: number, height: number, channels: number): void {
  const rows = Array.from({ length: height }, (_, y) => {
    let left = -1
    let right = -1
    let pale = 0
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels
      if (out[i + 3]! <= ALPHA_THRESHOLD) continue
      if (left < 0) left = x
      right = x
      const min = Math.min(out[i]!, out[i + 1]!, out[i + 2]!)
      if (min >= FACE_VALUE && Math.max(out[i]!, out[i + 1]!, out[i + 2]!) - min <= PEEL_SAT)
        pale += 1
    }
    const span = left < 0 ? 0 : right - left + 1
    return { span, pale: span ? pale / span : 0 }
  })
  const widest = Math.max(...rows.map((row) => row.span))
  for (let y = height - 1; y >= 0; y -= 1) {
    if (rows[y]!.span > widest * TAIL_WIDTH && rows[y]!.pale < TAIL_PALE) break
    for (let x = 0; x < width; x += 1) out[(y * width + x) * channels + 3] = 0
  }
}

type Placed = { buffer: Buffer; left: number; top: number; bottomGap: number }

// Hats and hair keyed off a display figure are placed against that head: its chin sits where the
// head canvas ends and its width matches our heads.
function standPlacement(stand: StandAnchor, slot: Slot, meta: PartMeta): Placement {
  const geometry = GEOMETRY[slot]
  const factor = ((GEOMETRY.head.targetWidth ?? 0) / stand.headWidth) * (meta.scale ?? 1)
  return {
    factor,
    left: Math.round(
      CANVAS_WIDTH / 2 - stand.centerX * factor + (meta.offsetX ?? 0) * CANVAS_WIDTH,
    ),
    top: Math.round(
      geometry.canvasHeight +
        geometry.stackOffset -
        stand.chinRow * factor +
        (meta.offsetY ?? 0) * geometry.canvasHeight,
    ),
  }
}

type Placement = { factor: number; left: number; top: number }

async function fixedPlacement(
  part: Sharp,
  slot: Slot,
  width: number,
  height: number,
  meta: PartMeta,
): Promise<Placement> {
  const geometry = GEOMETRY[slot]
  const anchorHeight = geometry.anchor === 'hem' ? await centralColumnBottom(part) : height
  const factor =
    (geometry.targetWidth
      ? geometry.targetWidth / width
      : (geometry.targetHeight ?? anchorHeight) / anchorHeight) * (meta.scale ?? 1)
  return {
    factor,
    left: Math.round((CANVAS_WIDTH - width * factor) / 2 + (meta.offsetX ?? 0) * CANVAS_WIDTH),
    top: Math.round(
      geometry.canvasHeight -
        (geometry.bottomInset ?? 0) -
        anchorHeight * factor +
        (meta.offsetY ?? 0) * geometry.canvasHeight,
    ),
  }
}

async function placeOnCanvas(
  part: Sharp,
  slot: Slot,
  meta: PartMeta,
  stand?: StandAnchor,
): Promise<Placed> {
  const canvasH = GEOMETRY[slot].canvasHeight
  const { width = 1, height = 1 } = await part.metadata()
  const placement = stand
    ? standPlacement(stand, slot, meta)
    : await fixedPlacement(part, slot, width, height, meta)
  const { factor } = placement
  let { left, top } = placement
  const sw = Math.max(1, Math.round(width * factor))
  const sh = Math.max(1, Math.round(height * factor))

  let scaled = part.clone().resize(sw, sh, { kernel: 'lanczos3' })
  // sharp cannot composite an overlay that spills outside the base; crop the spill.
  const cropLeft = Math.max(0, -left)
  const cropTop = Math.max(0, -top)
  const visibleW = Math.min(sw - cropLeft, CANVAS_WIDTH - Math.max(0, left))
  const visibleH = Math.min(sh - cropTop, canvasH - Math.max(0, top))
  if (cropLeft || cropTop || visibleW < sw || visibleH < sh) {
    if (!stand)
      console.warn(
        `  ! part spills outside canvas by ${sw - visibleW}x${sh - visibleH}px, cropping`,
      )
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

// Hand retouch from the erase page: the erase brush clears alpha the way the browser canvas does,
// the restore brush pushes it back up, so what the user painted there is what a rebuild produces.
// Restoring only reaches pixels that kept some alpha — a fully cleared pixel has no colour left.
// Coordinates are pixels of this finished canvas.
async function eraseStrokes(canvas: Sharp, strokes: Stroke[]): Promise<Buffer> {
  if (!strokes.length) return canvas.png().toBuffer()
  const { data, info } = await canvas.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const out = Buffer.from(data)
  for (const { r, points, mode } of strokes) {
    for (const [x, y] of points) {
      const left = Math.max(0, Math.floor(x - r - 1))
      const right = Math.min(width - 1, Math.ceil(x + r + 1))
      const top = Math.max(0, Math.floor(y - r - 1))
      const bottom = Math.min(height - 1, Math.ceil(y + r + 1))
      for (let row = top; row <= bottom; row += 1) {
        for (let col = left; col <= right; col += 1) {
          const distance = Math.hypot(col + 0.5 - x, row + 0.5 - y)
          const covered = Math.min(1, Math.max(0, r + 0.5 - distance))
          if (!covered) continue
          const index = (row * width + col) * channels + 3
          const was = out[index]!
          if (mode !== 'restore') out[index] = Math.round(was * (1 - covered))
          else if (was > 0) out[index] = Math.round(was + (255 - was) * covered)
        }
      }
    }
  }
  return sharp(out, { raw: { width, height, channels } }).png().toBuffer()
}

// The thumbnail is cut from the trimmed photo, which never saw the retouch, so a retouched piece is
// thumbed from the finished canvas instead, cropped back to what is left of the piece on it.
async function retouchedThumb(canvasPng: Buffer): Promise<Sharp> {
  const image = sharp(canvasPng)
  return sharp(
    await image
      .extract(await centralBlobBox(image))
      .png()
      .toBuffer(),
  )
}

async function processFile(
  slot: Slot,
  filename: string,
  meta: PartMeta,
  erase: EraseFile,
): Promise<Part> {
  const name = meta.name ?? nameFromFilename(filename)
  const id = slugify(name)
  const source = await loadSource(slot, path.join(RAW_DIR, slot, filename), meta)
  const box = await centralBlobBox(source.guide ?? source.image)
  const trimmed = sharp(await source.image.extract(box).png().toBuffer())
  const geometry = GEOMETRY[slot]
  const stand = source.stand && {
    ...source.stand,
    centerX: source.stand.centerX - box.left,
    chinRow: source.stand.chinRow - box.top,
  }
  if (source.stand) {
    const { headWidth, estimated, centerX, chinRow } = source.stand
    const note = estimated ? ' (estimated)' : ''
    console.log(
      `  · display head ${Math.round(headWidth)}px wide${note} at x=${Math.round(centerX)}, chin row ${Math.round(chinRow)}`,
    )
  }
  const placed = await placeOnCanvas(trimmed, slot, meta, stand)

  const canvas = sharp({
    create: {
      width: CANVAS_WIDTH,
      height: geometry.canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: placed.buffer, left: placed.left, top: placed.top }])
  const strokes = erase[eraseKey(slot, id)] ?? []
  const canvasPng = await eraseStrokes(canvas, strokes)

  const outDir = path.join(OUT_DIR, slot)
  await writeFile(path.join(outDir, `${id}.png`), canvasPng)
  await sharp(canvasPng)
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(path.join(outDir, `${id}.webp`))
  await (strokes.length ? await retouchedThumb(canvasPng) : trimmed.clone())
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

async function loadErase(file: string): Promise<EraseFile> {
  const raw = await readFile(file, 'utf8').catch(() => '{}')
  return readStrokes(JSON.parse(raw) as unknown)
}

// `pnpm parts --only <id,id>` rebuilds just those parts: after a retouch session the pieces that
// were not touched must keep the files they already have, whether they came from this build or from
// a revert. Every other part, and its manifest entry, is left alone.
function onlyIds(argv: string[]): Set<string> {
  const at = argv.indexOf('--only')
  const list = at < 0 ? '' : (argv[at + 1] ?? '')
  return new Set(
    list
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
}

// The parts that were not rebuilt keep the entry they had: a stale size or hem would describe a
// build that is no longer on disk.
async function mergeManifest(built: Part[]): Promise<Part[]> {
  const file = path.join(OUT_DIR, 'parts.json')
  const before = JSON.parse(await readFile(file, 'utf8')) as Manifest
  const fresh = new Map(built.map((part) => [`${part.slot}/${part.id}`, part]))
  const known = new Set(before.parts.map((part) => `${part.slot}/${part.id}`))
  const merged = before.parts.map((part) => fresh.get(`${part.slot}/${part.id}`) ?? part)
  // A part built for the first time has no entry to replace, so it joins the end of its own slot —
  // where a full rebuild would have put it, and where the picker shows it last.
  for (const part of built) {
    if (known.has(`${part.slot}/${part.id}`)) continue
    merged.splice(merged.findLastIndex((entry) => entry.slot === part.slot) + 1, 0, part)
  }
  return merged
}

async function main(): Promise<void> {
  const meta = await loadMeta(META_PATH)
  const erase = await loadErase(ERASE_PATH)
  const only = onlyIds(process.argv.slice(2))
  if (!only.size) await rm(OUT_DIR, { recursive: true, force: true })
  const parts: Part[] = []
  let failed = 0

  for (const slot of SLOTS) {
    await mkdir(path.join(OUT_DIR, slot), { recursive: true })
    const files = (await readdir(path.join(RAW_DIR, slot)))
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()
      .map((filename) => {
        const key = `${slot}/${filename}`.normalize('NFC')
        return { key, filename, partMeta: meta[key] ?? {} }
      })
      // Explicit `order` first, then filename order.
      .sort((a, b) => (a.partMeta.order ?? UNORDERED) - (b.partMeta.order ?? UNORDERED))
    const seen = new Set<string>()
    for (const { key, filename, partMeta } of files) {
      if (only.size && !only.has(slugify(partMeta.name ?? nameFromFilename(filename)))) continue
      if (partMeta.exclude) {
        console.log(`- skip ${key}`)
        continue
      }
      console.log(`+ ${key}`)
      // A photo the keying cannot read should not stop the other 250; mark it `exclude` or fix it.
      const part = await processFile(slot, filename, partMeta, erase).catch((error: unknown) => {
        console.log(`  ! ${error instanceof Error ? error.message : String(error)}`)
        failed += 1
        return null
      })
      if (!part) continue
      if (seen.has(part.id)) throw new Error(`Duplicate id "${part.id}" in slot ${slot}`)
      seen.add(part.id)
      parts.push(part)
    }
  }

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    slots: SLOTS,
    parts: only.size ? await mergeManifest(parts) : parts,
  }
  await writeFile(path.join(OUT_DIR, 'parts.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writePreview(path.join(ROOT, 'mockups/parts-preview.html'), manifest)
  await writeGeometryJs(path.join(ROOT, 'mockups/_geometry.js'))
  const missed = [...only].filter((id) => !parts.some((part) => part.id === id))
  if (missed.length) console.log(`\n! no source for ${missed.join(', ')}`)
  console.log(
    `\n${parts.length} parts -> public/parts/parts.json${failed ? `, ${failed} failed` : ''}`,
  )
}

await main()
