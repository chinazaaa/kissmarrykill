// Invoked on a schedule by EventBridge. POSTs to the app's freeze-recovery
// endpoint with the shared CRON_SECRET so a match can't hang if every client
// disconnects. The endpoint itself is idempotent and only acts on sessions
// already past their deadline.
export const handler = async () => {
  const url = process.env.TICK_URL
  const secret = process.env.CRON_SECRET
  if (!url || !secret) {
    throw new Error('TICK_URL and CRON_SECRET must be set')
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
  const body = await res.text()
  console.log(`tick -> ${res.status} ${body}`)

  if (!res.ok) {
    throw new Error(`tick failed: ${res.status}`)
  }
  return { ok: true, status: res.status }
}
