'use client'

type Props = {
  title: string
  children: React.ReactNode
  className?: string
}

export function HostLobbySettingBlock({ title, children, className = '' }: Props) {
  return (
    <section className={`space-y-2 ${className}`}>
      <p className="label-caps text-[10px]">{title}</p>
      {children}
    </section>
  )
}
