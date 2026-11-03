'use client'
import { useEffect, useState } from 'react'

type Preferences = { recent: string[] }
const empty: Preferences = { recent: [] }
const storageKey = 'pascal:landscape:catalog'

export function useCatalogPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(empty)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<Preferences>
      const strings = (values: unknown): string[] => Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []
      setPreferences({ recent: strings(raw.recent).slice(0, 20) })
    } catch { /* Browsing remains usable when browser storage is unavailable. */ }
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)) } catch { /* Preferences remain available for this session. */ }
  }, [loaded, preferences])
  return { ...preferences,
    remember: (key: string) => setPreferences((current) => ({ ...current, recent: [key, ...current.recent.filter((value) => value !== key)].slice(0, 20) })),
  }
}
