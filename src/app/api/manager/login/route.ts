import { NextRequest, NextResponse } from 'next/server'
import {
  createManagerSessionToken,
  managerCodeIsSet,
  managerCookieName,
  managerSessionMaxAgeSeconds,
  verifyManagerCode,
} from '@/lib/manager-session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code : ''

    if (!(await managerCodeIsSet())) {
      return NextResponse.json(
        { error: 'No access code has been set yet. Ask the admin to set one.' },
        { status: 503 }
      )
    }

    if (!(await verifyManagerCode(code))) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 401 })
    }

    const token = await createManagerSessionToken()
    const res = NextResponse.json({ success: true })
    res.cookies.set(managerCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: managerSessionMaxAgeSeconds(),
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
