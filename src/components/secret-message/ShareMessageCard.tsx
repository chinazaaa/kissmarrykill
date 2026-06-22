const SIZE = 1080

function messageFontSize(text: string): number {
  const len = text.trim().length
  if (len > 200) return 32
  if (len > 120) return 38
  if (len > 60) return 44
  if (len > 30) return 50
  return 56
}

export function ShareMessageCard({
  messageText,
  gameTitle,
  headerEmoji = '💌✨',
  brand = 'fateround.com',
}: {
  messageText: string
  gameTitle: string
  headerEmoji?: string
  brand?: string
}) {
  const fontSize = messageFontSize(messageText)

  return (
    <div
      data-theme="dark"
      className="relative flex flex-col overflow-hidden antialiased"
      style={{
        width: SIZE,
        height: SIZE,
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
      }}
    >
      <div className="absolute inset-0" style={{ background: '#08080f' }} />

      <div
        className="absolute rounded-full"
        style={{
          width: 520,
          height: 520,
          top: -140,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, rgba(244, 63, 94, 0.2) 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.55,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 400,
          height: 400,
          bottom: -100,
          right: -80,
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.14) 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.5,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 300,
          height: 300,
          bottom: '22%',
          left: -90,
          background: 'radial-gradient(circle, rgba(251, 146, 60, 0.1) 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.45,
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-20">
        <div
          className="relative w-full rounded-[1.5rem] border px-14 py-16 text-center"
          style={{
            background: 'rgba(22, 22, 34, 0.92)',
            borderColor: 'rgba(255, 255, 255, 0.14)',
            boxShadow:
              '0 0 0 1px rgba(244, 63, 94, 0.12), 0 12px 48px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-[1.5rem]"
            style={{
              opacity: 0.14,
              background: 'radial-gradient(ellipse 80% 55% at 18% 0%, #f43f5e 0%, transparent 70%)',
            }}
          />
          <div className="relative mb-10 space-y-4">
            <p className="text-[3.25rem] leading-none">{headerEmoji}</p>
            <h2 className="gradient-title text-[2.25rem] font-black tracking-tight leading-tight">{gameTitle}</h2>
            <div
              className="mx-auto h-px w-16"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(244, 63, 94, 0.45), transparent)',
              }}
            />
          </div>
          <p
            className="relative font-semibold leading-[1.35] tracking-tight whitespace-pre-wrap break-words"
            style={{
              fontSize,
              color: '#f2f2f8',
            }}
          >
            {messageText.trim()}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 pb-[72px]">
        <div
          className="h-px w-[88px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(244, 63, 94, 0.5), transparent)',
          }}
        />
        <span className="font-medium tracking-[0.14em] uppercase" style={{ fontSize: 22, color: '#5c5c78' }}>
          {brand}
        </span>
      </div>
    </div>
  )
}
