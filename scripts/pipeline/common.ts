// Shared by the pipeline steps. Source text lives in data/raw/<slug>/ and work files in data/work/<slug>/;
// both are git-ignored and must never be deployed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import type { Realm } from '../../lib/consolidate.ts'

export type NovelConfig = {
  slug: string; title_zh: string; title_vi: string; author_vi: string; cover: string
  protagonist: string; realms: Realm[]; name_overrides: Record<string, string>
}
export type Chapter = { n: number; title: string; text: string }

const root = new URL('../../data/', import.meta.url).pathname
export const paths = {
  config: (slug: string) => `${root}novels/${slug}.json`,
  raw: (slug: string) => `${root}raw/${slug}/`,
  work: (slug: string) => `${root}work/${slug}/`,
  chapters: (slug: string) => `${root}work/${slug}/chapters.jsonl`,
  extract: (slug: string, n: number) => `${root}work/${slug}/extract/${String(n).padStart(5, '0')}.json`,
  batches: (slug: string) => `${root}work/${slug}/batches.json`,
  gold: (slug: string) => `${root}gold/${slug}/`,
  hanviet: `${root}hanviet.json`,
}

export function loadConfig(slug: string | undefined): NovelConfig {
  if (!slug || !existsSync(paths.config(slug ?? ''))) {
    console.error(`usage: <command> <novel-slug>  (config expected at data/novels/<slug>.json)`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(paths.config(slug), 'utf8'))
}

export const readJson = <T>(p: string, fallback: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback)
export function writeJson(p: string, v: unknown) {
  mkdirSync(p.slice(0, p.lastIndexOf('/')), { recursive: true })
  writeFileSync(p, JSON.stringify(v, null, 1))
}
export const readJsonl = <T>(p: string): T[] => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))

export const RELATION_TYPES = ['master', 'friend', 'enemy', 'kin', 'dao_companion', 'colleague', 'acquaintance'] as const

/** What the model returns for one chapter. Descriptions become part of the JSON schema the model sees. */
export const ChapterExtraction = z.object({
  characters: z.array(z.object({
    name: z.string().describe('Full Chinese name of the person as best identified from context (e.g. 韩立). Never a pronoun or a generic title.'),
    surfaces: z.array(z.string()).describe('Every way this chapter refers to the person: names, titles, nicknames, exactly as written in Chinese. Exclude pronouns and generic address such as 前辈, 道友, 师兄.'),
    mentions: z.number().int().describe('How many times the person is referred to in this chapter.'),
    description_vi: z.string().describe('One short Vietnamese sentence (max 25 words), in your own words, saying who this person is, using only this chapter. Never quote the text.'),
    realm: z.string().describe('Cultivation realm this chapter states the person is at, as written (e.g. 筑基初期). Empty if not stated.'),
    faction: z.string().describe('Sect or faction this chapter says the person belongs to, Chinese name. Empty if not stated.'),
    location: z.string().describe('Major region the person is in during this chapter (country, sea, continent), Chinese name. Empty if unclear.'),
    died: z.boolean().describe('True only if the person dies in this chapter.'),
    appearance_en: z.string().describe('How this chapter describes the person\'s look, in English: apparent age, build, face, hair, clothing, notable items. Empty if the chapter does not describe it.'),
    evidence: z.string().describe('Up to 30 Chinese characters copied from the chapter that support the realm, faction or death. Empty if none.'),
    confidence: z.number().describe('0 to 1: how sure you are about realm, faction and death for this person.'),
  })),
  factions: z.array(z.object({ name: z.string(), surfaces: z.array(z.string()) })).describe('Sects, clans and organisations named in this chapter.'),
  locations: z.array(z.object({ name: z.string(), surfaces: z.array(z.string()) })).describe('Major regions named in this chapter.'),
  relations: z.array(z.object({
    a: z.string().describe('Full Chinese name of the first person.'),
    b: z.string().describe('Full Chinese name of the second person.'),
    type: z.enum(RELATION_TYPES).describe('master = b is the teacher/master of a (a is the disciple). dao_companion = cultivation partners/spouses. colleague = same sect peers. acquaintance = met and interacted.'),
    ended: z.boolean().describe('True only if this chapter shows the relationship ending (death, betrayal, severing ties).'),
    evidence: z.string().describe('Up to 30 Chinese characters copied from the chapter.'),
    confidence: z.number().describe('0 to 1.'),
  })).describe('Relationships this chapter shows or states between named people.'),
})
export type Extraction = z.infer<typeof ChapterExtraction>

export function systemPrompt(cfg: NovelConfig) {
  return `You extract a structured, spoiler-safe knowledge base from one chapter of the Chinese web novel 《${cfg.title_zh}》.

Rules:
- Use only what this chapter states or makes unambiguous. Do not use knowledge of later chapters or of the novel from elsewhere.
- Identify people by their full Chinese name. When the text uses a nickname or title for someone you can identify (e.g. 韩老魔 for 韩立), put the full name in "name" and the nickname in "surfaces".
- Skip unnamed extras (守卫, 路人) unless the chapter gives them a name.
- Cultivation realms of this novel, low to high: ${cfg.realms.map((r) => r.zh).join(' < ')}. Report a realm only when the chapter states it for that person.
- "evidence" must be copied verbatim from the chapter and be at most 30 characters. It is kept for reviewers only.
- "description_vi" is written in natural Vietnamese, in your own words, with Hán Việt names (韩立 = Hàn Lập).
- Be calibrated: confidence 0.9+ only when the chapter says it plainly.`
}

export const userPrompt = (c: Chapter) => `<chapter number="${c.n}" title="${c.title.replace(/"/g, "'")}">\n${c.text}\n</chapter>`
