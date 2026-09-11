import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'
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
  const scroller = useRef<HTMLDivElement>(null)
  const openedSlot = useRef<Slot | null>(null)

  // Keep the selected tile in view: centred when the picker opens, and nudged back in whenever
  // the selection moves out of the scroll area (the arrows on the figure change it too).
  useLayoutEffect(() => {
    const element = scroller.current
    const target = element?.querySelector<HTMLElement>(`[data-testid="tile-${selected ?? 'none'}"]`)
    if (!element || !target) return
    const opened = openedSlot.current !== slot
    openedSlot.current = slot
    const centred = target.offsetTop - element.clientHeight / 2 + target.clientHeight / 2
    if (opened) {
      element.scrollTop = centred
      return
    }
    const hidden =
      target.offsetTop < element.scrollTop ||
      target.offsetTop + target.clientHeight > element.scrollTop + element.clientHeight
    if (hidden) element.scrollTo({ top: centred, behavior: 'smooth' })
  }, [slot, selected])

  return (
    <AnimatePresence>
      {slot && (
        <motion.div
          // The panel sits just under the viewport's middle, so this is what is left below it.
          className='absolute top-0 left-0 z-20 flex max-h-[calc(50dvh-8px)] w-[560px] origin-top-left flex-col rounded-[18px] border-[1.5px] border-line bg-white p-4 text-ink shadow-[0_30px_60px_-30px_rgba(23,28,58,.35)]'
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
          <div
            ref={scroller}
            className='relative -mr-2 grid grid-cols-6 content-start gap-2 overflow-y-auto pr-2 [scrollbar-width:thin]'
          >
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
                  color={false}
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
