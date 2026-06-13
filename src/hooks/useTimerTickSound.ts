import { useEffect, useRef } from 'react'
import { playTickTockSound, TIMER_TICK_THRESHOLD } from '@/lib/sounds'

/** Plays a tick-tock each second when the countdown enters the final seconds. */
export function useTimerTickSound(seconds: number, enabled: boolean) {
  const lastTickRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      lastTickRef.current = null
      return
    }
    if (seconds <= 0 || seconds > TIMER_TICK_THRESHOLD) {
      if (seconds > TIMER_TICK_THRESHOLD) lastTickRef.current = null
      return
    }
    if (lastTickRef.current === seconds) return
    lastTickRef.current = seconds
    playTickTockSound(seconds)
  }, [seconds, enabled])
}
