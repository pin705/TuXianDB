import { sql } from '@/lib/db.ts'

// For uptime monitors: 200 when the database answers.
export async function GET() {
  try {
    await sql`select 1`
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
