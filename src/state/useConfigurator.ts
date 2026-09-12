import { useEffect, useReducer, useRef } from 'react'
import type { PartsBySlot } from '../parts/useManifest'
import { initialState, reduce, type ConfiguratorState } from './selection'
import { decode, encode } from './urlCodec'

export function useConfigurator(bySlot: PartsBySlot) {
  const [state, dispatch] = useReducer(reduce, bySlot, (parts) =>
    initialState(decode(window.location.search, parts)),
  )
  const pushNext = useRef(false)

  useEffect(() => {
    // An all-default state encodes to nothing, and an empty url would keep the current query.
    const url = encode({ selection: state.selection, mode: state.mode }) || window.location.pathname
    // Shuffle marks the next write as a push, so Back returns the figure it replaced. Its four
    // slots land one at a time and each following write replaces that same entry.
    if (pushNext.current) {
      pushNext.current = false
      window.history.pushState(null, '', url)
    } else {
      window.history.replaceState(null, '', url)
    }
  }, [state.selection, state.mode])

  useEffect(() => {
    const onPopState = () =>
      dispatch({ type: 'restore', shared: decode(window.location.search, bySlot) })
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [bySlot])

  const pushHistory = () => {
    pushNext.current = true
  }

  return [state, dispatch, pushHistory] as const satisfies readonly [
    ConfiguratorState,
    unknown,
    unknown,
  ]
}
