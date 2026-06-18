'use client'

import { useState } from 'react'
import { GameLinkQrModal } from '@/components/GameLinkQrModal'
import { copyToClipboard } from '@/lib/copy'
import { playerResumeUrl, shareOrigin } from '@/lib/site'
import { useToast } from '@/components/ui/Toast'

type Props = {
  gameCode: string
  resumeToken: string
  className?: string
}

export function SharePlayerResumeButton({ gameCode, resumeToken, className = '' }: Props) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const url = playerResumeUrl(gameCode, resumeToken, shareOrigin())

  const handleCopy = async () => {
    const ok = await copyToClipboard(url)
    if (ok) {
      toast.success('Your play link copied')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Could not copy — try again')
    }
  }

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-secondary text-xs sm:text-sm py-1.5 px-2.5 sm:px-4 whitespace-nowrap border-[var(--primary)]/30"
        >
          {copied ? 'Copied ✓' : (
            <>
              <span className="sm:hidden">Play link</span>
              <span className="hidden sm:inline">Copy play link</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="btn-secondary text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 whitespace-nowrap border-[var(--primary)]/30"
          aria-label="Show your play link QR code"
        >
          QR play
        </button>
      </div>
      <GameLinkQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        title="Scan to play as you"
        subtitle="Opens your player seat — use this on your phone or another device after joining in the lobby."
        copyLabel="Copy play link"
        copySuccessMessage="Your play link copied"
      />
    </>
  )
}
