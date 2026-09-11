import { motion } from 'motion/react'
import { Figure } from '../figure/Figure'
import { PartStrip } from '../picker/PartStrip'
import { SLOTS, type Slot } from '../parts/manifest'
import { optionsFor } from '../state/selection'
import { AssembledActions } from '../ui/AssembledActions'
import { Backdrop } from '../ui/Backdrop'
import { snapButtonClass } from '../ui/buttons'
import { Credit } from '../ui/Credit'
import { cx } from '../ui/cx'
import { SLOT_SHORT, SLOT_WORD } from '../ui/palette'
import { ShuffleButton } from '../ui/ShuffleButton'
import type { LayoutProps } from './ConfiguratorProps'
import { useStageScale } from './useStageScale'

export function MobileLayout({
  catalog,
  state,
  dispatch,
  color,
  onCycle,
  onSelect,
  onShuffle,
  onToggleExploded,
}: LayoutProps) {
  const { stageRef, scale } = useStageScale(true)
  // One slot is always active on mobile. Tapping the active one again keeps it.
  const slot = state.activeSlot ?? state.focusSlot
  const activate = (next: Slot) => {
    if (next !== state.activeSlot) dispatch({ type: 'activate', slot: next })
  }
  const options = optionsFor(catalog.bySlot, slot)
  const selected = state.selection[slot]
  const part = selected ? catalog.byId.get(selected) : undefined

  return (
    <>
      <section
        ref={stageRef}
        className='relative grid min-h-0 place-items-center overflow-hidden'
        data-testid='stage'
      >
        <Backdrop color={color} word={state.exploded ? SLOT_WORD[slot] : 'DONE'} compact />
        {scale > 0 && (
          <Figure
            catalog={catalog}
            selection={state.selection}
            exploded={state.exploded}
            activeSlot={slot}
            direction={state.direction}
            scale={scale}
            hoverArrows={false}
            onActivate={activate}
            onCycle={onCycle}
          />
        )}
      </section>
      <div className='z-[1] flex justify-end px-[14px] pt-2'>
        <ShuffleButton className='h-11 pr-[18px] pl-[14px] text-sm' onShuffle={onShuffle} />
      </div>
      <nav className='z-[1] grid grid-cols-4 px-[14px]' data-testid='tabs'>
        {SLOTS.map((tab) => {
          const active = tab === slot
          return (
            <button
              key={tab}
              type='button'
              className={cx(
                'relative pt-3 pb-[10px] font-mono text-[11px] tracking-[.14em] uppercase transition-[color,opacity] duration-300',
                color
                  ? cx('text-(--on-slot)', active ? 'opacity-100' : 'opacity-60')
                  : active
                    ? 'text-navy'
                    : 'text-muted',
              )}
              onClick={() => activate(tab)}
              data-testid={`tab-${tab}`}
            >
              {SLOT_SHORT[tab]}
              {active && (
                <motion.span
                  layoutId='tab-underline'
                  className={cx(
                    'absolute inset-x-0 bottom-0 h-0.5',
                    color ? 'bg-(--on-slot)' : 'bg-lego',
                  )}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          )
        })}
      </nav>
      <section className='z-[2] grid grid-cols-[minmax(0,1fr)] gap-[10px] pt-2 pb-[calc(14px+env(safe-area-inset-bottom))]'>
        <div
          className={cx(
            'flex min-h-[18px] items-baseline justify-between px-4 text-xs transition-colors duration-500',
            color ? 'text-(--on-slot)' : 'text-muted',
          )}
        >
          <b className={cx('text-sm font-semibold', color ? 'text-(--on-slot)' : 'text-navy')}>
            {part?.name ?? 'No hair'}
          </b>
          <span>
            {options.indexOf(selected) + 1} / {options.length}
          </span>
        </div>
        <PartStrip
          slot={slot}
          bySlot={catalog.bySlot}
          selected={selected}
          color={color}
          onSelect={onSelect}
        />
        <div className='mx-[14px] mt-0.5 flex items-center gap-2'>
          <button
            type='button'
            className={cx(snapButtonClass(color), 'h-[50px] flex-1 text-[15px] whitespace-nowrap')}
            onClick={onToggleExploded}
            data-testid='snap'
          >
            {state.exploded ? 'Put together' : 'Take apart'}
          </button>
          <AssembledActions compact selection={state.selection} catalog={catalog} />
        </div>
        <Credit
          inline
          className={cx(
            'text-center text-[10px] transition-colors duration-500',
            color ? 'text-(--on-slot)/75' : 'text-muted',
          )}
        />
      </section>
    </>
  )
}
