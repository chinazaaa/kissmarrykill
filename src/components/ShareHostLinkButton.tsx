'use client'

import { useState } from 'react'
import { GameLinkQrModal } from '@/components/GameLinkQrModal'
import { copyToClipboard } from '@/lib/copy'
import { hostGameUrl } from '@/lib/site'
import { useToast } from '@/components/ui/Toast'

type Props = {
  gameCode: string
  hostToken: string
  className?: string
}

export function ShareHostLinkButton({ gameCode, hostToken, className = '' }: Props) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const url = hostGameUrl(gameCode, hostToken)

  const handleCopy = async () => {
    const ok = await copyToClipboard(url)
    if (ok) {
      toast.success('Host link copied')
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
          className="btn-secondary text-xs sm:text-sm py-1.5 px-2.5 sm:px-4 whitespace-nowrap"
        >
          {copied ? 'Copied ✓' : (
            <>
              <span className="sm:hidden">Host link</span>
              <span className="hidden sm:inline">Copy host link</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="btn-secondary text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 whitespace-nowrap"
          aria-label="Show host link QR code"
        >
          QR host
        </button>
      </div>
      <GameLinkQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        title="Scan host link"
        subtitle="Save this to reopen your host panel on another device."
        copyLabel="Copy host link"
        copySuccessMessage="Host link copied"
      />
    </>
  )
}
