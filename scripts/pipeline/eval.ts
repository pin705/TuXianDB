// npm run pipeline:eval -- <slug>
// Compares extraction results with hand-labelled chapters in data/gold/<slug>/<n>.json (same shape as the model output).
// Run it after every prompt or model change, before extracting the whole novel.
import { existsSync, readdirSync } from 'node:fs'
import { loadConfig, paths, readJson, type Extraction } from './common.ts'

const cfg = loadConfig(process.argv[2])
const dir = paths.gold(cfg.slug)
const golds = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : []
if (!golds.length) throw new Error(`No gold chapters in ${dir}`)

const score = { people: [0, 0, 0], realm: [0, 0, 0], faction: [0, 0, 0], relations: [0, 0, 0] } // [hit, predicted, gold]
const add = (k: keyof typeof score, pred: Set<string>, gold: Set<string>) => {
  score[k][0] += [...pred].filter((x) => gold.has(x)).length
  score[k][1] += pred.size
  score[k][2] += gold.size
}
let missingRuns = 0
for (const f of golds) {
  const n = Number(f.replace('.json', ''))
  const gold = readJson<Extraction>(dir + f, null as never)
  const run = readJson<{ data: Extraction } | null>(paths.extract(cfg.slug, n), null)
  if (!run) { missingRuns++; continue }
  const p = run.data
  add('people', new Set(p.characters.map((c) => c.name)), new Set(gold.characters.map((c) => c.name)))
  for (const attr of ['realm', 'faction'] as const) {
    add(attr, new Set(p.characters.filter((c) => c[attr]).map((c) => `${c.name}=${c[attr]}`)), new Set(gold.characters.filter((c) => c[attr]).map((c) => `${c.name}=${c[attr]}`)))
  }
  const rel = (r: Extraction['relations'][number]) => (r.type === 'master' ? `${r.a}>${r.b}:master` : `${[r.a, r.b].sort().join('~')}:${r.type}`)
  add('relations', new Set(p.relations.map(rel)), new Set(gold.relations.map(rel)))
}
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—')
console.log(`gold chapters: ${golds.length}${missingRuns ? ` (${missingRuns} not extracted yet)` : ''}`)
console.table(Object.fromEntries(Object.entries(score).map(([k, [hit, pred, gold]]) => [k, { precision: pct(hit, pred), recall: pct(hit, gold), predicted: pred, gold }])))
console.log('Launch gate (plan): fact precision ≥ 95%, recall ≥ 80%.')
