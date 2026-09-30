// Pipeline logic that turns per-chapter observations into entities, aliases and chapter intervals.
// Pure functions so they can be unit-tested without the API or a database.

export type Realm = { zh: string; vi: string }

const STAGES: [RegExp, number, string][] = [
  [/初期|前期/, 0, 'sơ kỳ'],
  [/中期/, 1, 'trung kỳ'],
  [/后期|後期/, 2, 'hậu kỳ'],
  [/大圆满|大圓滿|圆满|圓滿|巅峰|顶峰|巔峰/, 3, 'đại viên mãn'],
]

/** "筑基初期" -> { rank: 10, vi: "Trúc Cơ sơ kỳ" }. Ranks compare across stages: realm*10 + stage. */
export function parseRealm(raw: string, realms: Realm[]): { rank: number; vi: string; zh: string } | null {
  const idx = realms.findIndex((r) => raw.includes(r.zh))
  if (idx < 0) return null
  const stage = STAGES.find(([re]) => re.test(raw))
  return {
    rank: idx * 10 + (stage ? stage[1] : 0),
    vi: `${realms[idx].vi} ${stage ? stage[2] : 'kỳ'}`,
    zh: realms[idx].zh + (stage ? raw.match(stage[0])![0] : ''),
  }
}

export type Observation<V> = { ch: number; value: V; conf: number; quote?: string }
export type Span<V> = {
  value: V
  from_ch: number
  to_ch: number | null
  chapters: number[]
  confidence: number
  quotes: { ch: number; quote: string }[]
}

/**
 * Consecutive observations with the same value become one span; a new value closes the previous span.
 * Within one chapter the most confident observation wins.
 */
export function toSpans<V>(obs: Observation<V>[], key: (v: V) => string = String): Span<V>[] {
  const best = new Map<number, Observation<V>>()
  for (const o of obs) if (!best.has(o.ch) || best.get(o.ch)!.conf < o.conf) best.set(o.ch, o)
  const sorted = [...best.values()].sort((a, b) => a.ch - b.ch)
  const spans: (Span<V> & { confs: number[] })[] = []
  for (const o of sorted) {
    const cur = spans.at(-1)
    if (cur && key(cur.value) === key(o.value)) {
      cur.chapters.push(o.ch)
      cur.confs.push(o.conf)
      if (o.quote && cur.quotes.length < 5) cur.quotes.push({ ch: o.ch, quote: o.quote })
      continue
    }
    if (cur) cur.to_ch = o.ch
    spans.push({ value: o.value, from_ch: o.ch, to_ch: null, chapters: [o.ch], confs: [o.conf], confidence: 0, quotes: o.quote ? [{ ch: o.ch, quote: o.quote }] : [] })
  }
  return spans.map(({ confs, ...s }) => ({
    ...s,
    // More chapters agreeing = more trust, capped at the mean model confidence.
    confidence: round((confs.reduce((a, b) => a + b, 0) / confs.length) * Math.min(1, 0.7 + 0.1 * confs.length)),
  }))
}

const round = (n: number) => Math.round(n * 100) / 100

/** Generic forms of address that never identify one person. */
const GENERIC = new Set([
  '前辈', '道友', '师兄', '师弟', '师姐', '师妹', '师父', '师尊', '师傅', '老夫', '在下', '此人', '那人', '小子', '少年', '老者', '此子',
  '他', '她', '你', '我', '晚辈', '贫道', '本座', '阁下', '公子', '姑娘', '大哥', '兄台', '老祖', '主人',
])

export type NameObs = { ch: number; name: string; surfaces: string[]; mentions: number }

export type Resolution = {
  canon: (name: string) => string
  /** canonical name -> surface -> first chapter */
  aliases: Map<string, Map<string, number>>
  conflicts: { surface: string; candidates: { name_zh: string; chapters: number[] }[] }[]
}

/**
 * Entity resolution across the whole novel, without processing chapters in order:
 * 1. a name that the text keeps using for a bigger character is merged into it
 *    (e.g. the model sometimes reports 韩老魔 as its own character);
 * 2. a surface used for several different characters is a conflict for a human.
 */
export function resolveNames(obs: NameObs[], minMergeChapters = 3): Resolution {
  const total = new Map<string, number>()
  const use = new Map<string, Map<string, Set<number>>>()
  for (const o of obs) {
    total.set(o.name, (total.get(o.name) ?? 0) + Math.max(1, o.mentions))
    for (const s of new Set([o.name, ...o.surfaces])) {
      if (!s || GENERIC.has(s)) continue
      if (!use.has(s)) use.set(s, new Map())
      const byName = use.get(s)!
      if (!byName.has(o.name)) byName.set(o.name, new Set())
      byName.get(o.name)!.add(o.ch)
    }
  }

  const parent = new Map<string, string>()
  const find = (n: string): string => {
    let p = n
    while (parent.has(p)) p = parent.get(p)!
    return p
  }
  for (const [surface, byName] of use) {
    if (!total.has(surface)) continue
    for (const [owner, chs] of byName) {
      const a = find(surface), b = find(owner)
      if (a !== b && chs.size >= minMergeChapters && total.get(b)! > total.get(a)!) parent.set(a, b)
    }
  }

  const aliases = new Map<string, Map<string, number>>()
  const conflicts: Resolution['conflicts'] = []
  for (const [surface, byName] of use) {
    const byCanon = new Map<string, number[]>()
    for (const [owner, chs] of byName) byCanon.set(find(owner), [...(byCanon.get(find(owner)) ?? []), ...chs])
    const ranked = [...byCanon].sort((a, b) => b[1].length - a[1].length)
    const [top, second] = ranked
    const contested = second && second[1].length >= 2 && second[1].length * 4 > top[1].length
    if (contested && !total.has(surface)) {
      conflicts.push({ surface, candidates: ranked.map(([name_zh, chs]) => ({ name_zh, chapters: [...new Set(chs)].sort((x, y) => x - y) })) })
      continue
    }
    const owner = total.has(surface) ? find(surface) : top[0]
    const chs = byCanon.get(owner) ?? top[1]
    if (!aliases.has(owner)) aliases.set(owner, new Map())
    aliases.get(owner)!.set(surface, Math.min(...chs))
  }
  return { canon: find, aliases, conflicts }
}
