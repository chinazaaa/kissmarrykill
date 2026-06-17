'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MonopolyModal,
  MonopolyPrimaryButton,
  MonopolySecondaryButton,
} from '@/components/monopoly/MonopolyChrome'
import { formatCardAlertForPlayer } from '@/lib/monopoly-card-messages'
import {
  useMonopolyFixedTimer,
} from '@/hooks/useMonopolyModalTimer'
import { MONOPOLY_CARD_MODAL_SECONDS } from '@/lib/supabase-selects'
import {
  canAddHotel,
  canAddHouse,
  canRemoveHotel,
  canRemoveHouse,
} from '@/lib/monopoly-build'
import {
  buildingLevel,
  computeRent,
  parseBuildings,
  parseMortgaged,
} from '@/lib/monopoly-rent'
import {
  MonopolyColorBar,
  MonopolyColorPortfolio,
  MonopolyColorSetDots,
  colorBarClass,
} from '@/components/monopoly/MonopolyColorPortfolio'
import {
  buildColorGroupStatuses,
  ownedColorGroups,
  propertiesInGroupForPlayer,
  COLOR_GROUP_LABELS,
} from '@/lib/monopoly-color-portfolio'
import {
  currentPlayerId,
  formatMonopolyMoney,
  mortgageValue,
  parsePropertyOwners,
  playerProperties,
  spaceAt,
  unmortgageCost,
  type MonopolyColorGroup,
} from '@/lib/monopoly'
import type { MonopolyBoard, MonopolyPlayerState, Player } from '@/types'

type PostAction = (url: string, body?: Record<string, unknown>) => Promise<void>

export function MonopolyCardAlertModal({
  board,
  myPlayerId,
  players,
}: {
  board: MonopolyBoard | null
  myPlayerId: string | null
  players: Player[]
}) {
  const event = board?.last_card_event ?? null
  const [dismissedSeq, setDismissedSeq] = useState<number | null>(null)
  const readyRef = useRef(false)
  const prevSeqRef = useRef<number | null>(null)

  useEffect(() => {
    if (!board) return
    const seq = board.last_card_event?.seq ?? null

    if (!readyRef.current) {
      readyRef.current = true
      prevSeqRef.current = seq
      if (seq != null) setDismissedSeq(seq)
      return
    }

    if (seq != null && seq !== prevSeqRef.current) {
      prevSeqRef.current = seq
      setDismissedSeq(null)
    }
  }, [board, board?.last_card_event?.seq])

  const isOpen = !!(event && dismissedSeq !== event.seq)
  const dismiss = useCallback(() => {
    if (event?.seq != null) setDismissedSeq(event.seq)
  }, [event?.seq])

  const cardSecondsLeft = useMonopolyFixedTimer(MONOPOLY_CARD_MODAL_SECONDS, isOpen, dismiss)

  if (!isOpen || !event) return null

  const alert = formatCardAlertForPlayer(event, myPlayerId, players)

  return (
    <MonopolyModal
      open
      subtitle={alert.subtitle}
      title={alert.title}
      timerSecondsLeft={cardSecondsLeft}
    >
      <p className="text-4xl text-center">{alert.emoji}</p>
      <p className="text-sm text-muted text-center leading-relaxed">{alert.body}</p>
      <MonopolyPrimaryButton onClick={dismiss}>Got it</MonopolyPrimaryButton>
    </MonopolyModal>
  )
}

