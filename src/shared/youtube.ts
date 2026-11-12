const VIDEO_ID = /^[\w-]{11}$/

export function videoIdFromUri(uri: string): string | null {
  if (VIDEO_ID.test(uri)) return uri
  try {
    const url = new URL(uri)
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') ?? ''
    return VIDEO_ID.test(id) ? id : null
  } catch {
    return null
  }
}
