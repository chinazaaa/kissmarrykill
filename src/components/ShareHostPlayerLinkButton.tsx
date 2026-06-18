'use client'

import { useState } from 'react'
import { GameLinkQrModal } from '@/components/GameLinkQrModal'
import { copyToClipboard } from '@/lib/copy'
import { hostPlayerUrl, shareOrigin } from '@/lib/site'
import { useToast } from '@/components/ui/Toast'

type Props = {
  gameCode: string
  hostToken: string
  resumeToken: string
  className?: string
}

export function ShareHostPlayerLinkButton({ gameCode, hostToken, resumeToken, className = '' }: Props) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const url = hostPlayerUrl(gameCode, hostToken, resumeToken, shareOrigin())

  const handleCopy = async () => {
    const ok = await copyToClipboard(url)
    if (ok) {
      toast.success('Host + play link copied')
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
              <span className="sm:hidden">My link</span>
              <span className="hidden sm:inline">Copy host+play link</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="btn-secondary text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 whitespace-nowrap border-[var(--primary)]/30"
          aria-label="Show host and play link QR code"
        >
          QR host+play
        </button>
      </div>
      <GameLinkQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        title="Host + play"
        subtitle="Manage the game and play as yourself — save this for another device."
        copyLabel="Copy host+play link"
        copySuccessMessage="Host + play link copied"
      />
    </>
  )
}
