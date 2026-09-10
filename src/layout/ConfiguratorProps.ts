import type { Dispatch } from 'react'
import type { Slot } from '../parts/manifest'
import type { Catalog } from '../parts/useManifest'
import type { Action, ConfiguratorState, Direction } from '../state/selection'

export type LayoutProps = {
  catalog: Catalog
  state: ConfiguratorState
  dispatch: Dispatch<Action>
  block: boolean
  onCycle: (slot: Slot, direction: Direction) => void
  onSelect: (slot: Slot, id: string | null, direction: Direction) => void
  onToggleExploded: () => void
}
