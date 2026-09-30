// npm run pipeline:build -- <slug> [--publish]
// Turns per-chapter extractions into entities, aliases and chapter-interval facts, then loads them into Postgres.
// Human work is preserved: verified/rejected rows are never overwritten, and their exact duplicates are not re-added.
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import postgres from 'postgres'
import { parseRealm, resolveNames, toSpans, type NameObs, type Observation } from '../../lib/consolidate.ts'
import { hanViet, missingReadings, normalize, pinyinName, slugify, type ReadingTable } from '../../lib/text.ts'
import { loadConfig, paths, readJson, type Extraction } from './common.ts'

const cfg = loadConfig(process.argv[2])
const publish = process.argv.includes('--publish')
const table = readJson<ReadingTable>(paths.hanviet, {})
const meta = readJson<{ chapter_count: number } | null>(paths.work(cfg.slug) + 'meta.json', null)
if (!meta) throw new Error('Run pipeline:ingest first')
const dir = paths.work(cfg.slug) + 'extract/'
const results = (existsSync(dir) ? readdirSync(dir) : []).filter((f) => f.endsWith('.json'))
  .map((f) => readJson<{ n: number; data: Extraction }>(dir + f, null as never)).sort((a, b) => a.n - b.n)
if (!results.length) throw new Error('No extraction results; run pipeline:extract submit/collect first')
console.log(`${results.length} / ${meta.chapter_count} chapters extracted`)

// ---- 1. who is who ----
const trim = (s: string) => s.replace(/[\s（）()【】「」]/g, '')
const obsOf = (pick: (d: Extraction) => { name: string; surfaces: string[]; mentions?: number }[]): NameObs[] =>
  results.flatMap((r) => pick(r.data).filter((x) => trim(x.name)).map((x) => ({ ch: r.n, name: trim(x.name), surfaces: x.surfaces.map(trim).filter(Boolean), mentions: x.mentions ?? 1 })))
const people = resolveNames(obsOf((d) => d.characters))
const orgs = resolveNames(obsOf((d) => d.factions))
const places = resolveNames(obsOf((d) => d.locations))

type Ent = { type: 'character' | 'faction' | 'location'; zh: string; first: number; mentions: Map<number, number>; intro: string }
const ents = new Map<string, Ent>()
const key = (type: Ent['type'], zh: string) => `${type}:${zh}`
function touch(type: Ent['type'], zh: string, ch: number, count: number, intro = '') {
  const k = key(type, zh)
  const e = ents.get(k) ?? { type, zh, first: ch, mentions: new Map(), intro: '' }
  if (ch < e.first || (ch === e.first && !e.intro)) { e.first = ch; e.intro = intro || e.intro }
  e.mentions.set(ch, (e.mentions.get(ch) ?? 0) + count)
  ents.set(k, e)
}

// ---- 2. per-chapter observations ----
type RealmVal = NonNullable<ReturnType<typeof parseRealm>>
const realmObs = new Map<string, Observation<RealmVal>[]>()
const factionObs = new Map<string, Observation<string>[]>()
const placeObs = new Map<string, Observation<string>[]>()
const deaths = new Map<string, Observation<string>>()
const relObs = new Map<string, { a: string; b: string; type: string; obs: { ch: number; conf: number; ended: boolean; quote: string }[] }>()
const push = <V>(m: Map<string, Observation<V>[]>, k: string, o: Observation<V>) => m.set(k, [...(m.get(k) ?? []), o])

for (const { n, data } of results) {
  for (const f of data.factions) if (trim(f.name)) touch('faction', orgs.canon(trim(f.name)), n, 1)
  for (const l of data.locations) if (trim(l.name)) touch('location', places.canon(trim(l.name)), n, 1)
  for (const c of data.characters) {
    if (!trim(c.name)) continue
    const who = people.canon(trim(c.name))
    touch('character', who, n, Math.max(1, c.mentions), c.description_vi.trim())
    const base = { ch: n, conf: Math.max(0, Math.min(1, c.confidence)), quote: c.evidence.slice(0, 40) }
    const realm = c.realm && parseRealm(c.realm, cfg.realms)
    if (realm) push(realmObs, who, { ...base, value: realm })
    if (trim(c.faction)) push(factionObs, who, { ...base, value: orgs.canon(trim(c.faction)) })
    if (trim(c.location)) push(placeObs, who, { ...base, value: places.canon(trim(c.location)) })
    if (c.died && !deaths.has(who)) deaths.set(who, { ...base, value: '死亡' })
  }
  for (const r of data.relations) {
    const a = people.canon(trim(r.a)), b = people.canon(trim(r.b))
    if (!a || !b || a === b) continue
    const [x, y] = r.type === 'master' ? [a, b] : [a, b].sort()
    const k = `${x}|${y}|${r.type}`
    const rel = relObs.get(k) ?? { a: x, b: y, type: r.type, obs: [] }
    rel.obs.push({ ch: n, conf: Math.max(0, Math.min(1, r.confidence)), ended: r.ended, quote: r.evidence.slice(0, 40) })
    relObs.set(k, rel)
  }
}

