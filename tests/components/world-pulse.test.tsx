import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/preact'
import { WorldPulse, describeScene } from '~/components/WorldPulse'
import { buildScene, type Scene } from '~/map/scene'
import { createProjection } from '~/map/projection'
import type { Line } from '~/model/live-lines'
import type { LonLat } from '~/model/random-point'
import type { MapProjection } from '~/map/projection'

const PLACES: Record<string, LonLat> = {
  ARS: [-64, -34],
  VES: [-66, 8],
  'node-ar': [-58, -34],
  'node-ve': [-67, 10],
}

const projection: MapProjection = createProjection(900, 408)

function line(over: Partial<Line> = {}): Line {
  return {
    orderId: 'o1',
    fiat: 'ARS',
    instancePubkey: 'node-ar',
    phase: 'live',
    updatedAt: 0,
    ...over,
  }
}

function sceneOf(lines: readonly Line[]): Scene {
  return buildScene({
    lines,
    currencyAt: (code) => PLACES[code] ?? null,
    instanceAt: (pubkey) => PLACES[pubkey] ?? null,
    instanceLabel: (pubkey) => pubkey,
    project: projection.project,
  })
}

function draw(lines: readonly Line[], reducedMotion = false) {
  return render(
    <WorldPulse
      scene={sceneOf(lines)}
      land={[]}
      projection={projection}
      width={900}
      height={408}
      reducedMotion={reducedMotion}
    />,
  )
}

// Unmounting is what cancels the animation frame loop.
afterEach(cleanup)

describe('WorldPulse', () => {
  test('draws every arc the scene carries', () => {
    // Arrange
    const lines = Array.from({ length: 5 }, (_, i) => line({ orderId: `ars-${i}` }))

    // Act
    const { container } = draw(lines)

    // Assert
    expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(5)
  })

  test('gives each of those arcs a shape of its own', () => {
    const lines = Array.from({ length: 5 }, (_, i) => line({ orderId: `ars-${i}` }))

    const { container } = draw(lines)

    const shapes = new Set(
      [...container.querySelectorAll('[data-layer="arcs"] path')].map((p) =>
        p.getAttribute('d'),
      ),
    )
    expect(shapes.size).toBe(5)
  })

  test('marks a settling line by more than its colour', () => {
    const { container } = draw([line(), line({ orderId: 'o2', phase: 'settling' })])

    const dashed = [...container.querySelectorAll('[data-layer="arcs"] path')].filter((p) =>
      p.getAttribute('stroke-dasharray'),
    )
    expect(dashed).toHaveLength(1)
  })

  test('draws a currency and an instance for the route', () => {
    const { container } = draw([line()])

    expect(container.querySelectorAll('[data-layer="currencies"] > g')).toHaveLength(1)
    expect(container.querySelectorAll('[data-layer="instances"] > g')).toHaveLength(1)
  })

  test('sizes a currency by how many lines rest on it', () => {
    const one = draw([line()])
    const small = one.container
      .querySelector('[data-layer="currencies"] circle[stroke-opacity]')
      ?.getAttribute('r')
    cleanup()

    const many = draw(Array.from({ length: 9 }, (_, i) => line({ orderId: `o${i}` })))
    const large = many.container
      .querySelector('[data-layer="currencies"] circle[stroke-opacity]')
      ?.getAttribute('r')

    expect(Number(large)).toBeGreaterThan(Number(small))
  })

  test('draws one traveller per arc', () => {
    const { container } = draw([line(), line({ orderId: 'o2' })])

    expect(container.querySelectorAll('[data-layer="travellers"] circle')).toHaveLength(2)
  })

  test('draws no travellers when motion is not wanted', () => {
    const { container } = draw([line()], true)

    expect(container.querySelector('[data-layer="travellers"]')).toBeNull()
  })

  test('still draws the lines themselves when motion is not wanted', () => {
    const { container } = draw([line()], true)

    expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(1)
  })

  test('describes itself for a reader who cannot see it', () => {
    const { container } = draw([line()])

    expect(container.querySelector('svg')?.getAttribute('aria-label')).toMatch(
      /1 órdenes activas entre 1 monedas y 1 instancias/,
    )
  })

  test('draws the land it is given', () => {
    const { container } = render(
      <WorldPulse
        scene={sceneOf([])}
        land={[
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]] },
          },
        ]}
        projection={projection}
        width={900}
        height={408}
        reducedMotion={false}
      />,
    )

    expect(container.querySelectorAll('[data-layer="land"] path')).toHaveLength(1)
  })
})

describe('describeScene', () => {
  const empty: Scene = {
    arcs: [],
    currencies: [],
    instances: [],
    unplaced: { currencies: 0, instances: 0 },
  }

  test('says so when there is nothing to show', () => {
    expect(describeScene(empty)).toBe('Sin flujo de órdenes que mostrar.')
  })

  test('says what it could not place rather than quietly omitting it', () => {
    const scene: Scene = {
      ...empty,
      arcs: [{ orderId: 'a', fiat: 'ARS', instancePubkey: 'n', phase: 'live', points: [[0, 0]] }],
      unplaced: { currencies: 2, instances: 1 },
    }

    expect(describeScene(scene)).toMatch(/2 monedas sin ubicar/)
    expect(describeScene(scene)).toMatch(/1 instancias sin ubicar/)
  })
})
