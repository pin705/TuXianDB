import Link from 'next/link'
import { cookies } from 'next/headers'
import { SiteHeader } from '@/components/SiteHeader.tsx'
import { chapterCookie } from '@/lib/chapter.ts'
import { parseChapter } from '@/lib/spoiler.ts'
import { mediaUrl } from '@/lib/media.ts'
import { covers, listNovels } from '@/lib/queries.ts'

// Planned titles are shown greyed out so readers can see what is coming.
const SOON = [
  { zh: '仙逆', vi: 'Tiên Nghịch', cover: '#223E36' }, { zh: '遮天', vi: 'Già Thiên', cover: '#45465E' },
  { zh: '一念永恒', vi: 'Nhất Niệm Vĩnh Hằng', cover: '#602641' }, { zh: '剑来', vi: 'Kiếm Lai', cover: '#644D31' },
]

function Cover({ zh, color, seal, image }: { zh: string; color: string; seal?: boolean; image?: { id: number; artist_name: string } }) {
  return (
    <span className="cover" style={{ background: color }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized */}
      {image && <img src={mediaUrl(image.id, true)} alt={`Bìa do ${image.artist_name} vẽ`} width={112} height={160} />}
      <span lang="zh" className="label brushfont">{zh}</span>
      {[20, 60, 100, 138].map((t) => <span key={t} className="stitch" style={{ top: t }} />)}
      {seal && <span className="seal" style={{ position: 'absolute', right: 22, bottom: 12, width: 22, height: 22 }} />}
    </span>
  )
}

export default async function Home() {
  const [novels, art] = await Promise.all([listNovels(), covers()])
  const jar = await cookies()
  const reading = novels.map((n) => ({ n, ch: parseChapter(jar.get(chapterCookie(n.slug))?.value, n.chapter_count) })).filter((x) => x.ch !== null)
  const soon = SOON.filter((s) => !novels.some((n) => n.title_zh === s.zh))
  return (
    <div className="page">
      <div className="mist mist-lb" style={{ left: -40, bottom: 0, width: 720, opacity: 0.17 }} />
      <div className="mist mist-lm" style={{ left: 260, bottom: 0, width: 480, opacity: 0.15 }} />
      <div className="mist mist-lf2" style={{ left: 170, bottom: 0, width: 340, opacity: 0.19 }} />
      <div className="mist mist-rb" style={{ right: -40, bottom: 0, width: 940, opacity: 0.16 }} />
      <SiteHeader search={false} right={reading[0] && <Link href={`/truyen/${reading[0].n.slug}/nhan-vat`} className="btn">Tiếp tục · {reading[0].n.title_vi} ch. {reading[0].ch}</Link>} />

      <main className="wrap above">
        <div className="home-hero">
          <span aria-hidden="true" lang="zh" className="couplet brushfont" style={{ left: 72 }}><span>读到哪里</span><span className="seal" style={{ width: 26, height: 26 }} /></span>
          <span aria-hidden="true" lang="zh" className="couplet brushfont" style={{ right: 72 }}><span>查到哪里</span><span className="seal" style={{ width: 26, height: 26 }} /></span>
          <span className="seal" aria-hidden="true" style={{ width: 72, height: 72, fontSize: 50, transform: 'rotate(-5deg)' }}>问</span>
          <h1>Đọc đến đâu, tra đến đó.</h1>
          <p className="muted" style={{ maxWidth: 600, margin: 0, fontSize: 17, lineHeight: 1.6 }}>Hồ sơ, nhân duyên và đạo đồ của nhân vật truyện tu tiên. Mọi thông tin gắn số chương, phần bạn chưa đọc được cuộn lại.</p>
          <form action="/tim" role="search" className="brush search-box" style={{ width: 'min(740px, 100%)', flexBasis: 'auto', minHeight: 70, marginTop: 14 }}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" name="q" aria-label="Tìm nhân vật" placeholder="Tìm nhân vật, bí danh, chữ Hán, pinyin…" style={{ fontSize: 19 }} required />
            <button className="btn btn-solid" style={{ minHeight: 44 }}>Tìm</button>
          </form>
          <span className="small muted">Gõ không dấu, chữ Hán hay pinyin đều tìm được: han lap, 韩立, hán lì.</span>
        </div>

        <section id="tang-thu" aria-label="Tàng thư" className="shelf">
          {novels.map((n) => (
            <Link key={n.id} href={`/truyen/${n.slug}/nhan-vat`} className="book">
              <Cover zh={n.title_zh} color={n.cover} seal image={art.get(n.id)} />
              <span style={{ textAlign: 'center' }}><b>{n.title_vi}</b><br /><span className="small" style={{ color: 'var(--red-text)', fontWeight: 600 }}>{n.is_sample ? 'Bản xem thử' : 'Đang mở'}</span></span>
            </Link>
          ))}
          {soon.map((s) => (
            <div key={s.zh} className="book soon">
              <Cover zh={s.zh} color={s.cover} />
              <span style={{ textAlign: 'center' }}><b>{s.vi}</b><br /><span className="small muted">Sắp có</span></span>
            </div>
          ))}
        </section>
        <p className="small muted" style={{ textAlign: 'center', marginTop: 28 }}>Họa sĩ? <Link href="/dong-gop/tranh">Gửi tranh bìa hoặc tranh nhân vật</Link>, có ghi tên và link của bạn.</p>
      </main>
    </div>
  )
}
