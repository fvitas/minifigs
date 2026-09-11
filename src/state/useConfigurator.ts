import { useEffect, useReducer } from 'react'
import type { PartsBySlot } from '../parts/useManifest'
import { initialState, reduce, type ConfiguratorState } from './selection'
import { decode, encode } from './urlCodec'

export function useConfigurator(bySlot: PartsBySlot) {
  const [state, dispatch] = useReducer(reduce, bySlot, (parts) =>
    initialState(decode(window.location.search, parts)),
  )
  useEffect(() => {
    window.history.replaceState(null, '', encode({ selection: state.selection, mode: state.mode }))
  }, [state.selection, state.mode])
  return [state, dispatch] as const satisfies readonly [ConfiguratorState, unknown]
}
