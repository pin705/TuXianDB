import { RELATION_LABEL, type Perspective } from '@/lib/labels.ts'
import type { Relation } from '@/lib/queries.ts'

// Fixed slots around the centre keep labels from colliding; eight is the most the graph shows.
const C = { x: 370, y: 258 }
const SLOTS: { x: number; y: number; label: 'above' | 'below' }[] = [
  { x: 112, y: 96, label: 'above' }, { x: 628, y: 96, label: 'above' },
  { x: 84, y: 268, label: 'below' }, { x: 656, y: 268, label: 'below' },
  { x: 152, y: 424, label: 'below' }, { x: 598, y: 424, label: 'below' },
  { x: 370, y: 440, label: 'below' }, { x: 370, y: 64, label: 'above' },
]

type Style = { color: string; width: number; dash?: string; rough: boolean }
function edgeStyle(type: Perspective, ended: boolean): Style {
  const red = '#d9574b', ink = '#e6dfcf', quiet = '#b3ac9d'
  const base: Style =
    type === 'master' || type === 'disciple' ? { color: red, width: 6, rough: true }
    : type === 'dao_companion' ? { color: red, width: 4, rough: true }
    : type === 'friend' || type === 'kin' ? { color: ink, width: 5, rough: true }
    : type === 'enemy' ? { color: ink, width: 3, dash: '10 6', rough: false }
    : { color: quiet, width: 2.5, rough: true }
  // A tie that has ended is a dry, broken brush stroke.
  return ended ? { ...base, width: Math.min(base.width, 3), dash: '2 8', rough: false } : base
}

export function RelationGraph({ center, centerZh, nodes, hrefOf }: {
  center: string
  centerZh: string
  nodes: (Relation & { ended: boolean })[]
  hrefOf: (r: Relation) => string | null
}) {
  return (
    <svg className="graph" viewBox="0 0 740 496" role="img" aria-label={`Nhân duyên của ${center}`}>
      <defs>
        <filter id="ink-edge"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves={2} seed={7} /><feDisplacementMap in="SourceGraphic" scale={6} /></filter>
      </defs>
      {nodes.map((r, i) => {
        const s = SLOTS[i], st = edgeStyle(r.type, r.ended)
        const cx = C.x + (s.x - C.x) * 0.6, cy = C.y + (s.y - C.y) * 0.35
        return (
          <path key={`e${r.id}`} d={`M${C.x} ${C.y} Q ${cx} ${cy} ${s.x} ${s.y}`} fill="none" stroke={st.color} strokeWidth={st.width}
            strokeDasharray={st.dash} strokeLinecap="round" opacity={r.ended ? 0.45 : 1} filter={st.rough ? 'url(#ink-edge)' : undefined} />
        )
      })}
      <circle cx={C.x} cy={C.y} r={82} fill="#0b0f15" opacity={0.92} />
      <image href="/ink/enso-bright.webp" x={C.x - 98} y={C.y - 98} width={196} height={196} />
      <text x={C.x} y={C.y + 8} textAnchor="middle" className="brushfont" fontSize={centerZh.length > 2 ? 40 : 52}>{centerZh}</text>
      <text x={C.x} y={C.y + 34} textAnchor="middle" fontSize={13} fontWeight={600}>{center}</text>
      {nodes.map((r, i) => {
        const s = SLOTS[i], st = edgeStyle(r.type, r.ended), href = hrefOf(r)
        const ly = s.label === 'above' ? s.y - 38 : s.y + 30
        const sub = `${RELATION_LABEL[r.type].toLowerCase()}${r.ended ? `, dứt ch. ${r.to_ch}` : ` từ ch. ${r.from_ch}`}`
        const label = (
          <>
            <text x={s.x} y={ly} textAnchor="middle" className="display" fontSize={22} fontWeight={700} opacity={r.ended ? 0.7 : 1}>{r.other.name_vi}</text>
            <text x={s.x} y={ly + 18} textAnchor="middle" fontSize={12.5} fill={st.color === '#d9574b' && !r.ended ? '#e0645a' : '#a09a8d'} style={{ fill: st.color === '#d9574b' && !r.ended ? '#e0645a' : '#a09a8d' }}>{sub}</text>
          </>
        )
        return (
          <g key={`n${r.id}`}>
            <circle cx={s.x} cy={s.y} r={8} fill={r.ended ? 'none' : st.color} stroke={r.ended ? '#a09a8d' : 'none'} strokeWidth={2} />
            {href ? <a href={href}>{label}</a> : label}
          </g>
        )
      })}
    </svg>
  )
}
