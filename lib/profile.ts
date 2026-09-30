// Turns a stored profile into what one reader at chapter `ch` may see. Pure: tested in test/profile.test.ts.
import { activeAt, binSize, endedBy, mentionBins } from './spoiler.ts'
import { RELATION_ORDER, type Perspective } from './labels.ts'
import type { Fact, Profile, Relation } from './queries.ts'

export type Milestone = { ch: number; title: string; sub: string; seal?: string }

export type ProfileView = {
  /** Chapter the page is computed at. Unknown reader or not-yet-appeared -> the whole novel, fully masked. */
  at: number
  masked: boolean
  reason: 'unknown' | 'not_yet' | null
  status: { attr: Fact['attr'] | 'master'; value: string; since: number; verified: boolean; id: number; kind: 'fact' | 'relation' }[]
  seen: Milestone[]
  ahead: Milestone[]
  relations: (Relation & { ended: boolean })[]
  relationsAhead: (Relation & { ended: boolean })[]
  aliases: Profile['aliases']
  aliasesAhead: Profile['aliases']
  bins: number[]
  binSize: number
  mentionsSoFar: number
  chaptersSoFar: number
  verified: number
  auto: number
}

const REALM_SEAL = (f: Fact) => [...f.value_zh].slice(0, 2).join('')

function milestones(p: Profile): Milestone[] {
  const out: Milestone[] = [{ ch: p.entity.first_ch, title: 'Xuất hiện lần đầu', sub: '' }]
  for (const f of p.facts) {
    if (f.attr === 'realm') out.push({ ch: f.from_ch, title: f.value, sub: 'Đột phá cảnh giới', seal: REALM_SEAL(f) || undefined })
    if (f.attr === 'faction') out.push({ ch: f.from_ch, title: `Gia nhập ${f.value}`, sub: '' })
    if (f.attr === 'location') out.push({ ch: f.from_ch, title: `Tới ${f.value}`, sub: '' })
    if (f.attr === 'status') out.push({ ch: f.from_ch, title: 'Qua đời', sub: '' })
  }
  for (const r of p.relations) {
    if (r.type === 'master') out.push({ ch: r.from_ch, title: `Bái ${r.other.name_vi} làm sư phụ`, sub: r.to_ch ? `Sư đồ tới ch. ${r.to_ch}` : '' })
    if (r.type === 'dao_companion') out.push({ ch: r.from_ch, title: `Kết đạo lữ với ${r.other.name_vi}`, sub: '' })
  }
  return out.sort((a, b) => a.ch - b.ch)
}

export function profileView(p: Profile, ch: number | null, chapterCount: number): ProfileView {
  const reason = ch === null ? 'unknown' : ch < p.entity.first_ch ? 'not_yet' : null
  const masked = reason !== null
  const at = masked ? chapterCount : ch!

  const status: ProfileView['status'] = []
  for (const attr of ['realm', 'faction', 'location', 'status'] as const) {
    const f = p.facts.find((x) => x.attr === attr && activeAt(x, at))
    if (f) status.push({ attr, value: f.value, since: f.from_ch, verified: f.review === 'verified', id: f.id, kind: 'fact' })
  }
  for (const r of p.relations.filter((r) => r.type === 'master' && activeAt(r, at))) {
    status.push({ attr: 'master', value: r.other.name_vi, since: r.from_ch, verified: r.review === 'verified', id: r.id, kind: 'relation' })
  }

  const all = milestones(p)
  // Sub-lines may mention an end chapter; drop it if that end is still in the reader's future.
  const hideFutureEnd = (m: Milestone) => {
    const end = m.sub.match(/tới ch\. (\d+)/)
    return end && Number(end[1]) > at ? { ...m, sub: '' } : m
  }
  const seen = masked ? [] : all.filter((m) => m.ch <= at).map(hideFutureEnd)
  const ahead = masked ? all : all.filter((m) => m.ch > at)

  const order = (a: Relation, b: Relation) => RELATION_ORDER.indexOf(a.type) - RELATION_ORDER.indexOf(b.type) || a.from_ch - b.from_ch
  const withEnd = (r: Relation) => ({ ...r, ended: endedBy(r, at) })
  const knownRel = (r: Relation) => r.from_ch <= at && r.other.first_ch <= at
  const relations = masked ? [] : p.relations.filter(knownRel).sort(order).map(withEnd)
  const relationsAhead = (masked ? p.relations : p.relations.filter((r) => !knownRel(r))).sort(order).map((r) => ({ ...r, ended: false }))

  const others = p.aliases.filter((a) => a.name !== p.entity.name_zh)
  const size = binSize(at)
  const facts = p.facts.filter((f) => f.from_ch <= at)
  return {
    at, masked, reason, status, seen, ahead, relations, relationsAhead,
    aliases: masked ? [] : others.filter((a) => a.first_ch <= at),
    aliasesAhead: masked ? others : others.filter((a) => a.first_ch > at),
    bins: mentionBins(p.mentions, at, size),
    binSize: size,
    mentionsSoFar: p.mentions.filter((m) => m.chapter <= at).length,
    chaptersSoFar: at,
    verified: facts.filter((f) => f.review === 'verified').length,
    auto: facts.filter((f) => f.review !== 'verified').length,
  }
}

/** Relations drawn on the graph: the strongest ties first, at most eight. */
export function graphNodes(rels: (Relation & { ended: boolean })[]) {
  const weight: Record<Perspective, number> = { master: 0, dao_companion: 1, disciple: 2, kin: 3, friend: 4, enemy: 5, colleague: 6, acquaintance: 7 }
  const seen = new Set<number>()
  return [...rels]
    .sort((a, b) => Number(a.ended) - Number(b.ended) || weight[a.type] - weight[b.type])
    .filter((r) => !seen.has(r.other.id) && seen.add(r.other.id))
    .slice(0, 8)
}
