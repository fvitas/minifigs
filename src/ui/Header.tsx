import type { Mode } from '../state/selection'
import { ModeSwitch } from './ModeSwitch'
import { ShuffleButton } from './ShuffleButton'

type HeaderProps = {
  desktop: boolean
  mode: Mode
  onMode: (mode: Mode) => void
  onShuffle: () => void
}

// The mark is the cap band of the name: studs level with the top of the M, hem on the baseline.
// The studs sit outside the box, so the nudge puts the whole mark on that band, not its body.
const BRICK =
  "relative h-[11px] w-[18px] translate-y-[1px] rounded-[2px] bg-lego shadow-[inset_0_-2px_0_rgba(0,0,0,.18)] before:absolute before:-top-[3px] before:left-[2px] before:h-[3px] before:w-[6px] before:rounded-t-[1px] before:bg-lego before:content-[''] after:absolute after:-top-[3px] after:right-[2px] after:h-[3px] after:w-[6px] after:rounded-t-[1px] after:bg-lego after:content-[''] md:h-3.5 md:w-[22px] md:before:-top-1 md:before:left-[3px] md:before:h-1 md:before:w-[7px] md:after:-top-1 md:after:right-[3px] md:after:h-1 md:after:w-[7px]"

export function Header({ desktop, mode, onMode, onShuffle }: HeaderProps) {
  return (
    // Installed from the home screen there is no browser chrome, so the header clears the status bar itself.
    <header className='z-[3] flex items-center justify-between gap-2 border-b border-line bg-white px-[14px] py-[10px] pt-[calc(10px+env(safe-area-inset-top))] md:px-10 md:py-4 md:pt-[calc(16px+env(safe-area-inset-top))]'>
      <div className='grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-2 font-display text-[19px] font-extrabold tracking-[-.02em] text-navy md:gap-x-3 md:text-2xl'>
        <span className={BRICK} aria-hidden='true' />
        <span>Minifigs</span>
        {/* Wraps below ~375px so the switch keeps its size instead of sliding off. */}
        <small className='col-span-2 font-sans text-[10px] leading-[1.3] font-medium text-muted md:whitespace-nowrap md:text-xs'>
          Not affiliated with the LEGO Group
        </small>
      </div>
      <div className='flex shrink-0 items-center gap-2 md:gap-[14px]'>
        <ModeSwitch mode={mode} onChange={onMode} />
        {/* Mobile puts Shuffle above the slot tabs, within reach of the thumb. */}
        {desktop && <ShuffleButton className='h-10 pr-[18px] pl-[14px]' onShuffle={onShuffle} />}
      </div>
    </header>
  )
}
