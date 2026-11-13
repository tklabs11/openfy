import dbus from 'dbus-next'
import type { BrowserWindow } from 'electron'
import type { MediaKey } from '../shared/types'
import { mprisMetadata, mprisMicroseconds, mprisPlaybackStatus, type MprisPlayback } from '../shared/mpris'

const { Interface, ACCESS_READ, ACCESS_READWRITE } = dbus.interface
const Variant = dbus.Variant
const BUS_NAME = 'org.mpris.MediaPlayer2.openfy'
const OBJECT_PATH = '/org/mpris/MediaPlayer2'
const NAME_FLAG_DO_NOT_QUEUE = 4

export interface MprisHandle {
  update(playback: MprisPlayback): void
  destroy(): void
}

class RootInterface extends Interface {
  constructor(private readonly onRaise: () => void, private readonly onQuit: () => void) {
    super('org.mpris.MediaPlayer2')
  }
  get Identity(): string { return 'Openfy' }
  get DesktopEntry(): string { return 'openfy' }
  get CanQuit(): boolean { return true }
  get CanRaise(): boolean { return true }
  get HasTrackList(): boolean { return false }
  get SupportedUriSchemes(): string[] { return ['file', 'https'] }
  get SupportedMimeTypes(): string[] { return ['audio/mpeg', 'audio/flac', 'audio/ogg', 'audio/wav', 'audio/mp4'] }
  Raise(): void { this.onRaise() }
  Quit(): void { this.onQuit() }
}
RootInterface.configureMembers({
  properties: {
    Identity: { signature: 's', access: ACCESS_READ },
    DesktopEntry: { signature: 's', access: ACCESS_READ },
    CanQuit: { signature: 'b', access: ACCESS_READ },
    CanRaise: { signature: 'b', access: ACCESS_READ },
    HasTrackList: { signature: 'b', access: ACCESS_READ },
    SupportedUriSchemes: { signature: 'as', access: ACCESS_READ },
    SupportedMimeTypes: { signature: 'as', access: ACCESS_READ }
  },
  methods: {
    Raise: { inSignature: '', outSignature: '' },
    Quit: { inSignature: '', outSignature: '' }
  }
})

class PlayerInterface extends Interface {
  private playback: MprisPlayback = { playing: false, title: '', artist: '', duration: 0, position: 0 }
  private volume = 1

  constructor(private readonly send: (key: MediaKey) => void) {
    super('org.mpris.MediaPlayer2.Player')
  }

  get PlaybackStatus(): string { return mprisPlaybackStatus(this.playback.playing) }
  get LoopStatus(): string { return 'None' }
  set LoopStatus(_value: string) { /* sem repetição controlada pelo app */ }
  get Rate(): number { return 1 }
  set Rate(_value: number) { /* taxa fixa */ }
  get Shuffle(): boolean { return false }
  set Shuffle(_value: boolean) { /* sem aleatório */ }
  get Metadata(): Record<string, dbus.Variant> {
    const meta = mprisMetadata(this.playback, '/org/mpris/MediaPlayer2/openfy/track/0')
    return {
      'mpris:trackid': new Variant('o', meta['mpris:trackid'] as string),
      'xesam:title': new Variant('s', meta['xesam:title'] as string),
      'xesam:artist': new Variant('as', meta['xesam:artist'] as string[]),
      ...(typeof meta['mpris:length'] === 'number'
        ? { 'mpris:length': new Variant('x', meta['mpris:length']) }
        : {})
    }
  }
  get Volume(): number { return this.volume }
  set Volume(value: number) { this.volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1 }
  get Position(): number { return mprisMicroseconds(this.playback.position) }
  get MinimumRate(): number { return 1 }
  get MaximumRate(): number { return 1 }
  get CanGoNext(): boolean { return true }
  get CanGoPrevious(): boolean { return true }
  get CanPlay(): boolean { return true }
  get CanPause(): boolean { return true }
  get CanSeek(): boolean { return false }
  get CanControl(): boolean { return true }

  Next(): void { this.send('next') }
  Previous(): void { this.send('prev') }
  Pause(): void { this.send('play-pause') }
  Play(): void { this.send('play-pause') }
  PlayPause(): void { this.send('play-pause') }
  Stop(): void { this.send('play-pause') }
  Seek(_offset: number): void { /* o player não expõe busca */ }
  SetPosition(_trackId: string, _position: number): void { /* o player não expõe busca */ }
  OpenUri(_uri: string): void { /* sem abertura por URI */ }

