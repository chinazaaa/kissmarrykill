import { formatMonopolyMoney } from '@/lib/monopoly-board'
import type { MonopolyLastCashEvent } from '@/types'

export function formatCashMessageForPlayer(event: MonopolyLastCashEvent): string {
  const amount = formatMonopolyMoney(Math.abs(event.change))
  const balance = formatMonopolyMoney(event.balance_after)

  if (event.bankrupt) {
    return `${event.label} — you are out of the game.`
  }
  if (event.change < 0) {
    return `${event.label} — you paid ${amount}. Balance now ${balance}.`
  }
  if (event.change > 0) {
    return `${event.label} — you received ${amount}. Balance now ${balance}.`
  }
  return `${event.label} Balance now ${balance}.`
}

export function formatCashMessageForOthers(
  event: MonopolyLastCashEvent,
  playerName: string
): string {
  const amount = formatMonopolyMoney(Math.abs(event.change))
  if (event.bankrupt) {
    return `${playerName} went bankrupt — ${event.label}.`
  }
  if (event.change < 0) {
    return `${playerName} paid ${amount} — ${event.label}.`
  }
  if (event.change > 0) {
    return `${playerName} received ${amount} — ${event.label}.`
  }
  return `${playerName}: ${event.label}`
}
