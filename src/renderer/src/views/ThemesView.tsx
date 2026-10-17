import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { builtInThemes, themeEffects, themeStore, useThemes, type Theme, type ThemeNeonElement } from '../themes'
import { currentTrack, usePlayer } from '../player'

const neonElements: { id: ThemeNeonElement; label: string }[] = [
  { id: 'progress', label: 'Barra de progresso' },
  { id: 'controls', label: 'Controles do player' },
  { id: 'panels', label: 'Bordas dos painéis' },
  { id: 'active', label: 'Botões ativos' }
]

function RangeControl({ label, value, min, max, unit = '', onChange }: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  onChange(value: number): void
}) {
  return (
    <label className="theme-range">
      <span>{label}<strong>{value}{unit}</strong></span>
      <input type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} />
    </label>
  )
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="theme-editor-section"><h3>{title}</h3>{children}</section>
}

export function ThemesView() {
  const { active, custom, advancedEffectsEnabled, lightweightMode } = useThemes()
  const currentTrackForPreview = usePlayer(currentTrack)
  const [editing, setEditing] = useState<Theme | null>(null)
  const [saveTargetId, setSaveTargetId] = useState('')
  const [message, setMessage] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const themes = [...builtInThemes, ...custom]

  useEffect(() => {
    if (!editing) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        themeStore.setPreview(null)
        setSaveTargetId('')
        setEditing(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [Boolean(editing)])

  const updateEditing = (update: (theme: Theme) => Theme): void => {
    if (!editing) return
    const next = update(editing)
    setEditing(next)
  }
  const startEdit = (theme: Theme, duplicate = false): void => {
    const isCustom = custom.some(item => item.id === theme.id)
    const effects = themeEffects(theme)
    const next: Theme = {
      ...theme,
      id: isCustom && !duplicate ? theme.id : `custom-${crypto.randomUUID()}`,
      name: duplicate || !isCustom ? `${theme.name} Remix`.slice(0, 60) : theme.name,
      author: isCustom && !duplicate ? theme.author : 'Você',
      colors: { ...theme.colors },
      glass: { ...effects.glass },
      neon: { ...effects.neon, elements: [...effects.neon.elements] },
      background: { ...effects.background },
      animations: { ...effects.animations }
    }
    setSaveTargetId(isCustom && !duplicate ? theme.id : '')
    setEditing(next)
  }
  const closeEditor = (): void => {
    themeStore.setPreview(null)
    setSaveTargetId('')
    setEditing(null)
  }
  const exportTheme = (theme: Theme): void => {
    const exported: Theme = { ...theme, colors: { ...theme.colors } }
    if (exported.background?.mode === 'custom') {
      exported.background = { ...exported.background, mode: 'solid', image: undefined }
    }
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `openfy-${theme.id}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage(theme.background?.mode === 'custom'
      ? 'Tema exportado. A imagem de fundo local não é incluída no arquivo.'
      : 'Tema exportado com sucesso.')
  }
  const importTheme = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selected = event.target.files?.[0]
    if (!selected) return
    try {
      if (selected.size > 25_000) throw new Error('Arquivo de tema muito grande.')
      themeStore.importTheme(await selected.text())
      setMessage('Tema importado e aplicado com sucesso.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar o tema.')
    } finally {
      event.target.value = ''
    }
  }
  const chooseBackground = async (): Promise<void> => {
    try {
      const image = await window.api.pickThemeBackground()
      if (!image) return
      updateEditing(theme => ({ ...theme, background: { ...themeEffects(theme).background, mode: 'custom', image } }))
      setMessage('Imagem de fundo adicionada.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a imagem de fundo.')
    }
  }
  const saveEditing = (): void => {
    if (!editing) return
    try {
      themeStore.save(saveTargetId ? { ...editing, id: saveTargetId } : editing)
      setEditing(null)
      setSaveTargetId('')
      setMessage(saveTargetId ? 'Tema atualizado e aplicado.' : 'Novo tema salvo e aplicado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o tema.')
    }
  }

  return (
    <section className="page theme-page">
      <div className="theme-heading">
        <div><span className="eyebrow">OPENFY CUSTOMIZE</span><h1>Seu som. Seu estilo.</h1><p>Combine cores, vidro, iluminação, fundos e movimento.</p></div>
        <button className="theme-primary" onClick={() => file.current?.click()}>+ Importar tema</button>
      </div>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={event => void importTheme(event)} />
      <div className="theme-global-settings">
        <label><input type="checkbox" checked={advancedEffectsEnabled} onChange={event => themeStore.setAdvancedEffectsEnabled(event.target.checked)} /><span><strong>Efeitos visuais avançados</strong><small>Desative para desligar vidro, neon e fundos dinâmicos.</small></span></label>
        <label><input type="checkbox" checked={lightweightMode} onChange={event => themeStore.setLightweightMode(event.target.checked)} /><span><strong>Modo leve</strong><small>Reduz filtros e animações para computadores modestos.</small></span></label>
      </div>
      {message && <p role="status" className="theme-message">{message}</p>}
      <div className="theme-section-title"><h2>Galeria de temas</h2><span>{themes.length} temas disponíveis</span></div>
      <div className="theme-grid">
        {themes.map(theme => (
          <article className={'theme-card' + (active === theme.id ? ' selected' : '')} key={theme.id}>
            <div className="theme-preview" style={{ background: theme.colors.bg, color: theme.colors.text }}>
              <div className="theme-preview-side" style={{ background: theme.colors.panel }}><i style={{ background: theme.colors.accent }} /><span /><span /><span /></div>
              <div className="theme-preview-main"><div style={{ background: theme.colors.panel2 }} /><div className="theme-preview-albums">{[0, 1, 2].map(index => <i key={index} style={{ background: index === 0 ? theme.colors.accent : theme.colors.hover }} />)}</div><div style={{ background: theme.colors.panel2 }} /></div>
              {theme.glass?.enabled && <span className="theme-preview-badge">GLASS</span>}
              {theme.neon?.enabled && <span className="theme-preview-badge neon">NEON</span>}
            </div>
            <div className="theme-card-content">
              <strong>{theme.name}</strong><small>por {theme.author}</small><p>{theme.description}</p>
              <div className="theme-swatches">{['accent', 'panel', 'text'].map(key => <i key={key} style={{ background: theme.colors[key] }} />)}</div>
              <div className="theme-actions">
                <button className="theme-primary" onClick={() => themeStore.setActive(theme.id)}>{active === theme.id ? '✓ Em uso' : 'Aplicar'}</button>
                <button onClick={() => startEdit(theme)}>Editar</button>
                <button onClick={() => startEdit(theme, true)}>Duplicar</button>
                <button onClick={() => exportTheme(theme)}>Exportar</button>
                {custom.some(item => item.id === theme.id) && <button onClick={() => themeStore.remove(theme.id)}>Excluir</button>}
              </div>
            </div>
          </article>
        ))}
      </div>
      {editing && createPortal((
        <div className="theme-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor() }}>
          <div className="theme-modal theme-editor" role="dialog" aria-modal="true" aria-labelledby="theme-editor-title">
            <div className="theme-editor-heading"><div><span className="eyebrow">THEME ENGINE 2.0</span><h2 id="theme-editor-title">Editor de tema</h2></div><button className="icon-btn" aria-label="Fechar editor" onClick={closeEditor}>×</button></div>
            <div className="theme-editor-preview" style={{ background: editing.colors.bg, borderColor: editing.colors.accent, borderRadius: editing.radius, ['--theme-preview-dim' as string]: String((editing.background?.dim ?? 48) / 100) }}>
              {editing.background?.mode === 'custom' && editing.background.image && <img className="theme-editor-preview-background" src={editing.background.image} alt="" />}
              {editing.background?.mode === 'album' && currentTrackForPreview?.cover && <img className="theme-editor-preview-background" src={currentTrackForPreview.cover} alt="" />}
              <div className="theme-editor-preview-panel" style={{
                background: `color-mix(in srgb,${editing.colors.panel} ${editing.glass?.enabled ? editing.glass.opacity : 100}%,transparent)`,
                borderColor: editing.neon?.enabled && editing.neon.elements.includes('panels') ? editing.neon.color : editing.colors.line,
                borderRadius: Math.max(4, editing.radius * 0.8),
                backdropFilter: editing.glass?.enabled ? `blur(${editing.glass.blur}px)` : 'none',
                boxShadow: editing.neon?.enabled && editing.neon.elements.includes('panels') ? `0 0 ${Math.round(editing.neon.intensity * 0.32)}px ${editing.neon.color}` : editing.glass?.reflection ? 'inset 0 1px #ffffff30,0 12px 32px #0005' : 'none'
              }}>
                <span style={{ color: editing.colors.muted }}>PRÉVIA EM TEMPO REAL</span><strong style={{ color: editing.colors.text }}>{editing.name || 'Seu tema'}</strong>
                <div className="theme-editor-preview-row"><i style={{ background: editing.colors.accent }} /><i style={{ background: editing.colors.panel2 }} /><i style={{ background: editing.colors.hover }} /></div>
                <div className="theme-editor-preview-progress"><i style={{ background: editing.neon?.enabled && editing.neon.elements.includes('progress') ? editing.neon.color : editing.colors.accent, boxShadow: editing.neon?.enabled && editing.neon.elements.includes('progress') ? `0 0 ${Math.round(editing.neon.intensity * 0.3)}px ${editing.neon.color}` : 'none' }} /></div>
              </div>
            </div>
            <EditorSection title="Identidade">
              <div className="theme-editor-fields">
                <label>Nome<input value={editing.name} maxLength={60} onChange={event => updateEditing(theme => ({ ...theme, name: event.target.value }))} /></label>
                <label>Autor<input value={editing.author} maxLength={60} onChange={event => updateEditing(theme => ({ ...theme, author: event.target.value }))} /></label>
                <label className="wide">Descrição<input value={editing.description} maxLength={180} onChange={event => updateEditing(theme => ({ ...theme, description: event.target.value }))} /></label>
              </div>
              <div className="theme-colors">{Object.entries(editing.colors).map(([key, value]) => <label key={key}>{key}<input aria-label={`Cor ${key}`} type="color" value={value} onChange={event => updateEditing(theme => ({ ...theme, colors: { ...theme.colors, [key]: event.target.value } }))} /></label>)}</div>
              <div className="theme-editor-fields">
                <RangeControl label="Arredondamento" value={editing.radius} min={4} max={24} unit=" px" onChange={radius => updateEditing(theme => ({ ...theme, radius }))} />
                <label>Densidade<select value={editing.density} onChange={event => updateEditing(theme => ({ ...theme, density: event.target.value as Theme['density'] }))}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>
              </div>
            </EditorSection>
            <EditorSection title="Vidro">
              <label className="theme-toggle"><input type="checkbox" checked={editing.glass?.enabled ?? false} onChange={event => updateEditing(theme => ({ ...theme, glass: { ...themeEffects(theme).glass, enabled: event.target.checked } }))} />Ativar painéis de vidro</label>
              <div className="theme-editor-fields">
                <RangeControl label="Desfoque" value={editing.glass?.blur ?? 18} min={0} max={40} unit=" px" onChange={blur => updateEditing(theme => ({ ...theme, glass: { ...themeEffects(theme).glass, blur } }))} />
                <RangeControl label="Transparência" value={editing.glass?.opacity ?? 76} min={0} max={100} unit="%" onChange={opacity => updateEditing(theme => ({ ...theme, glass: { ...themeEffects(theme).glass, opacity } }))} />
                <RangeControl label="Intensidade das bordas" value={editing.glass?.border ?? 30} min={0} max={100} unit="%" onChange={border => updateEditing(theme => ({ ...theme, glass: { ...themeEffects(theme).glass, border } }))} />
              </div>
              <label className="theme-toggle"><input type="checkbox" checked={editing.glass?.reflection ?? false} onChange={event => updateEditing(theme => ({ ...theme, glass: { ...themeEffects(theme).glass, reflection: event.target.checked } }))} />Reflexos suaves</label>
            </EditorSection>
            <EditorSection title="Neon">
              <label className="theme-toggle"><input type="checkbox" checked={editing.neon?.enabled ?? false} onChange={event => updateEditing(theme => ({ ...theme, neon: { ...themeEffects(theme).neon, enabled: event.target.checked } }))} />Ativar iluminação neon</label>
              <div className="theme-editor-fields">
                <label>Cor do brilho<input type="color" value={editing.neon?.color ?? editing.colors.accent} onChange={event => updateEditing(theme => ({ ...theme, neon: { ...themeEffects(theme).neon, color: event.target.value } }))} /></label>
                <RangeControl label="Intensidade" value={editing.neon?.intensity ?? 55} min={0} max={100} unit="%" onChange={intensity => updateEditing(theme => ({ ...theme, neon: { ...themeEffects(theme).neon, intensity } }))} />
              </div>
              <div className="theme-option-grid">{neonElements.map(element => <label className="theme-toggle" key={element.id}><input type="checkbox" checked={editing.neon?.elements.includes(element.id) ?? false} onChange={event => updateEditing(theme => {
                const elements = new Set(themeEffects(theme).neon.elements)
                if (event.target.checked) elements.add(element.id)
                else elements.delete(element.id)
                return { ...theme, neon: { ...themeEffects(theme).neon, elements: [...elements] } }
              })} />{element.label}</label>)}</div>
            </EditorSection>
            <EditorSection title="Plano de fundo">
              <label>Modo<select value={editing.background?.mode ?? 'solid'} onChange={event => updateEditing(theme => ({ ...theme, background: { ...themeEffects(theme).background, mode: event.target.value as NonNullable<Theme['background']>['mode'] } }))}><option value="solid">Cor sólida do tema</option><option value="custom">Imagem personalizada</option><option value="album">Capa da música atual</option></select></label>
              {editing.background?.mode === 'custom' && <div className="theme-background-picker">
                {editing.background.image ? <img src={editing.background.image} alt="Prévia do fundo personalizado" /> : <span>Escolha uma imagem PNG, JPEG ou WebP (até 12 MB).</span>}
                <button type="button" onClick={() => void chooseBackground()}>Escolher imagem</button>
                {editing.background.image && <button type="button" onClick={() => updateEditing(theme => ({ ...theme, background: { ...themeEffects(theme).background, mode: 'solid', image: undefined } }))}>Remover imagem</button>}
              </div>}
              <div className="theme-editor-fields">
                <label>Posição<select value={editing.background?.position ?? 'center'} onChange={event => updateEditing(theme => ({ ...theme, background: { ...themeEffects(theme).background, position: event.target.value as 'center' | 'top' | 'bottom' } }))}><option value="center">Centro</option><option value="top">Topo</option><option value="bottom">Base</option></select></label>
                <label>Preenchimento<select value={editing.background?.fit ?? 'cover'} onChange={event => updateEditing(theme => ({ ...theme, background: { ...themeEffects(theme).background, fit: event.target.value as 'cover' | 'contain' } }))}><option value="cover">Preencher</option><option value="contain">Conter</option></select></label>
                <RangeControl label="Desfoque do fundo" value={editing.background?.blur ?? 18} min={0} max={40} unit=" px" onChange={blur => updateEditing(theme => ({ ...theme, background: { ...themeEffects(theme).background, blur } }))} />
                <RangeControl label="Escurecimento" value={editing.background?.dim ?? 48} min={0} max={85} unit="%" onChange={dim => updateEditing(theme => ({ ...theme, background: { ...themeEffects(theme).background, dim } }))} />
              </div>
            </EditorSection>
            <EditorSection title="Animações">
              <label className="theme-toggle"><input type="checkbox" checked={editing.animations?.transitions ?? true} onChange={event => updateEditing(theme => ({ ...theme, animations: { ...themeEffects(theme).animations, transitions: event.target.checked } }))} />Transições suaves</label>
              <label className="theme-toggle"><input type="checkbox" checked={editing.animations?.pulse ?? false} onChange={event => updateEditing(theme => ({ ...theme, animations: { ...themeEffects(theme).animations, pulse: event.target.checked } }))} />Pulsação discreta do player</label>
              <RangeControl label="Intensidade dos efeitos" value={editing.animations?.intensity ?? 45} min={0} max={100} unit="%" onChange={intensity => updateEditing(theme => ({ ...theme, animations: { ...themeEffects(theme).animations, intensity } }))} />
              <label className="theme-toggle"><input type="checkbox" checked={editing.animations?.reduceMotion ?? false} onChange={event => updateEditing(theme => ({ ...theme, animations: { ...themeEffects(theme).animations, reduceMotion: event.target.checked } }))} />Reduzir movimento neste tema</label>
            </EditorSection>
            <div className="theme-editor-footer">
              <label className="theme-save-target">Salvar alterações em
                <select value={saveTargetId} onChange={event => setSaveTargetId(event.target.value)}>
                  <option value="">Criar um novo tema</option>
                  {custom.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                </select>
                <small>{saveTargetId ? 'O tema selecionado será atualizado, sem criar outra cópia.' : 'Um novo tema será criado; os temas existentes serão preservados.'}</small>
              </label>
              <button onClick={() => {
                const defaults = builtInThemes[0]
                updateEditing(theme => ({ ...theme, colors: { ...defaults.colors }, radius: defaults.radius, density: defaults.density, glass: { ...themeEffects(defaults).glass }, neon: { ...themeEffects(defaults).neon }, background: { ...themeEffects(defaults).background }, animations: { ...themeEffects(defaults).animations } }))
              }}>Restaurar padrões</button>
              <div className="theme-actions"><button onClick={closeEditor}>Cancelar</button><button onClick={() => editing && themeStore.setPreview(editing)}>Aplicar prévia</button><button className="theme-primary" onClick={saveEditing}>Salvar e aplicar</button></div>
            </div>
          </div>
        </div>
      ), document.body)}
    </section>
  )
}
