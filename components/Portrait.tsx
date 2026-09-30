import Link from 'next/link'
import { credit, LICENSES, mediaUrl, safeUrl, type MediaMeta } from '@/lib/media.ts'

/** A hanging-scroll portrait with its credit. Artist links are marked ugc/nofollow. */
export function Portrait({ m, name, nameZh, contributeHref }: { m: MediaMeta; name: string; nameZh: string; contributeHref: string }) {
  const url = safeUrl(m.artist_url)
  const lic = m.license ? LICENSES[m.license] : null
  return (
    <figure className="portrait">
      <div className="portrait-frame brush">
        {/* eslint-disable-next-line @next/next/no-img-element -- already resized server-side */}
        <img src={mediaUrl(m.id)} alt={`Chân dung ${name}${m.source === 'ai' ? ' (tranh AI minh họa)' : ''}`} width={m.width} height={m.height} />
        <span lang="zh" className="seal portrait-seal" aria-hidden="true">{nameZh}</span>
      </div>
      <figcaption className="small muted">
        {m.source === 'ai'
          ? <>Tranh AI minh họa theo mô tả ở ch. {m.from_ch}. <Link href={contributeHref}>Bạn vẽ được?</Link></>
          : <>Tranh: {url ? <a href={url} target="_blank" rel="nofollow ugc noopener noreferrer">{m.artist_name}</a> : m.artist_name}
              {lic && <> · {lic.url ? <a href={lic.url} target="_blank" rel="noopener noreferrer">{lic.label}</a> : lic.label}</>} · từ ch. {m.from_ch}</>}
      </figcaption>
    </figure>
  )
}

export function Thumb({ id, alt, size = 64 }: { id: number; alt: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- thumbnails are pre-sized
  return <img className="thumb" src={mediaUrl(id, true)} alt={alt} width={size} height={Math.round(size * 4 / 3)} loading="lazy" />
}

export { credit }
