import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sortProductUpdates, type ProductUpdate } from '@/lib/product-updates'

export async function fetchProductUpdates(): Promise<ProductUpdate[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('product_updates').select('*')

  if (error) throw new Error(error.message)
  return sortProductUpdates((data ?? []) as ProductUpdate[])
}
