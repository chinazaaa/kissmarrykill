'use client'

import { useEffect } from 'react'
import { ALL_THEME_CSS_VAR_KEYS, parseThemeId, THEME_MAP } from '@/lib/themes'

function clearThemeVars(root: HTMLElement) {
  ALL_THEME_CSS_VAR_KEYS.forEach((k) => root.style.removeProperty(k))
  root.style.removeProperty('background')
}

/** Apply the selected game theme CSS variables to the document root. */
export function useApplyGameTheme(theme: string | null | undefined) {
  useEffect(() => {
    const themeId = parseThemeId(theme)
    const vars = THEME_MAP[themeId]?.cssVars ?? {}
    const root = document.documentElement

    if (themeId === 'default' || Object.keys(vars).length === 0) {
      clearThemeVars(root)
      return () => clearThemeVars(root)
    }

    const keys = Object.keys(vars)
    keys.forEach((k) => root.style.setProperty(k, vars[k]))
    root.style.setProperty('background', vars['--background'] ?? '')
    return () => {
      keys.forEach((k) => root.style.removeProperty(k))
      root.style.removeProperty('background')
    }
  }, [theme])
}
