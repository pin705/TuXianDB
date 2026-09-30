import type { Metadata } from 'next'
import Link from 'next/link'
import { openConflicts, openReports, pendingMedia, reviewQueue, stats } from '@/lib/admin.ts'
import { LICENSES } from '@/lib/media.ts'
import { closeReport, edit, moderateMedia, review, settleConflict } from './actions.ts'

export const metadata: Metadata = { title: 'Kiểm duyệt', robots: { index: false } }

const TABS = { queue: 'Hàng đợi', reports: 'Báo sai', conflicts: 'Gộp bí danh', tranh: 'Tranh' } as const

function Stamp({ kind, id }: { kind: string; id: number }) {
  return (
    <form action={review}>
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
      <button name="review" value="verified" className="btn btn-solid" style={{ minHeight: 44 }}><span className="seal" style={{ width: 24, height: 24, fontSize: 16 }}>验</span>Đóng dấu</button>
      <button name="review" value="rejected" className="link-btn">Bác bỏ</button>
    </form>
  )
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (Object.keys(TABS).includes((await searchParams).tab ?? '') ? (await searchParams).tab : 'queue') as keyof typeof TABS
  const s = await stats()
  const precision = s.verified + s.rejected ? Math.round((s.verified / (s.verified + s.rejected)) * 1000) / 10 : null
  return (
    <div className="page admin">
      <header className="wrap site-header">
        <Link href="/" className="logo"><span className="seal" aria-hidden="true">仙</span><b>TuXianDB</b></Link>
        <span className="pill">Kiểm duyệt</span>
        <nav aria-label="Khu vực" style={{ display: 'flex', gap: 6, marginLeft: 20 }}>
          {Object.entries(TABS).map(([k, l]) => (
            <Link key={k} href={`/admin?tab=${k}`} className="chip" aria-current={tab === k ? 'page' : undefined}>
              {l} · {k === 'queue' ? s.queue : k === 'reports' ? s.open_reports : k === 'tranh' ? s.media : '…'}
            </Link>
          ))}
        </nav>
      </header>
      <div className="wrap"><div className="hline" /></div>

      <main className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 20 }}>
        <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
          <div><span className="small muted">Top 200 nhân vật đã đóng dấu hết (cần 200 để launch)</span><br /><b className="display" style={{ fontSize: 44 }}>{s.top_done}</b><span className="display muted" style={{ fontSize: 22 }}> / {s.top_total}</span></div>
          <div><span className="small muted">Tỷ lệ đúng trên fact đã duyệt (ngưỡng 95%)</span><br /><b className="display" style={{ fontSize: 44, color: precision !== null && precision >= 95 ? 'var(--jade-text)' : 'var(--text)' }}>{precision === null ? '—' : `${precision}%`}</b></div>
          <div><span className="small muted">Báo sai mở quá 72 giờ</span><br /><b className="display" style={{ fontSize: 44, color: s.stale_reports ? 'var(--red-text)' : 'var(--text)' }}>{s.stale_reports}</b><span className="display muted" style={{ fontSize: 20 }}> / {s.open_reports} đang mở</span></div>
        </div>

        {tab === 'queue' && <Queue />}
        {tab === 'reports' && <Reports />}
        {tab === 'conflicts' && <Conflicts />}
        {tab === 'tranh' && <Media />}
      </main>
    </div>
  )
}

