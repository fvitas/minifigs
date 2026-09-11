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
      className='group flex h-[34px] rounded-full border border-line bg-fog p-[2px] text-[11px] font-semibold text-muted md:h-10 md:p-[3px] md:text-xs'
      onClick={() => onChange(mode === 'color' ? 'white' : 'color')}
      data-testid='mode-switch'
    >
      {MODES.map(({ value, label }) => {
        const on = value === mode
        return (
          <span
            key={value}
            className={cx(
              'relative flex items-center rounded-full px-3 transition-colors duration-200 md:px-[14px]',
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
    </button>
  )
}
