// Dev-only QA page: keeps or throws away what the last `pnpm parts` did to each torso. Only the
// torsos whose pixels differ from the committed build are listed, put together into the whole
// figure exactly as the app stacks it. The side button swaps the body layer between the committed
// part and the new one with nothing animated, so the difference is the only thing that moves.
// Decisions land in docs/torso-accept.json; `Apply reverts` puts the committed files back.
import { CANVAS_WIDTH, GEOMETRY, figureHeight, slotBottoms } from '../../../src/parts/geometry'
import { SLOTS, type Manifest, type Part, type Slot } from '../../../src/parts/manifest'

type Verdict = 'keep' | 'revert'
type AcceptEntry = { id: string; name: string; verdict: Verdict }

const STORE = '/__accept/verdicts'
const before = (id: string) => `/__accept/before/${id}.png`

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`#${id} is missing`)
  return node as T
}

function readEntries(value: unknown): Map<string, AcceptEntry> {
  const entries = new Map<string, AcceptEntry>()
  const parts = (value as { parts?: unknown } | null)?.parts
  if (!Array.isArray(parts)) return entries
  for (const part of parts as unknown[]) {
    const { id, name, verdict } = (part ?? {}) as Partial<AcceptEntry>
    if (typeof id !== 'string' || typeof name !== 'string') continue
    if (verdict !== 'keep' && verdict !== 'revert') continue
    entries.set(id, { id, name, verdict })
  }
  return entries
}

const manifest = (await fetch('/parts/parts.json').then((response) => response.json())) as Manifest
const { ids } = (await fetch('/__accept/changed').then((response) => response.json())) as {
  ids: string[]
}
const entries = readEntries(await fetch(STORE).then((response) => response.json()))

const byId = new Map(manifest.parts.map((part) => [part.id, part]))
const torsos = ids
  .map((id) => byId.get(id))
  .filter((part): part is Part => part !== undefined)
  .sort((left, right) => left.name.localeCompare(right.name))

// Everything built, to dress the three slots that are not under review.
const allBySlot = Object.fromEntries(
  SLOTS.map((slot) => [slot, manifest.parts.filter((part) => part.slot === slot)]),
) as Record<Slot, Part[]>
const reference = Object.fromEntries(SLOTS.map((slot) => [slot, 0])) as Record<Slot, number>

let index = 0
let showBefore = false
const history: string[] = []

const stage = el('stage')
const figure = el('figure')
const list = el<HTMLElement>('list')

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

// The committed torso rides in a second layer of its own, kept loaded next to the new one: the
// flip is a display swap between two decoded images, so it lands in the same frame as the click.
const committed = new Image()
committed.className = 'layer'
committed.draggable = false
committed.style.zIndex = layers.body.style.zIndex
figure.append(committed)

const current = (): Part | undefined => torsos[index]
const verdictOf = (id: string): Verdict | undefined => entries.get(id)?.verdict

function place(image: HTMLImageElement, slot: Slot, scale: number, bottom: number): void {
  image.style.width = `${CANVAS_WIDTH * scale}px`
  image.style.height = `${GEOMETRY[slot].canvasHeight * scale}px`
  image.style.bottom = `${bottom * scale}px`
}

// clientHeight counts the stage's padding, which the figure must not spill into.
function innerBox(node: HTMLElement): { width: number; height: number } {
  const style = getComputedStyle(node)
  return {
    width: node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    height: node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
  }
}

function renderFigure(): void {
  const part = current()
  const box = innerBox(stage)
  const scale = Math.min(box.height / figureHeight(false), box.width / CANVAS_WIDTH, 1)
  const bottoms = slotBottoms(false)
  figure.style.width = `${CANVAS_WIDTH * scale}px`
  figure.style.height = `${figureHeight(false) * scale}px`
  for (const slot of SLOTS) {
    const image = layers[slot]
    const worn = slot === 'body' ? part : allBySlot[slot][reference[slot]]
    image.style.display = worn && !(slot === 'body' && showBefore) ? 'block' : 'none'
    if (!worn) continue
    if (!image.src.endsWith(worn.src)) image.src = worn.src
    place(image, slot, scale, bottoms[slot])
  }
  committed.style.display = part && showBefore ? 'block' : 'none'
  if (part && !committed.src.endsWith(before(part.id))) committed.src = before(part.id)
  place(committed, 'body', scale, bottoms.body)
}

function renderList(): void {
  if (list.childElementCount !== torsos.length) {
    list.innerHTML = torsos.length
      ? torsos
          .map(
            (part, i) =>
              `<button class="row" data-index="${i}"><i class="dot"></i><img src="${part.thumb}" alt=""><span>${part.name}</span></button>`,
          )
          .join('')
      : '<p>Nothing changed: every torso matches the committed build.</p>'
  }
  torsos.forEach((part, i) => {
    const row = list.children[i]
    if (!(row instanceof HTMLElement)) return
    row.className = `row ${verdictOf(part.id) ?? ''} ${i === index ? 'is-current' : ''}`
    if (i === index) row.scrollIntoView({ block: 'nearest' })
  })
}

