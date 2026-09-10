import { AnimatePresence, motion } from 'motion/react'
import type { Part, Slot } from '../parts/manifest'
import type { PartsBySlot } from '../parts/useManifest'
import { optionsFor, type Direction } from '../state/selection'
import { SLOT_CHOOSE } from '../ui/palette'
import { PartTile } from './PartTile'

type PartGridProps = {
  slot: Slot | null
  bySlot: PartsBySlot
  selected: string | null
  onSelect: (slot: Slot, id: string | null, direction: Direction) => void
  onClose: () => void
}

// Desktop popover: opens over the slot cards, six tiles per row.
export function PartGrid({ slot, bySlot, selected, onSelect, onClose }: PartGridProps) {
  return (
    <AnimatePresence>
      {slot && (
        <motion.div
          className='absolute top-0 left-0 z-20 w-[560px] origin-top-left rounded-[18px] border-[1.5px] border-line bg-white p-4 text-ink shadow-[0_30px_60px_-30px_rgba(23,28,58,.35)]'
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          data-testid='part-grid'
        >
          <div className='mb-3 flex items-center justify-between text-[13px] text-muted'>
            <span>
              Choose <b className='font-semibold text-navy'>{SLOT_CHOOSE[slot]}</b>
            </span>
            <button type='button' className='font-semibold text-lego' onClick={onClose}>
              Done
            </button>
          </div>
          <div className='grid grid-cols-6 gap-2'>
            {optionsFor(bySlot, slot).map((id, index, options) => {
              const part: Part | null = id
                ? (bySlot[slot].find((candidate) => candidate.id === id) ?? null)
                : null
              const currentIndex = options.indexOf(selected)
              return (
                <PartTile
                  key={id ?? 'none'}
                  part={part}
                  selected={id === selected}
                  index={index}
                  block={false}
                  onSelect={() => onSelect(slot, id, index >= currentIndex ? 1 : -1)}
                />
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
