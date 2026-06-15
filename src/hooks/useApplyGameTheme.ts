'use client'

import { useEffect } from 'react'
import { parseThemeId, THEME_MAP } from '@/lib/themes'

/** Apply the selected game theme CSS variables to the document root. */
export function useApplyGameTheme(theme: string | null | undefined) {
  useEffect(() => {
    const themeId = parseThemeId(theme)
    const vars = THEME_MAP[themeId]?.cssVars ?? {}
    const root = document.documentElement
    const keys = Object.keys(vars)
    keys.forEach((k) => root.style.setProperty(k, vars[k]))
    if (Object.keys(vars).length > 0) {
      root.style.setProperty('background', vars['--background'] ?? '')
    }
    return () => {
      keys.forEach((k) => root.style.removeProperty(k))
      root.style.removeProperty('background')
    }
  }, [theme])
}
