export type ThemeDensity = 'comfortable' | 'compact'
export type ThemeBackgroundMode = 'solid' | 'custom' | 'album'
export type ThemeNeonElement = 'progress' | 'controls' | 'panels' | 'active'

export type Theme = {
  id: string
  name: string
  author: string
  description: string
  colors: Record<string, string>
  radius: number
  density: ThemeDensity
  glass?: {
    enabled: boolean
    blur: number
    opacity: number
    border: number
    reflection: boolean
  }
  neon?: {
    enabled: boolean
    color: string
    intensity: number
    elements: ThemeNeonElement[]
  }
  background?: {
    mode: ThemeBackgroundMode
    image?: string
    position: 'center' | 'top' | 'bottom'
    fit: 'cover' | 'contain'
    blur: number
    dim: number
  }
  animations?: {
    transitions: boolean
    pulse: boolean
    intensity: number
    reduceMotion: boolean
  }
}

export type ThemeEffects = Required<Pick<Theme, 'glass' | 'neon' | 'background' | 'animations'>>

export const themeColorKeys = ['bg', 'panel', 'panel2', 'hover', 'line', 'text', 'muted', 'accent', 'danger'] as const
export const themeBackgroundPattern = /^openfy-theme:\/\/background\/[a-f0-9]{64}\.(?:png|jpg|webp)$/

const defaultEffects: ThemeEffects = {
  glass: { enabled: false, blur: 18, opacity: 76, border: 30, reflection: false },
  neon: { enabled: false, color: '#4d8dff', intensity: 55, elements: ['progress', 'controls', 'active'] },
  background: { mode: 'solid', position: 'center', fit: 'cover', blur: 18, dim: 48 },
  animations: { transitions: true, pulse: false, intensity: 45, reduceMotion: false }
}

export function themeEffects(theme: Theme): ThemeEffects {
  return {
    glass: { ...defaultEffects.glass, ...theme.glass },
    neon: { ...defaultEffects.neon, ...theme.neon, elements: theme.neon?.elements ? [...theme.neon.elements] : [...defaultEffects.neon.elements] },
    background: { ...defaultEffects.background, ...theme.background },
    animations: { ...defaultEffects.animations, ...theme.animations }
  }
}

export function isThemeBackground(value: unknown): value is string {
  return typeof value === 'string' && themeBackgroundPattern.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key))
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

export function validateTheme(value: unknown): value is Theme {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'name', 'author', 'description', 'colors', 'radius', 'density', 'glass', 'neon', 'background', 'animations'])) return false
  if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.id)) return false
  if (typeof value.name !== 'string' || value.name.trim().length < 1 || value.name.length > 60) return false
  if (typeof value.author !== 'string' || value.author.trim().length < 1 || value.author.length > 60) return false
  if (typeof value.description !== 'string' || value.description.length > 180) return false
  if (!inRange(value.radius, 4, 24) || (value.density !== 'comfortable' && value.density !== 'compact')) return false
  if (!isRecord(value.colors) || !hasOnlyKeys(value.colors, themeColorKeys)) return false
  const colors = value.colors
  if (!themeColorKeys.every(key => {
    const color = colors[key]
    return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)
  })) return false

  if (value.glass !== undefined) {
    if (!isRecord(value.glass) || !hasOnlyKeys(value.glass, ['enabled', 'blur', 'opacity', 'border', 'reflection'])) return false
    if (typeof value.glass.enabled !== 'boolean' || !inRange(value.glass.blur, 0, 40) || !inRange(value.glass.opacity, 0, 100) || !inRange(value.glass.border, 0, 100) || typeof value.glass.reflection !== 'boolean') return false
  }
  if (value.neon !== undefined) {
    if (!isRecord(value.neon) || !hasOnlyKeys(value.neon, ['enabled', 'color', 'intensity', 'elements'])) return false
    if (typeof value.neon.enabled !== 'boolean' || typeof value.neon.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.neon.color) || !inRange(value.neon.intensity, 0, 100) || !Array.isArray(value.neon.elements) || !value.neon.elements.every(element => ['progress', 'controls', 'panels', 'active'].includes(String(element)))) return false
  }
  if (value.background !== undefined) {
    if (!isRecord(value.background) || !hasOnlyKeys(value.background, ['mode', 'image', 'position', 'fit', 'blur', 'dim'])) return false
    if (!['solid', 'custom', 'album'].includes(String(value.background.mode)) || !['center', 'top', 'bottom'].includes(String(value.background.position)) || !['cover', 'contain'].includes(String(value.background.fit)) || !inRange(value.background.blur, 0, 40) || !inRange(value.background.dim, 0, 85)) return false
    if (value.background.image !== undefined && !isThemeBackground(value.background.image)) return false
  }
  if (value.animations !== undefined) {
    if (!isRecord(value.animations) || !hasOnlyKeys(value.animations, ['transitions', 'pulse', 'intensity', 'reduceMotion'])) return false
    if (typeof value.animations.transitions !== 'boolean' || typeof value.animations.pulse !== 'boolean' || !inRange(value.animations.intensity, 0, 100) || typeof value.animations.reduceMotion !== 'boolean') return false
  }
  return true
}

