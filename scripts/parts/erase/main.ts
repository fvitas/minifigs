// Dev-only retouch page: a two-brush photo editor for what no threshold can be trusted to get —
// the grey hairline the display figure leaves behind a wig, a speck of stand, a white sleeve the
// key read as paper. Drag to rub pixels out of the finished part or to push them back, on the head
// it will be worn on. Strokes go to assets/parts.erase.json and are replayed by `pnpm parts`, so
// they survive a rebuild.
import { CANVAS_WIDTH, GEOMETRY, figureHeight, slotBottoms } from '../../../src/parts/geometry'
import { SLOTS, type Manifest, type Part, type Slot } from '../../../src/parts/manifest'
import { eraseKey, readStrokes, type EraseFile, type Stroke } from '../strokes'

const STORE = '/__erase/strokes'
const VERDICTS = '/__accept/verdicts'
// A plain face and quiet clothes behind the piece being cleaned, same as the fit page.
const REFERENCE: Record<Slot, string> = {
  hair: 'brown-short-hair',
  head: 'open-mouth-smile',
  body: 'blue-zip-jacket',
  pants: 'navy',
}
// The four colours are the stage's own, from src/ui/palette.ts: a part is judged against the
// background it will actually sit on, and ghosting only shows against something saturated.
const BACKGROUNDS = {
  figure: { label: 'On figure', swatch: 'linear-gradient(#ffcf00 50%, #e3000b 50%)' },
  checker: {
    label: 'Checker',
    swatch: 'repeating-conic-gradient(#d6d7de 0 25%, #fff 0 50%) 0 0/12px 12px',
  },
  red: { label: 'Torso red', swatch: '#e3000b' },
  blue: { label: 'Legs blue', swatch: '#0f6fd6' },
  yellow: { label: 'Head yellow', swatch: '#ffcf00' },
  orange: { label: 'Hair orange', swatch: '#f26b1d' },
  magenta: { label: 'Magenta', swatch: '#ff00ff' },
  black: { label: 'Navy', swatch: '#171c3a' },
} as const

type Background = keyof typeof BACKGROUNDS

type AcceptFile = { parts: { id: string; verdict: 'keep' | 'revert' }[] }

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`#${id} is missing`)
  return node as T
}

function canvasContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const found = target.getContext('2d')
  if (!found) throw new Error('No 2d canvas context')
  return found
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`${src} did not load`))
    image.src = src
  })
}

