import { connect, type Socket } from 'net'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import type { DiscordPresenceStatus } from '../shared/types'

const CLIENT_ID = '1560149407989764148'
const RECONNECT_DELAY_MS = 5000
const CONNECT_TIMEOUT_MS = 2500

interface Playback {
  playing: boolean
  title: string
  artist: string
  duration: number
  position: number
}

let enabled = false
let status: DiscordPresenceStatus = 'disabled'
let socket: Socket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let statusListener: ((status: DiscordPresenceStatus) => void) | null = null
let playback: Playback = { playing: false, title: '', artist: '', duration: 0, position: 0 }

function setStatus(next: DiscordPresenceStatus): void {
  if (status === next) return
  status = next
  statusListener?.(next)
}

function socketPaths(): string[] {
  if (process.platform === 'win32') {
    return Array.from({ length: 10 }, (_, index) => `\\\\?\\pipe\\discord-ipc-${index}`)
  }

  const paths = Array.from({ length: 10 }, (_, index) => join(tmpdir(), `discord-ipc-${index}`))
  if (process.platform === 'darwin') {
    paths.push(...Array.from({ length: 10 }, (_, index) =>
      join(homedir(), 'Library', 'Application Support', 'discord', `ipc-${index}`)
    ))
  } else {
    const runtime = process.env.XDG_RUNTIME_DIR
    if (runtime) paths.push(join(runtime, 'discord-ipc-0'), join(runtime, 'app', 'com.discordapp.Discord', 'discord-ipc-0'))
    if (typeof process.getuid === 'function') paths.push(`/run/user/${process.getuid()}/discord-ipc-0`)
    paths.push(join(homedir(), '.config', 'discord', 'ipc-0'), join(homedir(), '.discord', 'ipc-0'))
  }
  return [...new Set(paths)]
}

function sendPacket(target: Socket, opcode: number, payload: object): void {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  const packet = Buffer.allocUnsafe(8 + body.length)
  packet.writeUInt32LE(opcode, 0)
  packet.writeUInt32LE(body.length, 4)
  body.copy(packet, 8)
  target.write(packet)
}

function sendActivity(target: Socket): void {
  if (target !== socket || target.destroyed || status !== 'connected') return
  let activity: Record<string, unknown> | null = null

  if (playback.title) {
    activity = {
      type: 2,
      details: playback.title.slice(0, 128),
      state: (playback.playing ? playback.artist || 'Openfy' : `Pausado${playback.artist ? ` · ${playback.artist}` : ''}`).slice(0, 128),
      ...(playback.playing && playback.duration > 0
        ? {
            timestamps: {
              start: Date.now() - Math.max(0, playback.position) * 1000,
              end: Date.now() + Math.max(0, playback.duration - playback.position) * 1000
            }
          }
        : {})
    }
  }

  sendPacket(target, 1, {
    cmd: 'SET_ACTIVITY',
    args: { pid: process.pid, activity },
    nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`
  })
}

function scheduleReconnect(): void {
  if (!enabled || reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectToDiscord()
  }, RECONNECT_DELAY_MS)
}

function connectToDiscord(): void {
  if (!enabled || socket) return
  setStatus('connecting')
  const paths = socketPaths()
  let pathIndex = 0

  const tryNextPath = (): void => {
    if (!enabled) return
    if (pathIndex >= paths.length) {
      setStatus('unavailable')
      scheduleReconnect()
      return
    }

    const current = connect(paths[pathIndex++])
    socket = current
    let buffer = Buffer.alloc(0)
    let ready = false
    const timeout = setTimeout(() => current.destroy(new Error('Discord IPC connection timed out')), CONNECT_TIMEOUT_MS)

    current.on('connect', () => {
      sendPacket(current, 0, { v: 1, client_id: CLIENT_ID })
    })

    current.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 8) {
        const opcode = buffer.readUInt32LE(0)
        const length = buffer.readUInt32LE(4)
        if (buffer.length < 8 + length) break
        const payload = buffer.subarray(8, 8 + length).toString('utf8')
        buffer = buffer.subarray(8 + length)

        if (opcode === 1) {
          try {
            const message = JSON.parse(payload) as { evt?: string; cmd?: string }
            if (message.evt === 'READY') {
              ready = true
              clearTimeout(timeout)
              setStatus('connected')
              sendActivity(current)
            } else if (message.evt === 'ERROR') {
              const errorMessage = (message as { data?: { message?: string; code?: number } }).data
              console.error('[Openfy] Discord recusou o Rich Presence:', errorMessage?.code, errorMessage?.message)
              clearTimeout(timeout)
              setStatus('error')
              socket = null
              current.destroy()
            } else if (message.cmd === 'SET_ACTIVITY' && !message.evt) {
              // RPC acknowledgements do not require a response.
            }
          } catch (error) {
            console.error('[Openfy] Resposta inválida do Discord Rich Presence:', error)
            clearTimeout(timeout)
            current.destroy()
          }
        }
      }
    })

    current.on('error', (error) => {
      clearTimeout(timeout)
      if (socket !== current) return
      socket = null
      if (ready) {
        console.error('[Openfy] Conexão com Discord Rich Presence interrompida:', error.message)
        setStatus(enabled ? 'unavailable' : 'disabled')
        scheduleReconnect()
      } else {
        current.destroy()
        tryNextPath()
      }
    })

    current.on('close', () => {
      clearTimeout(timeout)
      if (socket !== current) return
      socket = null
      if (ready) {
        setStatus(enabled ? 'unavailable' : 'disabled')
        scheduleReconnect()
      } else {
        tryNextPath()
      }
    })
  }

  tryNextPath()
}

export const discordPresence = {
  getStatus: (): DiscordPresenceStatus => status,
  setStatusListener(listener: (status: DiscordPresenceStatus) => void): void {
    statusListener = listener
    listener(status)
  },
  setEnabled(value: boolean): void {
    enabled = value
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (!enabled) {
      const current = socket
      socket = null
      current?.destroy()
      setStatus('disabled')
      return
    }
    if (!socket) connectToDiscord()
  },
  updatePlayback(next: Playback): void {
    playback = {
      playing: next.playing,
      title: next.title.slice(0, 180),
      artist: next.artist.slice(0, 180),
      duration: Number.isFinite(next.duration) ? Math.max(0, next.duration) : 0,
      position: Number.isFinite(next.position) ? Math.max(0, next.position) : 0
    }
    if (socket && status === 'connected') sendActivity(socket)
  }
}
