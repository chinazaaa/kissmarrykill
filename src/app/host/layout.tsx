import type { Metadata } from 'next'
import { GamePlayerChrome } from '@/components/GamePlayerChrome'
import { GameRulesLoader } from '@/components/GameRulesLoader'
import { GameRulesProvider } from '@/contexts/GameRulesContext'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = noIndexMetadata('Host Panel')

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameRulesProvider>
      <GameRulesLoader />
      <GamePlayerChrome />
      <main className="pt-[3.75rem]">{children}</main>
    </GameRulesProvider>
  )
}
