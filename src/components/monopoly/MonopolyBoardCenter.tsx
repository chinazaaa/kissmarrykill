'use client'

import { useCallback, useRef, useState } from 'react'
import { MonopolyDiceRoll } from '@/components/monopoly/MonopolyBoard'
import { useMonopolyDeadlineTimer } from '@/hooks/useMonopolyModalTimer'
import { computeRent, parseBuildings, parseMortgaged } from '@/lib/monopoly-rent'
import {
  currentPlayerId,
  formatMonopolyMoney,
  MONOPOLY_JAIL_FINE,
  parsePropertyOwners,
  spaceAt,
  type MonopolyColorGroup,
} from '@/lib/monopoly'
import type { MonopolyBoard, MonopolyPlayerState, Player } from '@/types'

type PostAction = (url: string, body?: Record<string, unknown>) => Promise<void>

function BoardTimer({ seconds }: { seconds: number }) {
  if (seconds <= 0) return null
  const urgent = seconds <= 5
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
        urgent ? 'bg-red-500/30 text-red-100 animate-pulse' : 'bg-emerald-950/50 text-emerald-100',
      ].join(' ')}
    >
      {seconds}s
    </span>
  )
}

function BoardPrimaryButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-emerald-950 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition-colors w-full"
    >
      {loading ? '…' : children}
    </button>
  )
}

function BoardSecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-emerald-300/40 bg-emerald-900/70 hover:bg-emerald-800/80 disabled:opacity-40 text-emerald-50 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition-colors w-full"
    >
      {children}
    </button>
  )
}

