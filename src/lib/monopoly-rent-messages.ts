import { formatMonopolyMoney } from '@/lib/monopoly-board'
import type { MonopolyLastRentEvent } from '@/types'

export function formatRentMessageForPlayer(
  event: MonopolyLastRentEvent,
  myPlayerId: string | null | undefined,
  players: { id: string; name: string }[]
): string {
  const payer = players.find((p) => p.id === event.payer_player_id)?.name ?? 'A player'
  const owner = players.find((p) => p.id === event.owner_player_id)?.name ?? 'A player'
  const money = formatMonopolyMoney(event.amount)

  if (myPlayerId === event.owner_player_id) {
    return `${payer} paid you ${money} rent on ${event.space_name}.`
  }
  if (myPlayerId === event.payer_player_id) {
    return `You paid ${money} rent on ${event.space_name} to ${owner}.`
  }
  return `${payer} paid ${money} rent to ${owner} on ${event.space_name}.`
}
