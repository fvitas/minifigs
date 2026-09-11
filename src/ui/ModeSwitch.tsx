import { motion } from 'motion/react'
import type { Mode } from '../state/selection'
import { cx } from './cx'

type ModeSwitchProps = {
  mode: Mode
  onChange: (mode: Mode) => void
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'color', label: 'Color' },
]

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={mode === 'color'}
      aria-label='Color background'
      // The button is not the flex container: iOS drops `stretch` on a button's children, which
      // top-aligned the options and left the bottom of the track empty. The row below does the
      // layout instead, and each option carries its own height rather than inheriting the track's —
      // 36 + 3px padding + 1px border = the 44px iOS touch target, 40 on desktop.
      className='group inline-block rounded-full border border-line bg-fog p-[3px] text-[13px] font-semibold text-muted md:text-xs'
      onClick={() => onChange(mode === 'color' ? 'white' : 'color')}
      data-testid='mode-switch'
    >
      <span className='flex items-center'>
        {MODES.map(({ value, label }) => {
          const on = value === mode
          return (
            <span
              key={value}
              className={cx(
                'relative flex h-9 items-center rounded-full px-4 transition-colors duration-200 md:h-8 md:px-[14px]',
                on ? 'text-white' : 'group-hover:text-navy',
              )}
            >
              {on && (
                <motion.span
                  layoutId='mode-pill'
                  className='absolute inset-0 rounded-full bg-navy'
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                />
              )}
              <span className='relative z-[1]'>{label}</span>
            </span>
          )
        })}
      </span>
    </button>
  )
}
