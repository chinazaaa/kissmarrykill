'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AnonymousMessage } from '@/types'

export function useAnonymousMessages(gameCode: string, enabled: boolean) {
  const [messages, setMessages] = useState<AnonymousMessage[]>([])
  const [loading, setLoading] = useState(true)

  const mergeMessage = useCallback((message: AnonymousMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
  }, [])

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('anonymous_messages')
      .select('id, game_id, text, created_at')
      .eq('game_id', gameCode)
      .order('created_at', { ascending: true })

    if (!error) setMessages(data ?? [])
    setLoading(false)
  }, [gameCode])

  useEffect(() => {
    if (!enabled) return
    loadMessages()
  }, [enabled, loadMessages])

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel(`anon-messages-${gameCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'anonymous_messages', filter: `game_id=eq.${gameCode}` },
        (payload) => mergeMessage(payload.new as AnonymousMessage)
      )
      .subscribe()

    const poll = setInterval(loadMessages, 3000)

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [enabled, gameCode, loadMessages, mergeMessage])

  return { messages, loading, reload: loadMessages }
}
