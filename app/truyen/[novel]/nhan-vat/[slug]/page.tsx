import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChapterBar } from '@/components/ChapterBar.tsx'
import { Masked } from '@/components/Masked.tsx'
import { RelationGraph } from '@/components/RelationGraph.tsx'
import { ReportButton } from '@/components/ReportButton.tsx'
import { ScrollToEnd } from '@/components/ScrollToEnd.tsx'
import { SiteHeader } from '@/components/SiteHeader.tsx'
import { readChapter } from '@/lib/chapter.ts'
import { ATTR_LABEL, RELATION_LABEL, RELATION_ORDER, RELATION_SEAL } from '@/lib/labels.ts'
import { graphNodes, profileView, type Milestone } from '@/lib/profile.ts'
import { getNovel, getProfile, type Relation } from '@/lib/queries.ts'

type Params = { params: Promise<{ novel: string; slug: string }> }

async function load(params: Params['params']) {
  const { novel: ns, slug } = await params
  const novel = await getNovel(ns)
  const profile = novel && (await getProfile(novel.id, slug))
  if (!novel || !profile) notFound()
  return { novel, profile }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { novel, profile } = await load(params)
  const e = profile.entity
  const verified = profile.facts.filter((f) => f.review === 'verified').length
  return {
    // Title and description come only from spoiler-free fields, so search results never leak an ending.
    title: `${e.name_vi} là ai? — ${novel.title_vi}`,
    description: `${e.name_vi} (${e.name_zh}) trong ${novel.title_vi}: ${e.intro_safe} Hồ sơ, nhân duyên, cảnh giới theo từng chương, không spoiler.`,
    alternates: { canonical: `/truyen/${novel.slug}/nhan-vat/${e.slug}` },
    robots: novel.is_sample || verified < 3 ? { index: false } : undefined,
  }
}

const Arrow = () => <span aria-hidden="true">→</span>

function MilestoneItem({ m, i, n }: { m: Milestone; i: number; n: number }) {
  return (
    <li className="milestone" style={{ '--rise': n > 1 ? Math.round((i / (n - 1)) * 180) : 0 } as React.CSSProperties}>
      {m.seal ? <span className="seal zh">{m.seal}</span> : <span className="dot" />}
      <span className="c">ch. {m.ch}</span>
      <span className="t">{m.title}</span>
      {m.sub && <span className="s">{m.sub}</span>}
    </li>
  )
}

