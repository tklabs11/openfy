import { useRef, useState } from 'react'
import { builtInThemes, themeStore, useThemes, type Theme } from '../themes'

export function ThemesView() {
 const { active, custom } = useThemes()
 const [editing, setEditing] = useState<Theme | null>(null)
 const [message, setMessage] = useState('')
 const file = useRef<HTMLInputElement>(null)
 const themes = [...builtInThemes, ...custom]
 const startEdit = (theme: Theme) => setEditing({ ...theme, id:`custom-${Date.now()}`, name:`${theme.name} Remix`, author:'Você', colors:{...theme.colors} })
 const exportTheme = (theme: Theme) => { const blob = new Blob([JSON.stringify(theme,null,2)], {type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`openfy-${theme.id}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000) }
 return <section className="page theme-page">
  <div className="theme-heading"><div><span className="eyebrow">OPENFY CUSTOMIZE</span><h1>Seu som. Seu estilo.</h1><p>Explore skins, crie sua identidade e compartilhe temas com a comunidade.</p></div><button className="theme-primary" onClick={()=>file.current?.click()}>+ Importar tema</button></div>
  <input ref={file} type="file" accept=".json,application/json" hidden onChange={async e=>{ const f=e.target.files?.[0]; if(!f)return; try { if(f.size>25000)throw new Error('Arquivo muito grande'); themeStore.importTheme(await f.text()); setMessage('Tema importado com sucesso!') } catch(err) {setMessage(err instanceof Error?err.message:'Falha ao importar')} e.target.value='' }}/>
  {message && <p role="status" className="theme-message">{message}</p>}
  <div className="theme-section-title"><h2>Galeria de temas</h2><span>{themes.length} skins disponíveis</span></div>
  <div className="theme-grid">{themes.map(theme=><article className={'theme-card'+(active===theme.id?' selected':'')} key={theme.id}>
   <div className="theme-preview" style={{background:theme.colors.bg, color:theme.colors.text}}><div className="theme-preview-side" style={{background:theme.colors.panel}}><i style={{background:theme.colors.accent}}/><span/><span/><span/></div><div className="theme-preview-main"><div style={{background:theme.colors.panel2}}/><div className="theme-preview-albums">{[0,1,2].map(i=><i key={i} style={{background:i===0?theme.colors.accent:theme.colors.hover}}/>)}</div><div style={{background:theme.colors.panel2}}/></div></div>
   <div className="theme-card-content"><strong>{theme.name}</strong><small>por {theme.author}</small><p>{theme.description}</p><div className="theme-swatches">{['accent','panel','text'].map(k=><i key={k} style={{background:theme.colors[k]}} />)}</div>
   <div className="theme-actions"><button className="theme-primary" onClick={()=>themeStore.setActive(theme.id)}>{active===theme.id?'✓ Em uso':'Aplicar'}</button><button onClick={()=>startEdit(theme)}>Editar</button><button onClick={()=>exportTheme(theme)}>Exportar</button>{custom.some(t=>t.id===theme.id)&&<button onClick={()=>themeStore.remove(theme.id)}>Excluir</button>}</div></div>
  </article>)}</div>
  {editing && <div className="theme-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}><div className="theme-modal"><h2>Editor de tema</h2><label>Nome do tema<input value={editing.name} maxLength={60} onChange={e=>setEditing({...editing,name:e.target.value})}/></label><div className="theme-colors">{Object.entries(editing.colors).map(([key,value])=><label key={key}>{key}<input type="color" value={value} onChange={e=>setEditing({...editing,colors:{...editing.colors,[key]:e.target.value}})}/></label>)}</div><label>Arredondamento: {editing.radius}px<input type="range" min="4" max="24" value={editing.radius} onChange={e=>setEditing({...editing,radius:Number(e.target.value)})}/></label><label>Densidade<select value={editing.density} onChange={e=>setEditing({...editing,density:e.target.value as Theme['density']})}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label><div className="theme-actions"><button onClick={()=>setEditing(null)}>Cancelar</button><button className="theme-primary" onClick={()=>{themeStore.save(editing);setEditing(null)}}>Salvar e aplicar</button></div></div></div>}
 </section>
}
