import { ChapterGate } from './ChapterGate.tsx'
import { RollBackButton } from './Reveal.tsx'
import type { Novel } from '@/lib/queries.ts'

/** The rolled-up scroll: how far this reader has opened the novel. */
export function ChapterBar({ novel, ch }: { novel: Novel; ch: number | null }) {
  const pct = ch === null ? 0 : (ch / novel.chapter_count) * 100
  return (
    <div className="wrap above">
      <div className="chapter-bar">
        <span className="small muted">{ch === null ? 'Chưa chọn chương' : 'Cuộn đã mở tới'}</span>
        {ch !== null && <span className="num">ch. {ch.toLocaleString('vi')}</span>}
        <span className="small muted">/ {novel.chapter_count.toLocaleString('vi')}</span>
        <div className="mini-scroll" aria-hidden="true">
          <span className="rod" /><span className="painted" style={{ width: `${pct}%` }} /><span className="rod" style={{ width: 11 }} /><span className="rest" />
        </div>
        <RollBackButton />
        <ChapterGate novelSlug={novel.slug} novelTitle={novel.title_vi} chapterCount={novel.chapter_count} current={ch} autoOpen={ch === null} />
      </div>
      {novel.is_sample && <p className="sample-banner">Dữ liệu mẫu để xem thử giao diện: số chương, cảnh giới và quan hệ chưa được kiểm chứng với truyện.</p>}
    </div>
  )
}
