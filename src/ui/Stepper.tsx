import { SLOTS, type Slot } from '../parts/manifest'
import { cx } from './cx'

type StepperProps = {
  activeSlot: Slot | null
  done: boolean
  block: boolean
}

// Step numbers sit centred under the four slot cards, joined by one dashed line.
export function Stepper({ activeSlot, done, block }: StepperProps) {
  return (
    <div className='relative grid w-fit grid-cols-[repeat(4,112px)] gap-[18px]'>
      <span
        aria-hidden='true'
        className={cx(
          'absolute inset-x-[56px] top-1/2 border-t-2 border-dashed transition-colors duration-500',
          block ? 'border-(--on-slot)/40' : 'border-[#c9cad3]',
        )}
      />
      {SLOTS.map((slot, index) => (
        <span
          key={slot}
          className={cx(
            'relative mx-auto grid size-[26px] place-items-center rounded-full text-xs font-semibold transition-[background-color,color,transform] duration-300',
            block
              ? 'bg-(--on-slot) text-(--slot)'
              : done
                ? 'bg-lego text-white'
                : 'bg-navy text-white',
            activeSlot === slot && 'scale-[1.15]',
          )}
        >
          {index + 1}
        </span>
      ))}
    </div>
  )
}
