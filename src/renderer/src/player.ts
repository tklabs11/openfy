import { create } from 'zustand'
import type { Track } from '@shared/types'
import { HtmlAudioProvider } from './providers/HtmlAudioProvider'
import { YouTubeProvider } from './providers/YouTubeProvider'
import { useLibrary } from './library'
import { recordTaste } from './taste'
import { insertNext, keepCurrentQueueItem, moveQueueItem, removeQueueItem } from './queue'

export type Repeat = 'off' | 'all' | 'one'

interface PlayerState {
  queue: Track[]
  index: number
  playing: boolean
  position: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: Repeat
  error: string | null
  fadeSeconds: number
  setFadeSeconds(seconds: number): void
  eqGains: number[]
  setEqGains(gains: number[]): void
  spectrum(): number[]
  restoreSession(): Promise<void>
  playQueue(tracks: Track[], start: number): void
  enqueueNext(track: Track): void
  removeQueueTrack(index: number): void
  moveQueueTrack(from: number, to: number): void
  clearUpcoming(): void
  toggle(): void
  next(auto?: boolean): void
  prev(): void
  seek(seconds: number): void
  setVolume(v: number): void
  toggleShuffle(): void
  cycleRepeat(): void
}

// YouTube usa o player oficial incorporado; as outras fontes tocam por <audio>.
const audio = new HtmlAudioProvider()
export const youtube = new YouTubeProvider()

let active: HtmlAudioProvider | YouTubeProvider | null = null
let token = 0
let fadeTimer: ReturnType<typeof setInterval> | null = null
function cancelFade(): void { if (fadeTimer) clearInterval(fadeTimer); fadeTimer = null }
const setAllVolume = (volume: number): void => { audio.setVolume(volume); youtube.setVolume(volume) }
function fadeVolume(from: number, to: number, seconds: number, done?: () => void): void {
  cancelFade()
  if (seconds <= 0) { setAllVolume(to); done?.(); return }
  const start = Date.now()
  fadeTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - start) / (seconds * 1000))
    setAllVolume(from + (to - from) * progress)
    if (progress >= 1) { cancelFade(); done?.() }
  }, 25)
}

