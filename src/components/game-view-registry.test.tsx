// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { PLAYER_VIEW_REGISTRY } from './game-player-views'
import { HOST_VIEW_REGISTRY } from './game-host-views'

// This test imports every dedicated player/host view component — each of which builds a
// Supabase client at module load. It exercises the harness's dummy-Supabase env (without
// it, these imports throw "supabaseUrl is required"). It also restores the registry
// coverage check that had to be dropped from #150 for exactly that reason.
describe('game view registries', () => {
  it('player and host registries cover exactly the same games', () => {
    expect(Object.keys(PLAYER_VIEW_REGISTRY).sort()).toEqual(Object.keys(HOST_VIEW_REGISTRY).sort())
  })

  it('every registry entry is a defined component', () => {
    const all = [...Object.values(PLAYER_VIEW_REGISTRY), ...Object.values(HOST_VIEW_REGISTRY)]
    expect(all.length).toBeGreaterThanOrEqual(2 * 18)
    for (const v of all) expect(v).toBeTruthy()
  })
})
