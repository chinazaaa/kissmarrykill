import type { CustomContentHint } from '@/lib/custom-content-hints'

type Props = {
  hint: CustomContentHint
  accent?: string
  className?: string
}

export function CustomContentAiTip({ hint, accent, className = '' }: Props) {
  return (
    <div
      className={`rounded-xl border border-theme p-4 space-y-2.5 ${className}`}
      style={accent ? { borderLeftWidth: 3, borderLeftColor: accent, background: `${accent}12` } : undefined}
    >
      <p className="text-sm font-semibold text-body">{hint.headline}</p>
      <p className="text-muted text-xs leading-relaxed">{hint.body}</p>
      <p className="text-faint text-xs leading-relaxed">
        <span className="font-medium text-muted">Try asking your AI:</span> {hint.promptExample}
      </p>
      <a
        href={hint.sampleHref}
        download={hint.sampleDownload}
        className="inline-block text-xs font-semibold text-body hover:opacity-80 transition-opacity no-underline"
      >
        Download sample CSV →
      </a>
    </div>
  )
}
