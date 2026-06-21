'use client'

type Props = {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function HostLobbySettingBlock({ title, description, children, className = '' }: Props) {
  return (
    <section className={`space-y-3 ${className}`}>
      <div>
        <p className="text-sm font-semibold text-body">{title}</p>
        {description ? <p className="text-faint text-xs mt-0.5 leading-relaxed">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
