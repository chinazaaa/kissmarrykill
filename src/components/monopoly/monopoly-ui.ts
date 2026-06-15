import type { MonopolySpaceType } from '@/lib/monopoly'

export const PLAYER_TOKEN_COLORS = [
  { bg: 'bg-red-500', ring: 'ring-red-400', text: 'text-red-100', hex: '#ef4444' },
  { bg: 'bg-blue-500', ring: 'ring-blue-400', text: 'text-blue-100', hex: '#3b82f6' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-400', text: 'text-emerald-100', hex: '#22c55e' },
  { bg: 'bg-amber-500', ring: 'ring-amber-400', text: 'text-amber-100', hex: '#f59e0b' },
  { bg: 'bg-violet-500', ring: 'ring-violet-400', text: 'text-violet-100', hex: '#8b5cf6' },
  { bg: 'bg-pink-500', ring: 'ring-pink-400', text: 'text-pink-100', hex: '#ec4899' },
] as const

export function tokenColorForOrder(order: number) {
  return PLAYER_TOKEN_COLORS[order % PLAYER_TOKEN_COLORS.length]!
}

export function spaceIcon(type: MonopolySpaceType): string {
  switch (type) {
    case 'go':
      return '→'
    case 'chance':
      return '?'
    case 'community':
      return '🎁'
    case 'tax':
      return '💸'
    case 'jail':
      return '🔒'
    case 'go_to_jail':
      return '👮'
    case 'free_parking':
      return '🅿️'
    case 'railroad':
      return '🚂'
    case 'utility':
      return '💡'
    default:
      return ''
  }
}

export function shortSpaceName(name: string, max = 12): string {
  if (name.length <= max) return name
  const parts = name.split(' ')
  if (parts.length > 1 && parts[0]!.length <= max - 2) return `${parts[0]}…`
  return `${name.slice(0, max - 1)}…`
}

export function gridPositionForSpace(index: number): { row: number; col: number } {
  if (index <= 10) return { row: 10, col: 10 - index }
  if (index <= 19) return { row: 19 - index, col: 0 }
  if (index <= 30) return { row: 0, col: index - 20 }
  return { row: index - 30, col: 10 }
}

export const DICE_PIPS: Record<number, number[][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
}
