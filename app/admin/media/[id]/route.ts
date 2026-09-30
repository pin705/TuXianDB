import { sql } from '@/lib/db.ts'

// Reviewer preview of any image, including pending ones. Guarded by proxy.ts like the rest of /admin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const [row] = Number.isInteger(id) ? await sql<{ bytes: Buffer }[]>`select bytes from media where id = ${id}` : []
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(row.bytes), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store' } })
}
