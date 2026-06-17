import type { MonopolyLastTradeEvent } from '@/types'

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
