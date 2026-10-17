/** Openfy declarative plugin manifests. No remote code execution. */
import type { SearchOptions } from '@shared/types'

export type PluginEffect =
  | { type: 'search.archive-license-filter'; value: 'open-only' | 'off' }
  | { type: 'source.youtube'; value: 'on' }
export const EFFECT_RULES = {
  'search.archive-license-filter': { permission: 'search.configure', values: ['open-only', 'off'] },
  'source.youtube': { permission: 'sources.youtube', values: ['on'] }
} as const
export function describeEffect(effect: PluginEffect): string {
  if (effect.type === 'source.youtube') {
    return 'Busca do YouTube usando sua própria chave da API. Vídeos reproduzidos no player oficial e sempre visíveis no painel.'
  }
  return effect.value === 'off'
    ? 'Busca do Internet Archive: sem filtro de licença (mostra também áudio com direitos reservados).'
    : 'Busca do Internet Archive: somente licenças abertas (padrão).'
}

export type PluginManifest = {schemaVersion:1;id:string;name:string;version:string;author:string;description:string;kind:'integration'|'visualizer'|'utility';permissions:string[];effects?:PluginEffect[];homepage?:string}
const KEY='openfy-community-manifests-v1'
const allowedPermissions=['library.read','player.read','theme.read','search.configure','sources.youtube'] as const
const ENABLED_KEY='openfy-community-enabled-v1'
export const permissions=allowedPermissions
export const PLUGINS_CHANGED='openfy-plugins-changed'
export function validateManifest(input:unknown):PluginManifest {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Manifesto deve ser um objeto JSON.')
 const m=input as Record<string,unknown>
 if(m.schemaVersion!==1)throw Error('schemaVersion precisa ser 1.')
 const str=(key:string,max:number)=>{const v=m[key];if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`Campo inválido: ${key}`);return v.trim()}
 const id=str('id',100);if(!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id))throw Error('ID deve usar letras minúsculas, números, pontos ou hífens.')
 const version=str('version',32);if(!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version))throw Error('Versão precisa seguir SemVer (ex.: 1.0.0).')
 const kind=m.kind;if(!['integration','visualizer','utility'].includes(String(kind)))throw Error('Tipo de plugin inválido.')
 if(!Array.isArray(m.permissions)||m.permissions.some(p=>typeof p!=='string'||!allowedPermissions.includes(p as typeof allowedPermissions[number])))throw Error('Permissões inválidas ou não suportadas.')
 if(new Set(m.permissions).size!==m.permissions.length)throw Error('Permissões duplicadas.')
 const effects:PluginEffect[]=[]
 if(m.effects!==undefined){
  if(!Array.isArray(m.effects)||m.effects.length>5)throw Error('Efeitos inválidos (máximo 5).')
  for(const raw of m.effects){
   const e=raw as Record<string,unknown>
   const rule=e&&typeof e==='object'?(EFFECT_RULES as Record<string,{permission:string;values:readonly string[]}>)[String(e.type)]:undefined
   if(!rule)throw Error('Efeito não suportado.')
   if(typeof e.value!=='string'||!rule.values.includes(e.value))throw Error('Valor inválido para o efeito '+String(e.type)+'.')
   if(!(m.permissions as string[]).includes(rule.permission))throw Error('O efeito '+String(e.type)+' exige a permissão '+rule.permission+'.')
   if(effects.some(x=>x.type===e.type))throw Error('Efeito duplicado: '+String(e.type)+'.')
   effects.push({type:e.type as PluginEffect['type'],value:e.value as PluginEffect['value']} as PluginEffect)
  }
 }
 let homepage: string|undefined
 if(m.homepage!==undefined){const value=str('homepage',500);try{const url=new URL(value);if(url.protocol!=='https:')throw Error();homepage=url.toString()}catch{throw Error('Homepage deve ser uma URL HTTPS válida.')}}
 return {schemaVersion:1,id,name:str('name',80),version,author:str('author',80),description:str('description',500),kind:kind as PluginManifest['kind'],permissions:[...m.permissions],...(effects.length?{effects}:{}),...(homepage?{homepage}:{})}
}
export function readPlugins():PluginManifest[]{try{const raw=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(raw))return [];return raw.slice(0,100).flatMap(item=>{try{return [validateManifest(item)]}catch{return []}})}catch{return []}}
export function savePlugins(plugins:PluginManifest[]):void{localStorage.setItem(KEY,JSON.stringify(plugins));notify()}
export function readEnabled():string[]{try{const raw=JSON.parse(localStorage.getItem(ENABLED_KEY)||'[]');return Array.isArray(raw)?raw.filter((x):x is string=>typeof x==='string').slice(0,100):[]}catch{return []}}
const notify=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event(PLUGINS_CHANGED))}
export function saveEnabled(ids:string[]):void{localStorage.setItem(ENABLED_KEY,JSON.stringify(ids));notify()}
export function resolveSearchOptions(plugins:PluginManifest[],enabled:string[]):SearchOptions{
 const active=plugins.filter(p=>enabled.includes(p.id))
 const relaxed=active.some(p=>p.permissions.includes('search.configure')&&(p.effects??[]).some(e=>e.type==='search.archive-license-filter'&&e.value==='off'))
 const youtube=active.some(p=>p.permissions.includes('sources.youtube')&&(p.effects??[]).some(e=>e.type==='source.youtube'))
 return {archiveOpenOnly:!relaxed,...(youtube?{youtube:true}:{})}
}
export function downloadJson(name:string,data:unknown):void{const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export const sampleManifest:PluginManifest={schemaVersion:1,id:'community.example-plugin',name:'Meu primeiro plugin',version:'1.0.0',author:'Comunidade Openfy',description:'Exemplo de manifesto declarativo para compartilhar com a comunidade.',kind:'utility',permissions:['player.read']}
