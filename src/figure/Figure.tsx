import { motion } from 'motion/react'
import { CANVAS_WIDTH, figureHeight, slotBottoms } from '../parts/geometry'
import { SLOTS, type Slot } from '../parts/manifest'
import type { Catalog } from '../parts/useManifest'
import type { Direction, Selection } from '../state/selection'
import { SlotLayer } from './SlotLayer'

type FigureProps = {
  catalog: Catalog
  selection: Selection
  exploded: boolean
  activeSlot: Slot | null
  direction: Direction
  scale: number
  hoverArrows: boolean
  onActivate: (slot: Slot) => void
  onCycle: (slot: Slot, direction: Direction) => void
}

export function Figure({
  catalog,
  selection,
  exploded,
  activeSlot,
  direction,
  scale,
  hoverArrows,
  onActivate,
  onCycle,
}: FigureProps) {
  const bottoms = slotBottoms(exploded)
  // The box is sized for the exploded stack; re-centre it once the parts collapse to the bottom.
  const lift = exploded ? 0 : (-(figureHeight(true) - figureHeight(false)) * scale) / 2
  return (
    <motion.div
      className='relative z-[1]'
      style={{ width: CANVAS_WIDTH * scale, height: figureHeight(true) * scale }}
      animate={{ y: lift }}
      transition={
        exploded
          ? { type: 'spring', stiffness: 170, damping: 20 }
          : { type: 'spring', stiffness: 260, damping: 14, mass: 0.9 }
      }
      data-testid='figure'
    >
      {SLOTS.map((slot) => {
        const id = selection[slot]
        return (
          <SlotLayer
            key={slot}
            slot={slot}
            part={id ? catalog.byId.get(id) : undefined}
            bottom={bottoms[slot] * scale}
            scale={scale}
            exploded={exploded}
            active={activeSlot === slot}
            direction={direction}
            hoverArrows={hoverArrows}
            onActivate={onActivate}
            onCycle={onCycle}
          />
        )
      })}
    </motion.div>
  )
}
