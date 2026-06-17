import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchGamePlayerLimits } from '@/lib/game-limits'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET() {
  const limits = await fetchGamePlayerLimits(supabase)
  return NextResponse.json({ limits })
}
