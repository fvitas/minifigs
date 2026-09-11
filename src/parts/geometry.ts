import { SLOTS, type Slot } from './manifest'

// 1 unit = width of the legs piece (2 studs). All sizes in px at UNIT scale.
export const UNIT = 400
export const CANVAS_WIDTH = 600

export type SlotGeometry = {
  canvasHeight: number
  // Part bounding-box size after scaling, in px. Body scales by height because arm poses vary.
  targetWidth?: number
  targetHeight?: number
  // Row the part is aligned by: its lowest pixel, or (body) the hem found in the central columns,
  // so targetHeight measures neck top -> hem and every torso block ends up the same size.
  anchor?: 'bottom' | 'hem'
  // The anchor row sits this many px above the canvas bottom (room for hands below the hem,
  // or for hair pieces nudged down with meta offsetY).
  bottomInset?: number
  // Where this canvas's bottom edge sits, in px above the bottom edge of the canvas below it.
  stackOffset: number
  // Extra px gap added when the figure is exploded. For hair it is measured from the part's
  // lowest pixel: SlotLayer drops the image by Part.bottomGap so hats and hair hover alike.
  explodeGap: number
  // Where the cycle arrows sit, in px below the canvas top. One position per slot rather than the
  // middle of each piece: pieces differ in height, and arrows that followed them hopped while
  // cycling. Every piece of the slot reaches this row.
  arrowCenter: number
  // Exploded hair hangs by its lowest pixel, well below where it sits stacked.
  explodedArrowCenter?: number
}

export const GEOMETRY: Record<Slot, SlotGeometry> = {
  pants: {
    canvasHeight: 420,
    targetWidth: UNIT * 0.7,
    stackOffset: 0,
    explodeGap: 0,
    arrowCenter: 230,
  },
  // Hip block top is ~312 above the legs' bottom (the hip pins above it hide inside the torso).
  body: {
    canvasHeight: 460,
    targetHeight: UNIT * 0.81,
    anchor: 'hem',
    bottomInset: 90,
    stackOffset: 214,
    explodeGap: 150,
    arrowCenter: 220,
  },
  head: {
    canvasHeight: 320,
    targetWidth: UNIT * 0.54,
    stackOffset: 306,
    explodeGap: 150,
    arrowCenter: 195,
  },
  hair: {
    canvasHeight: 600,
    targetWidth: UNIT * 0.648,
    bottomInset: 230,
    stackOffset: -100,
    explodeGap: 400,
    arrowCenter: 300,
    explodedArrowCenter: 500,
  },
}

// Bottom edge of each slot canvas measured from the figure's bottom.
export function slotBottoms(exploded: boolean): Record<Slot, number> {
  const gap = (slot: Slot) => (exploded ? GEOMETRY[slot].explodeGap : 0)
  const pants = 0
  const body = pants + GEOMETRY.body.stackOffset + gap('body')
  const head = body + GEOMETRY.head.stackOffset + gap('head')
  const hair = head + GEOMETRY.hair.stackOffset + gap('hair')
  return { pants, body, head, hair }
}

export function figureHeight(exploded: boolean): number {
  const bottoms = slotBottoms(exploded)
  return Math.max(...SLOTS.map((slot) => bottoms[slot] + GEOMETRY[slot].canvasHeight))
}
