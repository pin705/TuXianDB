// Integration test for ingest + build against a real Postgres: `npm run test:db` (needs DATABASE_URL, e.g. `npm run db:up`).
// Uses a throw-away novel "zz-fixture" with synthetic extraction results; no API calls.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import postgres from 'postgres'

const data = new URL('../data/', import.meta.url).pathname
const slug = 'zz-fixture'
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} })
const run = (script: string) => execFileSync('node', [`scripts/pipeline/${script}.ts`, slug], { encoding: 'utf8' })

function fixture() {
  const cfg = JSON.parse(readFileSync(`${data}novels/pham-nhan-tu-tien.json`, 'utf8'))
  writeFileSync(`${data}novels/${slug}.json`, JSON.stringify({ ...cfg, slug, title_vi: 'Fixture' }))
  mkdirSync(`${data}raw/${slug}`, { recursive: true })
  const body = '韩立走进七玄门。'.repeat(60)
  writeFileSync(`${data}raw/${slug}/all.txt`, ['一', '二', '三', '四', '五', '六'].map((n) => `第${n}章 测试\n${body}\n`).join('\n'))
  const dir = `${data}work/${slug}/extract`
  mkdirSync(dir, { recursive: true })
  const c = (name: string, surfaces: string[], o: Record<string, unknown> = {}) => ({
    name, surfaces, mentions: 5, description_vi: 'Nhân vật thử.', realm: '', faction: '', location: '越国', died: false, evidence: '证据', confidence: 0.9, ...o,
  })
  const factions = [{ name: '七玄门', surfaces: ['七玄门'] }, { name: '黄枫谷', surfaces: ['黄枫谷'] }]
  const chapters = [
    [c('韩立', ['韩立'], { faction: '七玄门', description_vi: 'Thiếu niên nhà nông.' }), c('墨大夫', ['墨大夫'], { faction: '七玄门' })],
    [c('韩立', ['韩立', '韩师弟'], { realm: '炼气期', faction: '七玄门' }), c('墨大夫', ['墨大夫'], { died: true })],
    [c('韩立', ['韩立', '韩老魔'], { realm: '筑基初期', faction: '黄枫谷' })],
    [c('韩老魔', ['韩老魔'])],
    [c('韩立', ['韩立', '韩老魔'], { realm: '炼气期', faction: '黄枫谷', confidence: 0.7 })],
    [c('韩立', ['韩立', '韩老魔'], { realm: '筑基中期', faction: '黄枫谷' })],
  ]
  const rels = [
    [{ a: '韩立', b: '墨大夫', type: 'master', ended: false, evidence: '拜师', confidence: 0.9 }],
    [{ a: '韩立', b: '墨大夫', type: 'master', ended: true, evidence: '死去', confidence: 0.9 }],
  ]
  chapters.forEach((characters, i) => writeFileSync(`${dir}/${String(i + 1).padStart(5, '0')}.json`,
    JSON.stringify({ n: i + 1, data: { characters, factions, locations: [{ name: '越国', surfaces: ['越国'] }], relations: rels[i] ?? [] } })))
}

after(async () => {
  await sql`delete from novel where slug = ${slug}`
  await sql.end()
  for (const p of [`raw/${slug}`, `work/${slug}`, `novels/${slug}.json`]) rmSync(data + p, { recursive: true, force: true })
})

test('ingest splits chapters and build loads spans, merges nicknames, flags regressions', async () => {
  fixture()
  assert.match(run('ingest'), /6 chapters/)
  run('build')
  const facts = await sql<{ name_vi: string; attr: string; value: string; from_ch: number; to_ch: number | null; review: string; flag: string }[]>`
    select e.name_vi, f.attr, f.value, f.from_ch, f.to_ch, f.review, f.flag from fact f join entity e on e.id = f.entity_id
    join novel n on n.id = e.novel_id where n.slug = ${slug} order by e.id, f.attr, f.from_ch`
  const hl = facts.filter((f) => f.name_vi === 'Hàn Lập')
  assert.deepEqual(hl.filter((f) => f.attr === 'faction').map((f) => [f.value, f.from_ch, f.to_ch]), [['Thất Huyền Môn', 1, 3], ['Hoàng Phong Cốc', 3, null]])
  assert.deepEqual(hl.filter((f) => f.attr === 'realm').map((f) => [f.value, f.flag]), [
    ['Luyện Khí kỳ', ''], ['Trúc Cơ sơ kỳ', ''], ['Luyện Khí kỳ', 'realm_regression'], ['Trúc Cơ trung kỳ', ''],
  ])
  assert.equal(hl.find((f) => f.flag === 'realm_regression')!.review, 'disputed', 'flagged facts stay hidden until reviewed')
  assert.ok(facts.some((f) => f.name_vi === 'Mặc đại phu' && f.attr === 'status' && f.from_ch === 2))

  const aliases = await sql<{ name: string; first_ch: number }[]>`
    select a.name, a.first_ch from alias a join entity e on e.id = a.entity_id join novel n on n.id = e.novel_id
    where n.slug = ${slug} and e.name_zh = '韩立' order by a.first_ch`
  assert.deepEqual(aliases.map((a) => [a.name, a.first_ch]), [['韩立', 1], ['韩师弟', 2], ['韩老魔', 3]])
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from entity e join novel v on v.id = e.novel_id where v.slug = ${slug} and e.name_zh = '韩老魔'`
  assert.equal(n, 0, '韩老魔 is merged into 韩立, not its own character')

  const [rel] = await sql<{ from_ch: number; to_ch: number }[]>`
    select r.from_ch, r.to_ch from relation r join entity e on e.id = r.a_id join novel v on v.id = e.novel_id where v.slug = ${slug}`
  assert.deepEqual([rel.from_ch, rel.to_ch], [1, 2])

  // A reviewer verifies a fact; rebuilding must keep it and not duplicate it.
  await sql`update fact set review = 'verified' where value = 'Trúc Cơ sơ kỳ'`
  run('build')
  const again = await sql<{ review: string }[]>`select f.review from fact f join entity e on e.id = f.entity_id join novel v on v.id = e.novel_id where v.slug = ${slug} and f.value = 'Trúc Cơ sơ kỳ'`
  assert.deepEqual(again.map((r) => r.review), ['verified'])
})
