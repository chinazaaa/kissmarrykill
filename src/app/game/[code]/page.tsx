'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPlayerSession, setPlayerSession, getInitial } from '@/lib/utils'
import type { Game, Participant, Player, Round, Vote, VoteAssignment, Confession } from '@/types'

type View = 'loading' | 'not_found' | 'join' | 'waiting' | 'round' | 'results'

export default function GamePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const gameCode = (Array.isArray(code) ? code[0] : code).toUpperCase()

  const [view, setView] = useState<View>('loading')
  const [game, setGame] = useState<Game | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [allRounds, setAllRounds] = useState<Round[]>([])
  const [allVotes, setAllVotes] = useState<Vote[]>([])
  const [confessions, setConfessions] = useState<Confession[]>([])
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null)

  const [nameInput, setNameInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [assignment, setAssignment] = useState<VoteAssignment>({ kiss: null, marry: null, kill: null })
  const [submitted, setSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [confessionText, setConfessionText] = useState('')
  const [confessionSent, setConfessionSent] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)
  const assignmentRef = useRef(assignment)
  assignmentRef.current = assignment

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: gameData } = await supabase.from('games').select('*').eq('id', gameCode).maybeSingle()
      if (!gameData) { setView('not_found'); return }
      setGame(gameData)

      const [{ data: parts }, { data: plrs }] = await Promise.all([
        supabase.from('participants').select('*').eq('game_id', gameCode).order('display_order'),
        supabase.from('players').select('*').eq('game_id', gameCode).order('joined_at'),
      ])
      setParticipants(parts || [])
      setPlayers(plrs || [])

      const session = getPlayerSession(gameCode)
      if (session) {
        setMyPlayerId(session.playerId)
        setMyPlayerName(session.playerName)
      }

      if (gameData.status === 'active') {
        const { data: roundData } = await supabase
          .from('rounds').select('*').eq('game_id', gameCode).eq('status', 'active').maybeSingle()
        if (roundData) {
          setCurrentRound(roundData)
          if (session) {
            const { data: voteData } = await supabase
              .from('votes').select('*')
              .eq('player_id', session.playerId).eq('round_id', roundData.id).maybeSingle()
            if (voteData) {
              setAssignment({ kiss: voteData.kiss_participant_id, marry: voteData.marry_participant_id, kill: voteData.kill_participant_id })
              submittedRef.current = true
              setSubmitted(true)
            }
          }
        }
        setView(session ? 'round' : 'join')
        return
      }

      if (gameData.status === 'finished') {
        await loadResults()
        setView('results')
        return
      }

      setView(session ? 'waiting' : 'join')
    }
    load()
  }, [gameCode])

  async function loadResults() {
    const [{ data: rounds }, { data: votes }, { data: confs }] = await Promise.all([
      supabase.from('rounds').select('*').eq('game_id', gameCode).order('round_number'),
      supabase.from('votes').select('*').eq('game_id', gameCode),
      supabase.from('confessions').select('*').eq('game_id', gameCode).order('created_at'),
    ])
    setAllRounds(rounds || [])
    setAllVotes(votes || [])
    setConfessions(confs || [])
  }

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel(`game-${gameCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameCode}` },
        async (payload) => {
          const newGame = payload.new as Game
          setGame(newGame)
          if (newGame.status === 'active') {
            const { data: roundData } = await supabase
              .from('rounds').select('*').eq('game_id', gameCode).eq('status', 'active').maybeSingle()
            if (roundData) {
              setCurrentRound(roundData)
              submittedRef.current = false
              setSubmitted(false)
              setAssignment({ kiss: null, marry: null, kill: null })
              setConfessionSent(false)
            }
            setView('round')
          }
          if (newGame.status === 'finished') {
            await loadResults()
            setView('results')
          }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameCode}` },
        (payload) => setPlayers((prev) => [...prev, payload.new as Player])
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameCode}` },
        (payload) => {
          const round = payload.new as Round
          if (round.status === 'active') {
            setCurrentRound(round)
            submittedRef.current = false
            setSubmitted(false)
            setAssignment({ kiss: null, marry: null, kill: null })
            setConfessionSent(false)
            setConfessionText('')
            setView('round')
          }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `game_id=eq.${gameCode}` },
        (payload) => setAllVotes((prev) => [...prev, payload.new as Vote])
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [gameCode])

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (view !== 'round' || !currentRound?.started_at || !game || submitted) return

    const endMs = new Date(currentRound.started_at).getTime() + game.timer_seconds * 1000

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endMs - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0 && !submittedRef.current) {
        handleAutoSubmit()
      }
    }

    tick()
    timerRef.current = setInterval(tick, 500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [view, currentRound?.id, currentRound?.started_at, game?.timer_seconds, submitted])

  const handleAutoSubmit = useCallback(async () => {
    if (submittedRef.current || !myPlayerId || !currentRound) return
    submittedRef.current = true
    setSubmitted(true)

    let a = { ...assignmentRef.current }

    if (game?.auto_submit_behavior === 'random') {
      const roundParts = participants.filter((p) => currentRound.participant_ids.includes(p.id))
      const actions: (keyof VoteAssignment)[] = ['kiss', 'marry', 'kill']
      const unassignedActions = actions.filter((k) => !a[k])
      const unassignedParts = roundParts.filter((p) => !Object.values(a).includes(p.id))
      unassignedActions.forEach((act, i) => {
        if (unassignedParts[i]) a[act] = unassignedParts[i].id
      })
    }

    await doSubmitVote(a)
  }, [myPlayerId, currentRound, participants, game?.auto_submit_behavior])

  const doSubmitVote = async (a: VoteAssignment) => {
    if (!myPlayerId || !currentRound) return
    await fetch('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: myPlayerId, roundId: currentRound.id, gameId: gameCode, kiss: a.kiss, marry: a.marry, kill: a.kill }),
    })
  }

  const handleSubmit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    await doSubmitVote(assignment)
  }

  const assign = (action: keyof VoteAssignment, participantId: string) => {
    setAssignment((prev) => {
      const next = { ...prev }
      // Clear this participant from any existing assignment
      ;(Object.keys(next) as (keyof VoteAssignment)[]).forEach((k) => {
        if (next[k] === participantId) next[k] = null
      })
      next[action] = participantId
      return next
    })
  }

  const joinGame = async () => {
    if (joining || !nameInput.trim()) return
    setJoining(true)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCode, playerName: nameInput.trim() }),
      })
      const data = await res.json()
      if (data.playerId) {
        setPlayerSession(gameCode, data.playerId, data.playerName)
        setMyPlayerId(data.playerId)
        setMyPlayerName(data.playerName)
        setView('waiting')
      } else {
        alert(data.error || 'Failed to join')
      }
    } finally {
      setJoining(false)
    }
  }

  const sendConfession = async () => {
    if (!confessionText.trim() || confessionSent) return
    setConfessionSent(true)
    await fetch('/api/confessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: gameCode, roundId: currentRound?.id, text: confessionText }),
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (view === 'loading') return <FullLoader />
  if (view === 'not_found') return <NotFound onHome={() => router.push('/')} />

  const roundParts = currentRound ? participants.filter((p) => currentRound.participant_ids.includes(p.id)) : []
  const roundVoteCount = allVotes.filter((v) => v.round_id === currentRound?.id).length
  const allAssigned = !!(assignment.kiss && assignment.marry && assignment.kill)

  if (view === 'join') {
    return (
      <CenteredCard>
        <div className="text-center space-y-1">
          <div className="text-4xl">❤️💍💀</div>
          <h1 className="text-2xl font-black text-white">{game?.title}</h1>
          <p className="text-zinc-500 text-sm">{game?.rounds_count} rounds · {game?.timer_seconds}s each</p>
        </div>
        <div className="space-y-3">
          <p className="text-zinc-400 font-medium text-center">Enter your name to join</p>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinGame()}
            placeholder="Your name"
            autoFocus
            className={inputCls}
          />
          <button
            onClick={joinGame}
            disabled={!nameInput.trim() || joining}
            className={primaryBtnCls}
          >
            {joining ? 'Joining...' : 'Join Game'}
          </button>
        </div>
      </CenteredCard>
    )
  }

  if (view === 'waiting') {
    return (
      <CenteredCard>
        <div className="text-center space-y-1">
          <div className="text-4xl">⏳</div>
          <h1 className="text-2xl font-black text-white">{game?.title}</h1>
          <p className="text-zinc-500">Waiting for the host to start...</p>
        </div>
        <div className="bg-[#0d0d0d] border border-[#262626] rounded-2xl p-4 space-y-2">
          <p className="text-zinc-500 text-xs uppercase tracking-wider">Players Joined ({players.length})</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${p.name === myPlayerName ? 'bg-purple-400' : 'bg-zinc-600'}`} />
                <span className={`text-sm ${p.name === myPlayerName ? 'text-purple-300 font-semibold' : 'text-zinc-300'}`}>
                  {p.name}{p.name === myPlayerName ? ' (you)' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-zinc-600 text-xs text-center">Keep this tab open — the game will start automatically</p>
      </CenteredCard>
    )
  }

  if (view === 'round' && currentRound) {
    return (
      <div className="min-h-screen flex flex-col px-4 py-6 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-wider">Round</p>
            <p className="text-white font-black text-2xl">{currentRound.round_number} <span className="text-zinc-600 font-normal text-base">/ {game?.rounds_count}</span></p>
          </div>
          <TimerDisplay seconds={timeLeft} total={game?.timer_seconds ?? 30} />
        </div>

        {/* Participant cards */}
        <div className="flex-1 flex flex-col gap-4 mb-6">
          {roundParts.map((p) => {
            const action = assignment.kiss === p.id ? 'kiss' : assignment.marry === p.id ? 'marry' : assignment.kill === p.id ? 'kill' : null
            return (
              <ParticipantCard
                key={p.id}
                participant={p}
                action={action}
                onAssign={(a) => !submitted && assign(a, p.id)}
                disabled={submitted}
              />
            )
          })}
        </div>

        {/* Submit / waiting */}
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!allAssigned}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 ${
              allAssigned
                ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-rose-500 text-white shadow-lg shadow-purple-500/20 hover:opacity-90'
                : 'bg-[#161616] text-zinc-600 border border-[#262626] cursor-not-allowed'
            }`}
          >
            {allAssigned ? 'Submit Vote' : `Assign all 3 (${[assignment.kiss, assignment.marry, assignment.kill].filter(Boolean).length}/3)`}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="w-full py-4 rounded-2xl bg-[#161616] border border-[#262626] text-center">
              <p className="text-green-400 font-semibold">✓ Vote submitted!</p>
              <p className="text-zinc-500 text-sm mt-0.5">Waiting for others ({roundVoteCount}/{players.length} voted)</p>
            </div>
            {!confessionSent ? (
              <div className="space-y-2">
                <p className="text-zinc-500 text-sm text-center">Anonymous confession (optional)</p>
                <div className="flex gap-2">
                  <input
                    value={confessionText}
                    onChange={(e) => setConfessionText(e.target.value)}
                    placeholder="Why did you make those choices?"
                    className="flex-1 bg-[#161616] text-white border border-[#262626] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                  />
                  <button onClick={sendConfession} className="px-4 py-2.5 bg-[#262626] text-zinc-300 rounded-xl text-sm hover:bg-[#2a2a2a] transition-colors">
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-zinc-600 text-sm text-center">Confession sent 👀</p>
            )}
          </div>
        )}
      </div>
    )
  }

  if (view === 'results') {
    return (
      <ResultsView
        game={game!}
        participants={participants}
        rounds={allRounds}
        votes={allVotes}
        confessions={confessions}
        players={players}
      />
    )
  }

  return <FullLoader />
}

