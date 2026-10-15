import { useSyncExternalStore } from 'react'

export type Theme = { id: string; name: string; author: string; description: string; colors: Record<string, string>; radius: number; density: 'comfortable' | 'compact' }
const keys = ['bg', 'panel', 'panel2', 'hover', 'line', 'text', 'muted', 'accent', 'danger']
export const builtInThemes: Theme[] = [
  { id: 'midnight', name: 'Midnight Blue', author: 'Openfy', description: 'Azul elétrico, grafite e profundidade.', radius: 12, density: 'comfortable', colors: { bg:'#070a12',panel:'#111827',panel2:'#192438',hover:'#25344c',line:'#2b3950',text:'#f5f8ff',muted:'#a3b4cc',accent:'#4d8dff',danger:'#ff6578' } },
  { id: 'forest', name: 'Forest Pulse', author: 'Openfy', description: 'Verde suave com tons de floresta.', radius: 14, density: 'comfortable', colors: { bg:'#07100e',panel:'#11201b',panel2:'#1b3027',hover:'#274437',line:'#335042',text:'#f0fff5',muted:'#a4c4b4',accent:'#55dfa0',danger:'#ff7c89' } },
  { id: 'violet', name: 'Neon Violet', author: 'Openfy', description: 'Roxo vibrante com detalhes luminosos.', radius: 16, density: 'comfortable', colors: { bg:'#0d0915',panel:'#1a1326',panel2:'#2a1c3b',hover:'#3c2b53',line:'#4b3862',text:'#fff7ff',muted:'#bdaacb',accent:'#b67aff',danger:'#ff7193' } },
  { id: 'ember', name: 'Amber Studio', author: 'Openfy', description: 'Laranja quente e visual minimalista.', radius: 9, density: 'compact', colors: { bg:'#100d0b',panel:'#211a16',panel2:'#30251e',hover:'#423126',line:'#59402f',text:'#fff8f0',muted:'#c6ae9a',accent:'#ffb454',danger:'#ff6b6b' } }
]
const storageKey = 'openfy-themes-v1'
type ThemeState = { active: string; custom: Theme[] }
function load(): ThemeState { try { const v = JSON.parse(localStorage.getItem(storageKey) || '{}'); return { active: typeof v.active === 'string' ? v.active : 'midnight', custom: Array.isArray(v.custom) ? v.custom.filter(validTheme) : [] } } catch { return { active:'midnight', custom:[] } } }
let state: ThemeState = load()
const listeners = new Set<() => void>()
function emit() { localStorage.setItem(storageKey, JSON.stringify(state)); applyTheme(); listeners.forEach(fn => fn()) }
function validTheme(v: unknown): v is Theme { if (!v || typeof v !== 'object') return false; const t = v as Theme; return typeof t.id === 'string' && typeof t.name === 'string' && typeof t.author === 'string' && typeof t.description === 'string' && typeof t.radius === 'number' && (t.density === 'comfortable' || t.density === 'compact') && !!t.colors && keys.every(k => typeof t.colors[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(t.colors[k])) }
export function applyTheme() { const theme = [...builtInThemes, ...state.custom].find(t => t.id === state.active) || builtInThemes[0]; for (const k of keys) document.documentElement.style.setProperty(`--${k}`, theme.colors[k]); document.documentElement.style.setProperty('--radius', `${theme.radius}px`); document.documentElement.dataset.density = theme.density }
export const themeStore = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  getSnapshot: () => state,
  setActive: (active: string) => { state = { ...state, active }; emit() },
  save: (theme: Theme) => { if (!validTheme(theme)) throw new Error('Tema inválido'); state = { active:theme.id, custom:[...state.custom.filter(t => t.id !== theme.id), theme] }; emit() },
  remove: (id: string) => { state = { active: state.active === id ? 'midnight' : state.active, custom:state.custom.filter(t => t.id !== id) }; emit() },
  importTheme: (raw: string) => { const parsed: unknown = JSON.parse(raw); if (!validTheme(parsed)) throw new Error('Arquivo de tema inválido'); const theme = { ...parsed, id:`community-${Date.now()}`, name:parsed.name.slice(0,60), author:parsed.author.slice(0,60), description:parsed.description.slice(0,180), radius:Math.max(4,Math.min(24,parsed.radius)) }; themeStore.save(theme) }
}
export function useThemes() { return useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot) }
applyTheme()
