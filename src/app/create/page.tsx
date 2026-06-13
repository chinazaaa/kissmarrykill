'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'settings' | 'participants' | 'done'

interface Settings {
  title: string
  rounds_count: number
  timer_seconds: number
  anonymous: boolean
  auto_reveal: boolean
  auto_submit_behavior: 'random' | 'no_answer'
}

export default function CreateGame() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('settings')
  const [settings, setSettings] = useState<Settings>({
    title: '',
    rounds_count: 3,
    timer_seconds: 30,
    anonymous: false,
    auto_reveal: true,
    auto_submit_behavior: 'random',
  })
  const [participants, setParticipants] = useState<string[]>([])
  const [nameInput, setNameInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ gameCode: string; hostToken: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addParticipant = () => {
    const name = nameInput.trim()
    if (!name) return
    if (participants.some((p) => p.toLowerCase() === name.toLowerCase())) return
    setParticipants((prev) => [...prev, name])
    setNameInput('')
    inputRef.current?.focus()
  }

  const removeParticipant = (i: number) => setParticipants((prev) => prev.filter((_, idx) => idx !== i))

  const createGame = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, participants }),
      })
      const data = await res.json()
      if (data.gameCode) {
        setResult(data)
        setStep('done')
      } else {
        alert(data.error || 'Failed to create game')
      }
    } finally {
      setLoading(false)
    }
  }

  if (step === 'settings') {
    return (
      <PageShell>
        <BackBtn onClick={() => router.push('/')} />
        <h1 className="text-3xl font-black text-white">Create Game</h1>

        <div className="space-y-5">
          <Field label="Game Name">
            <input
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && settings.title.trim() && setStep('participants')}
              placeholder="Friday Night FMK"
              autoFocus
              className={inputCls}
            />
          </Field>

          <Field label="Number of Rounds">
            <div className="flex gap-2 flex-wrap">
              {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                <Chip
                  key={n}
                  active={settings.rounds_count === n}
                  onClick={() => setSettings({ ...settings, rounds_count: n })}
                >
                  {n}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Time Per Round">
            <div className="flex gap-2">
              {[15, 30, 60].map((t) => (
                <Chip
                  key={t}
                  active={settings.timer_seconds === t}
                  onClick={() => setSettings({ ...settings, timer_seconds: t })}
                  wide
                >
                  {t}s
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="When Timer Runs Out (incomplete votes)">
            <div className="flex gap-2">
              <Chip
                active={settings.auto_submit_behavior === 'random'}
                onClick={() => setSettings({ ...settings, auto_submit_behavior: 'random' })}
                wide
              >
                Random Fill
              </Chip>
              <Chip
                active={settings.auto_submit_behavior === 'no_answer'}
                onClick={() => setSettings({ ...settings, auto_submit_behavior: 'no_answer' })}
                wide
              >
                No Answer
              </Chip>
            </div>
          </Field>

          <div className="space-y-2">
            <Toggle
              label="Anonymous Responses"
              description="Hide who voted for what"
              value={settings.anonymous}
              onChange={(v) => setSettings({ ...settings, anonymous: v })}
            />
            <Toggle
              label="Auto-Reveal Results"
              description="Show results after the last round automatically"
              value={settings.auto_reveal}
              onChange={(v) => setSettings({ ...settings, auto_reveal: v })}
            />
          </div>
        </div>

        <PrimaryBtn
          onClick={() => setStep('participants')}
          disabled={!settings.title.trim()}
        >
          Next: Add Participants →
        </PrimaryBtn>
      </PageShell>
    )
  }

  if (step === 'participants') {
    return (
      <PageShell>
        <BackBtn onClick={() => setStep('settings')} />
        <div>
          <h1 className="text-3xl font-black text-white">Add Participants</h1>
          <p className="text-zinc-500 text-sm mt-1">People being voted on — need at least 3</p>
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
            placeholder="Enter name..."
            autoFocus
            className={inputCls}
          />
          <button
            onClick={addParticipant}
            className="px-5 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 active:scale-95 transition-all whitespace-nowrap"
          >
            Add
          </button>
        </div>

        {participants.length > 0 ? (
          <div className="space-y-2">
            {participants.map((name, i) => (
              <div key={i} className="flex items-center justify-between bg-[#161616] border border-[#262626] rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={name} />
                  <span className="text-white font-medium">{name}</span>
                </div>
                <button onClick={() => removeParticipant(i)} className="text-zinc-600 hover:text-red-400 text-2xl leading-none transition-colors">
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-600">No participants yet</div>
        )}

        {participants.length < 3 && (
          <p className="text-zinc-600 text-sm text-center">
            Add {3 - participants.length} more to continue
          </p>
        )}

        <PrimaryBtn onClick={createGame} disabled={participants.length < 3 || loading}>
          {loading ? 'Creating...' : `Create Game (${participants.length} participants)`}
        </PrimaryBtn>
      </PageShell>
    )
  }

  // Done
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const gameUrl = `${origin}/game/${result?.gameCode}`
  const hostUrl = `${origin}/host/${result?.gameCode}?token=${result?.hostToken}`

  return (
    <PageShell>
      <div className="text-center space-y-1">
        <div className="text-6xl">🎉</div>
        <h1 className="text-3xl font-black text-white">Game Created!</h1>
        <p className="text-zinc-400">Share the link or code below</p>
      </div>

      <CopyCard label="Share this with players" value={gameUrl}>
        <div className="mt-2 text-center">
          <span className="text-zinc-500 text-xs uppercase tracking-widest">Game Code</span>
          <p className="text-white font-mono text-4xl font-black tracking-[0.3em] mt-1">{result?.gameCode}</p>
        </div>
      </CopyCard>

      <CopyCard label="Your host link (save this!)" value={hostUrl} accent />

      <PrimaryBtn onClick={() => router.push(`/host/${result?.gameCode}?token=${result?.hostToken}`)}>
        Open Host Panel →
      </PrimaryBtn>

      <p className="text-zinc-700 text-xs text-center">The host link won&apos;t be shown again — save it now</p>
    </PageShell>
  )
}

// ── Small components ────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-10 overflow-y-auto">
      <div className="w-full max-w-lg space-y-6">{children}</div>
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-zinc-500 hover:text-white text-sm transition-colors">
      ← Back
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-zinc-400 text-sm font-medium block mb-2">{label}</label>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children, wide }: { active: boolean; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`${wide ? 'flex-1' : 'px-4'} py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
        active
          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
          : 'bg-[#161616] text-zinc-400 border border-[#262626] hover:border-purple-500'
      }`}
    >
      {children}
    </button>
  )
}

function Toggle({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className="flex items-center justify-between bg-[#161616] border border-[#262626] rounded-xl px-4 py-3 cursor-pointer hover:border-purple-900 transition-colors"
      onClick={() => onChange(!value)}
    >
      <div>
        <p className="text-white font-medium text-sm">{label}</p>
        <p className="text-zinc-500 text-xs mt-0.5">{description}</p>
      </div>
      <div className={`ml-3 shrink-0 w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-purple-600' : 'bg-[#2a2a2a]'}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </div>
    </div>
  )
}

function PrimaryBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-rose-500 text-white text-lg font-bold rounded-2xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
    >
      {children}
    </button>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function CopyCard({ label, value, children, accent }: { label: string; value: string; children?: React.ReactNode; accent?: boolean }) {
  const copy = () => navigator.clipboard.writeText(value).catch(() => null)
  return (
    <div className={`bg-[#161616] border rounded-2xl p-4 space-y-2 ${accent ? 'border-purple-800' : 'border-[#262626]'}`}>
      <p className={`text-xs font-medium uppercase tracking-wider ${accent ? 'text-purple-400' : 'text-zinc-500'}`}>{label}</p>
      <p className="text-white font-mono text-sm break-all">{value}</p>
      {children}
      <button onClick={copy} className={`text-sm transition-colors ${accent ? 'text-purple-400 hover:text-purple-300' : 'text-zinc-400 hover:text-white'}`}>
        Copy →
      </button>
    </div>
  )
}

const inputCls =
  'w-full bg-[#161616] text-white border border-[#262626] rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors placeholder:text-zinc-700'
