import { describe, it, expect } from 'vitest'
import { computePlacementPoints, selectBottomNForLifeLoss } from './tournament-scoring'

const POINTS = [10, 7, 5, 3, 2, 1]

describe('computePlacementPoints', () => {
  it('maps ranks to the points array', () => {
    expect(computePlacementPoints({ a: 1, b: 2, c: 3 }, POINTS)).toEqual({ a: 10, b: 7, c: 5 })
  })

  it('falls back to the last entry for ranks beyond the array', () => {
    expect(computePlacementPoints({ a: 1, b: 7, c: 12 }, POINTS)).toEqual({ a: 10, b: 1, c: 1 })
  })

  it('gives tied ranks the same points', () => {
    expect(computePlacementPoints({ a: 1, b: 1, c: 3 }, POINTS)).toEqual({ a: 10, b: 10, c: 5 })
  })
})

describe('selectBottomNForLifeLoss', () => {
  it('picks the single last-place finisher (N=1)', () => {
    expect(selectBottomNForLifeLoss({ a: 1, b: 2, c: 3, d: 4 }, 1)).toEqual(['d'])
  })

  it('picks the bottom N finishers', () => {
    expect(new Set(selectBottomNForLifeLoss({ a: 1, b: 2, c: 3, d: 4 }, 2))).toEqual(new Set(['c', 'd']))
  })

  it('eliminates nobody when last place is a tie (N=1)', () => {
    // b and c tie for last — ambiguous bottom, so no one loses a life.
    expect(selectBottomNForLifeLoss({ a: 1, b: 2, c: 2 }, 1)).toEqual([])
  })

  it('treats a missing/zero eliminateCount as 1', () => {
    expect(selectBottomNForLifeLoss({ a: 1, b: 2, c: 3 }, 0)).toEqual(['c'])
  })
})

describe('5-player lives tournament simulation', () => {
  it('runs games until one player survives, decrementing lives for last place', () => {
    // Fixed skill order (best → worst); the worst surviving player comes last each game.
    const SKILL = ['A', 'B', 'C', 'D', 'E']
    const STARTING_LIVES = 2
    const ELIMINATE_COUNT = 1

    const lives: Record<string, number> = Object.fromEntries(SKILL.map((p) => [p, STARTING_LIVES]))
    const points: Record<string, number> = Object.fromEntries(SKILL.map((p) => [p, 0]))
    const games_played: Record<string, number> = Object.fromEntries(SKILL.map((p) => [p, 0]))
    const eliminated = new Set<string>()

    let games = 0
    const alive = () => SKILL.filter((p) => !eliminated.has(p))

    while (alive().length > 1 && games < 100) {
      // Only non-eliminated players play; rank them by skill (best first).
      const field = alive()
      const placements: Record<string, number> = {}
      field.forEach((p, i) => {
        placements[p] = i + 1
      })

      // Award placement points.
      const earned = computePlacementPoints(placements, POINTS)
      for (const [p, pts] of Object.entries(earned)) {
        points[p] += pts
        games_played[p] += 1
      }

      // Bottom-N lose a life; eliminate at zero.
      for (const p of selectBottomNForLifeLoss(placements, ELIMINATE_COUNT)) {
        lives[p] -= 1
        if (lives[p] <= 0) eliminated.add(p)
      }

      games += 1
    }

    // Worst-skill players are eliminated in order; A (best) is the lone survivor.
    expect(alive()).toEqual(['A'])
    expect([...eliminated].sort()).toEqual(['B', 'C', 'D', 'E'])

    // 5 players × 2 lives, one life lost per game → 8 games to leave one standing.
    expect(games).toBe(8)

    // A placed 1st in all 8 games → 8 × 10 pts, and never lost a life.
    expect(points.A).toBe(80)
    expect(lives.A).toBe(2)

    // E (worst) only survived the first 2 games: 2 pts each as last of 5 → 4 pts total.
    expect(games_played.E).toBe(2)
    expect(points.E).toBe(4)
    expect(lives.E).toBe(0)

    // Every eliminated player ended on zero lives.
    for (const p of ['B', 'C', 'D', 'E']) expect(lives[p]).toBe(0)
  })

  it('ends quickly when several players are eliminated per game (N=2)', () => {
    const SKILL = ['A', 'B', 'C', 'D', 'E']
    const lives: Record<string, number> = Object.fromEntries(SKILL.map((p) => [p, 1]))
    const eliminated = new Set<string>()
    const alive = () => SKILL.filter((p) => !eliminated.has(p))

    let games = 0
    while (alive().length > 1 && games < 100) {
      const field = alive()
      const placements: Record<string, number> = {}
      field.forEach((p, i) => {
        placements[p] = i + 1
      })
      for (const p of selectBottomNForLifeLoss(placements, 2)) {
        lives[p] -= 1
        if (lives[p] <= 0) eliminated.add(p)
      }
      games += 1
    }

    // 1 life each, bottom 2 out per game: 5 → 3 → 1. Two games, A survives.
    expect(alive()).toEqual(['A'])
    expect(games).toBe(2)
  })
})
