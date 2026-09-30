import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { Thumb } from '@/components/Portrait.tsx'
import { SiteHeader } from '@/components/SiteHeader.tsx'
import { chapterCookie } from '@/lib/chapter.ts'
import { parseChapter } from '@/lib/spoiler.ts'
import { search } from '@/lib/queries.ts'

export const metadata: Metadata = { title: 'Tìm nhân vật', robots: { index: false } }

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').slice(0, 40)
  const jar = await cookies()
  const { hits, hidden } = await search(q, (slug, count) => parseChapter(jar.get(chapterCookie(slug))?.value, count))
  return (
    <div className="page">
      <div className="mist mist-rb" style={{ right: -40, bottom: 0, width: 900, opacity: 0.12 }} />
      <SiteHeader q={q} />
      <main className="wrap above" style={{ maxWidth: 820, paddingTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 className="display" style={{ fontSize: 40 }}>{q ? <>Kết quả cho “{q}”</> : 'Tìm nhân vật'}</h1>
        {q && hits.length === 0 && hidden === 0 && <p className="muted">Không tìm thấy. Thử gõ tên Hán Việt không dấu, chữ Hán hoặc pinyin.</p>}
        {hits.length > 0 && (
          <div className="results">
            {hits.map((h) => (
              <Link key={`${h.novel_slug}/${h.slug}`} href={`/truyen/${h.novel_slug}/nhan-vat/${h.slug}`} className="result">
                {h.portrait ? <Thumb id={h.portrait} alt="" size={48} /> : <span className="enso brushfont" lang="zh" style={{ width: 52, height: 52, fontSize: 24 }}>{[...h.name_zh][0]}</span>}
                <span style={{ flex: 1 }}>
                  <span className="display" style={{ fontSize: 24, fontWeight: 700 }}>{h.name_vi} <span lang="zh" className="zh muted" style={{ fontSize: 16 }}>{h.name_zh}</span></span><br />
                  <span className="small muted">{h.matched !== h.name_zh ? `Bí danh “${h.matched_vi || h.matched}” · ` : ''}{h.novel_title} · {h.role === 'chinh' ? 'nhân vật chính' : `từ ch. ${h.first_ch}`}</span>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        )}
        {hidden > 0 && (
          <p className="panel" style={{ margin: 0, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span lang="zh" aria-hidden="true" className="brushfont muted" style={{ fontSize: 22 }}>未展</span>
            {hidden} kết quả khác chỉ xuất hiện sau chương bạn đang đọc, hoặc bạn chưa chọn chương cho truyện đó.
          </p>
        )}
      </main>
    </div>
  )
}
