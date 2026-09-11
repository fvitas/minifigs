import { Suspense, type CSSProperties } from 'react'
import { useKeyboard } from './hooks/useKeyboard'
import { useMediaQuery } from './hooks/useMediaQuery'
import { DesktopLayout } from './layout/DesktopLayout'
import { MobileLayout } from './layout/MobileLayout'
import { SLOTS, type Slot } from './parts/manifest'
import { useCatalog } from './parts/useManifest'
import { randomSelection, type Direction, type Mode } from './state/selection'
import { useConfigurator } from './state/useConfigurator'
import { cx } from './ui/cx'
import { Header } from './ui/Header'
import { SLOT_PALETTE } from './ui/palette'

const SHUFFLE_STAGGER_MS = 70

function Configurator() {
  const catalog = useCatalog()
  const [state, dispatch] = useConfigurator(catalog.bySlot)
  const desktop = useMediaQuery('(min-width: 768px)')
  const color = state.mode === 'color'
  const palette = SLOT_PALETTE[state.focusSlot]

  const onCycle = (slot: Slot, direction: Direction) =>
    dispatch({ type: 'cycle', slot, direction, bySlot: catalog.bySlot })
  const onSelect = (slot: Slot, id: string | null, direction: Direction) =>
    dispatch({ type: 'set', slot, id, direction })
  const onToggleExploded = () => dispatch({ type: 'explode', exploded: !state.exploded })
  const onMode = (mode: Mode) => dispatch({ type: 'mode', mode })
  const onShuffle = () => {
    const picks = randomSelection(catalog.bySlot)
    SLOTS.forEach((slot, index) => {
      setTimeout(() => onSelect(slot, picks[slot], index % 2 ? -1 : 1), index * SHUFFLE_STAGGER_MS)
    })
  }

  useKeyboard((event: KeyboardEvent) => {
    const slot = state.activeSlot ?? (desktop ? null : state.focusSlot)
    const index = slot ? SLOTS.indexOf(slot) : 0
    switch (event.key) {
      case 'ArrowRight':
        if (slot) onCycle(slot, 1)
        break
      case 'ArrowLeft':
        if (slot) onCycle(slot, -1)
        break
      case 'ArrowUp':
        event.preventDefault()
        dispatch({
          type: 'activate',
          slot: SLOTS[(index - 1 + SLOTS.length) % SLOTS.length] ?? 'hair',
        })
        break
      case 'ArrowDown':
        event.preventDefault()
        dispatch({ type: 'activate', slot: SLOTS[(index + 1) % SLOTS.length] ?? 'hair' })
        break
      case ' ':
        event.preventDefault()
        onToggleExploded()
        break
      case 'Escape':
        if (desktop) dispatch({ type: 'activate', slot: null })
        break
    }
  })

  const layoutProps = { catalog, state, dispatch, color, onCycle, onSelect, onToggleExploded }
  return (
    <div
      className={cx(
        'grid h-dvh grid-cols-[minmax(0,1fr)] overflow-hidden transition-[background-color,color] duration-500',
        desktop
          ? 'grid-rows-[auto_minmax(0,1fr)_auto]'
          : 'grid-rows-[auto_auto_minmax(0,1fr)_auto]',
        color ? 'bg-(--slot) text-(--on-slot)' : 'bg-fog text-ink',
      )}
      style={{ '--slot': palette.slot, '--on-slot': palette.onSlot } as CSSProperties}
      data-mode={state.mode}
      data-slot={state.focusSlot}
    >
      <Header mode={state.mode} onMode={onMode} onShuffle={onShuffle} />
      {desktop ? <DesktopLayout {...layoutProps} /> : <MobileLayout {...layoutProps} />}
    </div>
  )
}

function Loading() {
  return (
    <div className='grid h-dvh place-items-center bg-fog'>
      <span className='h-4 w-[26px] animate-pulse rounded-[3px] bg-lego shadow-[inset_0_-3px_0_rgba(0,0,0,.18)]' />
    </div>
  )
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Configurator />
    </Suspense>
  )
}
