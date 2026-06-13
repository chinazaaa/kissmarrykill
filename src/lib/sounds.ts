let audioCtx: AudioContext | null = null

/** Play tick-tock during the last N seconds of a round timer. */
export const TIMER_TICK_THRESHOLD = 5

export function unlockAudio() {
  if (typeof window === 'undefined') return
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') void audioCtx.resume()
}

/** Short ascending chime when a new round starts. */
export function playRoundStartSound() {
  if (typeof window === 'undefined') return

  try {
    unlockAudio()
    if (!audioCtx) audioCtx = new AudioContext()
    const ctx = audioCtx
    const now = ctx.currentTime

    const playTone = (freq: number, start: number, duration: number, volume = 0.12) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(volume, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration + 0.05)
    }

    playTone(523.25, now, 0.14)
    playTone(659.25, now + 0.1, 0.18)
    playTone(783.99, now + 0.2, 0.32, 0.14)
  } catch {
    // Browser may block audio until user gesture — ignore silently
  }
}

/** Short clock tick/tock for countdown urgency (last few seconds). */
export function playTickTockSound(secondsRemaining: number) {
  if (typeof window === 'undefined') return
  if (secondsRemaining <= 0 || secondsRemaining > TIMER_TICK_THRESHOLD) return

  try {
    unlockAudio()
    if (!audioCtx) audioCtx = new AudioContext()
    const ctx = audioCtx
    const now = ctx.currentTime
    const isTock = secondsRemaining % 2 === 0

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = isTock ? 600 : 900
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.07, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.09)
  } catch {
    // Ignore if audio is blocked
  }
}
