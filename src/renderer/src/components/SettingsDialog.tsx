import { useState } from 'react'
import { useEffect } from 'react'
import { usePlayer } from '../player'
import { Icon } from './Icon'
import { clearTaste, setTasteEnabled, tasteEnabled } from '../taste'
import type { View } from './Sidebar'

interface Props {open:boolean;onClose:()=>void;onNavigate:(view:View)=>void;showNow:boolean;onToggleNow:()=>void}
export function SettingsDialog({open,onClose,onNavigate,showNow,onToggleNow}:Props) {
  const [desktopPrefs, setDesktopPrefs] = useState({ minimizeToTray: false, notifications: false })
  const fadeSeconds = usePlayer(s => s.fadeSeconds)
  useEffect(() => { if (open) void window.api.desktopGetPreferences().then(setDesktopPrefs) }, [open])
  const updateDesktop = (key: 'minimizeToTray'|'notifications', value: boolean): void => {
    const next = { ...desktopPrefs, [key]: value }
    setDesktopPrefs(next)
    void window.api.desktopSetPreferences(next)
  }
  const [personalization,setPersonalization] = useState(tasteEnabled())
  const [tab,setTab] = useState<'geral'|'audio'|'aparencia'|'mods'|'developer'|'privacidade'|'desktop'>('geral')
  if (!open) return null
  return <div className="settings-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Configurações do Openfy">
      <header className="settings-heading"><div><small>PREFERÊNCIAS</small><h2>Configurações</h2></div><button className="topbar-icon" aria-label="Fechar" onClick={onClose}><Icon name="close"/></button></header>
      <div className="settings-body"><nav className="settings-tabs">{([['geral','Geral'],['audio','Áudio'],['aparencia','Aparência'],['mods','Mods e extensões'],['developer','Desenvolvedor'],['desktop','Desktop'],['privacidade','Privacidade']] as const).map(([id,name])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{name}</button>)}</nav>
      <div className="settings-content">
        {tab==='geral'&&<><h3>Interface</h3><label className="settings-setting"><div><strong>Painel da música atual</strong><p>Exibir a capa e informações à direita. Você também pode alternar pelo ícone no topo.</p></div><input type="checkbox" checked={showNow} onChange={onToggleNow}/></label><p className="settings-tip">Suas preferências visuais são salvas neste dispositivo.</p></>}
        {tab==='privacidade'&&<><h3>Seu gosto é seu</h3><p className="privacy-motto">“Seu gosto musical pertence a você. O Openfy apenas aprende com ele, no seu dispositivo.”</p>
          <label className="settings-setting"><div><strong>Personalizar minha página inicial</strong><p>Aprendizado local baseado no histórico de músicas reproduzidas e concluídas. Não exige conta.</p></div><input type="checkbox" checked={personalization} onChange={e=>{setPersonalization(e.target.checked);setTasteEnabled(e.target.checked)}}/></label>
          <button className="settings-action" onClick={()=>{if(window.confirm('Apagar todo o histórico de preferências musicais salvo neste dispositivo?')) clearTaste()}}>Apagar histórico de preferências</button>
          <p className="settings-tip">Desativar a personalização impede novos registros. Apagar o histórico elimina os registros anteriores.</p></>}
        {tab==='desktop' && <><h3>Integração com Windows</h3>
          <label className="settings-setting"><div><strong>Minimizar para a bandeja</strong><p>Ao minimizar ou fechar a janela, manter o Openfy na área de notificação. Use o menu do ícone para sair completamente.</p></div><input type="checkbox" checked={desktopPrefs.minimizeToTray} onChange={e => updateDesktop('minimizeToTray', e.target.checked)}/></label>
          <label className="settings-setting"><div><strong>Notificações de músicas</strong><p>Mostrar uma notificação ao começar uma faixa diferente.</p></div><input type="checkbox" checked={desktopPrefs.notifications} onChange={e => updateDesktop('notifications', e.target.checked)}/></label>
          <p className="settings-tip">Controles na prévia da barra de tarefas estão disponíveis no Windows.</p>
        </>}
        {tab==='audio' &&<><h3>Reprodução e áudio</h3><p>Personalize as frequências, presets e visualizador no Audio Studio.</p>
          <label className="settings-setting"><div><strong>Fade ao trocar, pausar ou retomar</strong><p>Transição suave de volume. Não é crossfade de duas faixas simultâneas. 0 desativa.</p></div><select value={fadeSeconds} onChange={e=>usePlayer.getState().setFadeSeconds(Number(e.target.value))}>{[0,0.5,1,2,3,4,6].map(v=><option key={v} value={v}>{v === 0 ? 'Desativado' : `${v} s`}</option>)}</select></label><button className="settings-action" onClick={()=>onNavigate({type:'studio'})}>Abrir Audio Studio →</button><p className="settings-tip">Faixas online com restrições CORS continuam usando reprodução direta para evitar silêncio. O processamento depende da autorização da fonte.</p></>}
        {tab==='aparencia'&&<><h3>Seu Openfy, seu estilo</h3><p>Altere skins, cores e detalhes de aparência sem interromper a reprodução.</p><button className="settings-action" onClick={()=>onNavigate({type:'themes'})}>Personalizar temas →</button></>}
        {tab==='developer'&&<><h3>Developer Mode</h3><p>Crie e valide manifestos de plugins, com exportação e importação de arquivos JSON. Sem execução de código externo.</p><button className="settings-action" onClick={()=>onNavigate({type:'developer'})}>Abrir Developer Mode →</button></>}
        {tab==='mods'&&<><h3>Mod Hub</h3><p>Gerencie temas e extensões instaladas em um só lugar.</p><button className="settings-action" onClick={()=>onNavigate({type:'modhub'})}>Abrir Mod Hub →</button></>}
      </div></div>
    </section>
  </div>
}