async function Queue() {
  const items = await reviewQueue()
  if (!items.length) return <p className="muted">Hàng đợi trống.</p>
  return (
    <div className="panel" style={{ padding: '6px 0' }}>
      <table>
        <thead><tr><th>Điểm</th><th>Mục</th><th>Bằng chứng</th><th>Sửa khoảng chương</th><th>Duyệt</th></tr></thead>
        <tbody>
          {items.map((q) => (
            <tr key={`${q.kind}${q.id}`}>
              <td style={{ fontWeight: 700 }}>{q.priority >= 1e6 ? <span className="pill red">{q.flag || 'tranh chấp'}</span> : Math.round(q.priority)}</td>
              <td>
                <Link href={`/truyen/${q.novel_slug}/nhan-vat/${q.subject_slug}`}>{q.subject}</Link> · {q.detail}<br />
                <span className="small muted">{q.kind} · ch. {q.from_ch}{q.to_ch ? `–${q.to_ch}` : '+'} · tin cậy {Math.round(q.confidence * 100)}%</span>
              </td>
              <td className="small">{q.quotes.length ? q.quotes.map((v) => <div key={v.chapter}><b style={{ color: 'var(--red-text)' }}>ch. {v.chapter}</b> {v.quote}</div>) : <span className="muted">—</span>}</td>
              <td>
                <form action={edit} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><input type="hidden" name="kind" value={q.kind} /><input type="hidden" name="id" value={q.id} />
                  <input type="number" name="from" defaultValue={q.from_ch} aria-label="Từ chương" min={0} required />
                  <input type="number" name="to" defaultValue={q.to_ch ?? ''} aria-label="Tới chương (để trống nếu chưa kết thúc)" min={1} />
                  {q.kind === 'fact' && <input type="text" name="value" placeholder="giá trị mới" aria-label="Giá trị mới" />}
                  <button className="link-btn">Lưu</button>
                </form>
              </td>
              <td><Stamp kind={q.kind} id={q.id} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

async function Reports() {
  const items = await openReports()
  if (!items.length) return <p className="muted">Không có báo sai nào đang mở.</p>
  return (
    <div className="panel" style={{ padding: '6px 0' }}>
      <table>
        <thead><tr><th>Gửi lúc</th><th>Mục bị báo</th><th>Nội dung</th><th /></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td className="small">{r.created_at.toLocaleString('vi-VN')}</td>
              <td>{r.target}<br /><span className="small muted">{r.target_type} #{r.target_id}</span></td>
              <td style={{ maxWidth: 420 }}>{r.message}</td>
              <td>
                {(r.target_type === 'fact' || r.target_type === 'relation') && <form action={review}><input type="hidden" name="kind" value={r.target_type} /><input type="hidden" name="id" value={r.target_id} /><button name="review" value="disputed" className="link-btn">Đưa vào hàng đợi</button></form>}
                <form action={closeReport}><input type="hidden" name="id" value={r.id} /><button className="link-btn">Đã xử lý</button></form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

async function Conflicts() {
  const items = await openConflicts()
  if (!items.length) return <p className="muted">Không có bí danh nào cần gộp.</p>
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {items.map((c) => (
        <form key={c.id} action={settleConflict} className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="id" value={c.id} />
          <h2 className="display" style={{ fontSize: 30 }}>“<span lang="zh" className="brushfont">{c.surface}</span>” là ai?</h2>
          {c.candidates.map((x) => (
            <label key={x.name_zh} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
              <input type="radio" name="choice" value={x.entity_id ?? 'new'} required />
              <span><b>{x.name_vi ?? x.name_zh}</b> <span lang="zh" className="zh muted">{x.name_zh}</span> · ch. {x.chapters.join(', ')}{x.entity_id ? '' : ' · chưa có thực thể'}</span>
            </label>
          ))}
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}><input type="radio" name="choice" value="new" />Thực thể mới</label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}><input type="radio" name="choice" value="dismiss" />Không phải tên riêng, bỏ qua</label>
          <button className="btn btn-solid" style={{ alignSelf: 'flex-start' }}>Lưu</button>
        </form>
      ))}
    </div>
  )
}

async function Media() {
  const items = await pendingMedia()
  const ai = items.filter((m) => m.source === 'ai')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form action={moderateMedia} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><label className="small muted" htmlFor="takedown">Gỡ tranh đã duyệt (yêu cầu bản quyền): mã tranh</label>
        <input id="takedown" type="number" name="id" min={1} required />
        <button name="status" value="rejected" className="link-btn">Gỡ</button>
      </form>
      <p className="small muted" style={{ margin: 0 }}>Kiểm tra: đúng nhân vật, không phải ảnh chụp donghua hay tranh của người khác (thử tìm ngược bằng Google Lens), không lộ tình tiết sau chương đã chọn.</p>
      {ai.length > 1 && (
        <form action={moderateMedia}>{ai.map((m) => <input key={m.id} type="hidden" name="id" value={m.id} />)}
          <button name="status" value="approved" className="btn">Duyệt cả {ai.length} tranh AI đang hiển thị</button>
        </form>
      )}
      {!items.length && <p className="muted">Không có tranh nào chờ duyệt.</p>}
      <div className="art-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {items.map((m) => (
          <figure key={m.id} className="art-card panel" style={{ padding: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
            <img src={`/admin/media/${m.id}`} alt="" width={m.width} height={m.height} />
            <figcaption className="small" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <b>{m.kind === 'cover' ? `Bìa ${m.novel_title}` : <Link href={`/truyen/${m.novel_slug}/nhan-vat/${m.entity_slug}`}>{m.entity_name}</Link>}</b>
              {m.source === 'ai'
                ? <span className="muted">AI · theo mô tả ch. {m.from_ch}</span>
                : <span className="muted">{m.artist_name} · {m.artist_email}{m.artist_url && <> · <a href={m.artist_url} target="_blank" rel="noopener noreferrer">link</a></>}<br />{LICENSES[m.license as keyof typeof LICENSES]?.label} · từ ch. {m.from_ch} · {m.width}×{m.height}</span>}
              <form action={moderateMedia} style={{ display: 'flex', gap: 10 }}><input type="hidden" name="id" value={m.id} />
                <button name="status" value="approved" className="btn btn-solid" style={{ minHeight: 44 }}>Duyệt</button>
                <button name="status" value="rejected" className="link-btn">Từ chối</button>
              </form>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
