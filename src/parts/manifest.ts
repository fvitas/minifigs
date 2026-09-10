export const SLOTS = ['hair', 'head', 'body', 'pants'] as const
export type Slot = (typeof SLOTS)[number]

export type Part = {
  id: string
  slot: Slot
  name: string
  src: string
  png: string
  thumb: string
  color: string
  width: number
  height: number
  // Transparent rows between the part's lowest pixel and the canvas bottom.
  bottomGap: number
}

export type Manifest = {
  generatedAt: string
  slots: readonly Slot[]
  parts: Part[]
}
