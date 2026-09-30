'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap" style={{ paddingTop: 120, textAlign: 'center' }}>
      <p lang="zh" aria-hidden="true" className="brushfont muted" style={{ fontSize: 96, margin: 0 }}>走火</p>
      <h1 className="display" style={{ fontSize: 44 }}>Có lỗi khi tải trang</h1>
      <p className="muted">Thử lại sau giây lát. Nếu lỗi còn, hãy báo cho chúng tôi.</p>
      <button type="button" className="btn btn-solid" onClick={reset}>Thử lại</button>
    </main>
  )
}
