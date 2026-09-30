// npm run pipeline:extract -- submit <slug> [--from N] [--to M] [--dry-run]
// npm run pipeline:extract -- collect <slug>
//
// One Batch API request per chapter (50% cheaper, chapters are independent so they run in parallel).
// `submit` skips chapters that already have a result, so re-running it retries failures.
// Note: server-side refusal fallbacks are not available on the Batches API; refused chapters are listed by `collect`.
import { existsSync } from 'node:fs'
import { parseArgs } from 'node:util'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ChapterExtraction, loadConfig, paths, readJson, readJsonl, systemPrompt, userPrompt, writeJson, type Chapter } from './common.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { from: { type: 'string' }, to: { type: 'string' }, 'dry-run': { type: 'boolean' } },
})
const [cmd, slug] = positionals
const cfg = loadConfig(slug)
const client = new Anthropic()
const MODEL = process.env.PIPELINE_MODEL || 'claude-opus-5-5'
const EFFORT = (process.env.PIPELINE_EFFORT || 'medium') as 'low' | 'medium' | 'high'
// Batch prices, USD per million tokens (input, output). Check current pricing before large runs.
const PRICE: Record<string, [number, number]> = { 'claude-opus-5-5': [2, 10], 'claude-sonnet-5-5': [1, 5], 'claude-haiku-4-5': [0.5, 2.5] }

type BatchLog = { id: string; created: string; chapters: number[]; collected?: boolean }
const log = () => readJson<BatchLog[]>(paths.batches(cfg.slug), [])

function request(c: Chapter) {
  return {
    custom_id: `ch-${c.n}`,
    params: {
      model: MODEL,
      max_tokens: 16000,
      system: systemPrompt(cfg),
      output_config: { effort: EFFORT, format: zodOutputFormat(ChapterExtraction) },
      messages: [{ role: 'user' as const, content: userPrompt(c) }],
    },
  }
}

async function submit() {
  const from = Number(values.from ?? 1), to = Number(values.to ?? Infinity)
  const inFlight = new Set(log().filter((b) => !b.collected).flatMap((b) => b.chapters))
  const todo = readJsonl<Chapter>(paths.chapters(cfg.slug))
    .filter((c) => c.n >= from && c.n <= to && !existsSync(paths.extract(cfg.slug, c.n)) && !inFlight.has(c.n))
  if (!todo.length) return console.log('Nothing to submit: every chapter in range has a result or is in flight.')

  if (values['dry-run']) {
    const sample = todo.slice(0, 3)
    const counts = await Promise.all(sample.map((c) => client.messages.countTokens({ model: MODEL, system: systemPrompt(cfg), messages: request(c).params.messages })))
    const perChar = counts.reduce((s, r) => s + r.input_tokens, 0) / sample.reduce((s, c) => s + c.text.length, 0)
    const input = todo.reduce((s, c) => s + c.text.length, 0) * perChar
    const output = todo.length * 2500 // rough: JSON + thinking per chapter; measure on a small run first
    const [pi, po] = PRICE[MODEL] ?? [NaN, NaN]
    console.log(`${todo.length} chapters, ~${Math.round(input / 1e6 * 10) / 10}M input tokens (${perChar.toFixed(2)} tokens/char), ~${Math.round(output / 1e6 * 10) / 10}M output`)
    console.log(`${MODEL} batch estimate: ~$${Math.round((input / 1e6) * pi + (output / 1e6) * po)}`)
    return
  }

  const batches = log()
  for (let i = 0; i < todo.length; i += 1000) {
    const part = todo.slice(i, i + 1000)
    const b = await client.messages.batches.create({ requests: part.map(request) })
    batches.push({ id: b.id, created: new Date().toISOString(), chapters: part.map((c) => c.n) })
    writeJson(paths.batches(cfg.slug), batches)
    console.log(`submitted ${b.id}: chapters ${part[0].n}–${part.at(-1)!.n}`)
  }
}

async function collect() {
  const batches = log()
  const failed: { n: number; why: string }[] = []
  for (const b of batches.filter((x) => !x.collected)) {
    const status = await client.messages.batches.retrieve(b.id)
    if (status.processing_status !== 'ended') {
      console.log(`${b.id}: ${status.processing_status}, ${status.request_counts.processing} still processing`)
      continue
    }
    for await (const r of await client.messages.batches.results(b.id)) {
      const n = Number(r.custom_id.slice(3))
      if (r.result.type !== 'succeeded') { failed.push({ n, why: r.result.type }); continue }
      const msg = r.result.message
      if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') { failed.push({ n, why: msg.stop_reason }); continue }
      const text = msg.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('')
      let json: unknown
      try { json = JSON.parse(text) } catch { json = null }
      const parsed = ChapterExtraction.safeParse(json)
      if (!parsed.success) { failed.push({ n, why: 'invalid JSON' }); continue }
      writeJson(paths.extract(cfg.slug, n), { n, model: MODEL, usage: msg.usage, data: parsed.data })
    }
    b.collected = true
    writeJson(paths.batches(cfg.slug), batches)
    console.log(`${b.id}: collected`)
  }
  if (failed.length) {
    writeJson(paths.work(cfg.slug) + 'failed.json', failed)
    console.log(`${failed.length} chapters failed (see failed.json). Run \`submit\` again to retry them.`)
  }
}

if (cmd === 'submit') await submit()
else if (cmd === 'collect') await collect()
else console.log('usage: extract.ts submit|collect <slug> [--from N --to M --dry-run]')
