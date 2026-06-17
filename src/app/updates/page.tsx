import type { Metadata } from 'next'
import { UpdatesPage } from '@/components/UpdatesPage'
import { fetchProductUpdates } from '@/lib/product-updates-server'
import type { ProductUpdate } from '@/lib/product-updates'
import { OG_IMAGE, SITE_NAME } from '@/lib/seo'

export const metadata: Metadata = {
  title: "What's New",
  description: 'See the latest features, improvements, and upcoming updates on Fate Round.',
  alternates: { canonical: '/updates' },
  openGraph: {
    title: `What's New | ${SITE_NAME}`,
    description: 'See the latest features, improvements, and upcoming updates on Fate Round.',
    url: '/updates',
    images: [OG_IMAGE],
  },
}

export const revalidate = 60

export default async function Page() {
  let updates: ProductUpdate[] = []

  try {
    updates = await fetchProductUpdates()
  } catch {
    updates = []
  }

  return <UpdatesPage updates={updates} />
}
