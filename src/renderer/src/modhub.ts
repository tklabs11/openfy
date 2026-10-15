import { useSyncExternalStore } from 'react'
import { builtInThemes, themeStore, type Theme } from './themes'

export type Mod = { id: string; name: string; author: string; description: string; category: 'theme' | 'extension'; version: string; tags: string[]; theme?: Theme; feature?: 'focus' | 'compact-player' | 'reduced-motion' }
const themeMods: Mod[] = builtInThemes.map(t => ({ id:`skin-${t.id}`,name:t.name,author:t.author,description:t.description,category:'theme',version:'1.0.0',tags:['skin','oficial'],theme:t }))
export const catalog: Mod[] = [
 ...themeMods,
 {id:'focus',name:'Focus Mode',author:'Openfy',description:'Oculta o painel de reprodução lateral para dar mais espaço à biblioteca.',category:'extension',version:'1.0.0',tags:['layout','produtividade'],feature:'focus'},
 {id:'compact-player',name:'Compact Player',author:'Openfy',description:'Reduz a altura da barra de reprodução.',category:'extension',version:'1.0.0',tags:['player','layout'],feature:'compact-player'},
 {id:'reduced-motion',name:'Calm Motion',author:'Openfy',description:'Reduz animações e transições visuais.',category:'extension',version:'1.0.0',tags:['acessibilidade'],feature:'reduced-motion'}
]
const key='openfy-mods-v1'
let installed: string[] = []
try { const value: unknown=JSON.parse(localStorage.getItem(key)||'[]'); if(Array.isArray(value)) installed=value.filter((x):x is string=>typeof x==='string' && catalog.some(m=>m.id===x && m.category==='extension')) } catch { /* start clean */ }
const listeners=new Set<()=>void>()
function update(){localStorage.setItem(key,JSON.stringify(installed)); document.documentElement.classList.toggle('mod-focus',installed.includes('focus'));document.documentElement.classList.toggle('mod-compact-player',installed.includes('compact-player'));document.documentElement.classList.toggle('mod-reduced-motion',installed.includes('reduced-motion'));listeners.forEach(f=>f())}
export const modStore={subscribe:(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f)}},getSnapshot:()=>installed, toggle:(id:string)=>{const m=catalog.find(m=>m.id===id);if(!m)return;if(m.category==='theme' && m.theme){themeStore.setActive(m.theme.id);return}installed=installed.includes(id)?installed.filter(x=>x!==id):[...installed,id];update()}}
export function useMods(){return useSyncExternalStore(modStore.subscribe,modStore.getSnapshot)}
update()
