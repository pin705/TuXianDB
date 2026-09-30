import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hanViet, missingReadings, normalize, pinyinName, slugify } from '../lib/text.ts'
import table from '../data/hanviet.json' with { type: 'json' }

const t = table as unknown as Record<string, [string, string]>

test('normalize strips Vietnamese diacritics', () => {
  assert.equal(normalize('  Hàn Sư Đệ '), 'han su de')
  assert.equal(normalize('Lệ Phi Vũ'), 'le phi vu')
  assert.equal(slugify('Nam Cung Uyển'), 'nam-cung-uyen')
  assert.equal(slugify('???'), 'x')
})

test('Hán Việt and pinyin names from the reading table', () => {
  assert.equal(hanViet('韩立', t), 'Hàn Lập')
  assert.equal(hanViet('厉飞雨', t), 'Lệ Phi Vũ')
  assert.equal(hanViet('黄枫谷', t), 'Hoàng Phong Cốc')
  assert.equal(pinyinName('厉飞雨', t), 'Lì Fēiyǔ')
  assert.equal(pinyinName('南宫婉', t), 'Nángōng Wǎn')
  assert.equal(pinyinName('韩立', t), 'Hán Lì')
})

test('unknown characters are kept and reported', () => {
  assert.deepEqual(missingReadings('韩X', t), [])
  assert.equal(hanViet('韩A', t), 'Hàn A')
})
