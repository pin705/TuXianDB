'use client'
import { useEffect, useRef, useState } from 'react'
import { setChapter } from '@/app/actions.ts'

/** "Đạo hữu đọc tới đâu rồi?" — native <dialog> gives focus trapping and Esc for free. */
export function ChapterGate({ novelSlug, novelTitle, chapterCount, current, autoOpen }: {
  novelSlug: string; novelTitle: string; chapterCount: number; current: number | null; autoOpen: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [ch, setCh] = useState(current ?? Math.min(100, chapterCount))
  const [pending, setPending] = useState(false)
  useEffect(() => { if (autoOpen) ref.current?.showModal() }, [autoOpen])
  const clamp = (v: number) => Math.max(0, Math.min(chapterCount, Math.round(v || 0)))
  const save = async (value: number) => {
    setPending(true)
    await setChapter(novelSlug, value)
    setPending(false)
    ref.current?.close()
  }
  const ticks = [1, ...[0.2, 0.4, 0.6, 0.8].map((f) => Math.round((chapterCount * f) / 100) * 100), chapterCount]
  return (
    <>
      <button type="button" className="btn btn-solid" onClick={() => ref.current?.showModal()}>{current === null ? 'Chọn chương' : 'Đổi chương'}</button>
      <dialog ref={ref} className="gate frame" aria-labelledby="gate-title">
        <form method="dialog" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="small muted" style={{ fontWeight: 600, letterSpacing: '0.05em' }}>{novelTitle.toUpperCase()} · {chapterCount.toLocaleString('vi')} CHƯƠNG</span>
          <button className="icon-btn" aria-label="Để sau">✕</button>
        </form>
        <div>
          <h2 id="gate-title">Đạo hữu đọc tới đâu rồi?</h2>
          <p className="muted" style={{ margin: '8px 0 0' }}>Cuộn tranh chỉ mở tới chương bạn đã đọc. Đổi lại lúc nào cũng được.</p>
        </div>
        <form action={() => save(ch)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <label htmlFor="gate-ch" className="muted">Chương</label>
            <input id="gate-ch" className="ch-input" type="number" min={0} max={chapterCount} value={ch} onChange={(e) => setCh(clamp(Number(e.target.value)))} />
            <span className="display muted" style={{ fontSize: 28 }}>/ {chapterCount.toLocaleString('vi')}</span>
            <span className="spacer" />
            <button type="button" className="link-btn" onClick={() => save(0)}>Chưa đọc</button>
            <button type="button" className="link-btn" onClick={() => save(chapterCount)}>Đã đọc xong</button>
          </div>
          <input type="range" className="ink-range" min={0} max={chapterCount} value={ch} onChange={(e) => setCh(clamp(Number(e.target.value)))} aria-label="Kéo giọt mực tới chương đang đọc" />
          <div className="ticks" aria-hidden="true">{ticks.map((t, i) => <span key={i}>{t.toLocaleString('vi')}</span>)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn btn-solid" style={{ minHeight: 60, fontSize: 16 }} disabled={pending}>Mở cuộn tới ch. {ch.toLocaleString('vi')} →</button>
            <span className="small muted">Lưu riêng cho truyện này, trên trình duyệt của bạn.</span>
          </div>
        </form>
      </dialog>
    </>
  )
}
