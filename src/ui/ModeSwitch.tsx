import { motion } from 'motion/react'
import type { Mode } from '../state/selection'
import { cx } from './cx'

type ModeSwitchProps = {
  mode: Mode
  onChange: (mode: Mode) => void
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'block', label: 'Block' },
]

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div
      role='radiogroup'
      aria-label='Background mode'
      className='flex h-[34px] rounded-full border border-line bg-fog p-[2px] text-[11px] font-semibold text-muted md:h-10 md:p-[3px] md:text-xs'
      data-testid='mode-switch'
    >
      {MODES.map(({ value, label }) => {
        const on = value === mode
        return (
          <button
            key={value}
            type='button'
            role='radio'
            aria-checked={on}
            className={cx(
              'relative rounded-full px-3 transition-colors duration-200 md:px-[14px]',
              on ? 'text-white' : 'hover:text-navy',
            )}
            onClick={() => onChange(value)}
            data-testid={`mode-${value}`}
          >
            {on && (
              <motion.span
                layoutId='mode-pill'
                className='absolute inset-0 rounded-full bg-navy'
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className='relative z-[1]'>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
