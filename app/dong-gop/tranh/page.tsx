import type { Metadata } from 'next'
import Link from 'next/link'
import { ArtUploadForm } from '@/components/ArtUploadForm.tsx'
import { SiteHeader } from '@/components/SiteHeader.tsx'
import { sql } from '@/lib/db.ts'
import { getNovel, listNovels } from '@/lib/queries.ts'

export const metadata: Metadata = { title: 'Đóng góp tranh', robots: { index: false } }

export default async function Contribute({ searchParams }: { searchParams: Promise<{ truyen?: string; 'nhan-vat'?: string; loai?: string }> }) {
  const sp = await searchParams
  const novel = sp.truyen ? await getNovel(sp.truyen) : null
  const [entity] = novel && sp['nhan-vat']
    ? await sql<{ slug: string; name_vi: string; name_zh: string; first_ch: number }[]>`
        select slug, name_vi, name_zh, first_ch from entity where novel_id = ${novel.id} and type = 'character' and slug = ${sp['nhan-vat']}`
    : []
  const kind = entity ? 'portrait' : 'cover'
  const novels = novel ? [] : await listNovels()
  return (
    <div className="page">
      <SiteHeader />
      <main className="wrap above" style={{ maxWidth: 820, paddingTop: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="section-head"><span lang="zh" aria-hidden="true" className="brushfont">献画</span><h1 className="display" style={{ fontSize: 44 }}>Đóng góp tranh</h1></div>
        <p className="muted" style={{ margin: 0 }}>
          TuXianDB chỉ dùng tranh do chính họa sĩ gửi, luôn ghi tên và link của bạn. Nhân vật chưa có tranh sẽ tạm dùng tranh AI minh họa, và tranh của bạn sẽ thay thế nó.
        </p>
        {!novel ? (
          <>
            <p style={{ margin: 0 }}>Chọn truyện để gửi <b>tranh bìa</b>. Muốn gửi tranh nhân vật, hãy mở hồ sơ nhân vật và bấm “Đóng góp tranh”.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {novels.map((n) => <Link key={n.id} href={`/dong-gop/tranh?truyen=${n.slug}`} className="btn">{n.title_vi}</Link>)}
            </div>
          </>
        ) : (
          <>
            <p className="panel" style={{ margin: 0, padding: '14px 16px' }}>
              {entity
                ? <>Tranh nhân vật <b>{entity.name_vi}</b> <span lang="zh" className="zh muted">{entity.name_zh}</span> · {novel.title_vi}</>
                : <>Tranh bìa <b>{novel.title_vi}</b> <span lang="zh" className="zh muted">{novel.title_zh}</span></>}
            </p>
            <ArtUploadForm novel={novel.slug} kind={kind} entity={entity?.slug} firstCh={entity?.first_ch} chapterCount={novel.chapter_count} />
          </>
        )}
      </main>
    </div>
  )
}
