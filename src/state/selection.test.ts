import { describe, expect, it } from 'vitest'
import type { Part } from '../parts/manifest'
import type { PartsBySlot } from '../parts/useManifest'
import { DEFAULT_SELECTION, nextOption, optionsFor } from './selection'

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
  hair: [part('black-bob', 'hair'), part('pirate-hat', 'hair'), part('top-hat', 'hair')],
  head: [part('stern', 'head'), part('eyepatch', 'head'), part('smirk', 'head')],
  body: [part('police-vest', 'body'), part('dollar-chain', 'body')],
  pants: [part('green', 'pants'), part('tan-camo', 'pants')],
}

describe('optionsFor', () => {
  it('puts the default first in every slot', () => {
    expect(optionsFor(bySlot, 'hair')[0]).toBe(DEFAULT_SELECTION.hair)
    expect(optionsFor(bySlot, 'head')[0]).toBe(DEFAULT_SELECTION.head)
    expect(optionsFor(bySlot, 'body')[0]).toBe(DEFAULT_SELECTION.body)
    expect(optionsFor(bySlot, 'pants')[0]).toBe(DEFAULT_SELECTION.pants)
  })

  it('keeps the rest in manifest order', () => {
    expect(optionsFor(bySlot, 'head')).toEqual(['smirk', 'stern', 'eyepatch'])
  })

  it('keeps "no hair" last', () => {
    expect(optionsFor(bySlot, 'hair')).toEqual(['pirate-hat', 'black-bob', 'top-hat', null])
  })

  it('leaves the order alone when the default is missing from the manifest', () => {
    const without: PartsBySlot = { ...bySlot, pants: [part('green', 'pants')] }
    expect(optionsFor(without, 'pants')).toEqual(['green'])
  })

  it('cycles forward from the default into the next manifest part', () => {
    expect(nextOption(bySlot, 'body', 'dollar-chain', 1)).toBe('police-vest')
    expect(nextOption(bySlot, 'body', 'dollar-chain', -1)).toBe('police-vest')
  })
})
