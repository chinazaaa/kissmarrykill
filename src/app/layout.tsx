import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AppBackground } from '@/components/AppBackground'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Kiss Marry Smash',
  description: 'The party game that reveals everything',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-[var(--foreground)]">
        <AppBackground />
        {children}
      </body>
    </html>
  )
}
