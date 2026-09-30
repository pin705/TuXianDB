import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeAt, endedBy, known, mentionBins, parseChapter, shown } from '../lib/spoiler.ts'

test('only verified or confident auto facts are shown', () => {
  assert.ok(shown({ review: 'verified', confidence: 0.1 }))
  assert.ok(shown({ review: 'auto', confidence: 0.6 }))
  assert.ok(!shown({ review: 'auto', confidence: 0.59 }))
  assert.ok(!shown({ review: 'disputed', confidence: 0.99 }))
  assert.ok(!shown({ review: 'rejected', confidence: 1 }))
})

test('a future end is not revealed', () => {
  const master = { from_ch: 6, to_ch: 26 }
  assert.ok(activeAt(master, 10), 'still master at ch 10')
  assert.ok(!endedBy(master, 10), 'reader at ch 10 must not learn it ends')
  assert.ok(endedBy(master, 26))
  assert.ok(!activeAt(master, 26))
  assert.ok(!activeAt(master, 5))
})

test('unknown chapter hides everything', () => {
  assert.ok(!known(1, null))
  assert.ok(known(350, 350))
  assert.ok(!known(351, 350))
})

test('chapter cookie parsing', () => {
  assert.equal(parseChapter('350', 2446), 350)
  assert.equal(parseChapter('99999', 2446), 2446)
  assert.equal(parseChapter('0', 2446), 0)
  assert.equal(parseChapter('-1', 2446), null)
  assert.equal(parseChapter('12abc', 2446), null)
  assert.equal(parseChapter(undefined, 2446), null)
})

test('mention bins stop at the reader chapter', () => {
  const m = [{ chapter: 1, count: 2 }, { chapter: 10, count: 1 }, { chapter: 11, count: 4 }, { chapter: 30, count: 9 }]
  assert.deepEqual(mentionBins(m, 20, 10), [3, 4])
})

test('bin size stays round and at most 40 dots', async () => {
  const { binSize } = await import('../lib/spoiler.ts')
  assert.equal(binSize(10), 1)
  assert.equal(binSize(350), 10)
  assert.equal(binSize(2446), 100)
})
