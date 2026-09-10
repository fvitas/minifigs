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
  "relative row-span-2 h-[14px] w-[22px] rounded-[3px] bg-lego shadow-[inset_0_-3px_0_rgba(0,0,0,.18)] before:absolute before:-top-1 before:left-0.5 before:h-1 before:w-[7px] before:rounded-t-[2px] before:bg-lego before:content-[''] after:absolute after:-top-1 after:right-0.5 after:h-1 after:w-[7px] after:rounded-t-[2px] after:bg-lego after:content-[''] md:h-4 md:w-[26px] md:before:-top-[5px] md:before:left-[3px] md:before:h-[5px] md:before:w-2 md:after:-top-[5px] md:after:right-[3px] md:after:h-[5px] md:after:w-2"

export function Header({ mode, onMode, onShuffle }: HeaderProps) {
  return (
    <header className='z-[3] flex items-center justify-between gap-2 border-b border-line bg-white px-[14px] py-[10px] md:px-10 md:py-4'>
      <div className='grid grid-cols-[auto_1fr] items-center gap-x-2 font-display text-[17px] font-extrabold tracking-[-.02em] text-navy md:gap-x-[10px] md:text-xl'>
        <span className={BRICK} aria-hidden='true' />
        <span>Minifigs</span>
        <small className='col-start-2 -mt-0.5 font-sans text-[9px] font-medium whitespace-nowrap text-muted md:text-[11px]'>
          Not affiliated with the LEGO Group
        </small>
      </div>
      <div className='flex items-center gap-2 md:gap-[14px]'>
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
