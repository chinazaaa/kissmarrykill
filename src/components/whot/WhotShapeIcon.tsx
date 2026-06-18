import type { WhotShape } from '@/types'

export const WHOT_SHAPE_COLORS: Record<WhotShape, string> = {
  circle: '#60a5fa',
  cross: '#4ade80',
  triangle: '#fbbf24',
  square: '#f87171',
  star: '#a78bfa',
  whot: '#e879f9',
}

const SIZE_PX = { sm: 16, md: 20, lg: 24 } as const

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

function ShapeGraphic({ shape, color }: { shape: WhotShape; color: string }) {
  switch (shape) {
    case 'circle':
      return <circle cx="12" cy="12" r="7.5" fill="none" stroke={color} strokeWidth="2.75" />
    case 'cross':
      return (
        <>
          <line x1="7" y1="7" x2="17" y2="17" stroke={color} strokeWidth="2.75" strokeLinecap="round" />
          <line x1="17" y1="7" x2="7" y2="17" stroke={color} strokeWidth="2.75" strokeLinecap="round" />
        </>
      )
    case 'triangle':
      return <polygon points="12,5.5 20.5,18.5 3.5,18.5" fill={color} />
    case 'square':
      return <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill={color} />
    case 'star':
      return <polygon points={starPoints(12, 12, 8, 3.5)} fill={color} />
    case 'whot':
      return (
        <>
          <polygon
            points="12,4 20,12 12,20 4,12"
            fill="none"
            stroke={color}
            strokeWidth="2.25"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.75" fill={color} />
        </>
      )
  }
}

export function WhotShapeIcon({
  shape,
  size = 'md',
  variant = 'default',
  className = '',
}: {
  shape: WhotShape
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'on-card'
  className?: string
}) {
  const px = SIZE_PX[size]
  const color = variant === 'on-card' ? '#ffffff' : WHOT_SHAPE_COLORS[shape]

  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <ShapeGraphic shape={shape} color={color} />
    </svg>
  )
}
