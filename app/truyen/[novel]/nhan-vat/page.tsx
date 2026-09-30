import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChapterBar } from '@/components/ChapterBar.tsx'
import { Masked } from '@/components/Masked.tsx'
import { SiteHeader } from '@/components/SiteHeader.tsx'
import { readChapter } from '@/lib/chapter.ts'
import { getNovel, listCharacters, type ListFilter } from '@/lib/queries.ts'

type Props = { params: Promise<{ novel: string }>; searchParams: Promise<Record<string, string | undefined>> }
const PAGE = 48

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const novel = await getNovel((await params).novel)
  if (!novel) return {}
  return {
    title: `Nhân vật ${novel.title_vi} — Quần anh phổ`,
    description: `Danh sách nhân vật ${novel.title_vi} (${novel.title_zh}) theo thế lực, cảnh giới, lọc theo chương bạn đang đọc.`,
    alternates: { canonical: `/truyen/${novel.slug}/nhan-vat` },
    robots: novel.is_sample ? { index: false } : undefined,
  }
}

const Peak = ({ level }: { level: number }) => (
  <svg viewBox="0 0 28 28" className="peak" aria-hidden="true"><path d={`M0 28 L14 ${24 - level * 6} L28 28 Z`} fill="#e6dfcf" opacity={0.35 + level * 0.16} /></svg>
)

export default async function ListPage({ params, searchParams }: Props) {
  const novel = await getNovel((await params).novel)
  if (!novel) notFound()
  const sp = await searchParams
  const ch = await readChapter(novel)
  const at = ch ?? novel.chapter_count
  const filter: ListFilter = {
    faction: sp.the_luc || undefined,
    realm: sp.canh_gioi !== undefined && /^\d+$/.test(sp.canh_gioi) ? Number(sp.canh_gioi) : undefined,
    alive: sp.con_song === '1' ? true : undefined,
    verifiedOnly: sp.da_duyet === '1',
    sort: sp.xep === 'first' || sp.xep === 'name' ? sp.xep : 'mentions',
  }
  const page = Math.max(1, Number(sp.trang) || 1)
  const { items, total, factions } = await listCharacters(novel, at, filter)
  const shown = items.slice(0, page * PAGE)
  const qs = (patch: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { ...sp, trang: undefined, ...patch }
    const next = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => !!e[1]))
    const s = next.toString()
    return `/truyen/${novel.slug}/nhan-vat${s ? `?${s}` : ''}`
  }
  const realmChoices = novel.realms.slice(0, 5)

  return (
    <div className="page">
      <div className="mist mist-lb" style={{ left: -60, bottom: 0, width: 800, opacity: 0.11 }} />
      <div className="mist mist-rb" style={{ right: -60, bottom: 0, width: 900, opacity: 0.1 }} />
      <SiteHeader />
      <ChapterBar novel={novel} ch={ch} />
      <main className="wrap above" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="section-head" style={{ paddingTop: 16, flexWrap: 'wrap' }}>
          <span lang="zh" aria-hidden="true" className="brushfont" style={{ fontSize: 76 }}>群英谱</span>
          <span><h1 className="display" style={{ fontSize: 40, lineHeight: 1 }}>Quần anh phổ</h1>
            <span className="small muted">Nhân vật {novel.title_vi} đã xuất hiện tới {ch === null ? 'chương bạn chọn' : `chương ${ch}`}</span></span>
          <span className="spacer" />
          <nav aria-label="Sắp xếp" className="filter-row">
            <span className="small muted">Xếp theo</span>
            {([['mentions', 'Số chương có mặt'], ['first', 'Lần đầu xuất hiện'], ['name', 'Tên A–Z']] as const).map(([k, l]) => (
              <Link key={k} href={qs({ xep: k === 'mentions' ? undefined : k })} className="chip" aria-current={filter.sort === k ? 'true' : undefined}>{l}</Link>
            ))}
          </nav>
        </div>

        <section aria-label="Bộ lọc" className="filters">
          <div className="filter-row">
            <span className="k">Thế lực</span>
            <Link href={qs({ the_luc: undefined })} className="chip" aria-current={!filter.faction ? 'true' : undefined}>Tất cả</Link>
            {factions.slice(0, 12).map((f) => <Link key={f} href={qs({ the_luc: f })} className="chip" aria-current={filter.faction === f ? 'true' : undefined}>{f}</Link>)}
          </div>
          <div className="filter-row">
            <span className="k">Cảnh giới</span>
            <Link href={qs({ canh_gioi: undefined })} className="chip" aria-current={filter.realm === undefined ? 'true' : undefined}>Tất cả</Link>
            {realmChoices.map((r, i) => (
              <Link key={r.zh} href={qs({ canh_gioi: String(i) })} className="chip" aria-current={filter.realm === i ? 'true' : undefined}><Peak level={Math.min(i, 4)} />&nbsp;{r.vi}{i < realmChoices.length - 1 ? ' trở lên' : ''}</Link>
            ))}
          </div>
          <div className="filter-row">
            <span className="k">Khác</span>
            <Link href={qs({ con_song: filter.alive ? undefined : '1' })} className="chip" aria-current={filter.alive ? 'true' : undefined}>Còn sống</Link>
            <Link href={qs({ da_duyet: filter.verifiedOnly ? undefined : '1' })} className="chip" aria-current={filter.verifiedOnly ? 'true' : undefined}>Chỉ nhân vật đã đóng dấu đủ</Link>
          </div>
        </section>

        <Masked masked={ch === null} label="Chọn chương để xem danh sách không bị spoiler" cta="Xem hết (có spoiler)">
          {shown.length === 0 ? <p className="muted">Không có nhân vật nào khớp bộ lọc tới chương này.</p> : (
            <section aria-label="Kết quả" className="cards">
              {shown.map((c) => (
                <Link key={c.id} href={`/truyen/${novel.slug}/nhan-vat/${c.slug}`} className={`card ${c.dead ? 'dead' : ''}`}>
                  <span lang="zh" className="vzh brushfont">{c.name_zh}</span>
                  <span className="body">
                    <span className="name">{c.name_vi}</span>
                    <span className="small muted">{c.faction || 'Không rõ thế lực'}</span>
                    <span className="small" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {c.realm ? <><Peak level={Math.max(0, Math.min(4, c.realmRank))} />{c.realm}</> : 'Cảnh giới không rõ'}
                    </span>
                    <span className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span lang="zh" aria-hidden="true" className={`seal ${c.dead ? 'dim' : 'jade'}`} style={{ width: 22, height: 22, fontSize: 14 }}>{c.dead ? '殁' : '存'}</span>{c.dead ? 'Đã mất' : 'Còn sống'}
                    </span>
                    <span style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="small muted">Lần đầu ch. {c.first_ch} · có mặt {c.mentions} lần</span>
                      <span className="bar" style={{ width: `${Math.max(8, Math.round((c.mentions / Math.max(1, items[0]?.mentions ?? 1)) * 100))}%` }} />
                    </span>
                  </span>
                </Link>
              ))}
            </section>
          )}
        </Masked>
        {shown.length < total && <div style={{ display: 'flex', justifyContent: 'center' }}><Link href={qs({ trang: String(page + 1) })} className="btn" scroll={false}>Xem thêm nhân vật ({total - shown.length})</Link></div>}
      </main>
    </div>
  )
}
