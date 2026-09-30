import { sql } from '@/lib/db.ts'

// Approved images only. Moderate cache so a takedown takes effect within a day even on CDNs.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return new Response('Not found', { status: 404 })
  const thumb = new URL(req.url).searchParams.get('s') === 'thumb'
  const [row] = await sql<{ data: Buffer }[]>`
    select ${thumb ? sql`thumb` : sql`bytes`} as data from media where id = ${id} and status = 'approved'`
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(row.data), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'X-Content-Type-Options': 'nosniff' },
  })
}
