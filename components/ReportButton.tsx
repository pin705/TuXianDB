'use client'
import { useState } from 'react'

const Flag = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" />
  </svg>
)

type Props = { novelId: number; targetType: 'fact' | 'relation' | 'alias' | 'entity'; targetId: number; label: string; wide?: boolean }

export function ReportButton({ novelId, targetType, targetId, label, wide }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | string>('idle')
  async function send(form: FormData) {
    setState('sending')
    const res = await fetch('/api/report', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ novelId, targetType, targetId, message: form.get('message'), website: form.get('website') }),
    })
    setState(res.ok ? 'done' : ((await res.json().catch(() => null))?.error ?? 'Không gửi được, thử lại sau'))
  }
  return (
    <div>
      {wide
        ? <button type="button" className="btn" onClick={() => setOpen(!open)} aria-expanded={open}><Flag />{label}</button>
        : <button type="button" className="icon-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={label}><Flag /></button>}
      {open && (state === 'done'
        ? <p className="small" role="status">Đã gửi. Cảm ơn đạo hữu, người kiểm duyệt sẽ xem trong 72 giờ.</p>
        : <form action={send} className="report-form">
            <label className="small" htmlFor={`r-${targetType}-${targetId}`}>Sai ở đâu? Nếu được, ghi chương đúng.</label>
            <textarea id={`r-${targetType}-${targetId}`} name="message" required minLength={3} maxLength={1000} />
            <input name="website" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" />
            <button className="btn btn-solid" disabled={state === 'sending'}>Gửi báo sai</button>
            {state !== 'idle' && state !== 'sending' && <p className="small" role="alert">{state}</p>}
          </form>)}
    </div>
  )
}
