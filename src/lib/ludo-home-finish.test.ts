import { describe, it, expect } from 'vitest'
import { getLegalMovesFromRemaining } from './ludo'
import type { LudoPlayerState } from '@/types'

// House rule: a piece in its home lane finishes on ANY roll that's enough — no
// waiting for the exact count. FINISH_STEPS = 57, so a 'home' piece at pos 4 is
// 56 steps in and needs just 1 to reach the centre.
function greenStates(pieces: LudoPlayerState['pieces']): LudoPlayerState[] {
  return [{ game_id: 'G', player_id: 'p1', color: 'green', pieces, player_order: 0 } as LudoPlayerState]
}

const homePieceNeedingOne = [
  { id: 0, zone: 'home', pos: 4 }, // needs exactly 1 to finish
  { id: 1, zone: 'base', pos: 1 },
  { id: 2, zone: 'finished', pos: 0 },
  { id: 3, zone: 'finished', pos: 0 },
] as LudoPlayerState['pieces']

describe('ludo lenient home-lane finish', () => {
  it('finishes a home-lane piece that needs 1 even when neither die is 1 (dice 3+5)', () => {
    const moves = getLegalMovesFromRemaining(
      'green',
      homePieceNeedingOne,
      [3, 5],
      greenStates(homePieceNeedingOne),
      'p1'
    )
    const finish = moves.find((m) => m.pieceId === 0 && m.to.zone === 'finished')
    expect(finish).toBeTruthy() // previously this piece was stuck — now any roll brings it home
  })

  it('still finishes on the exact roll (dice 1+4)', () => {
    const moves = getLegalMovesFromRemaining(
      'green',
      homePieceNeedingOne,
      [1, 4],
      greenStates(homePieceNeedingOne),
      'p1'
    )
    expect(moves.some((m) => m.pieceId === 0 && m.to.zone === 'finished')).toBe(true)
  })

  it('a home-lane piece is never stuck — every die yields a move', () => {
    for (const die of [1, 2, 3, 4, 5, 6]) {
      const moves = getLegalMovesFromRemaining(
        'green',
        homePieceNeedingOne,
        [die],
        greenStates(homePieceNeedingOne),
        'p1'
      )
      expect(moves.some((m) => m.pieceId === 0)).toBe(true)
    }
  })

  it('a piece still on the main track is NOT finished by an overshoot (needs exact)', () => {
    // Track piece 6 steps from the centre (green start 0, so 51 steps in = track pos 51).
    const trackPiece = [
      { id: 0, zone: 'track', pos: 51 }, // 51 steps in; needs exactly 6 to finish
      { id: 1, zone: 'finished', pos: 0 },
      { id: 2, zone: 'finished', pos: 0 },
      { id: 3, zone: 'finished', pos: 0 },
    ] as LudoPlayerState['pieces']
    const overshoot = getLegalMovesFromRemaining('green', trackPiece, [5], greenStates(trackPiece), 'p1')
    // 51 + 5 = 56 -> lands in the home lane, does NOT finish
    expect(overshoot.some((m) => m.to.zone === 'finished')).toBe(false)
    const exact = getLegalMovesFromRemaining('green', trackPiece, [6], greenStates(trackPiece), 'p1')
    expect(exact.some((m) => m.to.zone === 'finished')).toBe(true)
  })
})
