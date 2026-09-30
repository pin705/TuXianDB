// Which image a reader may see. Pure: tested in test/media.test.ts.

export type MediaMeta = {
  id: number
  kind: 'cover' | 'portrait'
  source: 'artist' | 'ai'
  from_ch: number
  artist_name: string
  artist_url: string
  license: License
  width: number
  height: number
}

export type License = '' | 'cc-by' | 'cc-by-nc' | 'display-only'
export const LICENSES: Record<Exclude<License, ''>, { label: string; url?: string }> = {
  'cc-by': { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/deed.vi' },
  'cc-by-nc': { label: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/deed.vi' },
  'display-only': { label: 'Chỉ hiển thị trên TuXianDB, tác giả giữ mọi quyền' },
}

/**
 * The portrait for a reader at chapter `ch`: artists before AI, then the latest stage the reader has reached.
 * Unknown chapter: only images of the character as first introduced, which are as safe as the intro text.
 */
export function pickPortrait<M extends MediaMeta>(images: M[], ch: number | null, firstCh: number): M | null {
  const limit = ch ?? firstCh
  const seen = images.filter((m) => m.kind === 'portrait' && m.from_ch <= limit)
  seen.sort((a, b) => Number(b.source === 'artist') - Number(a.source === 'artist') || b.from_ch - a.from_ch || b.id - a.id)
  return seen[0] ?? null
}

/** Gallery split: what the reader has reached, and how many are still rolled up. */
export function gallery<M extends MediaMeta>(images: M[], at: number) {
  const byStage = (a: M, b: M) => a.from_ch - b.from_ch || Number(b.source === 'artist') - Number(a.source === 'artist')
  return { seen: images.filter((m) => m.from_ch <= at).sort(byStage), ahead: images.filter((m) => m.from_ch > at).length }
}

export const mediaUrl = (id: number, thumb = false) => `/media/${id}${thumb ? '?s=thumb' : ''}`

export function credit(m: Pick<MediaMeta, 'source' | 'artist_name' | 'license'>): string {
  if (m.source === 'ai') return 'Tranh AI minh họa'
  const lic = m.license ? LICENSES[m.license].label : ''
  return `Tranh: ${m.artist_name}${lic ? ` · ${lic}` : ''}`
}

/** Only http(s) links are ever rendered for artists. */
export function safeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : ''
  } catch {
    return ''
  }
}
