import { AnimatePresence, motion } from 'motion/react'
import { CANVAS_WIDTH, GEOMETRY } from '../parts/geometry'
import { SLOTS, type Part, type Slot } from '../parts/manifest'
import type { Direction } from '../state/selection'
import { cx } from '../ui/cx'
import { ArrowControls } from './ArrowControls'

type SlotLayerProps = {
  slot: Slot
  part: Part | undefined
  bottom: number
  scale: number
  exploded: boolean
  active: boolean
  direction: Direction
  hoverArrows: boolean
  onActivate: (slot: Slot) => void
  onCycle: (slot: Slot, direction: Direction) => void
}

const DROP_STAGGER = 0.09

const swapOut = {
  exit: (direction: Direction) => ({ x: -70 * direction, rotate: -4 * direction, opacity: 0 }),
}

const stackSpring = (exploded: boolean) =>
  exploded
    ? { type: 'spring' as const, stiffness: 170, damping: 20 }
    : { type: 'spring' as const, stiffness: 260, damping: 14, mass: 0.9 }

export function SlotLayer({
  slot,
  part,
  bottom,
  scale,
  exploded,
  active,
  direction,
  hoverArrows,
  onActivate,
  onCycle,
}: SlotLayerProps) {
  const index = SLOTS.indexOf(slot)
  const dropDelay = (SLOTS.length - 1 - index) * DROP_STAGGER
  // Exploded hair hangs by its lowest pixel; offsetting the image (not the layer) keeps the
  // layer still when switching between hats and hair.
  const drop = exploded && slot === 'hair' ? (part?.bottomGap ?? 0) * scale : 0
  const geometry = GEOMETRY[slot]
  const center =
    (exploded ? (geometry.explodedArrowCenter ?? geometry.arrowCenter) : geometry.arrowCenter) *
    scale
  return (
    <motion.div
      className={cx(
        'group pointer-events-none absolute left-0',
        active && 'drop-shadow-[0_12px_20px_rgba(23,28,58,0.3)]',
      )}
      style={{
        width: CANVAS_WIDTH * scale,
        height: geometry.canvasHeight * scale,
        zIndex: SLOTS.length - index,
      }}
      initial={{ bottom, y: -140, opacity: 0 }}
      animate={{ bottom, y: 0, opacity: 1 }}
      transition={{
        bottom: stackSpring(exploded),
        y: { type: 'spring', stiffness: 150, damping: 16, delay: dropDelay },
        opacity: { duration: 0.3, delay: dropDelay },
      }}
      onClick={() => onActivate(slot)}
      data-testid={`layer-${slot}`}
    >
      <AnimatePresence custom={direction} initial={false}>
        {part && (
          <motion.img
            key={part.id}
            src={part.src}
            // CORS mode so the preload hits and the export reuses this bitmap instead of refetching.
            crossOrigin='anonymous'
            alt={part.name}
            draggable={false}
            className='absolute inset-0 block size-full select-none'
            custom={direction}
            variants={swapOut}
            initial={{ x: 70 * direction, rotate: 4 * direction, opacity: 0, y: drop }}
            animate={{ x: 0, rotate: 0, opacity: 1, y: drop }}
            exit='exit'
            transition={{ type: 'spring', stiffness: 320, damping: 26, y: stackSpring(exploded) }}
          />
        )}
      </AnimatePresence>
      <span
        className='pointer-events-auto absolute inset-x-0 cursor-pointer'
        style={{
          top: exploded ? 0 : geometry.hitTop * scale,
          height: (exploded ? geometry.canvasHeight : geometry.hitHeight) * scale,
        }}
        data-testid={`hit-${slot}`}
      />
      <ArrowControls
        slot={slot}
        visible={active}
        hoverReveal={hoverArrows}
        center={center}
        onCycle={onCycle}
      />
    </motion.div>
  )
}
