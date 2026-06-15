import { NextRequest, NextResponse } from 'next/server'
import { assertAdminRequest } from '@/lib/admin-api'
import { getSupabaseAdmin, hasServiceRoleKey } from '@/lib/supabase-admin'
import { updateProductUpdateSchema } from '@/lib/validation'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await assertAdminRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required to manage product updates.' },
      { status: 503 }
    )
  }

  const { id } = await context.params
  const raw = await req.json()
  const parsed = updateProductUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const { type, title, description, month, year, sortOrder } = parsed.data

  if (type !== undefined) payload.type = type
  if (title !== undefined) payload.title = title
  if (description !== undefined) payload.description = description
  if (month !== undefined) payload.month = month
  if (year !== undefined) payload.year = year
  if (sortOrder !== undefined) payload.sort_order = sortOrder

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('product_updates').update(payload).eq('id', id).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Update not found' }, { status: 404 })

  return NextResponse.json({ update: data })
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const session = await assertAdminRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required to manage product updates.' },
      { status: 503 }
    )
  }

  const { id } = await context.params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('product_updates').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
