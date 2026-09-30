// Reviewer queries and mutations. Only reachable behind /admin (basic auth in proxy.ts).
import { sql } from './db.ts'
import type { Review } from './spoiler.ts'
import { hanViet, normalize, slugify, type ReadingTable } from './text.ts'

export type QueueItem = {
  kind: 'fact' | 'relation'
  id: number
  novel_slug: string
  subject: string
  subject_slug: string
  detail: string
  from_ch: number
  to_ch: number | null
  confidence: number
  review: Review
  flag: string
  priority: number
  quotes: { chapter: number; quote: string }[]
}

/** Unreviewed items, most visible and least certain first. Pipeline flags jump the queue. */
export async function reviewQueue(limit = 60): Promise<QueueItem[]> {
  return sql<QueueItem[]>`
    with q as (
      select 'fact' as kind, f.id, n.slug as novel_slug, e.name_vi as subject, e.slug as subject_slug,
             f.attr || ' = ' || f.value as detail, f.from_ch, f.to_ch, f.confidence, f.review, f.flag,
             (case when f.flag <> '' or f.review = 'disputed' then 1000000 else 0 end) + e.mention_total * (1 - f.confidence) as priority
      from fact f join entity e on e.id = f.entity_id join novel n on n.id = e.novel_id
      where f.review in ('auto', 'disputed')
      union all
      select 'relation', r.id, n.slug, a.name_vi, a.slug, r.type || ' → ' || b.name_vi, r.from_ch, r.to_ch, r.confidence, r.review, r.flag,
             (case when r.flag <> '' or r.review = 'disputed' then 1000000 else 0 end) + greatest(a.mention_total, b.mention_total) * (1 - r.confidence)
      from relation r join entity a on a.id = r.a_id join entity b on b.id = r.b_id join novel n on n.id = a.novel_id
      where r.review in ('auto', 'disputed')
    )
    select q.*, coalesce((select json_agg(json_build_object('chapter', v.chapter, 'quote', v.quote) order by v.chapter)
                          from evidence v where v.target_type = q.kind and v.target_id = q.id), '[]') as quotes
    from q order by priority desc, id limit ${limit}`
}

export async function openReports() {
  return sql<{ id: number; novel_slug: string; target_type: string; target_id: number; message: string; created_at: Date; target: string }[]>`
    select r.id, n.slug as novel_slug, r.target_type, r.target_id, r.message, r.created_at,
      coalesce(case r.target_type
        when 'fact' then (select e.name_vi || ' · ' || f.attr || ' = ' || f.value from fact f join entity e on e.id = f.entity_id where f.id = r.target_id)
        when 'relation' then (select a.name_vi || ' · ' || x.type || ' → ' || b.name_vi from relation x join entity a on a.id = x.a_id join entity b on b.id = x.b_id where x.id = r.target_id)
        when 'alias' then (select e.name_vi || ' · ' || al.name from alias al join entity e on e.id = al.entity_id where al.id = r.target_id)
        when 'entity' then (select name_vi from entity where id = r.target_id) end, '(đã xoá)') as target
    from report r join novel n on n.id = r.novel_id where r.status = 'open' order by r.created_at limit 100`
}

export async function openConflicts() {
  return sql<{ id: number; novel_id: number; novel_slug: string; surface: string; candidates: { name_zh: string; chapters: number[]; entity_id: number | null; name_vi: string | null }[] }[]>`
    select c.id, c.novel_id, n.slug as novel_slug, c.surface,
      (select json_agg(json_build_object('name_zh', x->>'name_zh', 'chapters', x->'chapters', 'entity_id', e.id, 'name_vi', e.name_vi))
       from jsonb_array_elements(c.candidates) x left join entity e on e.novel_id = c.novel_id and e.type = 'character' and e.name_zh = x->>'name_zh') as candidates
    from alias_conflict c join novel n on n.id = c.novel_id where c.status = 'open' order by jsonb_array_length(c.candidates) desc, c.id limit 50`
}

