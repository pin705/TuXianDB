'use server'
import { cookies } from 'next/headers'
import { chapterCookie } from '@/lib/chapter.ts'
import { getNovel } from '@/lib/queries.ts'

export async function setChapter(novelSlug: string, chapter: number) {
  const novel = await getNovel(novelSlug)
  if (!novel || !Number.isFinite(chapter)) return
  const ch = Math.max(0, Math.min(novel.chapter_count, Math.round(chapter)))
  ;(await cookies()).set(chapterCookie(novel.slug), String(ch), {
    path: '/', maxAge: 60 * 60 * 24 * 400, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production',
  })
}
