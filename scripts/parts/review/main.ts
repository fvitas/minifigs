// Dev-only QA page: steps through the built parts slot by slot with the figure put together
// exactly as the app stacks it, so a torso or a pair of legs is judged in place instead of on a
// contact sheet. Verdicts are written to docs/part-review.json; apply them with
// `pnpm tsx scripts/parts/apply-review.ts`.
import { CANVAS_WIDTH, GEOMETRY, figureHeight, slotBottoms } from '../../../src/parts/geometry'
import { SLOTS, type Manifest, type Part, type Slot } from '../../../src/parts/manifest'

type Verdict = 'good' | 'bad'
type ReviewEntry = { id: string; slot: Slot; name: string; verdict: Verdict }

const STORE = '/__review/verdicts'
const LABEL: Record<Slot, string> = { hair: 'Hair', head: 'Heads', body: 'Torsos', pants: 'Legs' }

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`#${id} is missing`)
  return node as T
}

// Parts judged "not good" are excluded from the build, so they are no longer in the manifest.
// Their entries are kept verbatim and written back, or the record of the discard would be lost.
function readEntries(value: unknown): Map<string, ReviewEntry> {
  const entries = new Map<string, ReviewEntry>()
  const parts = (value as { parts?: unknown } | null)?.parts
  if (!Array.isArray(parts)) return entries
  for (const part of parts as unknown[]) {
    const entry = (part ?? {}) as Partial<ReviewEntry>
    const { id, slot: entrySlot, name, verdict } = entry
    if (typeof id !== 'string' || typeof name !== 'string') continue
    if (!(SLOTS as readonly string[]).includes(entrySlot as string)) continue
    if (verdict !== 'good' && verdict !== 'bad') continue
    entries.set(id, { id, slot: entrySlot as Slot, name, verdict })
  }
  return entries
}

const manifest = (await fetch('/parts/parts.json').then((response) => response.json())) as Manifest
const entries = readEntries(await fetch(STORE).then((response) => response.json()))
const verdicts = new Map(Array.from(entries, ([id, entry]) => [id, entry.verdict]))

// Everything built, used to dress the three slots that are not under review.
const allBySlot = Object.fromEntries(
  SLOTS.map((slot) => [slot, manifest.parts.filter((part) => part.slot === slot)]),
) as Record<Slot, Part[]>
// The queue is only what has never been judged. Parts decided in this session stay in it so they
// can still be undone; they are gone on the next load.
const bySlot = Object.fromEntries(
  SLOTS.map((slot) => [slot, allBySlot[slot].filter((part) => !verdicts.has(part.id))]),
) as Record<Slot, Part[]>

const index = Object.fromEntries(SLOTS.map((slot) => [slot, 0])) as Record<Slot, number>
// The slots not under review keep a fixed reference part, so only one thing changes at a time.
const reference = Object.fromEntries(SLOTS.map((slot) => [slot, 0])) as Record<Slot, number>

const hash = location.hash.slice(1)
let slot: Slot = (SLOTS as readonly string[]).includes(hash) ? (hash as Slot) : 'body'
let exploded = false
const history: string[] = []

const stage = el('stage')
const figure = el('figure')
const strip = el<HTMLDivElement>('strip')
const layers = Object.fromEntries(
  SLOTS.map((layerSlot) => {
    const image = new Image()
    image.className = 'layer'
    image.draggable = false
    image.style.zIndex = String(SLOTS.length - SLOTS.indexOf(layerSlot))
    figure.append(image)
    return [layerSlot, image]
  }),
) as Record<Slot, HTMLImageElement>

const shown = (target: Slot): Part | undefined =>
  target === slot ? bySlot[target][index[target]] : allBySlot[target][reference[target]]
const current = (): Part | undefined => shown(slot)
const pending = (target: Slot) => bySlot[target].filter((part) => !verdicts.has(part.id)).length

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
  const scale = Math.min(box.height / figureHeight(exploded), box.width / CANVAS_WIDTH, 1)
  const bottoms = slotBottoms(exploded)
  figure.style.width = `${CANVAS_WIDTH * scale}px`
  figure.style.height = `${figureHeight(exploded) * scale}px`
  for (const layerSlot of SLOTS) {
    const image = layers[layerSlot]
    const part = shown(layerSlot)
    image.style.display = part ? 'block' : 'none'
    if (!part) continue
    if (!image.src.endsWith(part.src)) image.src = part.src
    image.style.width = `${CANVAS_WIDTH * scale}px`
    image.style.height = `${GEOMETRY[layerSlot].canvasHeight * scale}px`
    image.style.bottom = `${bottoms[layerSlot] * scale}px`
    // Exploded hair hangs by its lowest pixel, exactly like SlotLayer does in the app.
    const drop = exploded && layerSlot === 'hair' ? part.bottomGap * scale : 0
    image.style.transform = `translateY(${drop}px)`
  }
}

