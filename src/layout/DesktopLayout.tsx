import { useRef } from 'react'
import { Figure } from '../figure/Figure'
import { useClickOutside } from '../hooks/useClickOutside'
import { PartGrid } from '../picker/PartGrid'
import { SlotCards } from '../picker/SlotCards'
import type { Slot } from '../parts/manifest'
import { AssembledActions } from '../ui/AssembledActions'
import { Backdrop } from '../ui/Backdrop'
import { snapButtonClass } from '../ui/buttons'
import { cx } from '../ui/cx'
import { Footer } from '../ui/Footer'
import { SLOT_WORD } from '../ui/palette'
import { Stepper } from '../ui/Stepper'
import type { LayoutProps } from './ConfiguratorProps'
import { useStageScale } from './useStageScale'

export function DesktopLayout({
  catalog,
  state,
  dispatch,
  block,
  onCycle,
  onSelect,
  onToggleExploded,
}: LayoutProps) {
  const { stageRef, scale } = useStageScale(false)
  const toggleSlot = (slot: Slot) =>
    dispatch({ type: 'activate', slot: state.activeSlot === slot ? null : slot })
  const close = () => dispatch({ type: 'activate', slot: null })
  const panelRef = useRef<HTMLDivElement>(null)
  const figureRef = useRef<HTMLDivElement>(null)
  useClickOutside([panelRef, figureRef], state.activeSlot !== null, close)

  return (
    <>
      <main className='relative z-[1] mx-auto grid w-full max-w-[1240px] min-h-0 grid-cols-[minmax(420px,560px)_1fr] items-center gap-10 px-10 py-6'>
        <section className='relative z-[1]'>
          <h1
            className={cx(
              'mb-4 font-display text-[clamp(36px,3.9vw,54px)] leading-[.98] font-extrabold tracking-[-.035em] whitespace-nowrap transition-colors duration-500',
              block ? 'text-(--on-slot)' : 'text-navy',
            )}
          >
            Design your{' '}
            <em
              className={cx(
                'not-italic transition-[color,opacity] duration-500',
                block ? 'text-(--on-slot) opacity-55' : 'text-lego',
              )}
            >
              figurine.
            </em>
          </h1>
          <p
            className={cx(
              'mb-[34px] font-mono text-xs tracking-[.14em] uppercase transition-colors duration-500',
              block ? 'text-(--on-slot)/75' : 'text-muted',
            )}
          >
            <b className={cx('font-medium', block ? 'text-(--on-slot)' : 'text-navy')}>
              Four pieces.
            </b>{' '}
            Thirty-eight parts. No wrong answers.
          </p>
          <div ref={panelRef} className='relative min-h-[190px]'>
            <SlotCards
              catalog={catalog}
              selection={state.selection}
              activeSlot={state.activeSlot}
              block={block}
              onActivate={toggleSlot}
            />
            <PartGrid
              slot={state.activeSlot}
              bySlot={catalog.bySlot}
              selected={state.activeSlot ? state.selection[state.activeSlot] : null}
              onSelect={onSelect}
              onClose={close}
            />
          </div>
          <div className='mt-[22px]'>
            <Stepper activeSlot={state.activeSlot} done={!state.exploded} block={block} />
          </div>
        </section>
        <div className='grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4'>
          <section
            ref={stageRef}
            className='relative grid min-h-0 place-items-center'
            data-testid='stage'
          >
            <Backdrop
              block={block}
              word={state.exploded ? SLOT_WORD[state.focusSlot] : 'DONE'}
              compact={false}
            />
            {scale > 0 && (
              <div ref={figureRef} className='contents'>
                <Figure
                  catalog={catalog}
                  selection={state.selection}
                  exploded={state.exploded}
                  activeSlot={state.activeSlot}
                  direction={state.direction}
                  scale={scale}
                  hoverArrows
                  onActivate={toggleSlot}
                  onCycle={onCycle}
                />
              </div>
            )}
          </section>
          <div className='relative z-[1] flex items-center justify-center gap-[10px]'>
            <button
              type='button'
              className={cx(
                snapButtonClass(state.exploded, block),
                'h-11 w-[150px] whitespace-nowrap',
              )}
              onClick={onToggleExploded}
              data-testid='snap'
            >
              {state.exploded ? 'Put together' : 'Take apart'}
            </button>
            <AssembledActions compact={false} selection={state.selection} catalog={catalog} />
          </div>
        </div>
      </main>
      <Footer block={block} />
    </>
  )
}