function baseTheme(theme: Pick<Theme, 'id' | 'name' | 'author' | 'description' | 'colors' | 'radius' | 'density'>): Theme {
  return {
    ...theme,
    glass: { ...defaultEffects.glass },
    neon: { ...defaultEffects.neon, color: theme.colors.accent },
    background: { ...defaultEffects.background },
    animations: { ...defaultEffects.animations }
  }
}

export const builtInThemes: Theme[] = [
  baseTheme({ id: 'midnight', name: 'Midnight Blue', author: 'Openfy', description: 'Azul elétrico, grafite e profundidade.', radius: 12, density: 'comfortable', colors: { bg:'#070a12',panel:'#111827',panel2:'#192438',hover:'#25344c',line:'#2b3950',text:'#f5f8ff',muted:'#a3b4cc',accent:'#4d8dff',danger:'#ff6578' } }),
  baseTheme({ id: 'forest', name: 'Forest Pulse', author: 'Openfy', description: 'Verde suave com tons de floresta.', radius: 14, density: 'comfortable', colors: { bg:'#07100e',panel:'#11201b',panel2:'#1b3027',hover:'#274437',line:'#335042',text:'#f0fff5',muted:'#a4c4b4',accent:'#55dfa0',danger:'#ff7c89' } }),
  baseTheme({ id: 'violet', name: 'Neon Violet', author: 'Openfy', description: 'Roxo vibrante com detalhes luminosos.', radius: 16, density: 'comfortable', colors: { bg:'#0d0915',panel:'#1a1326',panel2:'#2a1c3b',hover:'#3c2b53',line:'#4b3862',text:'#fff7ff',muted:'#bdaacb',accent:'#b67aff',danger:'#ff7193' } }),
  baseTheme({ id: 'ember', name: 'Amber Studio', author: 'Openfy', description: 'Laranja quente e visual minimalista.', radius: 9, density: 'compact', colors: { bg:'#100d0b',panel:'#211a16',panel2:'#30251e',hover:'#423126',line:'#59402f',text:'#fff8f0',muted:'#c6ae9a',accent:'#ffb454',danger:'#ff6b6b' } }),
  {
    ...baseTheme({ id: 'openfy-glass', name: 'Openfy Glass', author: 'Openfy', description: 'Painéis translúcidos, reflexos discretos e fundo personalizável.', radius: 16, density: 'comfortable', colors: { bg:'#080d18',panel:'#111b2b',panel2:'#192844',hover:'#253857',line:'#547099',text:'#f5f8ff',muted:'#b3c4dc',accent:'#72b7ff',danger:'#ff7182' } }),
    glass: { enabled: true, blur: 22, opacity: 68, border: 45, reflection: true }
  },
  {
    ...baseTheme({ id: 'openfy-neon-pulse', name: 'Openfy Neon Pulse', author: 'Openfy', description: 'Roxo e azul elétrico, controles iluminados e pulso opcional.', radius: 14, density: 'comfortable', colors: { bg:'#080611',panel:'#151126',panel2:'#201b3b',hover:'#312958',line:'#40356d',text:'#f8f5ff',muted:'#b8afd4',accent:'#9d70ff',danger:'#ff6385' } }),
    neon: { enabled: true, color: '#4c9dff', intensity: 72, elements: ['progress', 'controls', 'active', 'panels'] },
    animations: { transitions: true, pulse: true, intensity: 48, reduceMotion: false }
  },
  {
    ...baseTheme({ id: 'openfy-ambient', name: 'Openfy Ambient', author: 'Openfy', description: 'Capa dinâmica, luz ambiente e transições imersivas.', radius: 16, density: 'comfortable', colors: { bg:'#080d18',panel:'#111b2b',panel2:'#192844',hover:'#253857',line:'#34445e',text:'#f5f8ff',muted:'#b3c4dc',accent:'#72b7ff',danger:'#ff7182' } }),
    background: { mode: 'album', position: 'center', fit: 'cover', blur: 28, dim: 55 },
    animations: { transitions: true, pulse: false, intensity: 60, reduceMotion: false }
  }
]
