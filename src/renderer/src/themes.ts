import { useSyncExternalStore } from 'react'
import { builtInThemes, themeEffects, validateTheme, type Theme } from './theme-model'

export { builtInThemes, themeEffects, validateTheme } from './theme-model'
export type { Theme, ThemeBackgroundMode, ThemeDensity, ThemeNeonElement } from './theme-model'

const storageKey = 'openfy-themes-v1'
type ThemeState = {
  active: string
  custom: Theme[]
  advancedEffectsEnabled: boolean
  lightweightMode: boolean
}

const defaults: ThemeState = { active: 'midnight', custom: [], advancedEffectsEnabled: true, lightweightMode: false }
function load(): ThemeState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaults }
    const stored = value as Record<string, unknown>
    const custom = Array.isArray(stored.custom) ? stored.custom.filter(validateTheme) : []
    if (Array.isArray(stored.custom) && custom.length !== stored.custom.length) {
      console.warn('[Openfy] Temas locais inválidos foram ignorados ao carregar a galeria.')
    }
    const active = typeof stored.active === 'string' ? stored.active : defaults.active
    return {
      active: [...builtInThemes, ...custom].some(theme => theme.id === active) ? active : defaults.active,
      custom,
      advancedEffectsEnabled: stored.advancedEffectsEnabled !== false,
      lightweightMode: stored.lightweightMode === true
    }
  } catch (error) {
    console.warn('[Openfy] Preferências de tema inválidas; usando valores padrão:', error)
    return { ...defaults }
  }
}

let state: ThemeState = load()
let previewTheme: Theme | null = null
const listeners = new Set<() => void>()
const themeRoot = (): HTMLElement => document.documentElement

function selectedTheme(): Theme {
  return previewTheme ?? [...builtInThemes, ...state.custom].find(theme => theme.id === state.active) ?? builtInThemes[0]
}

export function applyTheme(): void {
  const root = themeRoot()
  const theme = selectedTheme()
  const effects = themeEffects(theme)
  const effectsEnabled = state.advancedEffectsEnabled && !state.lightweightMode
  for (const [key, value] of Object.entries(theme.colors)) root.style.setProperty(`--${key}`, value)
  root.style.setProperty('--radius', `${theme.radius}px`)
  root.style.setProperty('--theme-glass-blur', `${effectsEnabled && effects.glass.enabled ? effects.glass.blur : 0}px`)
  root.style.setProperty('--theme-glass-opacity', `${effectsEnabled && effects.glass.enabled ? effects.glass.opacity : 100}%`)
  root.style.setProperty('--theme-glass-border', `${effectsEnabled && effects.glass.enabled ? effects.glass.border : 0}%`)
  root.style.setProperty('--theme-neon-color', effects.neon.color)
  root.style.setProperty('--theme-neon-shadow', `${effectsEnabled && effects.neon.enabled ? Math.round(effects.neon.intensity * 0.32) : 0}px`)
  root.style.setProperty('--theme-neon-panel-shadow', `${effectsEnabled && effects.neon.enabled ? Math.round(effects.neon.intensity * 0.11) : 0}px`)
  root.style.setProperty('--theme-neon-hover-shadow', `${effectsEnabled && effects.neon.enabled ? Math.round(effects.neon.intensity * 0.32 + 8) : 0}px`)
  root.style.setProperty('--theme-pulse-color', effects.neon.enabled ? effects.neon.color : theme.colors.accent)
  root.style.setProperty('--theme-pulse-shadow', `${effectsEnabled && effects.animations.pulse ? Math.round(effects.animations.intensity * 0.2) : 0}px`)
  root.style.setProperty('--theme-pulse-hover-shadow', `${effectsEnabled && effects.animations.pulse ? Math.round(effects.animations.intensity * 0.2 + 5) : 0}px`)
  root.style.setProperty('--theme-background-blur', `${effectsEnabled ? effects.background.blur : 0}px`)
  root.style.setProperty('--theme-background-dim', `${(effectsEnabled ? effects.background.dim : 65) / 100}`)
  root.style.setProperty('--theme-transition-duration', `${effectsEnabled && effects.animations.transitions && !effects.animations.reduceMotion ? Math.round(240 * effects.animations.intensity / 100) : 0}ms`)
  root.style.setProperty('--theme-background-transition', `${effectsEnabled && effects.animations.transitions && !effects.animations.reduceMotion ? Math.round(700 * effects.animations.intensity / 100) : 0}ms`)
  root.style.setProperty('--theme-pulse-duration', `${Math.round(2800 - effects.animations.intensity * 8)}ms`)
  root.dataset.density = theme.density
  root.dataset.glass = String(effectsEnabled && effects.glass.enabled)
  root.dataset.glassReflection = String(effectsEnabled && effects.glass.enabled && effects.glass.reflection)
  root.dataset.neonProgress = String(effectsEnabled && effects.neon.enabled && effects.neon.elements.includes('progress'))
  root.dataset.neonControls = String(effectsEnabled && effects.neon.enabled && effects.neon.elements.includes('controls'))
  root.dataset.neonPanels = String(effectsEnabled && effects.neon.enabled && effects.neon.elements.includes('panels'))
  root.dataset.neonActive = String(effectsEnabled && effects.neon.enabled && effects.neon.elements.includes('active'))
  root.dataset.themePulse = String(effectsEnabled && effects.animations.pulse && !effects.animations.reduceMotion)
  root.dataset.themeReduceMotion = String(effects.animations.reduceMotion || state.lightweightMode)
  root.dataset.backgroundMode = effectsEnabled ? effects.background.mode : 'solid'
  root.style.setProperty('--theme-background-position', effects.background.position)
  root.style.setProperty('--theme-background-fit', effects.background.fit)
}

