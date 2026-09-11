import { CANVAS_WIDTH, GEOMETRY, figureHeight, slotBottoms } from '../parts/geometry'
import { SLOTS, type Slot } from '../parts/manifest'
import type { Catalog } from '../parts/useManifest'
import type { Selection } from '../state/selection'

const EXPORT_HEIGHT = 1_024
const DRAW_ORDER: Slot[] = ['pants', 'body', 'head', 'hair']

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // The parts come from another origin; without CORS the canvas is tainted and toBlob throws.
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${src}`))
    image.src = src
  })
}

// Assembled figure, transparent background, EXPORT_HEIGHT px tall.
export async function composePng(selection: Selection, catalog: Catalog): Promise<Blob> {
  const scale = EXPORT_HEIGHT / figureHeight(false)
  const bottoms = slotBottoms(false)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CANVAS_WIDTH * scale)
  canvas.height = EXPORT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is not available')

  for (const slot of DRAW_ORDER) {
    const id = selection[slot]
    const part = id ? catalog.byId.get(id) : undefined
    if (!part) continue
    // WebP, not the PNG master: every browser that can run this decodes it, the canvas re-encodes
    // to PNG anyway, and the masters never leave the repo.
    const image = await loadImage(part.src)
    const height = GEOMETRY[slot].canvasHeight * scale
    const y = EXPORT_HEIGHT - (bottoms[slot] + GEOMETRY[slot].canvasHeight) * scale
    context.drawImage(image, 0, y, canvas.width, height)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))),
      'image/png',
    )
  })
}

export function exportFilename(selection: Selection): string {
  return `minifig-${SLOTS.map((slot) => selection[slot] ?? 'none').join('-')}.png`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
