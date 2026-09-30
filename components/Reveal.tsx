'use client'
// Spoilers are already in the HTML, blurred. Revealing is a local, per-page-view choice.

function setRevealed(on: boolean) {
  const root = document.documentElement
  if (on) root.dataset.reveal = '1'
  else delete root.dataset.reveal
  document.querySelectorAll('.mask[data-masked] > .mask-body').forEach((el) => (on ? el.removeAttribute('aria-hidden') : el.setAttribute('aria-hidden', 'true')))
}

export function RevealButton({ label = 'Hiện (có spoiler)', className = 'btn btn-solid' }: { label?: string; className?: string }) {
  return <button type="button" className={className} onClick={() => setRevealed(true)}>{label}</button>
}

export function RollBackButton() {
  return <button type="button" className="link-btn only-revealed" onClick={() => setRevealed(false)}>Đang xem cả phần chưa mở · Cuộn lại</button>
}