function renderStrip(): void {
  if (strip.dataset.slot !== slot) {
    strip.dataset.slot = slot
    strip.innerHTML = bySlot[slot]
      .map((part, i) => `<img src="${part.thumb}" title="${part.name}" data-index="${i}">`)
      .join('')
  }
  bySlot[slot].forEach((part, i) => {
    const thumb = strip.children[i]
    if (!(thumb instanceof HTMLElement)) return
    thumb.className = `${verdicts.get(part.id) ?? ''} ${i === index[slot] ? 'is-current' : ''}`
    if (i === index[slot]) thumb.scrollIntoView({ block: 'nearest', inline: 'center' })
  })
}

function render(): void {
  el('tabs').innerHTML = SLOTS.map((tab) => {
    const left = pending(tab)
    return `<button class="tab ${tab === slot ? 'is-on' : ''}" data-slot="${tab}">${LABEL[tab]}${left ? `<b>${left}</b>` : ''}</button>`
  }).join('')
  const parts = bySlot[slot]
  el('stats').textContent = parts.length
    ? `${parts.length - pending(slot)} / ${parts.length} decided · ${pending(slot)} left`
    : `nothing new in ${LABEL[slot].toLowerCase()}`
  const part = current()
  el('title').textContent = part?.name ?? (parts.length ? '—' : 'All caught up')
  el('sub').textContent = part
    ? `${index[slot] + 1} / ${parts.length} · ${part.id} · ${verdicts.get(part.id) ?? 'not reviewed'}`
    : 'every part in this slot has already been judged'
  el<HTMLButtonElement>('undo').disabled = history.length === 0
  el('explode').classList.toggle('is-on', exploded)
  renderStrip()
  renderFigure()
}

async function save(): Promise<void> {
  const parts = [...entries.values()]
  const bad = parts.filter((entry) => entry.verdict === 'bad').length
  const body = JSON.stringify({ reviewedAt: new Date().toISOString(), parts }, null, 2) + '\n'
  const response = await fetch(STORE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => null)
  el('saved').textContent = response
    ? `saved · ${bad} not good in docs/part-review.json`
    : 'not saved: dev server unreachable'
}

function step(by: number): void {
  const parts = bySlot[slot]
  if (!parts.length) return
  index[slot] = (index[slot] + by + parts.length) % parts.length
  render()
}

function decide(verdict: Verdict): void {
  const part = current()
  if (!part) return
  verdicts.set(part.id, verdict)
  entries.set(part.id, { id: part.id, slot, name: part.name, verdict })
  history.push(part.id)
  void save()
  step(1)
}

function undo(): void {
  const id = history.pop()
  if (id === undefined) return
  verdicts.delete(id)
  entries.delete(id)
  const back = bySlot[slot].findIndex((part) => part.id === id)
  if (back >= 0) index[slot] = back
  void save()
  render()
}

function shuffleRest(): void {
  for (const target of SLOTS) {
    // The head stays put: heads are the one slot already settled, and a new face every shuffle
    // makes the part actually under review harder to judge.
    if (target === slot || target === 'head') continue
    reference[target] = Math.floor(Math.random() * allBySlot[target].length)
  }
  render()
}

function switchSlot(next: Slot): void {
  slot = next
  location.hash = next
  render()
}

el('tabs').addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('.tab') : null
  if (button instanceof HTMLElement && button.dataset.slot) switchSlot(button.dataset.slot as Slot)
})
strip.addEventListener('click', (event) => {
  const thumb = event.target
  if (!(thumb instanceof HTMLElement) || !thumb.dataset.index) return
  index[slot] = Number(thumb.dataset.index)
  render()
})
el('good').addEventListener('click', () => decide('good'))
el('bad').addEventListener('click', () => decide('bad'))
el('undo').addEventListener('click', undo)
el('shuffle').addEventListener('click', shuffleRest)
el('explode').addEventListener('click', () => {
  exploded = !exploded
  render()
})
el('reset').addEventListener('click', () => {
  if (!confirm(`Clear all verdicts for ${LABEL[slot]}?`)) return
  for (const part of bySlot[slot]) {
    verdicts.delete(part.id)
    entries.delete(part.id)
  }
  index[slot] = 0
  void save()
  render()
})

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey) return
  const slotKey = Number(event.key)
  if (slotKey >= 1 && slotKey <= SLOTS.length) return switchSlot(SLOTS[slotKey - 1]!)
  switch (event.key) {
    case 'ArrowRight':
      return decide('good')
    case 'ArrowLeft':
      return decide('bad')
    case 'ArrowDown':
      event.preventDefault()
      return step(1)
    case 'ArrowUp':
      event.preventDefault()
      return step(-1)
    case 'Backspace':
      event.preventDefault()
      return undo()
  }
  const key = event.key.toLowerCase()
  if (key === 's') shuffleRest()
  if (key === 'e') {
    exploded = !exploded
    render()
  }
})
// The strip and the title settle after the thumbnails load, which changes how tall the stage is.
new ResizeObserver(renderFigure).observe(stage)

render()