function emit(persist = true): void {
  if (persist) {
    localStorage.setItem(storageKey, JSON.stringify({
      active: state.active,
      custom: state.custom,
      advancedEffectsEnabled: state.advancedEffectsEnabled,
      lightweightMode: state.lightweightMode
    }))
  }
  applyTheme()
  listeners.forEach(listener => listener())
}

export const themeStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => state,
  getCurrentTheme: selectedTheme,
  setActive: (active: string) => {
    if (![...builtInThemes, ...state.custom].some(theme => theme.id === active)) throw new Error('Tema não encontrado')
    previewTheme = null
    state = { ...state, active }
    emit()
  },
  setPreview: (theme: Theme | null) => {
    if (theme && !validateTheme(theme)) throw new Error('Tema inválido')
    previewTheme = theme
    state = { ...state }
    emit(false)
  },
  setAdvancedEffectsEnabled: (enabled: boolean) => {
    state = { ...state, advancedEffectsEnabled: enabled }
    emit()
  },
  setLightweightMode: (enabled: boolean) => {
    state = { ...state, lightweightMode: enabled }
    emit()
  },
  save: (theme: Theme) => {
    if (!validateTheme(theme)) throw new Error('Tema inválido')
    previewTheme = null
    state = { ...state, active: theme.id, custom: [...state.custom.filter(item => item.id !== theme.id), theme] }
    emit()
  },
  remove: (id: string) => {
    previewTheme = null
    state = { ...state, active: state.active === id ? 'midnight' : state.active, custom: state.custom.filter(theme => theme.id !== id) }
    emit()
  },
  importTheme: (raw: string) => {
    const parsed: unknown = JSON.parse(raw)
    if (!validateTheme(parsed)) throw new Error('Arquivo de tema inválido ou incompatível')
    const theme: Theme = {
      ...parsed,
      id: `community-${crypto.randomUUID()}`,
      name: parsed.name.trim(),
      author: parsed.author.trim(),
      description: parsed.description.trim()
    }
    themeStore.save(theme)
  }
}

export function useThemes(): ThemeState {
  return useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot)
}

applyTheme()
