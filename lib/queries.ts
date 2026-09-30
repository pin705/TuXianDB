// Read queries for public pages. Spoiler filtering by chapter happens in lib/spoiler.ts and the pages;
// here we only drop what is never public (rejected, disputed, low confidence).
import { sql } from './db.ts'
import { MIN_AUTO_CONFIDENCE, type Review } from './spoiler.ts'
import { perspective, type Attr, type Perspective, type RelationType } from './labels.ts'
import { isHan, normalize } from './text.ts'

export type Novel = {
  id: number
  slug: string
  title_zh: string
  title_vi: string
  author_vi: string
  chapter_count: number
  realms: { zh: string; vi: string }[]
  cover: string
  is_sample: boolean
}

export type Entity = {
  id: number
  slug: string
  type: 'character' | 'faction' | 'location'
  name_zh: string
  name_vi: string
  pinyin: string
  first_ch: number
  intro_safe: string
  role: 'chinh' | 'phu'
  mention_total: number
}

export type Fact = {
  id: number
  attr: Attr
  value: string
  value_zh: string
  from_ch: number
  to_ch: number | null
  review: Review
  confidence: number
}

export type Relation = {
  id: number
  type: Perspective
  from_ch: number
  to_ch: number | null
  review: Review
  confidence: number
  other: Pick<Entity, 'id' | 'slug' | 'type' | 'name_vi' | 'name_zh' | 'first_ch'>
}

export type Alias = { id: number; name: string; name_vi: string; pinyin: string; note: string; first_ch: number }

const SHOWN = sql`(review = 'verified' or (review = 'auto' and confidence >= ${MIN_AUTO_CONFIDENCE}))`

const NOVEL_COLS = sql`id, slug, title_zh, title_vi, author_vi, chapter_count, realms, cover, is_sample`

export async function listNovels(): Promise<Novel[]> {
  return sql<Novel[]>`select ${NOVEL_COLS} from novel where is_live or is_sample order by id`
}

export async function getNovel(slug: string): Promise<Novel | null> {
  const [n] = await sql<Novel[]>`select ${NOVEL_COLS} from novel where slug = ${slug} and (is_live or is_sample)`
  return n ?? null
}

export type Profile = {
  entity: Entity
  facts: Fact[]
  relations: Relation[]
  aliases: Alias[]
  mentions: { chapter: number; count: number }[]
}

export async function getProfile(novelId: number, slug: string): Promise<Profile | null> {
  const [entity] = await sql<Entity[]>`
    select id, slug, type, name_zh, name_vi, pinyin, first_ch, intro_safe, role, mention_total
    from entity where novel_id = ${novelId} and type = 'character' and slug = ${slug}`
  if (!entity) return null
  const [facts, rels, aliases, mentions] = await Promise.all([
    sql<Fact[]>`
      select id, attr, value, value_zh, from_ch, to_ch, review, confidence from fact
      where entity_id = ${entity.id} and ${SHOWN} order by from_ch, id`,
    sql<(Omit<Relation, 'type' | 'other'> & { type: RelationType; owner_is_a: boolean; o_id: number; o_slug: string; o_type: Entity['type']; o_name_vi: string; o_name_zh: string; o_first_ch: number })[]>`
      select r.id, r.type, r.from_ch, r.to_ch, r.review, r.confidence, r.a_id = ${entity.id} as owner_is_a,
             o.id as o_id, o.slug as o_slug, o.type as o_type, o.name_vi as o_name_vi, o.name_zh as o_name_zh, o.first_ch as o_first_ch
      from relation r join entity o on o.id = case when r.a_id = ${entity.id} then r.b_id else r.a_id end
      where (r.a_id = ${entity.id} or r.b_id = ${entity.id}) and ${sql`(r.review = 'verified' or (r.review = 'auto' and r.confidence >= ${MIN_AUTO_CONFIDENCE}))`}
      order by r.from_ch, r.id`,
    sql<Alias[]>`select id, name, name_vi, pinyin, note, first_ch from alias where entity_id = ${entity.id} order by first_ch, id`,
    sql<{ chapter: number; count: number }[]>`select chapter, count from mention where entity_id = ${entity.id} order by chapter`,
  ])
  const relations = rels.map((r) => ({
    id: r.id, from_ch: r.from_ch, to_ch: r.to_ch, review: r.review, confidence: r.confidence,
    type: perspective(r.type, r.owner_is_a),
    other: { id: r.o_id, slug: r.o_slug, type: r.o_type, name_vi: r.o_name_vi, name_zh: r.o_name_zh, first_ch: r.o_first_ch },
  }))
  return { entity, facts, relations, aliases, mentions }
}

export type ListItem = Pick<Entity, 'id' | 'slug' | 'name_vi' | 'name_zh' | 'first_ch' | 'role'> & {
  faction: string
  realm: string
  realmRank: number
  dead: boolean
  mentions: number
  verified: boolean
}

export type ListFilter = { faction?: string; realm?: number; alive?: boolean; verifiedOnly?: boolean; sort?: 'mentions' | 'first' | 'name' }

/**
 * Characters known at chapter `ch`, with their state at `ch`. Sorting uses only data up to `ch`
 * so an unusual rank cannot leak someone's future importance.
 */
