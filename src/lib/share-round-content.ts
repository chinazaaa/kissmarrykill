import type { Game, Participant, Player, Round, Vote } from '@/types'
import {
  parseGameType,
  gameTypeConfig,
  isPairGame,
  isBinaryChoiceGame,
  isMostLikelyTo,
  isWhoSaidThis,
  isCustomGame,
  isHotSeat,
} from '@/lib/game-types'
import { getCustomSlots, tallyCustomVotes } from '@/lib/custom-game'
import { getCategoryMeta, getVoteCategories, flagForParticipant, tallyWyrVotes, tallyMltVotes } from '@/lib/vote-stats'
import { isMltImportGame, mltVoteTargets } from '@/lib/mlt'
import {
  tallyWstVotes,
  wstVoteTargets,
  wstCorrectParticipantIdFromRound,
  wstCorrectNameFromRound,
  isAnimeRound,
  tallyAnimeWstVotes,
} from '@/lib/who-said-this'

export interface ShareRoundCardRow {
  emoji: string
  label: string
  value: string
}

export interface ShareRoundCardContent {
  gameTitle: string
  headerEmoji: string
  gameLabel: string
  roundLabel: string
  subtitle?: string
  rows: ShareRoundCardRow[]
}

export function buildRoundShareCardContent({
  game,
  round,
  votes,
  participants,
  players,
}: {
  game: Game
  round: Round
  votes: Vote[]
  participants: Participant[]
  players: Player[]
}): ShareRoundCardContent {
  const gameType = parseGameType(game.game_type)
  const config = gameTypeConfig(gameType)
  const content: ShareRoundCardContent = {
    gameTitle: game.title,
    headerEmoji: config.headerEmoji,
    gameLabel: config.label,
    roundLabel: `Round ${round.round_number} of ${game.rounds_count}`,
    rows: [],
  }

  if (isBinaryChoiceGame(gameType)) {
    const { countA, countB } = tallyWyrVotes(votes)
    const optA = round.wyr_option_a ?? 'Option A'
    const optB = round.wyr_option_b ?? 'Option B'
    const total = countA + countB
    const winner = countA >= countB ? optA : optB
    const winPct = total > 0 ? Math.round((Math.max(countA, countB) / total) * 100) : 0

    content.subtitle = `${optA} vs ${optB}`
    content.rows.push({ emoji: '🏆', label: 'Winner', value: `${winner} (${winPct}%)` })
    content.rows.push({ emoji: 'A', label: optA, value: `${countA} votes` })
    content.rows.push({ emoji: 'B', label: optB, value: `${countB} votes` })
  } else if (isMostLikelyTo(gameType)) {
    const isMltImport = isMltImportGame(game)
    const mltKind = isMltImport ? 'participant' : 'player'
    const mltTargets = mltVoteTargets(game, participants, players)
    const { winnerNames } = tallyMltVotes(votes, mltTargets, mltKind)
    const q = round.mlt_question ?? '?'
    const winner = winnerNames.length > 0 ? winnerNames.join(', ') : 'Tie'

    content.subtitle = q
    content.rows.push({ emoji: '👑', label: 'Most voted', value: winner })
  } else if (isWhoSaidThis(gameType)) {
    content.subtitle = round.quote_text ?? '(no quote)'

    if (isAnimeRound(round)) {
      const meta = round.anime_metadata as { anime_name: string; correct_character: string; choices: string[] }
      const { correctCount } = tallyAnimeWstVotes(votes, meta.choices, meta.correct_character)
      const voterCount = votes.filter((v) => v.anime_choice).length
      content.rows.push({
        emoji: '✓',
        label: 'Answer',
        value: `${meta.correct_character} · ${meta.anime_name}`,
      })
      content.rows.push({
        emoji: '🎯',
        label: 'Guessed right',
        value: `${correctCount} of ${voterCount}`,
      })
    } else {
      const targets = wstVoteTargets(participants)
      const correctId = wstCorrectParticipantIdFromRound(round, players)
      const correctName = wstCorrectNameFromRound(round, players, participants)
      const { correctCount } = tallyWstVotes(votes, targets, correctId)
      const voterCount = votes.filter((v) => v.target_participant_id).length
      content.rows.push({
        emoji: '✓',
        label: 'Answer',
        value: correctName ?? 'Unknown',
      })
      content.rows.push({
        emoji: '🎯',
        label: 'Guessed right',
        value: `${correctCount} of ${voterCount}`,
      })
    }
  } else if (isCustomGame(gameType)) {
    const slots = getCustomSlots(game)
    const slotKeys = slots.map((s) => s.key)
    const roundParts = participants.filter((p) => round.participant_ids.includes(p.id))
    const nameMap = new Map(roundParts.map((p) => [p.id, p.name]))
    const tally = tallyCustomVotes(votes, round.participant_ids, nameMap, slotKeys)

    content.gameLabel = game.custom_slots?.title ?? 'Custom Game'
    for (const slot of slots) {
      const winner = tally.slotWinners[slot.key]
      if (winner) {
        content.rows.push({
          emoji: slot.emoji,
          label: `Most ${slot.label}`,
          value: `${winner.name} · ${winner.count} votes`,
        })
      }
    }
  } else if (isHotSeat(gameType)) {
    const submissionCount = votes.length
    content.subtitle = 'Hot Seat reveal'
    content.rows.push({
      emoji: '🪑',
      label: 'Answers received',
      value: `${submissionCount} ${submissionCount === 1 ? 'submission' : 'submissions'}`,
    })
  } else {
    const pairGame = isPairGame(gameType)
    const categories = getVoteCategories(gameType)
    const roundParts = participants.filter((p) => round.participant_ids.includes(p.id))

    for (const category of categories) {
      const meta = getCategoryMeta(gameType, category)

      type TallyRow = { id: string; name: string; count: number }
      const tally: TallyRow[] = roundParts.map((p) => {
        let count: number
        if (category === 'kiss') {
          count = pairGame
            ? votes.filter((v) => flagForParticipant(v, p.id) === 'kiss').length
            : votes.filter((v) => v.kiss_participant_id === p.id).length
        } else if (category === 'marry') {
          count = votes.filter((v) => v.marry_participant_id === p.id).length
        } else {
          count = pairGame
            ? votes.filter((v) => flagForParticipant(v, p.id) === 'kill').length
            : votes.filter((v) => v.kill_participant_id === p.id).length
        }
        return { id: p.id, name: p.name, count }
      })

      tally.sort((a, b) => b.count - a.count)
      const top = tally[0]
      if (top && top.count > 0) {
        content.rows.push({
          emoji: meta.emoji,
          label: meta.leaderboardLabel,
          value: `${top.name} · ${top.count} votes`,
        })
      }
    }
  }

  return content
}