  update(playback: MprisPlayback): void {
    const wasPlaying = this.playback.playing
    this.playback = playback
    // emitPropertiesChanged espera valores simples; ele mesmo embrulha em Variant
    // conforme a assinatura de cada propriedade (embrulhar de novo quebra o marshalling).
    const changed: Record<string, unknown> = { Metadata: this.Metadata }
    if (wasPlaying !== playback.playing) {
      changed.PlaybackStatus = mprisPlaybackStatus(playback.playing)
    }
    try {
      Interface.emitPropertiesChanged(this, changed, [])
    } catch (error) {
      console.warn('[Openfy] Falha ao notificar mudança no MPRIS:', error)
    }
  }
}
PlayerInterface.configureMembers({
  properties: {
    PlaybackStatus: { signature: 's', access: ACCESS_READ },
    LoopStatus: { signature: 's', access: ACCESS_READWRITE },
    Rate: { signature: 'd', access: ACCESS_READWRITE },
    Shuffle: { signature: 'b', access: ACCESS_READWRITE },
    Metadata: { signature: 'a{sv}', access: ACCESS_READ },
    Volume: { signature: 'd', access: ACCESS_READWRITE },
    Position: { signature: 'x', access: ACCESS_READ },
    MinimumRate: { signature: 'd', access: ACCESS_READ },
    MaximumRate: { signature: 'd', access: ACCESS_READ },
    CanGoNext: { signature: 'b', access: ACCESS_READ },
    CanGoPrevious: { signature: 'b', access: ACCESS_READ },
    CanPlay: { signature: 'b', access: ACCESS_READ },
    CanPause: { signature: 'b', access: ACCESS_READ },
    CanSeek: { signature: 'b', access: ACCESS_READ },
    CanControl: { signature: 'b', access: ACCESS_READ }
  },
  methods: {
    Next: { inSignature: '', outSignature: '' },
    Previous: { inSignature: '', outSignature: '' },
    Pause: { inSignature: '', outSignature: '' },
    PlayPause: { inSignature: '', outSignature: '' },
    Stop: { inSignature: '', outSignature: '' },
    Play: { inSignature: '', outSignature: '' },
    Seek: { inSignature: 'x', outSignature: '' },
    SetPosition: { inSignature: 'ox', outSignature: '' },
    OpenUri: { inSignature: 's', outSignature: '' }
  }
})

/**
 * Expõe o Openfy como player MPRIS no D-Bus da sessão.
 * É o que faz as teclas de mídia e o controle de mídia do GNOME/KDE funcionarem
 * no Linux (o globalShortcut do Electron não recebe essas teclas no Wayland).
 */
export function startMpris(
  send: (key: MediaKey) => void,
  getWindow: () => BrowserWindow | null
): MprisHandle | null {
  if (!process.env.DBUS_SESSION_BUS_ADDRESS) {
    console.warn('[Openfy] Sessão D-Bus não encontrada; MPRIS desativado.')
    return null
  }

  let bus: dbus.MessageBus
  try {
    bus = dbus.sessionBus()
  } catch (error) {
    console.warn('[Openfy] MPRIS indisponível:', error)
    return null
  }

  const player = new PlayerInterface(send)
  const root = new RootInterface(
    () => { const win = getWindow(); win?.show(); win?.focus() },
    () => { const win = getWindow(); win?.close() }
  )

  try {
    bus.export(OBJECT_PATH, root)
    bus.export(OBJECT_PATH, player)
  } catch (error) {
    console.warn('[Openfy] Não foi possível publicar o MPRIS:', error)
    return null
  }

  // Sem este listener, um erro de marshalling derruba o processo principal.
  bus.on('error', (error: Error) => console.warn('[Openfy] Erro na conexão D-Bus do MPRIS:', error.message))

  bus.requestName(BUS_NAME, NAME_FLAG_DO_NOT_QUEUE).catch((error: unknown) => {
    console.warn('[Openfy] Outro player já usa o nome MPRIS do Openfy:', error)
  })

  return {
    update: (playback: MprisPlayback) => player.update(playback),
    destroy: () => { try { bus.disconnect() } catch { /* já desconectado */ } }
  }
}