// ── Sub-components ────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  kiss:  { emoji: '❤️', label: 'Kiss',  color: 'border-pink-500 bg-pink-500/10',  btn: 'bg-pink-500/20 text-pink-300 border-pink-500/50 hover:bg-pink-500/30'  },
  marry: { emoji: '💍', label: 'Marry', color: 'border-amber-500 bg-amber-500/10', btn: 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30' },
  kill:  { emoji: '💀', label: 'Kill',  color: 'border-red-500 bg-red-500/10',    btn: 'bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30'   },
}

function ParticipantCard({ participant, action, onAssign, disabled }: {
  participant: Participant
  action: 'kiss' | 'marry' | 'kill' | null
  onAssign: (a: 'kiss' | 'marry' | 'kill') => void
  disabled: boolean
}) {
  const cfg = action ? ACTION_CONFIG[action] : null

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${cfg ? cfg.color : 'border-[#262626] bg-[#161616]'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-black text-lg shrink-0">
          {getInitial(participant.name)}
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-tight">{participant.name}</p>
          {action && <p className="text-sm font-medium" style={{ color: action === 'kiss' ? '#f9a8d4' : action === 'marry' ? '#fcd34d' : '#fca5a5' }}>
            {ACTION_CONFIG[action].emoji} {ACTION_CONFIG[action].label}
          </p>}
        </div>
      </div>
      <div className="flex gap-2">
        {(['kiss', 'marry', 'kill'] as const).map((a) => (
          <button
            key={a}
            onClick={() => onAssign(a)}
            disabled={disabled}
            className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
              action === a
                ? `${ACTION_CONFIG[a].btn} border-current`
                : `bg-[#0d0d0d] border-[#2a2a2a] text-zinc-500 ${!disabled ? 'hover:border-zinc-500' : ''}`
            } disabled:cursor-not-allowed`}
          >
            {ACTION_CONFIG[a].emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

function TimerDisplay({ seconds, total }: { seconds: number; total: number }) {
  const pct = total > 0 ? (seconds / total) * 100 : 0
  const color = seconds <= 5 ? 'text-red-400' : seconds <= 10 ? 'text-amber-400' : 'text-green-400'
  return (
    <div className="text-right">
      <p className={`text-4xl font-black tabular-nums ${color} ${seconds <= 5 ? 'animate-pulse' : ''}`}>{seconds}</p>
      <div className="w-20 h-1.5 bg-[#262626] rounded-full mt-1 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${seconds <= 5 ? 'bg-red-500' : seconds <= 10 ? 'bg-amber-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ResultsView({ game, participants, rounds, votes, confessions, players }: {
  game: Game
  participants: Participant[]
  rounds: Round[]
  votes: Vote[]
  confessions: Confession[]
  players: Player[]
}) {
  const tally = participants.map((p) => ({
    ...p,
    kissCount: votes.filter((v) => v.kiss_participant_id === p.id).length,
    marryCount: votes.filter((v) => v.marry_participant_id === p.id).length,
    killCount: votes.filter((v) => v.kill_participant_id === p.id).length,
  }))

  const mostMarried = [...tally].sort((a, b) => b.marryCount - a.marryCount)[0]
  const mostKissed  = [...tally].sort((a, b) => b.kissCount  - a.kissCount)[0]
  const mostKilled  = [...tally].sort((a, b) => b.killCount  - a.killCount)[0]

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto w-full space-y-8">
      <div className="text-center">
        <div className="text-4xl mb-2">🎊</div>
        <h1 className="text-3xl font-black text-white">{game.title}</h1>
        <p className="text-zinc-500">{players.length} players · {rounds.length} rounds</p>
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="text-zinc-400 text-xs uppercase tracking-wider mb-3">Leaderboard</h2>
        <div className="grid grid-cols-3 gap-3">
          <LeaderCard emoji="💍" label="Most Married" name={mostMarried?.name} count={mostMarried?.marryCount} color="amber" />
          <LeaderCard emoji="❤️" label="Most Kissed"  name={mostKissed?.name}  count={mostKissed?.kissCount}  color="pink" />
          <LeaderCard emoji="💀" label="Most Killed"  name={mostKilled?.name}  count={mostKilled?.killCount}  color="red" />
        </div>
      </div>

      {/* Per-participant breakdown */}
      <div>
        <h2 className="text-zinc-400 text-xs uppercase tracking-wider mb-3">Full Results</h2>
        <div className="space-y-3">
          {tally.map((p) => (
            <div key={p.id} className="bg-[#161616] border border-[#262626] rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-black shrink-0">
                  {getInitial(p.name)}
                </div>
                <p className="text-white font-bold text-lg">{p.name}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <VoteStat emoji="❤️" label="Kiss"  count={p.kissCount}  total={votes.length / 3} color="#f472b6" />
                <VoteStat emoji="💍" label="Marry" count={p.marryCount} total={votes.length / 3} color="#fbbf24" />
                <VoteStat emoji="💀" label="Kill"  count={p.killCount}  total={votes.length / 3} color="#f87171" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hot takes */}
      {confessions.length > 0 && (
        <div>
          <h2 className="text-zinc-400 text-xs uppercase tracking-wider mb-3">🔥 Hot Takes</h2>
          <div className="space-y-2">
            {confessions.map((c) => (
              <div key={c.id} className="bg-[#161616] border border-[#262626] rounded-xl px-4 py-3">
                <p className="text-zinc-300 text-sm italic">&ldquo;{c.text}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LeaderCard({ emoji, label, name, count, color }: { emoji: string; label: string; name?: string; count?: number; color: string }) {
  const colorMap: Record<string, string> = {
    amber: 'border-amber-500/30 bg-amber-500/5',
    pink:  'border-pink-500/30 bg-pink-500/5',
    red:   'border-red-500/30 bg-red-500/5',
  }
  return (
    <div className={`border rounded-2xl p-3 text-center ${colorMap[color]}`}>
      <p className="text-2xl">{emoji}</p>
      <p className="text-zinc-400 text-xs mt-1">{label}</p>
      <p className="text-white font-bold text-sm mt-1 truncate">{name ?? '—'}</p>
      {count !== undefined && <p className="text-zinc-500 text-xs">{count} votes</p>}
    </div>
  )
}

function VoteStat({ emoji, label, count, total, color }: { emoji: string; label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="text-center">
      <p className="text-sm">{emoji} <span className="text-white font-bold">{count}</span></p>
      <p className="text-zinc-600 text-xs">{label}</p>
      <div className="h-1 bg-[#2a2a2a] rounded-full mt-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">{children}</div>
    </div>
  )
}

function FullLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function NotFound({ onHome }: { onHome: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-6xl">🤷</p>
        <h1 className="text-2xl font-black text-white">Game not found</h1>
        <p className="text-zinc-500">Check the code and try again</p>
        <button onClick={onHome} className={primaryBtnCls + ' max-w-xs mx-auto'}>Back Home</button>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-[#161616] text-white border border-[#262626] rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors placeholder:text-zinc-700'
const primaryBtnCls = 'w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-rose-500 text-white font-bold text-lg rounded-2xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20'