function render(): void {
  const part = current()
  const decided = torsos.filter((torso) => entries.has(torso.id)).length
  const reverts = torsos.filter((torso) => verdictOf(torso.id) === 'revert').length
  el('stats').textContent = torsos.length
    ? `${decided} / ${torsos.length} decided · ${reverts} to revert`
    : 'nothing to judge'
  el('title').textContent = part?.name ?? '—'
  el('sub').textContent = part
    ? `${index + 1} / ${torsos.length} · ${showBefore ? 'committed' : 'new'} · ${verdictOf(part.id) ?? 'undecided'}`
    : ''
  el('side').textContent = showBefore ? 'Before' : 'After'
  el('side').classList.toggle('is-on', showBefore)
  el('keep').classList.toggle('is-on', part !== undefined && verdictOf(part.id) === 'keep')
  el('revert').classList.toggle('is-on', part !== undefined && verdictOf(part.id) === 'revert')
  el<HTMLButtonElement>('undo').disabled = history.length === 0
  el<HTMLButtonElement>('apply').disabled = reverts === 0
  el('apply').textContent = reverts
    ? `Apply ${reverts} revert${reverts > 1 ? 's' : ''}`
    : 'Apply reverts'
  renderList()
  renderFigure()
}

async function save(): Promise<void> {
  const body =
    JSON.stringify({ decidedAt: new Date().toISOString(), parts: [...entries.values()] }, null, 2) +
    '\n'
  const response = await fetch(STORE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => null)
  el('saved').textContent = response
    ? 'saved · docs/torso-accept.json'
    : 'not saved: dev server unreachable'
}

// Every torso opens on the new build: the decision is about that one, and a flip left over from
// the torso before would have it judged on the committed image without anyone noticing.
function show(at: number): void {
  if (!torsos.length) return
  index = (at + torsos.length) % torsos.length
  showBefore = false
  render()
}

const step = (by: number): void => show(index + by)

function decide(verdict: Verdict): void {
  const part = current()
  if (!part) return
  entries.set(part.id, { id: part.id, name: part.name, verdict })
  history.push(part.id)
  void save()
  step(1)
}

function undo(): void {
  const id = history.pop()
  if (id === undefined) return
  entries.delete(id)
  const back = torsos.findIndex((part) => part.id === id)
  void save()
  if (back >= 0) return show(back)
  render()
}

function toggleSide(): void {
  showBefore = !showBefore
  render()
}

function shuffleRest(): void {
  for (const slot of SLOTS) {
    if (slot === 'body') continue
    reference[slot] = Math.floor(Math.random() * allBySlot[slot].length)
  }
  render()
}

async function apply(): Promise<void> {
  const reverts = torsos.filter((part) => verdictOf(part.id) === 'revert').map((part) => part.id)
  if (!reverts.length) return
  if (
    !confirm(
      `Put the committed build back for ${reverts.length} torso(s)? The new files are overwritten.`,
    )
  )
    return
  el('saved').textContent = 'reverting…'
  const result = await fetch('/__accept/revert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: reverts }),
  })
    .then((response) => response.json() as Promise<{ reverted: string[] }>)
    .catch(() => null)
  if (!result) {
    el('saved').textContent = 'not reverted: dev server unreachable'
    return
  }
  location.reload()
}

list.addEventListener('click', (event: MouseEvent) => {
  const row = event.target instanceof Element ? event.target.closest('.row') : null
  if (!(row instanceof HTMLElement) || !row.dataset.index) return
  show(Number(row.dataset.index))
})
el('side').addEventListener('click', toggleSide)
el('prev').addEventListener('click', () => step(-1))
el('next').addEventListener('click', () => step(1))
el('keep').addEventListener('click', () => decide('keep'))
el('revert').addEventListener('click', () => decide('revert'))
el('undo').addEventListener('click', undo)
el('shuffle').addEventListener('click', shuffleRest)
el('apply').addEventListener('click', () => void apply())

document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.metaKey || event.ctrlKey) return
  switch (event.key) {
    case ' ':
      event.preventDefault()
      return toggleSide()
    case 'ArrowRight':
      event.preventDefault()
      return step(1)
    case 'ArrowLeft':
      event.preventDefault()
      return step(-1)
    case 'Backspace':
      event.preventDefault()
      return undo()
  }
  const key = event.key.toLowerCase()
  if (key === 'a') decide('keep')
  if (key === 'r') decide('revert')
  if (key === 's') shuffleRest()
})
// The thumbnails settle after they load, which changes how tall the stage is.
new ResizeObserver(renderFigure).observe(stage)

render()
