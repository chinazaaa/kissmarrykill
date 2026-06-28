// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mutable state the hoisted mocks read from (vi.hoisted so it exists when mocks run).
const h = vi.hoisted(() => ({
  gameRow: null as { game_type: string } | null,
  verifyOk: true,
  verifyResponseOk: true,
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'abcd' }),
  useSearchParams: () => new URLSearchParams('token=secret'),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.gameRow, error: null }) }) }),
    }),
  },
}))

// Stub the heavy children so the test asserts the dispatch decision, not their internals.
vi.mock('@/components/poll-game/PollHostView', () => ({
  PollHostView: ({ gameCode, hostToken }: { gameCode: string; hostToken: string }) => (
    <div data-testid="poll-host-view">
      poll:{gameCode}:{hostToken}
    </div>
  ),
}))
vi.mock('@/components/game-host-views', () => ({
  HOST_VIEW_REGISTRY: {
    chess: ({ gameCode, hostToken }: { gameCode: string; hostToken: string }) => (
      <div data-testid="board-host-view">
        board:{gameCode}:{hostToken}
      </div>
    ),
  },
}))

import HostPage from './page'

beforeEach(() => {
  h.gameRow = null
  h.verifyOk = true
  h.verifyResponseOk = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: h.verifyResponseOk, json: async () => ({ ok: h.verifyOk }) }))
  )
})

afterEach(() => {
  vi.unstubAllGlobals() // restore the real global.fetch so it can't leak into other suites
})

describe('HostPage dispatcher', () => {
  it('dispatches a poll game to PollHostView (with the upper-cased code + token)', async () => {
    h.gameRow = { game_type: 'smash_marry_kill' }
    render(<HostPage />)
    expect(await screen.findByTestId('poll-host-view')).toHaveTextContent('poll:ABCD:secret')
    expect(screen.queryByTestId('board-host-view')).not.toBeInTheDocument()
  })

  it('dispatches a board game to its dedicated host view', async () => {
    h.gameRow = { game_type: 'chess' }
    render(<HostPage />)
    expect(await screen.findByTestId('board-host-view')).toHaveTextContent('board:ABCD:secret')
    expect(screen.queryByTestId('poll-host-view')).not.toBeInTheDocument()
  })

  it('shows Access Denied when the host token fails verification', async () => {
    h.gameRow = { game_type: 'chess' }
    h.verifyOk = false
    render(<HostPage />)
    expect(await screen.findByText('Access Denied')).toBeInTheDocument()
  })

  it('shows Access Denied when the game is not found', async () => {
    h.gameRow = null
    render(<HostPage />)
    expect(await screen.findByText('Access Denied')).toBeInTheDocument()
  })

  it('shows the server-error state when verify-host is unreachable', async () => {
    h.gameRow = { game_type: 'chess' }
    h.verifyResponseOk = false
    render(<HostPage />)
    expect(await screen.findByText("Can't reach the server")).toBeInTheDocument()
  })
})
