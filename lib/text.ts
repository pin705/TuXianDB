// Name handling shared by the web app and the pipeline. Pure functions, no I/O.

/** "Hàn Sư Đệ" -> "han su de". Used for diacritic-insensitive search and slugs. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugify(s: string): string {
  return normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'
}

export const isHan = (ch: string) => /\p{Script=Han}/u.test(ch)

/** char -> [Hán Việt, pinyin], from data/hanviet.json. */
export type ReadingTable = Record<string, [string, string]>

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w)

/** 韩立 -> "Hàn Lập". Unknown characters are kept as-is so a human can spot and override them. */
export function hanViet(zh: string, table: ReadingTable): string {
  const parts: string[] = []
  for (const ch of zh) {
    if (isHan(ch)) parts.push(cap(table[ch]?.[0] || ch))
    else if (ch.trim()) parts.push(ch)
  }
  return parts.join(' ')
}

const COMPOUND_SURNAMES = new Set([
  '南宫', '欧阳', '司马', '上官', '诸葛', '慕容', '令狐', '东方', '独孤', '公孙', '皇甫', '轩辕', '夏侯', '尉迟', '端木', '西门', '百里', '司徒',
])

/** 厉飞雨 -> "Lì Fēiyǔ": surname, then the given name joined. Only meant for personal names. */
export function pinyinName(zh: string, table: ReadingTable): string {
  const chars = [...zh].filter(isHan)
  if (!chars.length) return ''
  const syl = chars.map((c) => table[c]?.[1] || '')
  if (syl.some((s) => !s)) return ''
  const n = chars.length > 2 && COMPOUND_SURNAMES.has(chars.slice(0, 2).join('')) ? 2 : 1
  const surname = cap(syl.slice(0, n).join(''))
  const given = cap(syl.slice(n).join(''))
  return given ? `${surname} ${given}` : surname
}

/** Characters of `zh` that have no Hán Việt reading, for the pipeline's "please override" report. */
export function missingReadings(zh: string, table: ReadingTable): string[] {
  return [...zh].filter((ch) => isHan(ch) && !table[ch]?.[0])
}
