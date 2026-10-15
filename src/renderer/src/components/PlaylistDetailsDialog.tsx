import { useEffect, useRef, useState } from 'react'
import type { Playlist } from '@shared/types'
import { Icon } from './Icon'

export interface PlaylistDetails {
  name: string
  description: string
  cover?: string
}

interface Props {
  open: boolean
  playlist?: Playlist
  onClose: () => void
  onSave: (details: PlaylistDetails) => void
}

const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const MAX_COVER_DIMENSION = 640

export function PlaylistDetailsDialog({ open, playlist, onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cover, setCover] = useState<string | undefined>()
  const [imageError, setImageError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(playlist?.name ?? 'Minha playlist')
    setDescription(playlist?.description ?? '')
    setCover(playlist?.cover)
    setImageError('')
  }, [open, playlist?.id])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open, onClose])

  if (!open) return null

  const chooseCover = async (file?: File): Promise<void> => {
    if (!file) return
    setImageError('')
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'].includes(file.type)) {
      setImageError('Escolha uma imagem PNG, JPEG, WebP, GIF ou BMP.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('A imagem deve ter no máximo 8 MB.')
      return
    }

    let bitmap: ImageBitmap | undefined
    try {
      bitmap = await createImageBitmap(file)
      const scale = Math.min(1, MAX_COVER_DIMENSION / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Não foi possível preparar a imagem.')
      context.fillStyle = '#121212'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      setCover(canvas.toDataURL('image/jpeg', 0.86))
    } catch {
      setImageError('Não foi possível abrir essa imagem. Tente outro arquivo.')
    } finally {
      bitmap?.close()
    }
  }

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    onSave({ name: cleanName, description: description.trim(), cover })
  }

  return (
    <div className="playlist-dialog-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="playlist-dialog" role="dialog" aria-modal="true" aria-labelledby="playlist-dialog-title">
        <header className="playlist-dialog-header">
          <h2 id="playlist-dialog-title">{playlist ? 'Editar detalhes' : 'Criar playlist'}</h2>
          <button type="button" className="topbar-icon" aria-label="Fechar" onClick={onClose}><Icon name="close" /></button>
        </header>
        <form onSubmit={submit}>
          <div className="playlist-dialog-fields">
            <button
              type="button"
              className={'playlist-cover-picker' + (cover ? ' has-cover' : '')}
              onClick={() => fileInput.current?.click()}
              style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
              aria-label={cover ? 'Trocar imagem da playlist' : 'Escolher imagem da playlist'}
            >
              {!cover && <><Icon name="music" size={54} /><span><Icon name="image" size={16} /> Escolher imagem</span></>}
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                onChange={(event) => { void chooseCover(event.target.files?.[0]); event.target.value = '' }}
                hidden
              />
            </button>
            <div className="playlist-dialog-inputs">
              <input
                autoFocus
                aria-label="Nome da playlist"
                maxLength={100}
                placeholder="Nome da playlist"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <textarea
                aria-label="Descrição da playlist"
                maxLength={300}
                placeholder="Adicione uma descrição (opcional)"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          {cover && <button type="button" className="playlist-remove-cover" onClick={() => setCover(undefined)}>Remover imagem</button>}
          {imageError && <p className="playlist-image-error" role="alert">{imageError}</p>}
          <p className="playlist-image-note">A imagem é salva somente neste dispositivo. Use uma imagem que você tenha direito de usar.</p>
          <footer className="playlist-dialog-actions">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="playlist-save" disabled={!name.trim()}>Salvar</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
