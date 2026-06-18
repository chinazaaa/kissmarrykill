import type { Metadata } from 'next'
import { fetchGameTypeByCode } from '@/lib/game-lookup'
import { gameJoinMetadata } from '@/lib/seo'

type Props = {
  children: React.ReactNode
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { code } = await params
  const gameType = await fetchGameTypeByCode(code)
  return gameJoinMetadata(code, gameType)
}

export default function GameCodeLayout({ children }: Props) {
  return children
}
