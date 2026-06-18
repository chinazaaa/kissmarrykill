/** Public site domain (no protocol). Override with NEXT_PUBLIC_APP_URL in env. */
export function appDomain(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) return 'fateround.com'
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`)
    return url.host
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  }
}

export function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) return 'https://fateround.com'
  if (raw.includes('://')) return raw.replace(/\/$/, '')
  return `https://${raw.replace(/\/$/, '')}`
}

export function playerGameUrl(gameCode: string): string {
  return `${appOrigin()}/game/${gameCode.trim().toUpperCase()}`
}

export function playerResumeUrl(gameCode: string, resumeToken: string): string {
  const code = gameCode.trim().toUpperCase()
  const token = resumeToken.trim().toUpperCase()
  return `${playerGameUrl(code)}?player=${encodeURIComponent(token)}`
}

export function hostGameUrl(gameCode: string, hostToken: string): string {
  const code = gameCode.trim().toUpperCase()
  const token = hostToken.trim()
  return `${appOrigin()}/host/${code}?token=${encodeURIComponent(token)}`
}

/** PayPal / Ko-fi / Buy Me a Coffee link. Override with NEXT_PUBLIC_SUPPORT_URL. */
export function supportUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim()
  if (!raw) return 'https://www.paypal.me/nazalistic'
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`)
    return url.href
  } catch {
    return raw
  }
}
