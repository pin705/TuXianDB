import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader.tsx'

export default function NotFound() {
  return (
    <div className="page">
      <SiteHeader />
      <main className="wrap above" style={{ paddingTop: 80, textAlign: 'center' }}>
        <p lang="zh" aria-hidden="true" className="brushfont muted" style={{ fontSize: 96, margin: 0 }}>无踪</p>
        <h1 className="display" style={{ fontSize: 44 }}>Không tìm thấy trang này</h1>
        <p className="muted">Có thể nhân vật đã đổi tên, hoặc đường dẫn bị sai.</p>
        <Link href="/" className="btn">Về trang chủ</Link>
      </main>
    </div>
  )
}