export function MonopolyBoardCenter({
  board,
  myPlayerId,
  myState,
  players,
  acting,
  postAction,
  colorBarClass,
}: {
  board: MonopolyBoard
  myPlayerId: string | null
  myState: MonopolyPlayerState | undefined
  players: Player[]
  acting: boolean
  postAction: PostAction
  colorBarClass: (color?: MonopolyColorGroup) => string
}) {
  const turnPlayerId = currentPlayerId(board)
  const isMyTurn = turnPlayerId === myPlayerId && !myState?.bankrupt

  const owners = parsePropertyOwners(board.property_owners)
  const buildings = parseBuildings(board.property_buildings)
  const mortgaged = parseMortgaged(board.mortgaged_properties)
  const pendingSpace = board.pending_space != null ? spaceAt(board.pending_space) : null

  const rentOwnerId =
    board.phase === 'pay_rent' && board.pending_space != null ? owners[String(board.pending_space)] : null
  const rentOwner = rentOwnerId ? players.find((p) => p.id === rentOwnerId) : null
  const rentAmount =
    pendingSpace && rentOwnerId
      ? computeRent(pendingSpace, owners, rentOwnerId, board.last_dice?.total ?? 2, buildings, mortgaged)
      : 0

  const auction = board.auction_state
  const auctionSpace = auction ? spaceAt(auction.space_index) : null
  const isMyAuctionTurn = auction?.current_bidder_id === myPlayerId
  const [bidAmount, setBidAmount] = useState('')

  const showBuy = !!(isMyTurn && board.phase === 'buy' && pendingSpace)
  const showRent = !!(isMyTurn && board.phase === 'pay_rent' && pendingSpace)
  const showJail = !!(isMyTurn && board.phase === 'jail' && myState?.in_jail)
  const showAuction = !!(board.phase === 'auction' && auction && isMyAuctionTurn)
  const showRoll = !!(isMyTurn && board.phase === 'roll' && !myState?.in_jail)

  const actingRef = useRef(acting)
  actingRef.current = acting

  const autoBuyAuction = useCallback(() => {
    if (!actingRef.current) void postAction('/api/monopoly/buy', { buy: false })
  }, [postAction])

  const autoPayRent = useCallback(() => {
    if (!actingRef.current) void postAction('/api/monopoly/rent')
  }, [postAction])

  const autoAuctionPass = useCallback(() => {
    if (!actingRef.current) void postAction('/api/monopoly/auction', { action: 'pass' })
  }, [postAction])

  const autoJailRoll = useCallback(() => {
    if (!actingRef.current) void postAction('/api/monopoly/roll')
  }, [postAction])

  const deadline = board.turn_deadline_at ?? null
  const buySeconds = useMonopolyDeadlineTimer(deadline, showBuy, autoBuyAuction)
  const rentSeconds = useMonopolyDeadlineTimer(deadline, showRent, autoPayRent)
  const jailSeconds = useMonopolyDeadlineTimer(deadline, showJail, autoJailRoll)
  const auctionSeconds = useMonopolyDeadlineTimer(deadline, showAuction, autoAuctionPass)

  const actionSeconds = showBuy
    ? buySeconds
    : showRent
      ? rentSeconds
      : showJail
        ? jailSeconds
        : showAuction
          ? auctionSeconds
          : 0

  const phaseColorBar =
    (showBuy || showRent) && pendingSpace?.color
      ? colorBarClass(pendingSpace.color)
      : showAuction && auctionSpace?.color
        ? colorBarClass(auctionSpace.color)
        : null

  return (
    <div className="flex flex-col items-center justify-center h-full w-full min-w-0 px-1 sm:px-2 py-1 sm:py-2 text-center overflow-y-auto">
      {myState && (
        <div className="mb-1 sm:mb-1.5 shrink-0">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-emerald-200/70 leading-none">
            Your cash
          </p>
          <p className="text-base sm:text-xl font-black tabular-nums text-amber-300 leading-tight mt-0.5">
            {formatMonopolyMoney(myState.cash)}
          </p>
        </div>
      )}

      {phaseColorBar && <div className={['h-1 w-12 sm:w-16 rounded-full mb-1', phaseColorBar].join(' ')} />}

      {!showBuy && !showRent && !showJail && !showAuction && (
        <MonopolyDiceRoll dice={board.last_dice} rolling={acting} />
      )}

      {actionSeconds > 0 && (
        <div className="mt-1">
          <BoardTimer seconds={actionSeconds} />
        </div>
      )}

      {showRoll && (
        <div className="mt-2 w-full max-w-[9rem] sm:max-w-[10rem]">
          <BoardPrimaryButton onClick={() => postAction('/api/monopoly/roll')} loading={acting}>
            🎲 Roll
          </BoardPrimaryButton>
        </div>
      )}

      {showBuy && pendingSpace && (
        <div className="mt-1.5 w-full max-w-[11rem] sm:max-w-[12rem] space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-200/80">For sale</p>
          <p className="text-xs sm:text-sm font-bold text-white leading-tight truncate">{pendingSpace.name}</p>
          <p className="text-lg sm:text-xl font-black text-amber-300 tabular-nums">
            {formatMonopolyMoney(pendingSpace.price ?? 0)}
          </p>
          {pendingSpace.rent != null && (
            <p className="text-[10px] text-emerald-200/70">Rent {formatMonopolyMoney(pendingSpace.rent)}</p>
          )}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <BoardPrimaryButton
              onClick={() => postAction('/api/monopoly/buy', { buy: true })}
              loading={acting}
              disabled={(myState?.cash ?? 0) < (pendingSpace.price ?? 0)}
            >
              Buy
            </BoardPrimaryButton>
            <BoardSecondaryButton
              onClick={() => postAction('/api/monopoly/buy', { buy: false })}
              disabled={acting}
            >
              Auction
            </BoardSecondaryButton>
          </div>
        </div>
      )}

      {showRent && pendingSpace && (
        <div className="mt-1.5 w-full max-w-[11rem] sm:max-w-[12rem] space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-200/80">Rent due</p>
          <p className="text-xs sm:text-sm font-bold text-white leading-tight truncate">{pendingSpace.name}</p>
          <p className="text-[10px] text-emerald-200/70 truncate">
            To {rentOwner?.name ?? 'owner'}
          </p>
          <p className="text-lg sm:text-xl font-black text-red-300 tabular-nums">
            {formatMonopolyMoney(rentAmount)}
          </p>
          <BoardPrimaryButton
            onClick={() => postAction('/api/monopoly/rent')}
            loading={acting}
            disabled={(myState?.cash ?? 0) < rentAmount}
          >
            Pay rent
          </BoardPrimaryButton>
        </div>
      )}

      {showJail && (
        <div className="mt-1.5 w-full max-w-[11rem] sm:max-w-[12rem] space-y-1.5">
          <p className="text-lg leading-none">🔒</p>
          <p className="text-xs font-bold text-white">In jail</p>
          <div className="space-y-1">
            <BoardPrimaryButton onClick={() => postAction('/api/monopoly/roll')} loading={acting}>
              Roll doubles
            </BoardPrimaryButton>
            <BoardSecondaryButton
              onClick={() => postAction('/api/monopoly/jail', { method: 'pay' })}
              disabled={acting || (myState?.cash ?? 0) < MONOPOLY_JAIL_FINE}
            >
              Pay {formatMonopolyMoney(MONOPOLY_JAIL_FINE)}
            </BoardSecondaryButton>
            {(myState?.get_out_of_jail_free ?? 0) > 0 && (
              <BoardSecondaryButton
                onClick={() => postAction('/api/monopoly/jail', { method: 'card' })}
                disabled={acting}
              >
                Use jail card
              </BoardSecondaryButton>
            )}
          </div>
        </div>
      )}

      {showAuction && auction && auctionSpace && (
        <div className="mt-1.5 w-full max-w-[11rem] sm:max-w-[12rem] space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-200/80">Auction</p>
          <p className="text-xs sm:text-sm font-bold text-white leading-tight truncate">{auctionSpace.name}</p>
          <p className="text-[10px] text-emerald-200/70">
            High:{' '}
            {auction.high_bid > 0 ? formatMonopolyMoney(auction.high_bid) : 'None'}
          </p>
          <input
            type="number"
            min={auction.high_bid + 1}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={`Min ${auction.high_bid + 1}`}
            className="input-field w-full py-1 text-xs text-center"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <BoardPrimaryButton
              onClick={() =>
                postAction('/api/monopoly/auction', { action: 'bid', amount: Number(bidAmount) || undefined })
              }
              loading={acting}
              disabled={!bidAmount || Number(bidAmount) <= auction.high_bid}
            >
              Bid
            </BoardPrimaryButton>
            <BoardSecondaryButton
              onClick={() => postAction('/api/monopoly/auction', { action: 'pass' })}
              disabled={acting}
            >
              Pass
            </BoardSecondaryButton>
          </div>
        </div>
      )}

      {board.phase === 'auction' && auction && !isMyAuctionTurn && (
        <div className="mt-1.5 space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-200/70">Auction</p>
          <p className="text-[11px] text-emerald-100/90 leading-snug">
            {auctionSpace?.name}
            <br />
            {players.find((p) => p.id === auction.current_bidder_id)?.name ?? 'Someone'}&apos;s bid
          </p>
        </div>
      )}
    </div>
  )
}