export async function listCharacters(novel: Novel, ch: number, f: ListFilter) {
  const [ents, facts, counts] = await Promise.all([
    sql<ListItem[]>`
      select id, slug, name_vi, name_zh, first_ch, role from entity
      where novel_id = ${novel.id} and type = 'character' and first_ch <= ${ch}`,
    sql<{ entity_id: number; attr: Attr; value: string; value_zh: string; review: Review }[]>`
      select f.entity_id, f.attr, f.value, f.value_zh, f.review from fact f join entity e on e.id = f.entity_id
      where e.novel_id = ${novel.id} and f.from_ch <= ${ch} and (f.to_ch is null or f.to_ch > ${ch})
        and ${sql`(f.review = 'verified' or (f.review = 'auto' and f.confidence >= ${MIN_AUTO_CONFIDENCE}))`}`,
    sql<{ entity_id: number; n: number }[]>`
      select m.entity_id, sum(m.count)::int as n from mention m join entity e on e.id = m.entity_id
      where e.novel_id = ${novel.id} and m.chapter <= ${ch} group by m.entity_id`,
  ])
  const byId = new Map(ents.map((e) => [e.id, { ...e, faction: '', realm: '', realmRank: -1, dead: false, mentions: 0, verified: false, unverified: false }]))
  for (const c of counts) if (byId.has(c.entity_id)) byId.get(c.entity_id)!.mentions = c.n
  for (const x of facts) {
    const e = byId.get(x.entity_id)
    if (!e) continue
    if (x.review === 'verified') e.verified = true
    else e.unverified = true
    if (x.attr === 'faction') e.faction = x.value
    if (x.attr === 'status') e.dead = true
    if (x.attr === 'realm') {
      e.realm = x.value
      e.realmRank = novel.realms.findIndex((r) => x.value_zh.startsWith(r.zh) || x.value.startsWith(r.vi))
    }
  }
  const all = [...byId.values()]
  const factions = [...new Set(all.map((e) => e.faction).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
  let items = all.filter((e) =>
    (!f.faction || e.faction === f.faction) &&
    (f.realm === undefined || e.realmRank >= f.realm) &&
    (f.alive === undefined || e.dead !== f.alive) &&
    (!f.verifiedOnly || (e.verified && !e.unverified)))
  const sorters = {
    mentions: (a: ListItem, b: ListItem) => b.mentions - a.mentions || a.first_ch - b.first_ch,
    first: (a: ListItem, b: ListItem) => a.first_ch - b.first_ch || b.mentions - a.mentions,
    name: (a: ListItem, b: ListItem) => a.name_vi.localeCompare(b.name_vi, 'vi'),
  }
  items = items.sort(sorters[f.sort ?? 'mentions'])
  return { items, total: items.length, factions }
}

export type SearchHit = Pick<Entity, 'slug' | 'name_vi' | 'name_zh' | 'role'> & {
  novel_slug: string
  novel_title: string
  matched: string
  matched_vi: string
  first_ch: number
  alias_first_ch: number
}

const esc = (s: string) => s.replace(/[%_\\]/g, '\\$&')
// ponytail: LIKE with a leading '% ' scans the alias table; fine for tens of thousands of aliases. Add pg_trgm (gin_trgm_ops) when it isn't.

/** Alias search: diacritic-insensitive, matching at word starts ("han" finds Hàn, not Zhāng). Spoiler-hidden hits are only counted. */
export async function search(q: string, chapterOf: (novelSlug: string, count: number) => number | null) {
  const term = q.trim().slice(0, 40)
  if (!term) return { hits: [] as SearchHit[], hidden: 0 }
  const han = [...term].some(isHan)
  const needle = han ? term : normalize(term)
  const rows = await sql<(SearchHit & { chapter_count: number })[]>`
    select distinct on (e.id) e.slug, e.name_vi, e.name_zh, e.role, e.first_ch, n.slug as novel_slug, n.title_vi as novel_title,
           n.chapter_count, a.name as matched, a.name_vi as matched_vi, a.first_ch as alias_first_ch
    from alias a join entity e on e.id = a.entity_id join novel n on n.id = e.novel_id
    where (n.is_live or n.is_sample) and e.type = 'character'
      and ${han ? sql`a.name like ${'%' + needle + '%'}` : sql`(a.search like ${esc(needle) + '%'} or a.search like ${'% ' + esc(needle) + '%'})`}
    order by e.id, (a.search like ${normalize(term) + '%'}) desc, a.first_ch
    limit 200`
  const hits: SearchHit[] = []
  let hidden = 0
  for (const r of rows) {
    const ch = chapterOf(r.novel_slug, r.chapter_count)
    if (ch !== null && r.first_ch <= ch && r.alias_first_ch <= ch) hits.push(r)
    else hidden++
  }
  hits.sort((a, b) => Number(normalize(b.name_vi).startsWith(needle)) - Number(normalize(a.name_vi).startsWith(needle)) || (a.role === 'chinh' ? -1 : 0))
  return { hits: hits.slice(0, 20), hidden }
}

/** Entities worth indexing: enough verified content that the page is not thin. */
export async function indexableEntities() {
  return sql<{ novel_slug: string; slug: string }[]>`
    select n.slug as novel_slug, e.slug from entity e join novel n on n.id = e.novel_id
    where n.is_live and e.type = 'character'
      and (select count(*) from fact f where f.entity_id = e.id and f.review = 'verified') >= 3
      and exists (select 1 from relation r where (r.a_id = e.id or r.b_id = e.id) and r.review = 'verified')`
}
