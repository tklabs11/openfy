// Sem imports: comparar versões e escolher o APK do release é testado isoladamente.

export interface ApkRelease {
  version: string
  url: string
  name: string
}

interface ParsedVersion {
  parts: number[]
  pre: string
}

function parseVersion(value: string): ParsedVersion {
  const clean = value.trim().replace(/^v/i, '').split('+')[0]
  const [core, pre = ''] = clean.split('-')
  const parts = core.split('.').map((piece) => Number(piece) || 0)
  return { parts: [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0], pre }
}

/** Compara versões no formato 0.2.0-beta.5; negativo quando `a` é mais antiga. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    if (left.parts[i] !== right.parts[i]) return left.parts[i] - right.parts[i]
  }
  if (!left.pre && !right.pre) return 0
  // Versão estável vale mais que qualquer pré-release dela.
  if (!left.pre) return 1
  if (!right.pre) return -1
  const [leftName, leftNumber] = left.pre.split('.')
  const [rightName, rightNumber] = right.pre.split('.')
  if (leftName !== rightName) return leftName.localeCompare(rightName)
  return (Number(leftNumber) || 0) - (Number(rightNumber) || 0)
}

/** Escolhe, entre os releases publicados, o APK mais novo que o instalado. */
export function pickApkRelease(releases: unknown, currentVersion: string): ApkRelease | null {
  if (!Array.isArray(releases)) return null
  let best: ApkRelease | null = null
  for (const item of releases) {
    const release = item as { tag_name?: unknown; draft?: unknown; assets?: unknown }
    if (typeof release?.tag_name !== 'string' || release.draft === true) continue
    if (!Array.isArray(release.assets)) continue
    const asset = release.assets.find((entry) => {
      const name = (entry as { name?: unknown })?.name
      return typeof name === 'string' && name.toLowerCase().endsWith('.apk')
    }) as { name?: string; browser_download_url?: string } | undefined
    const url = asset?.browser_download_url
    if (!asset || typeof asset.name !== 'string' || typeof url !== 'string' || !url.startsWith('https://')) continue
    if (compareVersions(release.tag_name, currentVersion) <= 0) continue
    if (!best || compareVersions(release.tag_name, best.version) > 0) {
      best = { version: release.tag_name.replace(/^v/i, ''), url, name: asset.name }
    }
  }
  return best
}
