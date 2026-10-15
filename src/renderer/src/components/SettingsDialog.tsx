import { useRef, useState } from 'react'
import { useEffect } from 'react'
import { usePlayer } from '../player'
import { useLibrary } from '../library'
import { createLibraryBackup, parseLibraryBackup } from '../backup'
import { Icon } from './Icon'
import { clearTaste, setTasteEnabled, tasteEnabled } from '../taste'
import type { View } from './Sidebar'
import type { AppUpdateState, DesktopPreferences, DiscordPresenceStatus } from '@shared/types'

interface Props {open:boolean;onClose:()=>void;onNavigate:(view:View)=>void;showNow:boolean;onToggleNow:()=>void}
export function SettingsDialog({open,onClose,onNavigate,showNow,onToggleNow}:Props) {
  const [desktopPrefs, setDesktopPrefs] = useState<DesktopPreferences>({ minimizeToTray: false, notifications: false, discordPresence: false })
  const [discordStatus, setDiscordStatus] = useState<DiscordPresenceStatus>('disabled')
  const [fadeSaveError, setFadeSaveError] = useState('')
  const [updateState, setUpdateState] = useState<AppUpdateState>({ status: 'idle' })
  const [backupFeedback, setBackupFeedback] = useState<{ message: string; error?: boolean } | null>(null)
  const backupInput = useRef<HTMLInputElement>(null)
  const fadeSeconds = usePlayer(s => s.fadeSeconds)
  useEffect(() => {
    const unsubscribe = window.api.onDiscordPresenceStatus(setDiscordStatus)
    const unsubscribeUpdates = window.api.onUpdateState(setUpdateState)
    if (open) {
      void window.api.desktopGetPreferences().then((prefs) => {
        setDesktopPrefs(prefs)
        if (prefs.fadeSeconds !== undefined) usePlayer.getState().setFadeSeconds(prefs.fadeSeconds)
      }).catch((error: unknown) => {
        console.error('[Openfy] Não foi possível carregar as preferências da área de trabalho:', error)
      })
      void window.api.desktopGetDiscordPresenceStatus().then(setDiscordStatus).catch((error: unknown) => {
        console.error('[Openfy] Não foi possível consultar o estado do Discord Rich Presence:', error)
        setDiscordStatus('error')
      })
      void window.api.desktopGetUpdateState().then(setUpdateState).catch((error: unknown) => {
        console.error('[Openfy] Não foi possível consultar o estado das atualizações:', error)
        setUpdateState({ status: 'error' })
      })
    }
    return () => { unsubscribe(); unsubscribeUpdates() }
  }, [open])
  const updateDesktop = async (key: keyof DesktopPreferences, value: boolean): Promise<void> => {
    const next = { ...desktopPrefs, [key]: value }
    setDesktopPrefs(next)
    try {
      await window.api.desktopSetPreferences(next)
    } catch (error) {
      console.error('[Openfy] Não foi possível salvar as preferências da área de trabalho:', error)
      setDesktopPrefs(desktopPrefs)
      if (key === 'discordPresence') setDiscordStatus('error')
    }
  }
  const updateFadeSeconds = async (value: number): Promise<void> => {
    const previous = usePlayer.getState().fadeSeconds
    const next = { ...desktopPrefs, fadeSeconds: value }
    setFadeSaveError('')
    setDesktopPrefs(next)
    usePlayer.getState().setFadeSeconds(value)
    try {
      await window.api.desktopSetPreferences(next)
    } catch (error) {
      console.error('[Openfy] Não foi possível salvar a preferência de fade:', error)
      usePlayer.getState().setFadeSeconds(previous)
      setDesktopPrefs(desktopPrefs)
      setFadeSaveError('Não foi possível salvar o tempo do fade. A configuração anterior foi restaurada.')
    }
  }
  const checkForUpdates = async (): Promise<void> => {
    try {
      await window.api.desktopCheckForUpdates()
    } catch (error) {
      console.error('[Openfy] Não foi possível verificar atualizações:', error)
      setUpdateState({ status: 'error' })
    }
  }
  const installUpdate = async (): Promise<void> => {
    try {
      await window.api.desktopInstallUpdate()
    } catch (error) {
      console.error('[Openfy] Não foi possível reiniciar para instalar a atualização:', error)
      setUpdateState({ status: 'error' })
    }
  }
  const exportLibrary = (): void => {
    try {
      const { tracks, liked, playlists } = useLibrary.getState()
      const backup = createLibraryBackup({ tracks, liked, playlists })
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `openfy-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setBackupFeedback({ message: 'Backup exportado. As faixas locais incluem caminhos do computador.' })
    } catch (error) {
      console.error('[Openfy] Não foi possível exportar o backup da biblioteca:', error)
      setBackupFeedback({ message: 'Não foi possível exportar o backup da biblioteca.', error: true })
    }
  }
  const importLibrary = async (file?: File): Promise<void> => {
    if (!file) return
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('O arquivo excede o limite de 50 MB.')
      const backup = parseLibraryBackup(JSON.parse(await file.text()))
      if (!window.confirm('Mesclar este backup com a biblioteca atual? Os dados atuais serão preservados e itens duplicados não serão repetidos.')) return
      const result = useLibrary.getState().mergeBackup(backup)
      setBackupFeedback({
        message: `Backup mesclado: ${result.addedTracks} músicas e ${result.addedLikes} favoritos adicionados; ${result.addedPlaylists} playlists novas e ${result.updatedPlaylists} atualizadas.`
      })
    } catch (error) {
      console.error('[Openfy] Não foi possível importar o backup da biblioteca:', error)
      setBackupFeedback({
        message: error instanceof Error ? error.message : 'Não foi possível importar o backup da biblioteca.',
        error: true
      })
    } finally {
      if (backupInput.current) backupInput.current.value = ''
    }
  }
  const [personalization,setPersonalization] = useState(tasteEnabled())
  const [tab,setTab] = useState<'geral'|'audio'|'aparencia'|'mods'|'developer'|'privacidade'|'desktop'|'sobre'>('geral')
  if (!open) return null
  return <div className="settings-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Configurações do Openfy">
      <header className="settings-heading"><div><small>PREFERÊNCIAS</small><h2>Configurações</h2></div><button className="topbar-icon" aria-label="Fechar" onClick={onClose}><Icon name="close"/></button></header>
      <div className="settings-body"><nav className="settings-tabs">{([['geral','Geral'],['audio','Áudio'],['aparencia','Aparência'],['mods','Mods e extensões'],['developer','Desenvolvedor'],['desktop','Desktop'],['privacidade','Privacidade'],['sobre','Sobre']] as const).map(([id,name])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{name}</button>)}</nav>
      <div className="settings-content">
        {tab==='geral'&&<><h3>Interface</h3><label className="settings-setting"><div><strong>Painel da música atual</strong><p>Exibir a capa e informações à direita. Você também pode alternar pelo ícone no topo.</p></div><input type="checkbox" checked={showNow} onChange={onToggleNow}/></label><p className="settings-tip">Suas preferências visuais são salvas neste dispositivo.</p>
          <h3>Backup da biblioteca</h3>
          <p>Exporte ou restaure músicas salvas, favoritos e playlists. A importação mescla os dados e preserva a biblioteca existente.</p>
          <p className="settings-tip">O backup pode conter caminhos de arquivos locais e capas personalizadas. Guarde o arquivo em um local privado.</p>
          <div className="library-backup-actions">
            <button className="settings-action" onClick={exportLibrary}>Exportar backup</button>
            <button className="settings-action" onClick={() => backupInput.current?.click()}>Importar e mesclar backup</button>
            <input ref={backupInput} type="file" accept=".json,application/json" hidden onChange={(event) => { void importLibrary(event.currentTarget.files?.[0]) }} />
          </div>
          {backupFeedback && <p className={backupFeedback.error ? 'discovery-error' : 'settings-tip'} role={backupFeedback.error ? 'alert' : 'status'}>{backupFeedback.message}</p>}
        </>}
        {tab==='privacidade'&&<><h3>Seu gosto é seu</h3><p className="privacy-motto">“Seu gosto musical pertence a você. O Openfy apenas aprende com ele, no seu dispositivo.”</p>
          <label className="settings-setting"><div><strong>Personalizar minha página inicial</strong><p>Aprendizado local baseado no histórico de músicas reproduzidas e concluídas. Não exige conta.</p></div><input type="checkbox" checked={personalization} onChange={e=>{setPersonalization(e.target.checked);setTasteEnabled(e.target.checked)}}/></label>
          <button className="settings-action" onClick={()=>{if(window.confirm('Apagar todo o histórico de preferências musicais salvo neste dispositivo?')) clearTaste()}}>Apagar histórico de preferências</button>
          <p className="settings-tip">Desativar a personalização impede novos registros. Apagar o histórico elimina os registros anteriores.</p></>}
        {tab==='sobre'&&<section className="about-page" aria-label="Sobre o Openfy">
          <div className="about-brand">
            <img src="./openfy-pulse.png" alt="Logo do Openfy" />
            <div><h3>Openfy</h3><div className="about-badges"><span>v{__APP_VERSION__}</span><span>Beta</span><span>Código aberto · MIT</span></div></div>
          </div>
          <p className="about-description">Sua música, seu espaço. Um player gratuito, moderno e personalizável para desktop.</p>
          <div className="about-credits">
            <div><span>Criador</span><strong>(TK)</strong></div>
            <div><span>Desenvolvimento</span><strong>TK Labs</strong></div>
            <div><span>Assistência de IA</span><strong>ChatGPT (OpenAI)</strong></div>
            <div><span>Licença</span><strong>MIT</strong></div>
          </div>
          <p className="about-disclaimer">O Openfy é um projeto independente, gratuito e de código aberto, sem afiliação ou endosso da OpenAI.</p>
          <div className="about-links">
            <a href="https://github.com/tklabs11/openfy" target="_blank" rel="noreferrer"><Icon name="code" size={16}/>Repositório</a>
            <a href="https://github.com/tklabs11/openfy/issues" target="_blank" rel="noreferrer"><Icon name="issue" size={16}/>Reportar problemas</a>
            <a href="https://github.com/tklabs11/openfy/blob/main/LICENSE" target="_blank" rel="noreferrer"><Icon name="license" size={16}/>Licença</a>
            <a href="https://discord.gg/HWgXKfhXAW" target="_blank" rel="noreferrer"><Icon name="discord" size={16}/>Discord da TK Labs</a>
          </div>
          <footer className="about-footer">© 2026 TK Labs.</footer>
        </section>}
        {tab==='desktop' && <><h3>Integração com desktop</h3>
          <label className="settings-setting"><div><strong>Minimizar para a bandeja</strong><p>Ao minimizar ou fechar a janela, manter o Openfy na área de notificação. Use o menu do ícone para sair completamente.</p></div><input type="checkbox" checked={desktopPrefs.minimizeToTray} onChange={e => void updateDesktop('minimizeToTray', e.target.checked)}/></label>
          <label className="settings-setting"><div><strong>Notificações de músicas</strong><p>Mostrar uma notificação ao começar uma faixa diferente.</p></div><input type="checkbox" checked={desktopPrefs.notifications} onChange={e => void updateDesktop('notifications', e.target.checked)}/></label>
          <label className="settings-setting"><div><strong>Discord Rich Presence</strong><p>Mostrar no seu perfil do Discord a música que está tocando no Openfy. O Discord precisa estar aberto com o status de atividade habilitado.</p></div><input type="checkbox" checked={desktopPrefs.discordPresence} onChange={e => void updateDesktop('discordPresence', e.target.checked)}/></label>
          <p className="settings-tip" role="status">Discord: {{
            disabled: 'integração desativada',
            connecting: 'conectando…',
            connected: 'conectado',
            unavailable: 'não encontrado. Abra o aplicativo Discord para conectar.',
            error: 'o Discord recusou a conexão. Verifique a configuração da integração.'
          }[discordStatus]}</p>
          <div className="settings-update">
            <div><strong>Atualizações do Openfy</strong><p>{
              updateState.status === 'idle' ? 'Verifique se há uma versão mais recente.' :
              updateState.status === 'checking' ? 'Verificando atualizações…' :
              updateState.status === 'available' ? `Versão ${updateState.version ?? ''} encontrada. Preparando o download…` :
              updateState.status === 'downloading' ? `Baixando versão ${updateState.version ?? ''}… ${Math.round(updateState.percent ?? 0)}%` :
              updateState.status === 'downloaded' ? `Versão ${updateState.version ?? ''} pronta para instalar.` :
              updateState.status === 'not-available' ? 'O Openfy já está atualizado.' :
              updateState.status === 'unsupported' ? 'A atualização pelo app estará disponível na versão instalada para Windows.' :
              'Não foi possível verificar atualizações. Confira sua conexão e tente novamente.'
            }</p></div>
            {updateState.status === 'downloaded'
              ? <button className="settings-action" onClick={() => void installUpdate()}>Reiniciar e atualizar</button>
              : <button className="settings-action" disabled={['checking', 'available', 'downloading', 'unsupported'].includes(updateState.status)} onClick={() => void checkForUpdates()}>{updateState.status === 'error' ? 'Tentar novamente' : 'Buscar atualizações'}</button>}
          </div>
          <p className="settings-tip">Controles na prévia da barra de tarefas estão disponíveis no Windows.</p>
        </>}
        {tab==='audio' &&<><h3>Reprodução e áudio</h3><p>Personalize as frequências, presets e visualizador no Audio Studio.</p>
          <label className="settings-setting"><div><strong>Fade ao trocar, pausar ou retomar</strong><p>Transição suave de volume. Não é crossfade de duas faixas simultâneas. 0 desativa.</p></div><select className="settings-select" value={fadeSeconds} onChange={e => void updateFadeSeconds(Number(e.target.value))}>{[0,0.5,1,2,3,4,6].map(v=><option key={v} value={v}>{v === 0 ? 'Desativado' : `${v} s`}</option>)}</select></label>{fadeSaveError && <p className="discovery-error" role="alert">{fadeSaveError}</p>}<button className="settings-action" onClick={()=>onNavigate({type:'studio'})}>Abrir Audio Studio →</button><p className="settings-tip">Faixas online com restrições CORS continuam usando reprodução direta para evitar silêncio. O processamento depende da autorização da fonte.</p></>}
        {tab==='aparencia'&&<><h3>Seu Openfy, seu estilo</h3><p>Altere skins, cores e detalhes de aparência sem interromper a reprodução.</p><button className="settings-action" onClick={()=>onNavigate({type:'themes'})}>Personalizar temas →</button></>}
        {tab==='developer'&&<><h3>Developer Mode</h3><p>Crie e valide manifestos de plugins, com exportação e importação de arquivos JSON. Sem execução de código externo.</p><button className="settings-action" onClick={()=>onNavigate({type:'developer'})}>Abrir Developer Mode →</button></>}
        {tab==='mods'&&<><h3>Mod Hub</h3><p>Gerencie temas e extensões instaladas em um só lugar.</p><button className="settings-action" onClick={()=>onNavigate({type:'modhub'})}>Abrir Mod Hub →</button></>}
      </div></div>
    </section>
  </div>
}
