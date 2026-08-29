import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { compareOf, compareRows, shareOfNetwork } from '~/model/compare'
import { metricsOf } from '~/model/metrics'
import type { Envelope, Metric } from '~/nostr/documents'

function payloadOf(file: string) {
  const event = JSON.parse(readFileSync(`tests/fixtures/snapshot/${file}`, 'utf8')) as {
    content: string
  }
  return (JSON.parse(event.content) as Envelope).payload
}

const sats = (name: string, value: number): Metric => ({
  name,
  kind: 'observed',
  unit: 'sats',
  value,
})

describe('compareRows · the live document', () => {
  const rows = compareRows(metricsOf(payloadOf('compare-30d.json')))

  test('reads one block per instance the publisher compares', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  test('keys the block by the label the publisher wrote', () => {
    expect(rows[0]?.label).toBe('Mostro (82fa8cb9)')
  })

  test('carries the instance own volume in sats', () => {
    expect(rows[0]?.figures.get('volume_sats')?.value).toBe(40017882)
    expect(rows[0]?.figures.get('volume_sats')?.unit).toBe('sats')
  })

  test('carries what it completed and what it sent in dev fees', () => {
    expect(rows[0]?.figures.get('completed')?.value).toBe(422)
    expect(rows[0]?.figures.get('dev_fees_sats')?.value).toBe(122642)
  })
})

describe('compareRows · the shapes that bite', () => {
  test('splits the label from the right, so a label may contain dots', () => {
    // Arrange
    const metrics = [sats('compare.mostro.network (abc).volume_sats', 7)]

    // Act
    const rows = compareRows(metrics)

    // Assert
    expect(rows[0]?.label).toBe('mostro.network (abc)')
    expect(rows[0]?.figures.get('volume_sats')?.value).toBe(7)
  })

  test('ignores a name that is not a compare block', () => {
    expect(compareRows([sats('volume.sats', 9)])).toEqual([])
  })

  test('finds the block a label names, and nothing when none does', () => {
    // Arrange
    const metrics = compareRows(metricsOf(payloadOf('compare-30d.json')))

    // Act & Assert
    expect(compareOf(metrics, 'Mostro (82fa8cb9)')?.label).toBe('Mostro (82fa8cb9)')
    expect(compareOf(metrics, 'Mostro (deadbeef)')).toBeUndefined()
  })
})

describe('shareOfNetwork', () => {
  const row = compareRows([sats('compare.Mostro.volume_sats', 25)])[0]!

  test('is the instance volume over the network volume, and says it is inferred', () => {
    // Act
    const share = shareOfNetwork(row, [sats('volume.sats', 100)])

    // Assert
    expect(share?.value).toBe(0.25)
    expect(share?.unit).toBe('ratio')
    expect(share?.kind).toBe('inferred')
  })

  test('is absence when the network total is not published', () => {
    expect(shareOfNetwork(row, [])).toBeUndefined()
  })

  test('is absence when the instance has no volume of its own', () => {
    // Arrange
    const bare = compareRows([sats('compare.Mostro.dev_fees_sats', 1)])[0]!

    // Act & Assert
    expect(shareOfNetwork(bare, [sats('volume.sats', 100)])).toBeUndefined()
  })

  test('is absence rather than a division by zero on a quiet network', () => {
    expect(shareOfNetwork(row, [sats('volume.sats', 0)])).toBeUndefined()
  })

  test('is absence when no block was found for the instance', () => {
    expect(shareOfNetwork(undefined, [sats('volume.sats', 100)])).toBeUndefined()
  })
})
