// Dev-only QA page for the one slot that has to be fitted by hand: hair, hats and masks. Head,
// torso and legs never change, so the only thing moving is the piece under review, and every piece
// gets a free-text note ("sits too high", "too small") written to docs/hair-notes.json. Those notes
// are what the scale/offsetX/offsetY in assets/parts.meta.json are tuned from.
import { CANVAS_WIDTH, GEOMETRY, figureHeight, slotBottoms } from '../../../src/parts/geometry'
import { SLOTS, type Manifest, type Part, type Slot } from '../../../src/parts/manifest'

type Note = { id: string; name: string; note: string }

const STORE = '/__fit/notes'
// A plain face and quiet clothes: anything patterned competes with the piece being judged.
const REFERENCE: Record<Exclude<Slot, 'hair'>, string> = {
  head: 'open-mouth-smile',
  body: 'blue-zip-jacket',
  pants: 'navy',
}
// Zoomed in, the view starts at mid-torso: nothing below that says anything about how a hat fits.
const FOCUS_FLOOR = 340

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`#${id} is missing`)
  return node as T
}

function readNotes(value: unknown): Map<string, Note> {
  const notes = new Map<string, Note>()
  const list = (value as { notes?: unknown } | null)?.notes
  if (!Array.isArray(list)) return notes
  for (const entry of list as unknown[]) {
    const { id, name, note } = (entry ?? {}) as Partial<Note>
    if (typeof id !== 'string' || typeof name !== 'string' || typeof note !== 'string') continue
    notes.set(id, { id, name, note })
  }
  return notes
}

const manifest = (await fetch('/parts/parts.json').then((response) => response.json())) as Manifest
const notes = readNotes(await fetch(STORE).then((response) => response.json()))

const bySlot = Object.fromEntries(
  SLOTS.map((slot) => [slot, manifest.parts.filter((part) => part.slot === slot)]),
) as Record<Slot, Part[]>
const pieces = bySlot.hair
const worn = Object.fromEntries(
  (Object.keys(REFERENCE) as (keyof typeof REFERENCE)[]).map((slot) => [
    slot,
    bySlot[slot].find((part) => part.id === REFERENCE[slot]) ?? bySlot[slot][0],
  ]),
) as Record<keyof typeof REFERENCE, Part | undefined>

let index = 0
let zoomed = true
let ghosted = false
let exploded = false

const stage = el('stage')
const figure = el('figure')
const strip = el<HTMLDivElement>('strip')
const input = el<HTMLInputElement>('note')
const layers = Object.fromEntries(
  SLOTS.map((slot) => {
    const image = new Image()
    image.className = 'layer'
    image.draggable = false
    image.style.zIndex = String(SLOTS.length - SLOTS.indexOf(slot))
    figure.append(image)
    return [slot, image]
  }),
) as Record<Slot, HTMLImageElement>

const current = (): Part | undefined => pieces[index]
const shown = (slot: Slot): Part | undefined => (slot === 'hair' ? current() : worn[slot])

// clientHeight counts the stage's padding, which the figure must not spill into.
function innerBox(node: HTMLElement): { width: number; height: number } {
  const style = getComputedStyle(node)
  return {
    width: node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    height: node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
  }
}

