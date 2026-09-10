import { describe, expect, it } from 'vitest'
import type { Part } from '../parts/manifest'
import type { PartsBySlot } from '../parts/useManifest'
import { DEFAULT_SELECTION } from './selection'
import { decode, encode } from './urlCodec'

const part = (id: string, slot: Part['slot']): Part => ({
  id,
  slot,
  name: id,
  src: '',
  png: '',
  thumb: '',
  color: '#000',
  width: 600,
  height: 400,
  bottomGap: 0,
})

const bySlot: PartsBySlot = {
  hair: [part('pirate-hat', 'hair'), part('black-bob', 'hair')],
  head: [part('smirk', 'head'), part('eyepatch', 'head')],
  body: [part('dollar-chain', 'body'), part('leather-jacket', 'body')],
  pants: [part('tan-camo', 'pants'), part('blue-jeans', 'pants')],
}

describe('urlCodec', () => {
  it('round-trips a full selection', () => {
    const selection = {
      hair: 'black-bob',
      head: 'eyepatch',
      body: 'leather-jacket',
      pants: 'blue-jeans',
    }
    expect(decode(encode(selection), bySlot)).toEqual(selection)
  })

  it('encodes no hair as none and decodes it back to null', () => {
    const selection = { ...DEFAULT_SELECTION, hair: null }
    expect(encode(selection)).toContain('hair=none')
    expect(decode(encode(selection), bySlot).hair).toBeNull()
  })

  it('falls back to the default for unknown ids and empty queries', () => {
    expect(decode('?hair=gone&head=eyepatch', bySlot)).toEqual({
      ...DEFAULT_SELECTION,
      head: 'eyepatch',
    })
    expect(decode('', bySlot)).toEqual(DEFAULT_SELECTION)
  })

  it('never lets a non-hair slot become none', () => {
    expect(decode('?head=none', bySlot).head).toBe(DEFAULT_SELECTION.head)
  })
})
