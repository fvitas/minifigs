import { Shuffle } from 'lucide-react'
import type { Mode } from '../state/selection'
import { GHOST } from './buttons'
import { cx } from './cx'
import { ModeSwitch } from './ModeSwitch'

type HeaderProps = {
  mode: Mode
  onMode: (mode: Mode) => void
  onShuffle: () => void
}

const BRICK =
  "relative row-span-2 h-4 w-[26px] rounded-[3px] bg-lego shadow-[inset_0_-3px_0_rgba(0,0,0,.18)] before:absolute before:-top-[5px] before:left-[3px] before:h-[5px] before:w-2 before:rounded-t-[2px] before:bg-lego before:content-[''] after:absolute after:-top-[5px] after:right-[3px] after:h-[5px] after:w-2 after:rounded-t-[2px] after:bg-lego after:content-[''] md:h-5 md:w-8 md:before:-top-1.5 md:before:left-1 md:before:h-1.5 md:before:w-[10px] md:after:-top-1.5 md:after:right-1 md:after:h-1.5 md:after:w-[10px]"

export function Header({ mode, onMode, onShuffle }: HeaderProps) {
  return (
    <header className='z-[3] flex items-center justify-between gap-2 border-b border-line bg-white px-[14px] py-[10px] md:px-10 md:py-4'>
      <div className='grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-2 font-display text-[19px] font-extrabold tracking-[-.02em] text-navy md:gap-x-3 md:text-2xl'>
        <span className={BRICK} aria-hidden='true' />
        <span>Minifigs</span>
        {/* Wraps below ~375px so the switch and Shuffle keep their size instead of sliding off. */}
        <small className='col-start-2 -mt-0.5 font-sans text-[10px] leading-[1.3] font-medium text-muted md:whitespace-nowrap md:text-xs'>
          Not affiliated with the LEGO Group
        </small>
      </div>
      <div className='flex shrink-0 items-center gap-2 md:gap-[14px]'>
        <ModeSwitch mode={mode} onChange={onMode} />
        <button
          type='button'
          aria-label='Shuffle'
          className={cx(
            GHOST,
            'size-[34px] gap-2 p-0 text-sm md:h-10 md:w-auto md:pr-[18px] md:pl-[14px] md:text-base',
          )}
          onClick={onShuffle}
          data-testid='shuffle'
        >
          <Shuffle className='size-4' />
          <span className='hidden md:inline'>Shuffle</span>
        </button>
      </div>
    </header>
  )
}
