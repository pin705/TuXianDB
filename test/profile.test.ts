import { test } from 'node:test'
import assert from 'node:assert/strict'
import { graphNodes, profileView } from '../lib/profile.ts'
import type { Profile } from '../lib/queries.ts'

const other = (id: number, name_vi: string, first_ch = 1) => ({ id, slug: `e${id}`, type: 'character' as const, name_vi, name_zh: '', first_ch })
const p: Profile = {
  entity: { id: 1, slug: 'han-lap', type: 'character', name_zh: '韩立', name_vi: 'Hàn Lập', pinyin: 'Hán Lì', first_ch: 1, intro_safe: 'x', role: 'chinh', mention_total: 100 },
  facts: [
    { id: 1, attr: 'faction', value: 'Thất Huyền Môn', value_zh: '七玄门', from_ch: 3, to_ch: 102, review: 'verified', confidence: 0.9 },
    { id: 2, attr: 'faction', value: 'Hoàng Phong Cốc', value_zh: '黄枫谷', from_ch: 102, to_ch: null, review: 'verified', confidence: 0.9 },
    { id: 3, attr: 'realm', value: 'Trúc Cơ kỳ', value_zh: '筑基', from_ch: 247, to_ch: 489, review: 'verified', confidence: 0.9 },
    { id: 4, attr: 'realm', value: 'Kết Đan kỳ', value_zh: '结丹', from_ch: 489, to_ch: null, review: 'auto', confidence: 0.8 },
  ],
  relations: [
    { id: 1, type: 'master', from_ch: 6, to_ch: 26, review: 'verified', confidence: 1, other: other(2, 'Mặc đại phu', 6) },
    { id: 2, type: 'dao_companion', from_ch: 640, to_ch: null, review: 'verified', confidence: 1, other: other(3, 'Nam Cung Uyển', 300) },
    { id: 3, type: 'friend', from_ch: 11, to_ch: null, review: 'verified', confidence: 1, other: other(4, 'Lệ Phi Vũ', 11) },
  ],
  aliases: [
    { id: 1, name: '韩立', name_vi: 'Hàn Lập', pinyin: '', note: '', first_ch: 1 },
    { id: 2, name: '韩老魔', name_vi: 'Hàn lão ma', pinyin: '', note: '', first_ch: 700 },
  ],
  mentions: [{ chapter: 1, count: 3 }, { chapter: 400, count: 5 }],
}

test('reader at ch 10: master is current, its end and later events are hidden', () => {
  const v = profileView(p, 10, 2446)
  assert.equal(v.masked, false)
  assert.deepEqual(v.status.map((s) => [s.attr, s.value]), [['faction', 'Thất Huyền Môn'], ['master', 'Mặc đại phu']])
  const bai = v.seen.find((m) => m.title.startsWith('Bái'))!
  assert.equal(bai.sub, '', 'the ch. 26 end must not leak at ch 10')
  assert.ok(v.ahead.every((m) => m.ch > 10))
  assert.ok(v.relationsAhead.some((r) => r.other.name_vi === 'Nam Cung Uyển'))
  assert.deepEqual(v.aliases, [])
  assert.equal(v.aliasesAhead[0].name, '韩老魔')
  assert.deepEqual(v.bins, [3, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'one-chapter bins at ch 10')
})

test('reader at ch 350: ended master shows as ended, realm is Trúc Cơ', () => {
  const v = profileView(p, 350, 2446)
  assert.ok(v.status.some((s) => s.attr === 'realm' && s.value === 'Trúc Cơ kỳ'))
  assert.ok(!v.status.some((s) => s.attr === 'master'))
  assert.equal(v.relations.find((r) => r.type === 'master')!.ended, true)
  assert.equal(v.seen.find((m) => m.title.startsWith('Bái'))!.sub, 'Sư đồ tới ch. 26')
})

test('unknown reader: everything is computed for the whole novel but masked', () => {
  const v = profileView(p, null, 2446)
  assert.equal(v.masked, true)
  assert.equal(v.reason, 'unknown')
  assert.deepEqual(v.seen, [])
  assert.equal(v.ahead.length, 7)
  assert.equal(v.relations.length, 0)
})

test('reader before first appearance is treated as not-yet', () => {
  const late = { ...p, entity: { ...p.entity, first_ch: 300 } }
  assert.equal(profileView(late, 100, 2446).reason, 'not_yet')
})

test('graph keeps the strongest ties and one node per person', () => {
  const nodes = graphNodes(profileView(p, 2446, 2446).relations)
  assert.deepEqual(nodes.map((n) => n.other.name_vi), ['Nam Cung Uyển', 'Lệ Phi Vũ', 'Mặc đại phu'])
})