export default async function ProfilePage({ params }: Params) {
  const { novel, profile } = await load(params)
  const ch = await readChapter(novel)
  const v = profileView(profile, ch, novel.chapter_count)
  const e = profile.entity
  const href = (r: Relation) => (r.other.type === 'character' ? `/truyen/${novel.slug}/nhan-vat/${r.other.slug}` : null)
  const statusAt = (attr: string) => v.status.find((s) => s.attr === attr)?.value
  const chLabel = ch === null ? 'chương bạn đang đọc' : `chương ${ch}`
  const maskLabel = v.reason === 'not_yet' ? `${e.name_vi} xuất hiện từ ch. ${e.first_ch}, sau chương bạn đang đọc` : 'Chọn chương để xem không bị spoiler'
  const milestones = v.masked ? v.ahead : v.seen
  const graph = graphNodes(v.masked ? v.relationsAhead.map((r) => ({ ...r, ended: false })) : v.relations)
  const groups = RELATION_ORDER.map((t) => ({ t, items: (v.masked ? v.relationsAhead : v.relations).filter((r) => r.type === t) })).filter((g) => g.items.length)
  const maxBin = Math.max(1, ...v.bins)

  return (
    <div className="page">
      <div className="mist mist-rb" style={{ right: -90, top: 150, width: 1000, opacity: 0.09 }} />
      <div className="mist mist-lb" style={{ left: -60, bottom: 0, width: 960, opacity: 0.13 }} />
      <div className="mist mist-lf" style={{ left: -10, bottom: 0, width: 380, opacity: 0.23 }} />
      <SiteHeader />
      <ChapterBar novel={novel} ch={ch} />

      <main className="wrap above">
        <section className="hero">
          <div className="vcol" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <span lang="zh" className="vname brushfont">{e.name_zh}</span>
            <span className="seal lg" title={e.role === 'chinh' ? 'Nhân vật chính' : 'Nhân vật phụ'} lang="zh">{e.role === 'chinh' ? '主角' : '配角'}</span>
          </div>

          <div className="intro" style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 8 }}>
            <nav aria-label="Đường dẫn" className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>{novel.title_vi}</Link><span className="sep" />
              <Link href={`/truyen/${novel.slug}/nhan-vat`} style={{ color: 'inherit', textDecoration: 'none' }}>Quần anh phổ</Link><span className="sep" />
              <span style={{ color: 'var(--text)' }}>{e.name_vi}</span>
            </nav>
            <h1>{e.name_vi}</h1>
            <div className="muted" style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              {e.pinyin && <span>{e.pinyin}</span>}<span>·</span><span lang="zh" className="zh" style={{ fontSize: 20 }}>{e.name_zh}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <span className="swipe">{e.role === 'chinh' ? 'Nhân vật chính' : 'Nhân vật phụ'}</span>
              {!v.masked && statusAt('faction') && <span className="tag">{statusAt('faction')}</span>}
              {!v.masked && statusAt('realm') && <span className="tag jade">{statusAt('realm')}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
              <span className="kicker"><span lang="zh" className="brushfont" style={{ fontSize: 18, letterSpacing: 0 }}>小传</span> · TIỂU TRUYỆN</span>
              <p className="lede">{e.intro_safe}</p>
              <span className="small muted">Tiểu truyện chỉ dùng thông tin có ở lần xuất hiện đầu tiên (ch. {e.first_ch}).</span>
            </div>
          </div>

          <Masked className="status" masked={v.masked} label={maskLabel} cta={v.reason === 'unknown' ? 'Xem hết (có spoiler)' : 'Hiện (có spoiler)'}>
            <div className="frame">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 8 }}>
                <span className="display" style={{ fontSize: 25, fontWeight: 600 }}>Tình trạng tới {v.masked ? 'cuối truyện' : `ch. ${v.at}`}</span>
                <span lang="zh" aria-hidden="true" className="brushfont" style={{ fontSize: 20, color: 'var(--red-text)' }}>当下</span>
              </div>
              {v.status.length === 0 && <p className="muted small">Chưa có thông tin nào được xác nhận.</p>}
              {v.status.map((s, i) => (
                <div key={`${s.kind}${s.id}`}>
                  {i > 0 && <div className="hline" style={{ opacity: 0.35 }} />}
                  <div className="status-row">
                    <span className="k">{s.attr === 'master' ? 'Sư phụ' : ATTR_LABEL[s.attr]}</span>
                    <span className="v"><b>{s.value}</b><span className="small muted">từ ch. {s.since}{s.verified ? '' : ' · tự động, chưa đóng dấu'}</span></span>
                    {s.verified ? <span className="seal" title="Đã kiểm duyệt">验</span> : <span className="seal ghost" title="Chưa kiểm duyệt" />}
                    <ReportButton novelId={novel.id} targetType={s.kind} targetId={s.id} label={`Báo sai: ${s.attr === 'master' ? 'sư phụ' : ATTR_LABEL[s.attr].toLowerCase()}`} />
                  </div>
                </div>
              ))}
              <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12 }}>
                <span>Lần đầu: <b style={{ color: 'var(--text)' }}>ch. {e.first_ch}</b></span>
                <span>Có mặt <b style={{ color: 'var(--text)' }}>{v.mentionsSoFar}</b> / {v.chaptersSoFar} chương</span>
              </div>
            </div>
          </Masked>
        </section>

        <section className="section" aria-labelledby="dao-do">
          <div className="section-head">
            <span lang="zh" aria-hidden="true" className="brushfont">道途</span>
            <span><h2 id="dao-do">Đạo đồ</h2><span className="small muted">Cảnh giới, thế lực và sự kiện chính, trải trên một cuộn tranh</span></span>
          </div>
          <div className="scroll-wrap">
            <span className="scroll-rod" aria-hidden="true" />
            <div className="scroll-paper" data-scroll-end="">
              {!v.masked && <ScrollToEnd />}
              <div className="mtns" aria-hidden="true">
                <div className="mtn" style={{ left: 40, width: 290, height: 160, backgroundImage: 'url(/ink/mtn-lf.webp)' }} />
                <div className="mtn" style={{ left: 240, width: 480, height: 148, backgroundImage: 'url(/ink/mtn-lm.webp)' }} />
                <div className="mtn" style={{ right: 0, width: 560, height: 190, backgroundImage: 'url(/ink/mtn-lb.webp)', opacity: 0.5 }} />
              </div>
              <Masked masked={v.masked} label={maskLabel}>
                <ol className="milestones">{milestones.map((m, i) => <MilestoneItem key={`${m.ch}${m.title}`} m={m} i={i} n={milestones.length} />)}</ol>
              </Masked>
            </div>
            <span className="scroll-rod" aria-hidden="true" style={{ flexBasis: 22 }} />
            {!v.masked && v.ahead.length > 0 && (
              <div className="scroll-end">
                <span lang="zh" aria-hidden="true" className="brushfont">未展</span>
                <Masked masked label={`${v.ahead.length} mốc sau ${chLabel}`} cta="Mở cuộn · có spoiler">
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {v.ahead.slice(0, 6).map((m) => <li key={`${m.ch}${m.title}`}><span className="small" style={{ color: 'var(--red-text)', fontWeight: 700 }}>ch. {m.ch}</span><br />{m.title}</li>)}
                  </ul>
                </Masked>
              </div>
            )}
          </div>
          <span className="small muted">Mỗi mốc ghi chương làm bằng chứng. Mốc đóng dấu son là một lần đột phá cảnh giới. Kéo cuộn tranh sang trái để xem các mốc trước.</span>
        </section>

        <section className="section" aria-labelledby="nhan-duyen">
          <div className="section-head">
            <span lang="zh" aria-hidden="true" className="brushfont">因缘</span>
            <span><h2 id="nhan-duyen">Nhân duyên</h2><span className="small muted">{v.masked ? 'Chọn chương để xem' : `${v.relations.length} mối quan hệ tới ch. ${v.at} · nét mực nhạt là duyên đã dứt`}</span></span>
          </div>
          {graph.length === 0 && !v.relationsAhead.length ? <p className="muted">Chưa có quan hệ nào được ghi nhận tới chương này.</p> : (
            <div className="graph-wrap">
              <Masked masked={v.masked} label={maskLabel}>
                <RelationGraph center={e.name_vi} centerZh={e.name_zh} nodes={graph} hrefOf={href} />
              </Masked>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Masked masked={v.masked} label={maskLabel}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {groups.map((g, gi) => (
                      <div key={g.t} className="rel-group">
                        {gi > 0 && <div className="hline" style={{ opacity: 0.35, marginBottom: 10 }} />}
                        <h3><span lang="zh" aria-hidden="true" className={`seal ${g.t === 'master' || g.t === 'dao_companion' ? '' : 'ink'}`}>{RELATION_SEAL[g.t]}</span>{RELATION_LABEL[g.t]}</h3>
                        {g.items.map((r) => {
                          const h = href(r)
                          const inner = <><span>{r.other.name_vi}</span><span>{r.ended ? `ch. ${r.from_ch}–${r.to_ch} · đã dứt` : `từ ch. ${r.from_ch}`}</span></>
                          return h ? <Link key={r.id} href={h} className={`rel-item ${r.ended ? 'ended' : ''}`}>{inner}</Link> : <div key={r.id} className="rel-item">{inner}</div>
                        })}
                      </div>
                    ))}
                  </div>
                </Masked>
                {!v.masked && v.relationsAhead.length > 0 && (
                  <Masked masked label={`Mây che ${v.relationsAhead.length} nhân duyên sau ${chLabel}`} cta="Vén mây">
                    <p className="small" style={{ margin: 0, padding: '14px 16px' }}>{v.relationsAhead.map((r) => `${r.other.name_vi} (${RELATION_LABEL[r.type].toLowerCase()})`).join(', ')}</p>
                  </Masked>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="section" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 48 }}>
          <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="section-head"><span lang="zh" aria-hidden="true" className="brushfont" style={{ fontSize: 48 }}>名号</span><h2 style={{ fontSize: 30 }}>Danh hiệu và bí danh</h2></div>
            {v.aliases.length === 0 && !v.masked && <p className="muted small">Chưa có bí danh nào tới chương này.</p>}
            <Masked masked={v.masked} label={maskLabel}>
              <div className="alias-grid">
                {(v.masked ? v.aliasesAhead : v.aliases).map((a) => (
                  <div key={a.id} className="alias-card"><span lang="zh" className="zh">{a.name}</span><b>{a.name_vi}</b>{a.note && <span className="small muted">{a.note}</span>}</div>
                ))}
              </div>
            </Masked>
            {!v.masked && v.aliasesAhead.length > 0 && (
              <Masked masked label={`Còn ${v.aliasesAhead.length} danh hiệu xuất hiện sau ${chLabel}`} cta="Hiện">
                <div className="alias-grid">{v.aliasesAhead.map((a) => <div key={a.id} className="alias-card"><span lang="zh" className="zh">{a.name}</span><b>{a.name_vi}</b></div>)}</div>
              </Masked>
            )}

            <div className="section-head" style={{ marginTop: 28 }}><span lang="zh" aria-hidden="true" className="brushfont" style={{ fontSize: 48 }}>足迹</span><h2 style={{ fontSize: 30 }}>Dấu chân</h2></div>
            <Masked masked={v.masked} label={maskLabel}>
              <div className="dots" style={{ '--n': v.bins.length } as React.CSSProperties} role="img" aria-label={`Số lần xuất hiện theo từng ${v.binSize} chương, tới ch. ${v.at}`}>
                {v.bins.map((b, i) => {
                  const size = b ? 5 + Math.round((b / maxBin) * 9) : 6
                  return <span key={i} className={b ? '' : 'zero'} style={{ width: size, height: size }} />
                })}
              </div>
              <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}><span>ch. 1</span><span>mỗi giọt mực là {v.binSize} chương</span><span>ch. {v.at}</span></div>
            </Masked>
            <p className="small muted" style={{ margin: 0 }}>Phần sau chương bạn đang đọc được che hoàn toàn, kể cả mật độ, để không lộ nhân vật còn quay lại hay không.</p>
          </div>

          <div className="vline" aria-hidden="true" />

          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="section-head"><span lang="zh" aria-hidden="true" className="brushfont" style={{ fontSize: 48 }}>印信</span><h2 style={{ fontSize: 30 }}>Độ tin cậy</h2></div>
            <div style={{ display: 'flex', gap: 28 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="seal">验</span><span><b className="display" style={{ fontSize: 30 }}>{v.verified}</b><br /><span className="small muted">fact đã đóng dấu</span></span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="seal ghost" /><span><b className="display" style={{ fontSize: 30 }}>{v.auto}</b><br /><span className="small muted">fact tự động</span></span></span>
            </div>
            <p className="small muted" style={{ margin: 0 }}>Dấu son nghĩa là đã có người đối chiếu với chương gốc. Fact tự động có độ tin cậy dưới 60% không được hiện.</p>
            <ReportButton novelId={novel.id} targetType="entity" targetId={e.id} label="Báo sai trên trang này" wide />
            <Link href={`/truyen/${novel.slug}/nhan-vat`} className="small">Xem các nhân vật khác <Arrow /></Link>
          </div>
        </section>
      </main>
    </div>
  )
}
