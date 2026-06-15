import { NextResponse } from 'next/server'
import { fetchProductUpdates } from '@/lib/product-updates-server'

export async function GET() {
  try {
    const updates = await fetchProductUpdates()
    return NextResponse.json({ updates })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load updates'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
