import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRealm, resolveNames, toSpans } from '../lib/consolidate.ts'

const realms = [{ zh: '炼气', vi: 'Luyện Khí' }, { zh: '筑基', vi: 'Trúc Cơ' }, { zh: '结丹', vi: 'Kết Đan' }]

test('realm parsing with stages', () => {
  assert.deepEqual(parseRealm('筑基初期', realms), { rank: 10, vi: 'Trúc Cơ sơ kỳ', zh: '筑基初期' })
  assert.equal(parseRealm('结丹后期修士', realms)?.vi, 'Kết Đan hậu kỳ')
  assert.equal(parseRealm('炼气期', realms)?.vi, 'Luyện Khí kỳ')
  assert.equal(parseRealm('元婴', realms), null)
})

test('observations become chapter spans', () => {
  const spans = toSpans([
    { ch: 5, value: 'A', conf: 0.9 },
    { ch: 9, value: 'A', conf: 0.8 },
    { ch: 12, value: 'B', conf: 0.7 },
    { ch: 12, value: 'C', conf: 0.95 }, // same chapter: most confident wins
    { ch: 20, value: 'C', conf: 0.9 },
  ])
  assert.deepEqual(spans.map((s) => [s.value, s.from_ch, s.to_ch]), [['A', 5, 12], ['C', 12, null]])
  assert.deepEqual(spans[0].chapters, [5, 9])
  assert.ok(spans[0].confidence > 0 && spans[0].confidence <= 0.85)
})

test('nicknames merge into the main character; shared surfaces become conflicts', () => {
  const obs = [
    ...[1, 2, 3, 4, 5].map((ch) => ({ ch, name: '韩立', surfaces: ['韩立', '韩师弟'], mentions: 20 })),
    ...[6, 7, 8].map((ch) => ({ ch, name: '韩立', surfaces: ['韩老魔'], mentions: 20 })),
    ...[9, 10].map((ch) => ({ ch, name: '韩老魔', surfaces: ['韩老魔'], mentions: 3 })),
    ...[2, 3].map((ch) => ({ ch, name: '韩平', surfaces: ['韩师弟'], mentions: 2 })),
    { ch: 4, name: '厉飞雨', surfaces: ['前辈'], mentions: 1 },
  ]
  const r = resolveNames(obs)
  assert.equal(r.canon('韩老魔'), '韩立')
  assert.equal(r.aliases.get('韩立')?.get('韩老魔'), 6)
  assert.deepEqual(r.conflicts.map((c) => c.surface), ['韩师弟'])
  assert.ok(!r.aliases.get('厉飞雨')?.has('前辈'), 'generic address is ignored')
})
