import { useEffect, type RefObject } from 'react'

// Fires when a pointerdown lands outside every ref. Inactive when `enabled` is false.
export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  enabled: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!enabled) return
    const handle = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (refs.some((ref) => ref.current?.contains(target))) return
      onOutside()
    }
    document.addEventListener('pointerdown', handle)
    return () => document.removeEventListener('pointerdown', handle)
  })
}
