import { useEffect, useState } from 'react'
import { PLUGINS_CHANGED, YOUTUBE_BUILTIN, readEnabled, readPlugins, saveEnabled, savePlugins, youtubeSearchEnabled } from '../plugin-sdk'

interface YouTubeStatus {
  lastError: string | null
}

export function YouTubeSearchPanel() {
  const [status, setStatus] = useState<YouTubeStatus>({ lastError: null })
  const [active, setActive] = useState(() => youtubeSearchEnabled(readPlugins(), readEnabled()))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    const sync = (): void => { if (alive) setActive(youtubeSearchEnabled(readPlugins(), readEnabled())) }
    window.addEventListener(PLUGINS_CHANGED, sync)
    void window.api.youtubeStatus().then((current) => {
      if (alive) setStatus(current)
    }).catch((error: unknown) => {
      if (alive) setMessage({ text: error instanceof Error ? error.message : 'Não foi possível consultar o estado da busca.', error: true })
    })
    return () => { alive = false; window.removeEventListener(PLUGINS_CHANGED, sync) }
  }, [])

  const toggle = (): void => {
    setMessage(null)
    const plugins = readPlugins()
    const enabled = readEnabled()
    if (active) {
      setActive(false)
      saveEnabled(enabled.filter((id) => !plugins.some((p) => p.id === id && (p.effects ?? []).some((e) => e.type === 'source.youtube'))))
      setMessage({ text: 'Busca do YouTube desativada.', error: false })
      return
    }
    if (!plugins.some((p) => p.id === YOUTUBE_BUILTIN.id)) savePlugins([...plugins, YOUTUBE_BUILTIN])
    setActive(true)
    saveEnabled([...new Set([...enabled, YOUTUBE_BUILTIN.id])])
    setMessage({ text: 'Busca do YouTube ativada. Ela vale para as próximas pesquisas.', error: false })
  }

  const test = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await window.api.youtubeTest()
      setStatus({ lastError: result.ok ? null : result.message })
      setMessage({ text: result.message, error: !result.ok })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Não foi possível testar a busca.', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dev-card yt-key">
      <h2>Busca do YouTube</h2>
      <p>{active
        ? 'Ativada: as pesquisas também trazem vídeos do YouTube.'
        : 'Desativada: as pesquisas trazem apenas o Internet Archive.'}</p>
      <p className="settings-tip">
        Sem chave de API: o Openfy consulta instâncias públicas do Invidious e tenta outra quando uma está fora do ar
        ou limitando acesso. Os vídeos tocam no player oficial incorporado; o Openfy não extrai nem baixa áudio.
      </p>
      {status.lastError && <p className="yt-err" role="status">Último erro da busca: {status.lastError}</p>}
      <div className="dev-actions">
        <button onClick={toggle}>{active ? 'Desativar busca do YouTube' : 'Ativar busca do YouTube'}</button>
        <button disabled={busy} onClick={() => void test()}>{busy ? 'Testando…' : 'Testar busca'}</button>
      </div>
      {message && <p className={message.error ? 'yt-err' : 'yt-msg'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  )
}
