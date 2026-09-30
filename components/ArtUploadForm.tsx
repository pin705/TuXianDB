'use client'
import { useState } from 'react'
import Link from 'next/link'

type Props = { novel: string; kind: 'cover' | 'portrait'; entity?: string; firstCh?: number; chapterCount: number }

export function ArtUploadForm({ novel, kind, entity, firstCh = 1, chapterCount }: Props) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | string>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  async function send(form: FormData) {
    setState('sending')
    form.set('novel', novel)
    form.set('kind', kind)
    if (entity) form.set('entity', entity)
    const res = await fetch('/api/media', { method: 'POST', body: form })
    setState(res.ok ? 'done' : ((await res.json().catch(() => null))?.error ?? 'Không gửi được, thử lại sau'))
  }
  if (state === 'done') return (
    <div role="status" className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <b className="display" style={{ fontSize: 28 }}>Đã nhận tranh. Cảm ơn đạo hữu!</b>
      <span className="muted">Người kiểm duyệt sẽ xem trong vài ngày. Tranh được duyệt sẽ hiện kèm tên và link của bạn.</span>
      <Link href="/">Về trang chủ</Link>
    </div>
  )
  return (
    <form action={send} className="form-grid">
      <label>Ảnh (JPG, PNG, WebP · tối đa 4 MB · tối thiểu {kind === 'cover' ? 400 : 300}px mỗi chiều)
        <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required
          onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null) }} />
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
      {preview && <img src={preview} alt="Xem trước" style={{ maxWidth: 240, borderRadius: 4 }} />}
      {kind === 'portrait' && (
        <label>Tranh vẽ nhân vật ở giai đoạn từ chương nào?
          <input type="number" name="from_ch" min={firstCh} max={chapterCount} defaultValue={firstCh} required />
          <span className="small muted">Người đọc chỉ thấy tranh khi đã đọc tới chương này, để tranh không thành spoiler.</span>
        </label>
      )}
      <label>Tên hoặc bút danh họa sĩ<input type="text" name="artist_name" required minLength={2} maxLength={80} /></label>
      <label>Link trang cá nhân (tuỳ chọn)<input type="url" name="artist_url" placeholder="https://" maxLength={300} /></label>
      <label>Email liên hệ<input type="email" name="artist_email" required maxLength={120} />
        <span className="small muted">Không hiển thị công khai. Chỉ dùng để xác minh tác giả và liên hệ khi có yêu cầu gỡ.</span>
      </label>
      <label>Giấy phép
        <select name="license" required defaultValue="">
          <option value="" disabled>Chọn giấy phép</option>
          <option value="display-only">Chỉ cho phép TuXianDB hiển thị, tôi giữ mọi quyền</option>
          <option value="cc-by-nc">CC BY-NC 4.0 (ghi tên, không thương mại)</option>
          <option value="cc-by">CC BY 4.0 (ghi tên)</option>
        </select>
      </label>
      <label className="check"><input type="checkbox" name="author" required />Tôi là người vẽ bức tranh này.</label>
      <label className="check"><input type="checkbox" name="original" required />Tranh không chụp, cắt hay lấy từ donghua, truyện tranh, ảnh bìa chính thức hoặc tác phẩm của người khác.</label>
      <label className="check"><input type="checkbox" name="no_spoiler" required />Tranh không tiết lộ tình tiết sau chương đã chọn.</label>
      <input name="website" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-solid" disabled={state === 'sending'}>{state === 'sending' ? 'Đang gửi…' : 'Gửi tranh'}</button>
        <span className="small muted">Xem <Link href="/ban-quyen">điều khoản đóng góp và bản quyền</Link>.</span>
      </div>
      {state !== 'idle' && state !== 'sending' && <p role="alert" className="small" style={{ color: 'var(--red-text)' }}>{state}</p>}
    </form>
  )
}