function renderFigure(): void {
  const box = innerBox(stage)
  const total = figureHeight(exploded)
  const scale = Math.min(box.height / total, box.width / CANVAS_WIDTH, 1)
  const bottoms = slotBottoms(exploded)
  figure.style.width = `${CANVAS_WIDTH * scale}px`
  figure.style.height = `${total * scale}px`
  // Zoom blows the band from FOCUS_FLOOR up to the top of the figure out to the full stage, and
  // slides it into the middle: translateY runs in the scaled frame, so the shift is not scaled.
  const band = Math.max(1, total - FOCUS_FLOOR)
  const zoom = Math.min(total / band, box.width / (CANVAS_WIDTH * scale))
  const shift = ((total + FOCUS_FLOOR) / 2 - total / 2) * scale
  figure.style.transform = zoomed ? `scale(${zoom}) translateY(${shift}px)` : 'none'
  for (const slot of SLOTS) {
    const image = layers[slot]
    const part = shown(slot)
    image.style.display = part ? 'block' : 'none'
    if (!part) continue
    if (!image.src.endsWith(part.src)) image.src = part.src
    image.classList.toggle('ghost', ghosted && slot === 'hair')
    image.style.width = `${CANVAS_WIDTH * scale}px`
    image.style.height = `${GEOMETRY[slot].canvasHeight * scale}px`
    image.style.bottom = `${bottoms[slot] * scale}px`
    // Exploded hair hangs by its lowest pixel, exactly like SlotLayer does in the app.
    const drop = exploded && slot === 'hair' ? part.bottomGap * scale : 0
    image.style.transform = `translateY(${drop}px)`
  }
}

function renderStrip(): void {
  if (!strip.children.length) {
    strip.innerHTML = pieces
      .map((part, i) => `<img src="${part.thumb}" title="${part.name}" data-index="${i}">`)
      .join('')
  }
  pieces.forEach((part, i) => {
    const thumb = strip.children[i]
    if (!(thumb instanceof HTMLElement)) return
    const note = notes.get(part.id)
    const state = note ? (note.note ? 'noted' : 'fine') : ''
    thumb.className = `${state} ${i === index ? 'is-current' : ''}`
    if (i === index) thumb.scrollIntoView({ block: 'nearest', inline: 'center' })
  })
}

function render(): void {
  const part = current()
  const wrong = [...notes.values()].filter((note) => note.note).length
  el('stats').textContent = `${notes.size} / ${pieces.length} looked at · ${wrong} to fix`
  el('title').textContent = part?.name ?? 'No hair built'
  el('sub').textContent = part ? `${index + 1} / ${pieces.length} · ${part.id}` : ''
  el('zoom').classList.toggle('is-on', zoomed)
  el('ghost').classList.toggle('is-on', ghosted)
  el('explode').classList.toggle('is-on', exploded)
  input.value = part ? (notes.get(part.id)?.note ?? '') : ''
  renderStrip()
  renderFigure()
  input.focus()
}

async function save(): Promise<void> {
  const body =
    JSON.stringify({ notedAt: new Date().toISOString(), notes: [...notes.values()] }, null, 2) + '\n'
  const response = await fetch(STORE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => null)
  el('saved').textContent = response
    ? 'saved to docs/hair-notes.json'
    : 'not saved: dev server unreachable'
}

function keep(): void {
  const part = current()
  if (!part) return
  notes.set(part.id, { id: part.id, name: part.name, note: input.value.trim() })
  void save()
}

function step(by: number): void {
  if (!pieces.length) return
  index = (index + by + pieces.length) % pieces.length
  render()
}

strip.addEventListener('click', (event: MouseEvent) => {
  const thumb = event.target
  if (!(thumb instanceof HTMLElement) || !thumb.dataset.index) return
  keep()
  index = Number(thumb.dataset.index)
  render()
})
el('next').addEventListener('click', () => {
  keep()
  step(1)
})
el('prev').addEventListener('click', () => {
  keep()
  step(-1)
})
el('zoom').addEventListener('click', () => {
  zoomed = !zoomed
  render()
})
el('ghost').addEventListener('click', () => {
  ghosted = !ghosted
  render()
})
el('explode').addEventListener('click', () => {
  exploded = !exploded
  render()
})

input.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    keep()
    if (event.shiftKey) render()
    else step(1)
    return
  }
  if (event.key === 'Tab' && event.shiftKey) {
    event.preventDefault()
    keep()
    step(-1)
  }
})

// The note input owns the keyboard: every other control is a button, and only the up/down arrows
// are taken from it, so a letter never toggles anything while a note is being typed.
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  keep()
  step(event.key === 'ArrowDown' ? 1 : -1)
})

window.addEventListener('resize', renderFigure)
render()