export function MonopolyTurnModals({
  board,
  myPlayerId,
  players,
  acting,
  postAction,
}: {
  board: MonopolyBoard | null
  myPlayerId: string | null
  myState?: MonopolyPlayerState | undefined
  players: Player[]
  acting: boolean
  postAction: PostAction
  colorBarClass?: (color?: MonopolyColorGroup) => string
}) {
  const trade = board?.pending_trade
  const tradeFrom = trade ? players.find((p) => p.id === trade.from_player_id) : null
  const showTradeModal = !!(trade && trade.to_player_id === myPlayerId)

  return (
    <>
      {showTradeModal && trade && (
        <MonopolyModal open subtitle="Trade offer" title={`From ${tradeFrom?.name ?? 'player'}`}>
          <div className="text-sm text-muted space-y-2">
            <p>
              <span className="font-semibold text-[var(--foreground)]">They offer:</span>{' '}
              {formatMonopolyMoney(trade.offer_cash)}
              {trade.offer_properties.length > 0 &&
                ` · ${trade.offer_properties.map((i) => spaceAt(i).name).join(', ')}`}
              {trade.offer_get_out_cards > 0 && ` · ${trade.offer_get_out_cards} jail card(s)`}
            </p>
            <p>
              <span className="font-semibold text-[var(--foreground)]">They want:</span>{' '}
              {formatMonopolyMoney(trade.request_cash)}
              {trade.request_properties.length > 0 &&
                ` · ${trade.request_properties.map((i) => spaceAt(i).name).join(', ')}`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <MonopolyPrimaryButton onClick={() => postAction('/api/monopoly/trade', { accept: true })} loading={acting}>
              Accept
            </MonopolyPrimaryButton>
            <MonopolySecondaryButton
              onClick={() => postAction('/api/monopoly/trade', { accept: false })}
              disabled={acting}
            >
              Decline
            </MonopolySecondaryButton>
          </div>
        </MonopolyModal>
      )}
    </>
  )
}

export function MonopolyManagePanel({
  board,
  myPlayerId,
  myState,
  players,
  acting,
  postAction,
}: {
  board: MonopolyBoard | null
  myPlayerId: string | null
  myState: MonopolyPlayerState | undefined
  players: Player[]
  acting: boolean
  postAction: PostAction
}) {
  const [tradeTarget, setTradeTarget] = useState('')
  const [offerCash, setOfferCash] = useState('0')
  const [requestCash, setRequestCash] = useState('0')
  const [offerProps, setOfferProps] = useState<number[]>([])
  const [requestProps, setRequestProps] = useState<number[]>([])

  if (!board || !myPlayerId || !myState || myState.bankrupt) {
    return (
      <div className="glass-card p-5 text-center space-y-2">
        <p className="text-sm text-muted">You&apos;re out of this game.</p>
      </div>
    )
  }

  const owners = parsePropertyOwners(board.property_owners)
  const buildings = parseBuildings(board.property_buildings)
  const mortgaged = parseMortgaged(board.mortgaged_properties)
  const mine = playerProperties(owners, myPlayerId)
  const theirs = tradeTarget ? playerProperties(owners, tradeTarget) : []
  const housesInBank = board.houses_in_bank ?? 32
  const hotelsInBank = board.hotels_in_bank ?? 12

  const toggleProp = (list: number[], setList: (v: number[]) => void, idx: number) => {
    setList(list.includes(idx) ? list.filter((i) => i !== idx) : [...list, idx])
  }

  if (mine.length === 0) {
    return (
      <div className="glass-card p-5 space-y-4">
        <MonopolyColorPortfolio propertyOwners={owners} myPlayerId={myPlayerId} players={players} />
        <div className="space-y-2 pt-2 border-t border-[var(--border-strong)]">
          <p className="label-caps">Build &amp; trade</p>
          <p className="text-sm text-muted leading-relaxed">
            Land on unowned properties and tap <strong className="text-body">Buy</strong> when prompted.
            Once you own every street in a colour group, come back here to add{' '}
            <strong className="text-body">houses</strong> and <strong className="text-body">hotels</strong>.
          </p>
        </div>
      </div>
    )
  }

  const playerNames = new Map(players.map((p) => [p.id, p.name]))
  const groupStatuses = buildColorGroupStatuses(owners, myPlayerId, playerNames)
  const statusByGroup = new Map(groupStatuses.map((s) => [s.group, s]))
  const myGroups = ownedColorGroups(owners, myPlayerId)

  const renderPropertyCard = (space: (typeof mine)[number]) => {
    const level = buildingLevel(buildings, space.index)
    const isMortgaged = mortgaged[String(space.index)]
    const levelLabel = level === 5 ? '🏨 Hotel' : level > 0 ? `${level} 🏠` : 'Unimproved'
    const currentRent = isMortgaged
      ? null
      : computeRent(space, owners, myPlayerId, board.last_dice?.total ?? 2, buildings, mortgaged)
    const canHouse = canAddHouse(space.index, myPlayerId, owners, buildings, mortgaged, housesInBank)
    const canHotel = canAddHotel(space.index, myPlayerId, owners, buildings, mortgaged, hotelsInBank)

    return (
      <div
        key={space.index}
        className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)] overflow-hidden"
      >
        {space.color && <MonopolyColorBar color={space.color} />}
        <div className="p-3 space-y-2">
          <div className="flex justify-between gap-2">
            <span className="font-semibold text-sm text-[var(--foreground)]">{space.name}</span>
            <span className="text-xs text-muted shrink-0">{isMortgaged ? 'Mortgaged' : levelLabel}</span>
          </div>
          <p className="text-[11px] text-faint leading-relaxed">
            {isMortgaged ? (
              <>No rent while mortgaged · unmortgage for {formatMonopolyMoney(unmortgageCost(space))}</>
            ) : currentRent != null ? (
              <>Current rent {formatMonopolyMoney(currentRent)}</>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {canHouse && (
              <button
                type="button"
                disabled={acting}
                onClick={() => postAction('/api/monopoly/build', { spaceIndex: space.index, action: 'buy_house' })}
                className="btn-primary btn-fit px-3 py-1.5 text-xs"
              >
                + House {formatMonopolyMoney(space.houseCost ?? 0)}
              </button>
            )}
            {canHotel && (
              <button
                type="button"
                disabled={acting}
                onClick={() => postAction('/api/monopoly/build', { spaceIndex: space.index, action: 'buy_hotel' })}
                className="btn-primary btn-fit px-3 py-1.5 text-xs"
              >
                + Hotel
              </button>
            )}
            {canRemoveHouse(space.index, myPlayerId, owners, buildings) && (
              <button
                type="button"
                disabled={acting}
                onClick={() => postAction('/api/monopoly/build', { spaceIndex: space.index, action: 'sell_house' })}
                className="btn-secondary btn-fit px-2.5 py-1 text-[10px]"
              >
                Sell house
              </button>
            )}
            {canRemoveHotel(space.index, myPlayerId, owners, buildings) && (
              <button
                type="button"
                disabled={acting}
                onClick={() => postAction('/api/monopoly/build', { spaceIndex: space.index, action: 'sell_hotel' })}
                className="btn-secondary btn-fit px-2.5 py-1 text-[10px]"
              >
                Sell hotel
              </button>
            )}
            {!isMortgaged && level === 0 && (
              <button
                type="button"
                disabled={acting}
                onClick={() => postAction('/api/monopoly/mortgage', { spaceIndex: space.index, action: 'mortgage' })}
                className="btn-secondary btn-fit px-2.5 py-1 text-[10px]"
                title={`Get ${formatMonopolyMoney(mortgageValue(space))} cash. No rent while mortgaged. Sell all buildings in the colour group first.`}
              >
                Mortgage
              </button>
            )}
            {isMortgaged && (
              <button
                type="button"
                disabled={acting}
                onClick={() => postAction('/api/monopoly/mortgage', { spaceIndex: space.index, action: 'unmortgage' })}
                className="btn-secondary btn-fit px-2.5 py-1 text-[10px]"
              >
                Unmortgage
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-4 space-y-4">
      <MonopolyColorPortfolio propertyOwners={owners} myPlayerId={myPlayerId} players={players} />

      <div className="space-y-3 pt-2 border-t border-[var(--border-strong)]">
        <div className="space-y-1">
          <p className="label-caps">Your properties</p>
          <p className="text-xs text-muted leading-relaxed">
            Grouped by colour. Own a full set (✓) to build houses and hotels.
          </p>
        </div>
        {myGroups.map((group) => {
          const status = statusByGroup.get(group)!
          const groupProps = propertiesInGroupForPlayer(owners, myPlayerId, group)
          return (
            <div key={group} className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={['h-4 w-4 shrink-0 rounded-sm', colorBarClass(group)].join(' ')} />
                  <span className="text-xs font-bold text-[var(--foreground)] truncate">
                    {COLOR_GROUP_LABELS[group]}
                    {status.complete && <span className="text-[var(--primary)] ml-1">✓</span>}
                  </span>
                </div>
                <MonopolyColorSetDots status={status} />
              </div>
              <div className="space-y-2">{groupProps.map(renderPropertyCard)}</div>
            </div>
          )
        })}
      </div>

      {!board.pending_trade && (
        <div className="pt-2 border-t border-[var(--border-strong)] space-y-2">
          <p className="text-xs font-semibold text-muted">Propose a trade</p>
          <select
            value={tradeTarget}
            onChange={(e) => {
              setTradeTarget(e.target.value)
              setRequestProps([])
            }}
            className="input-field w-full text-sm"
          >
            <option value="">Select player</option>
            {players.filter((p) => p.id !== myPlayerId).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              value={offerCash}
              onChange={(e) => setOfferCash(e.target.value)}
              placeholder="Offer £"
              className="input-field text-sm"
            />
            <input
              type="number"
              min={0}
              value={requestCash}
              onChange={(e) => setRequestCash(e.target.value)}
              placeholder="Request £"
              className="input-field text-sm"
            />
          </div>
          {mine.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-faint font-semibold">Offer properties</p>
              {mine.map((s) => (
                <label key={s.index} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={offerProps.includes(s.index)}
                    onChange={() => toggleProp(offerProps, setOfferProps, s.index)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
          {theirs.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-faint font-semibold">Request properties</p>
              {theirs.map((s) => (
                <label key={s.index} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={requestProps.includes(s.index)}
                    onChange={() => toggleProp(requestProps, setRequestProps, s.index)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={acting || !tradeTarget}
            className="btn-secondary w-full py-2.5 text-sm"
            onClick={() =>
              postAction('/api/monopoly/trade', {
                toPlayerId: tradeTarget,
                offerCash: Number(offerCash) || 0,
                requestCash: Number(requestCash) || 0,
                offerProperties: offerProps,
                requestProperties: requestProps,
              })
            }
          >
            Send trade offer
          </button>
        </div>
      )}
    </div>
  )
}