// One key per line: the point lists are long, and a stroke should stay readable in a diff.
function serialize(erase: EraseFile): string {
  const rows = Object.keys(erase)
    .sort()
    .filter((key) => erase[key]?.length)
    .map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(erase[key])}`)
  return rows.length ? `{\n${rows.join(',\n')}\n}\n` : '{}\n'
}

const manifest = (await fetch('/parts/parts.json').then((response) => response.json())) as Manifest
const erase = readStrokes(await fetch(STORE).then((response) => response.json()))
// The built PNG changes under us on every `pnpm parts`; the manifest stamp busts the cache.
const stamp = encodeURIComponent(manifest.generatedAt)

const bySlot = Object.fromEntries(
  SLOTS.map((slot) => [slot, manifest.parts.filter((part) => part.slot === slot)]),
) as Record<Slot, Part[]>

// The torsos kept in the accept page (scripts/parts/accept): the ones a rebuild changed and that
// were judged worth keeping, which are the only ones worth retouching by hand now.
const kept = new Set(
  ((await fetch(VERDICTS).then((response) => response.json())) as AcceptFile).parts
    .filter((part) => part.verdict === 'keep')
    .map((part) => part.id),
)

// #keep in the address opens straight on the kept torsos.
let keptOnly = location.hash === '#keep' && kept.size > 0
let slot: Slot = keptOnly ? 'body' : 'hair'
let index = 0
let brush = 8
let zoom = 1
let background: Background = 'figure'
let query = ''
let restoring = false
let drawing: Stroke | null = null
let panning = false
let spaceHeld = false
let saveTimer = 0

const stage = el<HTMLDivElement>('stage')
const figure = el<HTMLDivElement>('figure')
const strip = el<HTMLDivElement>('strip')
const ring = el<HTMLDivElement>('ring')
const brushInput = el<HTMLInputElement>('brush')
const zoomInput = el<HTMLInputElement>('zoom')
const slotInput = el<HTMLSelectElement>('slot')
const search = el<HTMLInputElement>('search')
const swatches = el<HTMLDivElement>('swatches')
const canvas = document.createElement('canvas')
canvas.className = 'layer'
const context = canvasContext(canvas)

const layers = Object.fromEntries(
  SLOTS.map((each) => {
    const image = new Image()
    image.className = 'layer'
    image.draggable = false
    image.style.zIndex = String(SLOTS.length - SLOTS.indexOf(each))
    figure.append(image)
    return [each, image]
  }),
) as Record<Slot, HTMLImageElement>
figure.append(canvas)

// The strip, the counter and the arrow keys all run off `pieces()`, so filtering here is enough to
// narrow the whole page to what was searched for.
const inSlot = (): Part[] =>
  keptOnly ? bySlot[slot].filter((part) => kept.has(part.id)) : bySlot[slot]
const pieces = (): Part[] =>
  query
    ? inSlot().filter((part) => `${part.name} ${part.id}`.toLowerCase().includes(query))
    : inSlot()
const current = (): Part | undefined => pieces()[index]
const strokesOf = (part: Part): Stroke[] => (erase[eraseKey(part.slot, part.id)] ??= [])

let source: HTMLImageElement | null = null

// Restore has no compositing operation behind it — raising alpha back up is a read-modify-write —
// so the restored area is collected as a coverage mask first and applied to the pixels in one pass.
const maskCanvas = document.createElement('canvas')
const maskContext = canvasContext(maskCanvas)

function paint(target: CanvasRenderingContext2D, strokes: Stroke[]): void {
  for (const stroke of strokes) {
    for (const [x, y] of stroke.points) {
      target.beginPath()
      target.arc(x, y, stroke.r, 0, Math.PI * 2)
      target.fill()
    }
  }
}

function redraw(): void {
  const part = current()
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (!part || !source) return
  context.drawImage(source, 0, 0)
  const strokes = strokesOf(part)
  context.globalCompositeOperation = 'destination-out'
  context.fillStyle = '#000'
  paint(
    context,
    strokes.filter((stroke) => stroke.mode !== 'restore'),
  )
  context.globalCompositeOperation = 'source-over'

  const restores = strokes.filter((stroke) => stroke.mode === 'restore')
  if (!restores.length) return
  maskCanvas.width = canvas.width
  maskCanvas.height = canvas.height
  maskContext.clearRect(0, 0, canvas.width, canvas.height)
  maskContext.fillStyle = '#fff'
  paint(maskContext, restores)
  const mask = maskContext.getImageData(0, 0, canvas.width, canvas.height).data
  const frame = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = frame.data
  for (let i = 3; i < pixels.length; i += 4) {
    const covered = mask[i]! / 255
    const was = pixels[i]!
    // A pixel cleared to nothing kept no colour to bring back, so restore leaves it alone.
    if (covered && was > 0) pixels[i] = Math.round(was + (255 - was) * covered)
  }
  context.putImageData(frame, 0, 0)
}

function layout(): void {
  const total = figureHeight(false)
  const bottoms = slotBottoms(false)
  const onFigure = background === 'figure'
  figure.style.width = `${CANVAS_WIDTH * zoom}px`
  figure.style.height = `${(onFigure ? total : GEOMETRY[slot].canvasHeight) * zoom}px`
  for (const each of SLOTS) {
    const image = layers[each]
    const part =
      bySlot[each].find((candidate) => candidate.id === REFERENCE[each]) ?? bySlot[each][0]
    const show = onFigure && each !== slot && part
    image.style.display = show ? 'block' : 'none'
    if (!show || !part) continue
    if (!image.src.endsWith(part.src)) image.src = part.src
    image.style.width = `${CANVAS_WIDTH * zoom}px`
    image.style.height = `${GEOMETRY[each].canvasHeight * zoom}px`
    image.style.bottom = `${bottoms[each] * zoom}px`
  }
  canvas.style.width = `${CANVAS_WIDTH * zoom}px`
  canvas.style.height = `${GEOMETRY[slot].canvasHeight * zoom}px`
  canvas.style.bottom = `${(onFigure ? bottoms[slot] : 0) * zoom}px`
  canvas.style.zIndex = String(SLOTS.length - SLOTS.indexOf(slot))
  ring.style.width = ring.style.height = `${brush * 2 * zoom}px`
}

function renderStrip(): void {
  strip.innerHTML = pieces()
    .map((part, i) => `<img src="${part.thumb}?${stamp}" title="${part.name}" data-index="${i}">`)
    .join('')
  pieces().forEach((part, i) => {
    const thumb = strip.children[i]
    if (!(thumb instanceof HTMLElement)) return
    const edited = erase[eraseKey(part.slot, part.id)]?.length ? 'edited' : ''
    thumb.className = `${edited} ${i === index ? 'is-current' : ''}`
    if (i === index) thumb.scrollIntoView({ block: 'nearest', inline: 'center' })
  })
}

function renderChrome(): void {
  const part = current()
  const strokes = part ? strokesOf(part).length : 0
  const edited = Object.values(erase).filter((list) => list.length).length
  el('title').textContent =
    part?.name ??
    (query ? `Nothing in ${slot} matches “${query}”` : `No ${keptOnly ? 'kept ' : ''}${slot} built`)
  el('sub').textContent = part
    ? `${index + 1} / ${pieces().length}${query ? ` of ${inSlot().length}` : ''} · ${part.id} · ${strokes} stroke${strokes === 1 ? '' : 's'} · ${edited} piece${edited === 1 ? '' : 's'} retouched · hold space to pan · [ ] resize brush · X swaps brush · / searches`
    : ''
  const tool = el('tool')
  tool.textContent = restoring ? 'Restore' : 'Erase'
  tool.append(Object.assign(document.createElement('kbd'), { textContent: 'X' }))
  tool.classList.toggle('is-on', restoring)
  ring.classList.toggle('is-restore', restoring)
  for (const swatch of swatches.children) {
    swatch.classList.toggle(
      'is-on',
      swatch instanceof HTMLElement && swatch.dataset.bg === background,
    )
  }
  const keptButton = el<HTMLButtonElement>('kept')
  keptButton.textContent = `Kept only (${kept.size})`
  keptButton.disabled = kept.size === 0
  keptButton.classList.toggle('is-on', keptOnly)
  brushInput.value = String(brush)
  zoomInput.value = String(zoom)
  el('brushValue').textContent = `${brush * 2}px`
  el('zoomValue').textContent = `${Math.round(zoom * 100)}%`
  stage.className = `stage bg-${background}`
}

async function showPiece(): Promise<void> {
  const part = current()
  renderChrome()
  renderStrip()
  canvas.width = part?.width ?? CANVAS_WIDTH
  canvas.height = part?.height ?? GEOMETRY[slot].canvasHeight
  canvas.style.display = part ? 'block' : 'none'
  layout()
  source = part ? await loadImage(`${part.png}?${stamp}`) : null
  if (current() !== part) return
  redraw()
}

function save(): void {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void fetch(STORE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialize(erase),
    })
      .then((response) => {
        el('saved').textContent = response.ok
          ? 'saved · run pnpm parts to bake it in'
          : 'not saved: dev server said no'
      })
      .catch(() => {
        el('saved').textContent = 'not saved: dev server unreachable'
      })
  }, 300)
}

function pointAt(event: PointerEvent): [number, number] {
  const box = canvas.getBoundingClientRect()
  return [
    Math.round(((event.clientX - box.left) / zoom) * 10) / 10,
    Math.round(((event.clientY - box.top) / zoom) * 10) / 10,
  ]
}

// A pointer that moves faster than the brush would leave a dotted line, so the gap is filled in at
// a third of the brush; a move shorter than that adds nothing a circle already covers.
function extend(stroke: Stroke, to: [number, number]): void {
  const from = stroke.points[stroke.points.length - 1]
  if (!from) return
  const step = Math.max(1, stroke.r / 3)
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1])
  for (let walked = step; walked <= distance; walked += step) {
    const ratio = walked / distance
    stroke.points.push([
      Math.round((from[0] + (to[0] - from[0]) * ratio) * 10) / 10,
      Math.round((from[1] + (to[1] - from[1]) * ratio) * 10) / 10,
    ])
  }
}

function step(by: number): void {
  if (!pieces().length) return
  index = (index + by + pieces().length) % pieces().length
  void showPiece()
}

function setBrush(size: number): void {
  brush = Math.min(60, Math.max(1, size))
  layout()
  renderChrome()
}

function setZoom(next: number): void {
  zoom = Math.min(8, Math.max(0.4, Math.round(next * 10) / 10))
  layout()
  renderChrome()
}

canvas.addEventListener('pointerdown', (event: PointerEvent) => {
  if (spaceHeld || event.button !== 0) return
  const part = current()
  if (!part) return
  event.preventDefault()
  canvas.setPointerCapture(event.pointerId)
  drawing = restoring
    ? { r: brush, points: [pointAt(event)], mode: 'restore' }
    : { r: brush, points: [pointAt(event)] }
  strokesOf(part).push(drawing)
  redraw()
})

canvas.addEventListener('pointermove', (event: PointerEvent) => {
  if (!drawing) return
  extend(drawing, pointAt(event))
  redraw()
})

canvas.addEventListener('pointerup', () => {
  if (!drawing) return
  drawing = null
  renderChrome()
  renderStrip()
  save()
})

stage.addEventListener('pointermove', (event: PointerEvent) => {
  ring.style.display = spaceHeld ? 'none' : 'block'
  ring.style.left = `${event.clientX}px`
  ring.style.top = `${event.clientY}px`
})
stage.addEventListener('pointerleave', () => {
  ring.style.display = 'none'
})

stage.addEventListener('pointerdown', (event: PointerEvent) => {
  if (!spaceHeld && event.button !== 1) return
  event.preventDefault()
  panning = true
  stage.classList.add('is-panning')
  stage.setPointerCapture(event.pointerId)
})
stage.addEventListener('pointermove', (event: PointerEvent) => {
  if (!panning) return
  stage.scrollLeft -= event.movementX
  stage.scrollTop -= event.movementY
})
stage.addEventListener('pointerup', () => {
  panning = false
  stage.classList.remove('is-panning')
})

// Wheel with a modifier zooms; a bare wheel keeps scrolling the stage, which is how you pan.
stage.addEventListener(
  'wheel',
  (event: WheelEvent) => {
    if (!event.metaKey && !event.ctrlKey) return
    event.preventDefault()
    setZoom(zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1))
  },
  { passive: false },
)

function undo(): void {
  const part = current()
  if (!part || !strokesOf(part).length) return
  strokesOf(part).pop()
  redraw()
  renderChrome()
  renderStrip()
  save()
}

el('undo').addEventListener('click', undo)
el('clear').addEventListener('click', () => {
  const part = current()
  if (!part) return
  erase[eraseKey(part.slot, part.id)] = []
  redraw()
  renderChrome()
  renderStrip()
  save()
})
el('prev').addEventListener('click', () => step(-1))
el('next').addEventListener('click', () => step(1))
swatches.innerHTML = Object.entries(BACKGROUNDS)
  .map(
    ([key, { label, swatch }]) =>
      `<button class="swatch" data-bg="${key}" title="${label}" style="background:${swatch}"></button>`,
  )
  .join('')
swatches.addEventListener('click', (event: MouseEvent) => {
  const swatch = event.target
  if (!(swatch instanceof HTMLElement) || !swatch.dataset.bg) return
  background = swatch.dataset.bg as Background
  layout()
  renderChrome()
})

// Keep the piece being worked on selected across a keystroke where the filter still holds it.
function setQuery(next: string): void {
  const part = current()
  query = next.trim().toLowerCase()
  const found = part ? pieces().indexOf(part) : -1
  index = found < 0 ? 0 : found
  void showPiece()
}

function setTool(next: boolean): void {
  restoring = next
  renderChrome()
}

el('tool').addEventListener('click', () => setTool(!restoring))
search.addEventListener('input', () => setQuery(search.value))
brushInput.addEventListener('input', () => setBrush(Number(brushInput.value)))
zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value)))
// The filter only means anything on torsos, so turning it on pins the slot there; the piece being
// worked on is kept selected when it survives the change, the same way the search box does it.
function setKeptOnly(next: boolean): void {
  const part = current()
  keptOnly = next
  if (keptOnly) slot = 'body'
  slotInput.value = slot
  slotInput.disabled = keptOnly
  history.replaceState(null, '', keptOnly ? '#keep' : location.pathname)
  const found = part ? pieces().indexOf(part) : -1
  index = found < 0 ? 0 : found
  void showPiece()
}

el('kept').addEventListener('click', () => setKeptOnly(!keptOnly))
slotInput.addEventListener('change', () => {
  slot = (slotInput.value as Slot) ?? 'hair'
  index = 0
  void showPiece()
})
strip.addEventListener('click', (event: MouseEvent) => {
  const thumb = event.target
  if (!(thumb instanceof HTMLElement) || !thumb.dataset.index) return
  index = Number(thumb.dataset.index)
  void showPiece()
})

document.addEventListener('keydown', (event: KeyboardEvent) => {
  // While the search box has focus every key belongs to it, brush shortcuts and the space pan too.
  if (document.activeElement === search) {
    if (event.key !== 'Escape') return
    search.value = ''
    search.blur()
    setQuery('')
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    undo()
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.code === 'Space') {
    event.preventDefault()
    spaceHeld = true
    ring.style.display = 'none'
    return
  }
  if (event.key === 'ArrowRight') step(1)
  else if (event.key === 'ArrowLeft') step(-1)
  else if (event.key === '[') setBrush(brush - (brush > 10 ? 4 : 1))
  else if (event.key === ']') setBrush(brush + (brush >= 10 ? 4 : 1))
  else if (event.key === '+' || event.key === '=') setZoom(zoom + 0.2)
  else if (event.key === '-') setZoom(zoom - 0.2)
  else if (event.key.toLowerCase() === 'x') setTool(!restoring)
  else if (event.key === '/') {
    event.preventDefault()
    search.focus()
  }
})
document.addEventListener('keyup', (event: KeyboardEvent) => {
  if (event.code === 'Space') spaceHeld = false
})

slotInput.innerHTML = SLOTS.map(
  (each) => `<option value="${each}"${each === slot ? ' selected' : ''}>${each}</option>`,
).join('')
slotInput.disabled = keptOnly
await showPiece()
setZoom(Math.min(2, (stage.clientHeight - 48) / figureHeight(false)))
