import { useEffect, useRef } from 'react'

export function useKeyboard(handler: (event: KeyboardEvent) => void) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  // The subscription outlives the handler identity, which changes on every render.
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handlerRef.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
