import { useEffect, useState } from 'react'

interface YouTubeStatus {
  hasKey: boolean
  lastError: string | null
}

export function YouTubeKeyPanel() {
  const [status, setStatus] = useState<YouTubeStatus>({ hasKey: false, lastError: null })
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    void window.api.youtubeStatus().then((current) => {
      if (alive) setStatus(current)
    }).catch((error: unknown) => {
      if (alive) setMessage({ text: error instanceof Error ? error.message : 'Não foi possível consultar o estado da chave.', error: true })
    })
    return () => { alive = false }
  }, [])

  const save = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await window.api.youtubeSetKey(key)
      if (result.ok) {
        setKey('')
        setStatus({ hasKey: true, lastError: null })
        setMessage({ text: 'Chave validada e salva criptografada neste computador.', error: false })
      } else {
        setMessage({ text: result.error, error: true })
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Não foi possível salvar a chave.', error: true })
    } finally {
      setBusy(false)
    }
  }

  const clear = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      await window.api.youtubeClearKey()
      setStatus({ hasKey: false, lastError: null })
      setMessage({ text: 'Chave removida deste computador.', error: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Não foi possível remover a chave.', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dev-card yt-key">
      <h2>Chave da YouTube Data API</h2>
      <p>{status.hasKey ? 'Uma chave está salva neste computador.' : 'Configure sua própria chave para habilitar buscas quando o plugin YouTube estiver ativo.'}</p>
      <p className="settings-tip">
        Crie um projeto no Google Cloud Console, ative a YouTube Data API v3 e gere uma chave restrita a essa API.
        A busca usa 100 unidades de cota por consulta; o limite padrão costuma ser 10.000 unidades por dia.
        O Openfy valida e guarda a chave criptografada pelo sistema operacional, sem exibi-la novamente.
      </p>
      {status.lastError && <p className="yt-err" role="status">Último erro da busca: {status.lastError}</p>}
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="Cole sua chave da API"
        value={key}
        onChange={(event) => setKey(event.target.value)}
      />
      <div className="dev-actions">
        <button disabled={busy || !key.trim()} onClick={() => void save()}>{busy ? 'Validando…' : 'Validar e salvar'}</button>
        {status.hasKey && <button disabled={busy} onClick={() => void clear()}>Remover chave</button>}
      </div>
      {message && <p className={message.error ? 'yt-err' : 'yt-msg'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  )
}
