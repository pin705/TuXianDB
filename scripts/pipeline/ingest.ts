// npm run pipeline:ingest -- <slug>
// Reads the novel text you supplied in data/raw/<slug>/ (one .txt per chapter, or one big .txt with 第…章 headings)
// and writes data/work/<slug>/chapters.jsonl. Chapters are numbered in reading order.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { loadConfig, paths, writeJson, type Chapter } from './common.ts'

const cfg = loadConfig(process.argv[2])
const dir = paths.raw(cfg.slug)
const files = readdirSync(dir).filter((f) => f.endsWith('.txt')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
if (!files.length) throw new Error(`No .txt files in ${dir}`)

const clean = (t: string) => t.replace(/\r/g, '').replace(/[ \t　]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
const HEADING = /^\s*第[零〇一二三四五六七八九十百千万两0-9]+[章回节].*$/gm

let chapters: Omit<Chapter, 'n'>[] = []
if (files.length === 1) {
  const text = readFileSync(dir + files[0], 'utf8')
  const heads = [...text.matchAll(HEADING)]
  if (!heads.length) throw new Error('One file but no 第…章 headings found; split it into one file per chapter.')
  chapters = heads.map((h, i) => ({ title: h[0].trim(), text: clean(text.slice(h.index! + h[0].length, heads[i + 1]?.index ?? text.length)) }))
} else {
  chapters = files.map((f) => {
    const [first, ...rest] = readFileSync(dir + f, 'utf8').split('\n')
    return { title: first.trim(), text: clean(rest.join('\n')) }
  })
}
chapters = chapters.filter((c) => c.text.length > 200) // drop author notes and empty stubs

mkdirSync(paths.work(cfg.slug), { recursive: true })
writeFileSync(paths.chapters(cfg.slug), chapters.map((c, i) => JSON.stringify({ n: i + 1, ...c })).join('\n') + '\n')
writeJson(paths.work(cfg.slug) + 'meta.json', { chapter_count: chapters.length, chars: chapters.reduce((s, c) => s + c.text.length, 0) })
console.log(`${chapters.length} chapters, ${chapters.reduce((s, c) => s + c.text.length, 0).toLocaleString()} characters -> ${paths.chapters(cfg.slug)}`)
