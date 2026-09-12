import { describe, expect, it } from 'vitest'
import type { Part } from '../parts/manifest'
import type { PartsBySlot } from '../parts/useManifest'
import { DEFAULT_MODE, DEFAULT_SELECTION } from './selection'
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
  it('round-trips a full selection and the mode', () => {
    const shared = {
      selection: {
        hair: 'black-bob',
        head: 'eyepatch',
        body: 'leather-jacket',
        pants: 'blue-jeans',
      },
      mode: 'white' as const,
    }
    expect(decode(encode(shared), bySlot)).toEqual(shared)
  })

  it('leaves the defaults out of the query', () => {
    expect(encode({ selection: DEFAULT_SELECTION, mode: DEFAULT_MODE })).toBe('')
    expect(encode({ selection: DEFAULT_SELECTION, mode: 'white' })).toBe('?mode=white')
  })

  it('falls back to the default mode for a missing or unknown one', () => {
    expect(decode('', bySlot).mode).toBe(DEFAULT_MODE)
    expect(decode('?mode=neon', bySlot).mode).toBe(DEFAULT_MODE)
  })

  it('encodes no hair as none and decodes it back to null', () => {
    const shared = { selection: { ...DEFAULT_SELECTION, hair: null }, mode: DEFAULT_MODE }
    expect(encode(shared)).toContain('hair=none')
    expect(decode(encode(shared), bySlot).selection.hair).toBeNull()
  })

  it('falls back to the default for unknown ids and empty queries', () => {
    expect(decode('?hair=gone&head=eyepatch', bySlot).selection).toEqual({
      ...DEFAULT_SELECTION,
      head: 'eyepatch',
    })
    expect(decode('', bySlot).selection).toEqual(DEFAULT_SELECTION)
  })

  it('never lets a non-hair slot become none', () => {
    expect(decode('?head=none', bySlot).selection.head).toBe(DEFAULT_SELECTION.head)
  })
})
