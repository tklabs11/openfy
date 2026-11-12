import { useEffect, useState } from 'react'

interface YouTubeStatus {
  lastError: string | null
}

export function YouTubeSearchPanel() {
  const [status, setStatus] = useState<YouTubeStatus>({ lastError: null })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    void window.api.youtubeStatus().then((current) => {
      if (alive) setStatus(current)
    }).catch((error: unknown) => {
      if (alive) setMessage({ text: error instanceof Error ? error.message : 'Não foi possível consultar o estado da busca.', error: true })
    })
    return () => { alive = false }
  }, [])

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
      <h2>Busca do YouTube (Invidious)</h2>
      <p>Não precisa de chave. O Openfy consulta instâncias públicas do Invidious e reproduz os vídeos no player oficial incorporado.</p>
      <p className="settings-tip">
        Ative o plugin de busca do YouTube para incluir vídeos nas pesquisas. Se uma instância pública estiver fora do ar
        ou limitando acesso, o Openfy tenta outra automaticamente. O Openfy não extrai nem baixa áudio.
      </p>
      {status.lastError && <p className="yt-err" role="status">Último erro da busca: {status.lastError}</p>}
      <div className="dev-actions">
        <button disabled={busy} onClick={() => void test()}>{busy ? 'Testando…' : 'Testar busca'}</button>
      </div>
      {message && <p className={message.error ? 'yt-err' : 'yt-msg'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  )
}