// ---- 3. names ----
const missing = new Set<string>()
const viName = (zh: string) => {
  missingReadings(zh, table).forEach((c) => missing.add(c))
  return cfg.name_overrides[zh] ?? hanViet(zh, table)
}

// ---- 4. load ----
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} })
type Row = Record<string, unknown>
try {
  await sql.begin(async (tx) => {
    // Seeded sample data (db:seed) never mixes with real data.
    await tx`delete from novel where slug = ${cfg.slug} and is_sample`
    const [novel] = await tx<{ id: number }[]>`
      insert into novel (slug, title_zh, title_vi, author_vi, chapter_count, realms, cover, is_sample, is_live)
      values (${cfg.slug}, ${cfg.title_zh}, ${cfg.title_vi}, ${cfg.author_vi}, ${meta.chapter_count}, ${tx.json(cfg.realms)}, ${cfg.cover}, false, ${publish})
      on conflict (slug) do update set title_zh = excluded.title_zh, title_vi = excluded.title_vi, author_vi = excluded.author_vi,
        chapter_count = excluded.chapter_count, realms = excluded.realms, cover = excluded.cover, is_sample = false,
        is_live = novel.is_live or excluded.is_live
      returning id`

    // Entities: keep existing slugs so URLs never change; give new ones a free slug.
    const existing = await tx<{ id: number; type: string; name_zh: string; slug: string }[]>`select id, type, name_zh, slug from entity where novel_id = ${novel.id}`
    const used = new Set(existing.map((e) => `${e.type}:${e.slug}`))
    const slugOf = new Map(existing.map((e) => [key(e.type as Ent['type'], e.name_zh), e.slug]))
    const ordered = [...ents.values()].sort((a, b) => a.first - b.first)
    const rows: Row[] = ordered.map((e) => {
      const name_vi = viName(e.zh)
      let slug = slugOf.get(key(e.type, e.zh))
      if (!slug) {
        const base = slugify(name_vi)
        slug = base
        for (let i = 2; used.has(`${e.type}:${slug}`); i++) slug = `${base}-${i}`
        used.add(`${e.type}:${slug}`)
      }
      const total = [...e.mentions.values()].reduce((s, x) => s + x, 0)
      return {
        novel_id: novel.id, type: e.type, name_zh: e.zh, name_vi, slug, first_ch: e.first, intro_safe: e.intro,
        pinyin: e.type === 'character' ? pinyinName(e.zh, table) : '', role: e.zh === cfg.protagonist ? 'chinh' : 'phu', mention_total: total,
      }
    })
    const ids = new Map<string, number>()
    for (let i = 0; i < rows.length; i += 500) {
      const got = await tx<{ id: number; type: Ent['type']; name_zh: string }[]>`
        insert into entity ${tx(rows.slice(i, i + 500) as never[])}
        on conflict (novel_id, type, name_zh) do update set name_vi = excluded.name_vi, pinyin = excluded.pinyin, first_ch = excluded.first_ch,
          intro_safe = case when entity.intro_safe = '' then excluded.intro_safe else entity.intro_safe end,
          role = excluded.role, mention_total = excluded.mention_total
        returning id, type, name_zh`
      for (const g of got) ids.set(key(g.type, g.name_zh), g.id)
    }
    const idOf = (type: Ent['type'], zh: string) => ids.get(key(type, zh))

    // Mentions
    await tx`delete from mention where entity_id in (select id from entity where novel_id = ${novel.id})`
    const mrows = ordered.flatMap((e) => [...e.mentions].map(([chapter, count]) => ({ entity_id: idOf(e.type, e.zh)!, chapter, count })))
    for (let i = 0; i < mrows.length; i += 5000) await tx`insert into mention ${tx(mrows.slice(i, i + 5000))}`

    // Aliases
    const arows: Row[] = []
    for (const [res, type] of [[people, 'character'], [orgs, 'faction'], [places, 'location']] as const) {
      for (const [owner, surfaces] of res.aliases) {
        const entity_id = idOf(type, owner)
        if (!entity_id) continue
        for (const [name, first_ch] of surfaces) {
          const name_vi = viName(name), pinyin = type === 'character' ? pinyinName(name, table) : ''
          arows.push({ entity_id, name, name_vi, pinyin, search: normalize(`${name_vi} ${pinyin}`), first_ch, note: '' })
        }
      }
    }
    for (let i = 0; i < arows.length; i += 2000) await tx`insert into alias ${tx(arows.slice(i, i + 2000) as never[])} on conflict (entity_id, name) do nothing`

    // Facts: replace machine rows, keep human ones.
    await tx`delete from evidence where target_type = 'fact' and target_id in (
      select f.id from fact f join entity e on e.id = f.entity_id where e.novel_id = ${novel.id} and (f.review = 'auto' or (f.review = 'disputed' and f.flag <> '')))`
    await tx`delete from fact f using entity e where e.id = f.entity_id and e.novel_id = ${novel.id} and (f.review = 'auto' or (f.review = 'disputed' and f.flag <> ''))`
    const kept = new Set((await tx<{ k: string }[]>`
      select f.entity_id || '|' || f.attr || '|' || f.value_zh || '|' || f.from_ch as k from fact f join entity e on e.id = f.entity_id where e.novel_id = ${novel.id}`).map((r) => r.k))

    let factCount = 0
    async function addFact(entity: number, attr: string, value: string, value_zh: string, s: { from_ch: number; to_ch: number | null; chapters: number[]; confidence: number; quotes: { ch: number; quote: string }[] }, flag = '') {
      if (kept.has(`${entity}|${attr}|${value_zh}|${s.from_ch}`)) return
      const [f] = await tx<{ id: number }[]>`
        insert into fact (entity_id, attr, value, value_zh, from_ch, to_ch, evidence_ch, confidence, review, flag)
        values (${entity}, ${attr}, ${value}, ${value_zh}, ${s.from_ch}, ${s.to_ch}, ${s.chapters.slice(0, 20)}, ${s.confidence}, ${flag ? 'disputed' : 'auto'}, ${flag})
        returning id`
      const q = s.quotes.filter((x) => x.quote)
      if (q.length) await tx`insert into evidence ${tx(q.map((x) => ({ target_type: 'fact', target_id: f.id, chapter: x.ch, quote: x.quote })))}`
      factCount++
    }
    for (const [who, obs] of realmObs) {
      const id = idOf('character', who)
      if (!id) continue
      let prev = -1
      for (const s of toSpans(obs, (v) => v.vi)) {
        await addFact(id, 'realm', s.value.vi, s.value.zh, s, s.value.rank < prev ? 'realm_regression' : '')
        prev = Math.max(prev, s.value.rank)
      }
    }
    for (const [attr, m] of [['faction', factionObs], ['location', placeObs]] as const) {
      for (const [who, obs] of m) {
        const id = idOf('character', who)
        if (!id) continue
        for (const s of toSpans(obs)) await addFact(id, attr, viName(s.value), s.value, s)
      }
    }
    for (const [who, d] of deaths) {
      const e = ents.get(key('character', who)), id = idOf('character', who)
      if (!e || !id) continue
      const later = [...e.mentions.keys()].filter((c) => c > d.ch + 1).length
      await addFact(id, 'status', 'Đã mất', '死亡', { from_ch: d.ch, to_ch: null, chapters: [d.ch], confidence: d.conf, quotes: [{ ch: d.ch, quote: d.quote ?? '' }] }, later > 3 ? 'after_death' : '')
    }

    // Relations: upsert, but never touch a row a human has reviewed.
    let relCount = 0
    for (const r of relObs.values()) {
      const a = idOf('character', r.a), b = idOf('character', r.b)
      if (!a || !b) continue
      const [x, y] = r.type === 'master' ? [a, b] : [a, b].sort((p, q) => p - q)
      const chapters = [...new Set(r.obs.map((o) => o.ch))].sort((p, q) => p - q)
      const from = chapters[0]
      const end = r.obs.filter((o) => o.ended && o.ch > from).sort((p, q) => p.ch - q.ch)[0]?.ch ?? null
      const conf = Math.round((r.obs.reduce((s, o) => s + o.conf, 0) / r.obs.length) * Math.min(1, 0.7 + 0.1 * chapters.length) * 100) / 100
      const [row] = await tx<{ id: number }[]>`
        insert into relation (a_id, b_id, type, from_ch, to_ch, evidence_ch, confidence, review)
        values (${x}, ${y}, ${r.type}, ${from}, ${end}, ${chapters.slice(0, 20)}, ${conf}, 'auto')
        on conflict (a_id, b_id, type) do update set from_ch = excluded.from_ch, to_ch = excluded.to_ch, evidence_ch = excluded.evidence_ch, confidence = excluded.confidence
        where relation.review = 'auto'
        returning id`
      if (!row) continue
      await tx`delete from evidence where target_type = 'relation' and target_id = ${row.id}`
      const q = r.obs.filter((o) => o.quote).slice(0, 5)
      if (q.length) await tx`insert into evidence ${tx(q.map((o) => ({ target_type: 'relation', target_id: row.id, chapter: o.ch, quote: o.quote })))}`
      relCount++
    }

    // Contested nicknames go to the admin queue.
    for (const c of people.conflicts) {
      await tx`insert into alias_conflict (novel_id, surface, candidates, chapters)
               values (${novel.id}, ${c.surface}, ${tx.json(c.candidates)}, ${[...new Set(c.candidates.flatMap((x) => x.chapters))].sort((p, q) => p - q).slice(0, 50)})
               on conflict (novel_id, surface) do nothing`
    }
    console.log(`loaded ${rows.length} entities, ${arows.length} aliases, ${factCount} facts, ${relCount} relations, ${people.conflicts.length} alias conflicts${publish ? ' (live)' : ' (not live: run with --publish)'}`)
  })
} finally {
  await sql.end()
}

if (missing.size) {
  writeFileSync(paths.work(cfg.slug) + 'missing-readings.txt', [...missing].join('\n') + '\n')
  console.log(`${missing.size} characters have no Hán Việt reading; add names to name_overrides in data/novels/${cfg.slug}.json (list in missing-readings.txt)`)
}
