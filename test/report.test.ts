import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseReport } from '../lib/report.ts'

test('report validation', () => {
  assert.deepEqual(parseReport({ novelId: 1, targetType: 'fact', targetId: 7, message: '  sai chương ' }), {
    novelId: 1, targetType: 'fact', targetId: 7, message: 'sai chương',
  })
  assert.equal(typeof parseReport({ novelId: 1, targetType: 'user', targetId: 7, message: 'abc' }), 'string')
  assert.equal(typeof parseReport({ novelId: 1, targetType: 'fact', targetId: -1, message: 'abc' }), 'string')
  assert.equal(typeof parseReport({ novelId: 1, targetType: 'fact', targetId: 7, message: 'x'.repeat(1001) }), 'string')
  assert.equal(parseReport({ novelId: 1, targetType: 'fact', targetId: 7, message: 'abc', website: 'x' }), 'spam')
  assert.equal(typeof parseReport(null), 'string')
})