export const usePlayer = create<PlayerState>((set, get) => {
  const load = async (i: number, autoplay = true, resume = 0): Promise<void> => {
    const track = get().queue[i]
    if (!track) return
    const mine = ++token
    cancelFade()
    const fade = get().fadeSeconds
    if (autoplay && active && get().playing && fade > 0) {
      const prior = active
      const from = get().volume
      await new Promise<void>(resolve => fadeVolume(from, 0, Math.min(fade, 3) / 2, resolve))
      if (mine !== token) return
      prior.pause()
    }
    set({ index: i, position: 0, duration: track.duration ?? 0, error: null, playing: false })
    const provider = track.source === 'youtube' ? youtube : audio
    if (active && active !== provider) active.pause()
    active = provider
    try {
      await provider.load(track)
      if (mine !== token) return
      provider.setVolume(get().volume)
      provider.setEqualizer(get().eqGains)
      if (resume > 0) provider.seek(resume)
      if (autoplay) {
        if (fade > 0) provider.setVolume(0)
        provider.play(); recordTaste(track)
        if (fade > 0) fadeVolume(0, get().volume, Math.min(fade, 3) / 2)
      }
      try { const ids: string[] = JSON.parse(localStorage.getItem('openfy-history') || '[]'); localStorage.setItem('openfy-history', JSON.stringify([track.id, ...ids.filter(id => id !== track.id)].slice(0, 100))) } catch { /* history optional */ }
      set({ playing: autoplay, position: resume })
    } catch (e) {
      if (mine !== token) return
      set({ playing: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const handleEnd = (): void => {
    const track = get().queue[get().index]
    if (track) recordTaste(track, true)
    if (get().repeat === 'one') {
      active?.seek(0)
      active?.play()
      return
    }
    get().next(true)
  }

  const handleError = (message: string): void => {
    set({ error: message, playing: false })
    const { index, queue } = get()
    if (index < queue.length - 1) window.setTimeout(() => get().next(true), 1500)
  }

  audio.onEnd(handleEnd)
  audio.onError(handleError)

  const SESSION = 'openfy-last-session-v1'
  const saveSession = (): void => {
    const { queue, index, position, volume, shuffle, repeat } = get()
    if (index < 0 || !queue[index]) return
    try { localStorage.setItem(SESSION, JSON.stringify({ queue: queue.slice(0, 250), index: Math.min(index, 249), position, volume, shuffle, repeat })) } catch { /* storage unavailable */ }
  }
  window.addEventListener('beforeunload', saveSession)
  window.setInterval(() => {
    if (get().playing && active) {
      set({ position: active.getPosition(), duration: active.getDuration() || get().duration })
    }
  }, 250)
  window.setInterval(saveSession, 3000)

  return {
    queue: [],
    index: -1,
    playing: false,
    position: 0,
    duration: 0,
    volume: 0.8,
    shuffle: false,
    repeat: 'off',
    error: null,
    fadeSeconds: (() => { const n = Number(localStorage.getItem('openfy-fade-seconds') || 0); return Number.isFinite(n) ? Math.max(0, Math.min(6, n)) : 0 })(),
    setFadeSeconds(seconds) { const value = Math.max(0, Math.min(6, seconds)); localStorage.setItem('openfy-fade-seconds', String(value)); set({ fadeSeconds: value }) },
    eqGains: (() => { try { const v = JSON.parse(localStorage.getItem('openfy-eq') || '[]'); return Array.isArray(v) && v.length === 10 ? v.map((n: unknown) => Math.max(-12, Math.min(12, Number(n) || 0))) : Array(10).fill(0) } catch { return Array(10).fill(0) } })(),
    setEqGains(gains) { audio.setEqualizer(gains); localStorage.setItem('openfy-eq', JSON.stringify(gains)); set({ eqGains: [...gains] }) },
    spectrum() { return audio.getSpectrum() },

    async restoreSession() {
      try {
        const session = JSON.parse(localStorage.getItem(SESSION) || 'null')
        if (!session || !Array.isArray(session.queue) || !session.queue.length) return
        const queue = session.queue.filter((t: Track) => t && typeof t.id === 'string' && typeof t.uri === 'string').slice(0, 250) as Track[]
        if (!queue.length) return
        const index = Math.max(0, Math.min(queue.length - 1, Number(session.index) || 0))
        const resume = Math.max(0, Number(session.position) || 0)
        set({ queue, index, position: resume, duration: queue[index].duration || 0, playing: false, shuffle: !!session.shuffle, repeat: ['one','all'].includes(session.repeat) ? session.repeat : 'off' })
        try { await load(index, false, resume) } catch { /* offline source unavailable; keep metadata */ }
      } catch { /* corrupt session */ }
    },
    playQueue(tracks, start) {
      if (!tracks.length) return
      set({ queue: tracks })
      void load(Math.min(Math.max(start, 0), tracks.length - 1))
    },

    enqueueNext(track) {
      const state = get()
      if (state.index < 0 || !state.queue.length) {
        get().playQueue([track], 0)
        return
      }
      set(insertNext(state.queue, state.index, track))
    },

    removeQueueTrack(removeIndex) {
      const state = get()
      const change = removeQueueItem(state.queue, state.index, removeIndex)
      if (change.queue === state.queue) return
      if (change.index < 0) {
        ++token
        cancelFade()
        active?.pause()
        set({ ...change, playing: false, position: 0, duration: 0, error: null })
        return
      }
      set(change)
      if (removeIndex === state.index) void load(change.index, state.playing)
    },

    moveQueueTrack(from, to) {
      const state = get()
      const change = moveQueueItem(state.queue, state.index, from, to)
      if (change.queue !== state.queue) set(change)
    },

    clearUpcoming() {
      const state = get()
      const change = keepCurrentQueueItem(state.queue, state.index)
      if (change.queue.length !== state.queue.length) set(change)
    },

    toggle() {
      if (!active || get().index < 0) return
      if (get().playing) {
        const current = active
        const fade = get().fadeSeconds
        if (fade > 0) fadeVolume(get().volume, 0, Math.min(fade, 2) / 2, () => current?.pause())
        else { cancelFade(); active.pause() }
        set({ playing: false })
      } else {
        cancelFade()
        if (get().fadeSeconds > 0) active.setVolume(0)
        else active.setVolume(get().volume)
        active.play()
        if (get().fadeSeconds > 0) fadeVolume(0, get().volume, Math.min(get().fadeSeconds, 2) / 2)
        const track = get().queue[get().index]
        if (track) recordTaste(track)
        set({ playing: true })
      }
    },

    next(auto = false) {
      const { queue, index, shuffle, repeat } = get()
      if (!queue.length) return
      let n: number
      if (shuffle && queue.length > 1) {
        do {
          n = Math.floor(Math.random() * queue.length)
        } while (n === index)
      } else {
        n = index + 1
        if (n >= queue.length) {
          if (repeat === 'all' || !auto) {
            n = 0
          } else {
            active?.pause()
            set({ playing: false, position: 0 })
            return
          }
        }
      }
      void load(n)
    },

    prev() {
      const { index, position } = get()
      if (index < 0) return
      if (position > 3) {
        active?.seek(0)
        set({ position: 0 })
        return
      }
      void load(Math.max(0, index - 1))
    },

    seek(seconds) {
      active?.seek(seconds)
      set({ position: seconds })
      const state = get()
      const track = state.queue[state.index]
      window.api.desktopUpdatePlayback(state.playing, track?.title, track?.artist, state.duration, seconds)
    },

    setVolume(v) {
      const vol = Math.min(1, Math.max(0, v))
      cancelFade()
      setAllVolume(vol)
      set({ volume: vol })
      useLibrary.getState().updateSettings({ volume: vol })
    },

    toggleShuffle() {
      set((s) => ({ shuffle: !s.shuffle }))
    },

    cycleRepeat() {
      set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' }))
    }
  }
})

export const currentTrack = (s: PlayerState): Track | undefined => s.queue[s.index]
