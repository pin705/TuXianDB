import { sql } from '@/lib/db.ts'
import { ipHash as hashIp } from '@/lib/ip.ts'
import { parseReport, REPORT_LIMIT } from '@/lib/report.ts'

const json = (body: unknown, status = 200) => Response.json(body, { status })

export async function POST(req: Request) {
  if (Number(req.headers.get('content-length') ?? 0) > 4096) return json({ error: 'Quá dài' }, 413)
  const input = parseReport(await req.json().catch(() => null))
  if (input === 'spam') return json({ ok: true }) // pretend success to bots
  if (typeof input === 'string') return json({ error: input }, 400)

  const ipHash = hashIp(req)
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from report where ip_hash = ${ipHash} and created_at > now() - make_interval(mins => ${REPORT_LIMIT.minutes})`
  if (n >= REPORT_LIMIT.count) return json({ error: 'Bạn gửi hơi nhiều, thử lại sau ít phút' }, 429)

  // The target must belong to the novel being reported, so nobody can spam arbitrary ids.
  const owner = {
    fact: sql`select e.novel_id from fact t join entity e on e.id = t.entity_id where t.id = ${input.targetId}`,
    relation: sql`select e.novel_id from relation t join entity e on e.id = t.a_id where t.id = ${input.targetId}`,
    alias: sql`select e.novel_id from alias t join entity e on e.id = t.entity_id where t.id = ${input.targetId}`,
    entity: sql`select novel_id from entity where id = ${input.targetId}`,
  }[input.targetType]
  const [row] = await owner
  if (!row || row.novel_id !== input.novelId) return json({ error: 'Không tìm thấy mục cần báo' }, 404)

  await sql`insert into report (novel_id, target_type, target_id, message, ip_hash)
            values (${input.novelId}, ${input.targetType}, ${input.targetId}, ${input.message}, ${ipHash})`
  return json({ ok: true }, 201)
}
