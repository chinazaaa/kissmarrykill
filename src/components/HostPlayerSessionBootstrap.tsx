'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getResumeTokenFromUrl, resumePlayerSession } from '@/lib/player-resume'

/** Restore player session when opening a combined host+play link. */
export function HostPlayerSessionBootstrap() {
  const params = useParams()
  const code = typeof params?.code === 'string' ? params.code.toUpperCase() : null

  useEffect(() => {
    const resumeToken = getResumeTokenFromUrl()
    if (!code || !resumeToken) return
    void resumePlayerSession(code, resumeToken)
  }, [code])

  return null
}
