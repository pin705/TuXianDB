import { cookies } from 'next/headers'
import { parseChapter } from './spoiler.ts'

export const chapterCookie = (novelSlug: string) => `ch_${novelSlug}`

/** The reader's chapter for this novel, from their own cookie (links never carry it, so shared links stay safe). */
export async function readChapter(novel: { slug: string; chapter_count: number }): Promise<number | null> {
  return parseChapter((await cookies()).get(chapterCookie(novel.slug))?.value, novel.chapter_count)
}
