import { formatMonopolyMoney, spaceAt } from '@/lib/monopoly'
import type { MonopolyLastTradeEvent } from '@/types'

export type TradeSideItem =
  | { kind: 'cash'; amount: number }
  | { kind: 'property'; name: string; index: number }
  | { kind: 'jail_cards'; count: number }

export function buildTradeSideItems(
  cash: number,
  propertyIndexes: number[],
  jailCards = 0
): TradeSideItem[] {
  const items: TradeSideItem[] = []
  if (cash > 0) items.push({ kind: 'cash', amount: cash })
  for (const index of propertyIndexes) {
    items.push({ kind: 'property', name: spaceAt(index).name, index })
  }
  if (jailCards > 0) items.push({ kind: 'jail_cards', count: jailCards })
  return items
}

export function tradeSideHasValue(cash: number, propertyIndexes: number[], jailCards = 0): boolean {
  return cash > 0 || propertyIndexes.length > 0 || jailCards > 0
}

/** Human-readable trade side — omits £0 when there is no cash. */
export function formatTradeSideText(cash: number, propertyIndexes: number[], jailCards = 0): string {
  const items = buildTradeSideItems(cash, propertyIndexes, jailCards)
  if (items.length === 0) return 'Nothing'

  return items
    .map((item) => {
      if (item.kind === 'cash') return formatMonopolyMoney(item.amount)
      if (item.kind === 'property') return item.name
      return `${item.count} jail card${item.count === 1 ? '' : 's'}`
    })
    .join(' · ')
}

export function formatTradeMessageForPlayer(
  event: MonopolyLastTradeEvent,
  myPlayerId: string | null | undefined,
  players: { id: string; name: string }[]
): string {
  const from = players.find((p) => p.id === event.from_player_id)?.name ?? 'A player'
  const to = players.find((p) => p.id === event.to_player_id)?.name ?? 'A player'

  if (event.outcome === 'declined') {
    if (myPlayerId === event.from_player_id) {
      return `${to} declined your trade offer.`
    }
    if (myPlayerId === event.to_player_id) {
      return `You declined ${from}'s trade offer.`
    }
    return `${to} declined ${from}'s trade offer.`
  }

  if (event.outcome === 'accepted') {
    if (myPlayerId === event.from_player_id) {
      return `${to} accepted your trade offer.`
    }
    if (myPlayerId === event.to_player_id) {
      return `You accepted ${from}'s trade offer.`
    }
    return `${from} and ${to} completed a trade.`
  }

  if (event.outcome === 'proposed') {
    if (myPlayerId === event.from_player_id) {
      return `Trade offer sent to ${to} — waiting for a response.`
    }
    if (myPlayerId === event.to_player_id) {
      return `${from} sent you a trade offer.`
    }
    return `${from} sent a trade offer to ${to}.`
  }

  return `${from} sent a trade offer to ${to}.`
}
