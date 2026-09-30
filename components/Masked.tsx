import { RevealButton } from './Reveal.tsx'

/** Blurs its content until the reader chooses to reveal it. Content stays in the HTML (same page for people and crawlers). */
export function Masked({ masked, label, cta, children, className = '' }: { masked: boolean; label?: React.ReactNode; cta?: string; children: React.ReactNode; className?: string }) {
  if (!masked) return <div className={className}>{children}</div>
  return (
    <div className={`mask ${className}`} data-masked="">
      <div className="mask-body" aria-hidden="true">{children}</div>
      <div className="mask-cover">
        {label && <span className="small">{label}</span>}
        <RevealButton label={cta} className="link-btn" />
      </div>
    </div>
  )
}