export async function stats() {
  const [s] = await sql<{ top_done: number; top_total: number; verified: number; rejected: number; stale_reports: number; open_reports: number; queue: number; media: number }[]>`
    with top as (select id from entity where type = 'character' order by mention_total desc limit 200)
    select
      (select count(*)::int from top where not exists (select 1 from fact f where f.entity_id = top.id and f.review in ('auto', 'disputed'))
                                      and not exists (select 1 from relation r where (r.a_id = top.id or r.b_id = top.id) and r.review in ('auto', 'disputed'))) as top_done,
      (select count(*)::int from top) as top_total,
      (select count(*)::int from fact where review = 'verified') as verified,
      (select count(*)::int from fact where review = 'rejected') as rejected,
      (select count(*)::int from report where status = 'open' and created_at < now() - interval '72 hours') as stale_reports,
      (select count(*)::int from report where status = 'open') as open_reports,
      ((select count(*) from fact where review in ('auto', 'disputed')) + (select count(*) from relation where review in ('auto', 'disputed')))::int as queue,
      (select count(*)::int from media where status = 'pending') as media`
  return s
}

const REVIEWS = new Set<Review>(['auto', 'verified', 'disputed', 'rejected'])

export async function setReview(kind: 'fact' | 'relation', id: number, review: Review) {
  if (!REVIEWS.has(review)) throw new Error('bad review')
  if (kind === 'fact') await sql`update fact set review = ${review}, flag = '' where id = ${id}`
  else await sql`update relation set review = ${review}, flag = '' where id = ${id}`
}

/** A human correction is verified by definition. */
export async function editInterval(kind: 'fact' | 'relation', id: number, from: number, to: number | null, value?: string) {
  if (!Number.isInteger(from) || from < 0 || (to !== null && (!Number.isInteger(to) || to <= from))) throw new Error('Khoảng chương không hợp lệ')
  if (kind === 'fact') {
    await sql`update fact set from_ch = ${from}, to_ch = ${to}, value = coalesce(${value?.trim() || null}, value), review = 'verified', flag = '' where id = ${id}`
  } else {
    await sql`update relation set from_ch = ${from}, to_ch = ${to}, review = 'verified', flag = '' where id = ${id}`
  }
}

export async function resolveReport(id: number) {
  await sql`update report set status = 'resolved' where id = ${id}`
}

/** Attach a contested surface to one entity, create a new entity for it, or just dismiss it. */
export async function resolveConflict(id: number, choice: { entityId: number } | { create: true } | { dismiss: true }, table: ReadingTable) {
  await sql.begin(async (tx) => {
    const [c] = await tx<{ novel_id: number; surface: string; chapters: number[] }[]>`
      select novel_id, surface, chapters from alias_conflict where id = ${id} and status = 'open' for update`
    if (!c) return
    const first = c.chapters.length ? Math.min(...c.chapters) : 1
    let entityId: number | null = null
    if ('entityId' in choice) entityId = choice.entityId
    if ('create' in choice) {
      const nameVi = hanViet(c.surface, table)
      const [e] = await tx<{ id: number }[]>`
        insert into entity (novel_id, type, name_zh, name_vi, slug, first_ch)
        values (${c.novel_id}, 'character', ${c.surface}, ${nameVi},
                ${slugify(nameVi)} || (select case when count(*) = 0 then '' else '-' || (count(*) + 1) end from entity
                                        where novel_id = ${c.novel_id} and type = 'character' and slug like ${slugify(nameVi) + '%'}),
                ${first})
        on conflict (novel_id, type, name_zh) do update set name_zh = excluded.name_zh returning id`
      entityId = e.id
    }
    if (entityId) {
      const vi = hanViet(c.surface, table)
      await tx`insert into alias (entity_id, name, name_vi, search, first_ch)
               values (${entityId}, ${c.surface}, ${vi}, ${normalize(vi)}, ${first}) on conflict do nothing`
    }
    await tx`update alias_conflict set status = 'resolved' where id = ${id}`
  })
}

export async function pendingMedia() {
  return sql<{ id: number; kind: string; source: string; from_ch: number; artist_name: string; artist_url: string; artist_email: string; license: string;
               width: number; height: number; created_at: Date; novel_title: string; novel_slug: string; entity_name: string | null; entity_slug: string | null; prompt: string }[]>`
    select m.id, m.kind, m.source, m.from_ch, m.artist_name, m.artist_url, m.artist_email, m.license, m.width, m.height, m.created_at, m.prompt,
           n.title_vi as novel_title, n.slug as novel_slug, e.name_vi as entity_name, e.slug as entity_slug
    from media m join novel n on n.id = m.novel_id left join entity e on e.id = m.entity_id
    where m.status = 'pending' order by (m.source = 'artist') desc, m.created_at limit 60`
}

export async function setMediaStatus(ids: number[], status: 'approved' | 'rejected') {
  if (!['approved', 'rejected'].includes(status) || !ids.every(Number.isInteger)) throw new Error('bad input')
  await sql`update media set status = ${status} where id = any(${ids})`
}
