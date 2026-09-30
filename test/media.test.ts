import { test } from 'node:test'
import assert from 'node:assert/strict'
import { credit, gallery, pickPortrait, safeUrl, type MediaMeta } from '../lib/media.ts'

const m = (id: number, source: MediaMeta['source'], from_ch: number): MediaMeta =>
  ({ id, kind: 'portrait', source, from_ch, artist_name: 'Mặc Khách', artist_url: '', license: source === 'ai' ? '' : 'cc-by', width: 900, height: 1200 })

test('artist beats AI, latest reached stage wins, future stages stay hidden', () => {
  const imgs = [m(1, 'ai', 1), m(2, 'artist', 1), m(3, 'artist', 500), m(4, 'ai', 50)]
  assert.equal(pickPortrait(imgs, 100, 1)?.id, 2, 'ch 100: early artist portrait, not the ch 500 one')
  assert.equal(pickPortrait(imgs, 600, 1)?.id, 3)
  assert.equal(pickPortrait([m(1, 'ai', 1), m(4, 'ai', 50)], 100, 1)?.id, 4)
  assert.equal(pickPortrait(imgs, null, 1)?.id, 2, 'unknown reader: first-appearance look only')
  assert.equal(pickPortrait([m(3, 'artist', 500)], 100, 1), null)
})

test('gallery counts what is still rolled up', () => {
  const g = gallery([m(1, 'ai', 1), m(3, 'artist', 500), m(2, 'artist', 1)], 100)
  assert.deepEqual(g.seen.map((x) => x.id), [2, 1])
  assert.equal(g.ahead, 1)
})

test('credits and links', () => {
  assert.equal(credit(m(1, 'ai', 1)), 'Tranh AI minh họa')
  assert.equal(credit(m(2, 'artist', 1)), 'Tranh: Mặc Khách · CC BY 4.0')
  assert.equal(safeUrl('javascript:alert(1)'), '')
  assert.equal(safeUrl(' https://example.com/a '), 'https://example.com/a')
  assert.equal(safeUrl('not a url'), '')
})
