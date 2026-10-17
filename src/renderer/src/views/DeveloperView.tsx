import { useState } from 'react'
import { YouTubeKeyPanel } from '../components/YouTubeKeyPanel'
import { describeEffect, downloadJson, permissions, readEnabled, readPlugins, sampleManifest, saveEnabled, savePlugins, validateManifest, type PluginManifest } from '../plugin-sdk'
export function DeveloperView(){
 const [plugins,setPlugins]=useState(readPlugins)
 const [draft,setDraft]=useState(JSON.stringify(sampleManifest,null,2))
 const [message,setMessage]=useState('')
 const [selected,setSelected]=useState<string|null>(null)
 const [enabled,setEnabled]=useState(readEnabled)
 const toggle=(p:PluginManifest)=>{
  const on=enabled.includes(p.id)
  if(!on){const lines=(p.effects??[]).map(describeEffect).join('\n- ');if(!window.confirm(`Ativar "${p.name}"?\n\nEfeitos:\n- ${lines}\n\nO que você tocar é responsabilidade sua. Você pode desativar quando quiser, e o Openfy volta ao padrão.`))return}
  const next=on?enabled.filter(id=>id!==p.id):[...enabled,p.id]
  saveEnabled(next);setEnabled(next);setMessage(on?`✓ ${p.name} desativado. A busca voltou ao padrão.`:`✓ ${p.name} ativado.`)
 }
 const inspect=():PluginManifest|null=>{try{const m=validateManifest(JSON.parse(draft));setMessage(`✓ Manifesto válido: ${m.name}. Nenhum código será executado.`);return m}catch(e){setMessage('Erro: '+(e instanceof Error?e.message:String(e)));return null}}
 const install=()=>{const m=inspect();if(!m)return;const previous=plugins.find(p=>p.id===m.id);if(previous&&!window.confirm(`Substituir o manifesto ${previous.name} (${previous.version}) por ${m.version}?`))return;const next=[...plugins.filter(p=>p.id!==m.id),m];savePlugins(next);setPlugins(next);setMessage(`✓ Manifesto ${m.name} importado. Nenhum código externo foi executado.`)}
 const remove=(id:string)=>{const next=plugins.filter(p=>p.id!==id);savePlugins(next);setPlugins(next);if(enabled.includes(id)){const remaining=enabled.filter(x=>x!==id);saveEnabled(remaining);setEnabled(remaining)}if(selected===id)setSelected(null)}
 const importFile=async(file?:File)=>{if(!file)return;if(file.size>64*1024){setMessage('Arquivo excede 64 KB.');return}try{setDraft(await file.text());setMessage('Arquivo carregado. Valide e revise as permissões antes de importar.')}catch{setMessage('Não foi possível ler o arquivo.')}}
 return <section className="page developer-page"><div className="theme-heading"><div><span className="eyebrow">OPENFY COMMUNITY SDK</span><h1>Developer Mode</h1><p>Crie, valide e compartilhe manifestos de extensões. Nesta fase, nenhum plugin externo executa código.</p></div></div>
 <div className="dev-layout"><div className="dev-card"><h2>Editor de manifesto</h2><p>Edite o JSON, valide e exporte para compartilhar no Discord.</p><textarea className="dev-editor" spellCheck={false} value={draft} onChange={e=>setDraft(e.target.value)} aria-label="Manifesto JSON"/><div className="dev-actions"><button onClick={inspect}>Validar</button><button onClick={()=>{const m=inspect();if(m)downloadJson(m.id+'.openfy.json',m)}}>Exportar JSON</button><button onClick={install}>Importar manifesto</button><label className="dev-file">Abrir arquivo<input type="file" accept=".json,.openfy.json,application/json" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label></div><p className="dev-feedback" role="status">{message}</p></div>
 <div className="dev-card"><h2>Manifestos importados</h2><p>Registros locais, sem execução de scripts ou acesso à rede.</p>{plugins.length===0?<p>Nenhum manifesto importado ainda.</p>:plugins.map(p=><div className="dev-plugin" key={p.id}><strong>{p.name} <small>v{p.version}</small></strong><span>{p.author} · {p.kind}{p.effects?.length?(enabled.includes(p.id)?' · ATIVO':' · desativado'):''}</span>{p.effects?.map(e=><small key={e.type}>{describeEffect(e)}</small>)}<div className="dev-actions">{p.effects?.length?<button onClick={()=>toggle(p)}>{enabled.includes(p.id)?'Desativar':'Ativar'}</button>:null}<button onClick={()=>setSelected(selected===p.id?null:p.id)}>Permissões</button><button onClick={()=>{setDraft(JSON.stringify(p,null,2));setMessage('Manifesto carregado no editor.')}}>Editar</button><button onClick={()=>remove(p.id)}>Remover</button></div>{selected===p.id&&<p>{p.permissions.length?p.permissions.join(', '):'Nenhuma permissão solicitada.'}</p>}</div>)}<h3>Permissões reconhecidas</h3><p>{permissions.join(' · ')}</p><p className="settings-tip">Plugins que pedem efeitos só funcionam se declararem a permissão correspondente e forem ativados por você. Plugins executáveis continuam fora: exigiriam sandbox e revisão de segurança.</p></div></div>
 <div className="dev-layout"><YouTubeKeyPanel /></div></section>
}
