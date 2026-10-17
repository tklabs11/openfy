import { useEffect, useRef, useState } from 'react'
import { currentTrack, usePlayer } from '../player'
import { themeEffects, themeStore, useThemes } from '../themes'

type ImageLayer = { src: string; key: number }

export function ThemeBackdrop() {
  const themeState = useThemes()
  const track = usePlayer(currentTrack)
  const [visible, setVisible] = useState(!document.hidden)
  const [current, setCurrent] = useState<ImageLayer | null>(null)
  const [previous, setPrevious] = useState<ImageLayer | null>(null)
  const [loadedKey, setLoadedKey] = useState<number | null>(null)
  const imageSequence = useRef(0)
  const theme = themeStore.getCurrentTheme()
  const effects = themeEffects(theme)
  const useEffects = themeState.advancedEffectsEnabled && !themeState.lightweightMode
  const source = !useEffects || effects.background.mode === 'solid'
    ? null
    : effects.background.mode === 'custom'
      ? effects.background.image ?? null
      : track?.cover ?? null

  useEffect(() => {
    const updateVisibility = (): void => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    if (current?.src === source) return
    setPrevious(current)
    const next = source ? { src: source, key: ++imageSequence.current } : null
    setCurrent(next)
    setLoadedKey(null)
  }, [source])

  useEffect(() => {
    if (!previous) return
    const timeout = window.setTimeout(() => setPrevious(null), 850)
    return () => window.clearTimeout(timeout)
  }, [previous, current])

  if (!visible || !source) return <div className="theme-backdrop" aria-hidden="true" />

  return (
    <div
      className={'theme-backdrop' + (current || previous ? ' has-background-image' : '')}
      aria-hidden="true"
      style={{
        ['--theme-background-position' as string]: effects.background.position,
        ['--theme-background-fit' as string]: effects.background.fit,
        ['--theme-background-blur' as string]: `${useEffects ? effects.background.blur : 0}px`,
        ['--theme-background-dim' as string]: String((useEffects ? effects.background.dim : 65) / 100)
      }}
    >
      {previous && <img className="theme-backdrop-image active" src={previous.src} alt="" />}
      {current && (
        <img
          key={current.key}
          className={'theme-backdrop-image' + (loadedKey === current.key ? ' active' : '')}
          src={current.src}
          alt=""
          onLoad={() => setLoadedKey(current.key)}
          onError={() => {
            console.warn('[Openfy] Não foi possível carregar a imagem de fundo do tema.')
            setCurrent(null)
          }}
        />
      )}
    </div>
  )
}
