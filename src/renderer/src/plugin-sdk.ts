/** Openfy declarative plugin manifests. No remote code execution. */
export type PluginManifest = {schemaVersion:1;id:string;name:string;version:string;author:string;description:string;kind:'integration'|'visualizer'|'utility';permissions:string[];homepage?:string}
const KEY='openfy-community-manifests-v1'
const allowedPermissions=['library.read','player.read','theme.read'] as const
export const permissions=allowedPermissions
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
 let homepage: string|undefined
 if(m.homepage!==undefined){const value=str('homepage',500);try{const url=new URL(value);if(url.protocol!=='https:')throw Error();homepage=url.toString()}catch{throw Error('Homepage deve ser uma URL HTTPS válida.')}}
 return {schemaVersion:1,id,name:str('name',80),version,author:str('author',80),description:str('description',500),kind:kind as PluginManifest['kind'],permissions:[...m.permissions],...(homepage?{homepage}:{})}
}
export function readPlugins():PluginManifest[]{try{const raw=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(raw))return [];return raw.slice(0,100).flatMap(item=>{try{return [validateManifest(item)]}catch{return []}})}catch{return []}}
export function savePlugins(plugins:PluginManifest[]):void{localStorage.setItem(KEY,JSON.stringify(plugins))}
export function downloadJson(name:string,data:unknown):void{const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export const sampleManifest:PluginManifest={schemaVersion:1,id:'community.example-plugin',name:'Meu primeiro plugin',version:'1.0.0',author:'Comunidade Openfy',description:'Exemplo de manifesto declarativo para compartilhar com a comunidade.',kind:'utility',permissions:['player.read']}
