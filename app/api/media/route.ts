import { sql } from '@/lib/db.ts'
import { MAX_UPLOAD_BYTES, processImage } from '@/lib/images.ts'
import { ipHash } from '@/lib/ip.ts'
import { LICENSES, safeUrl } from '@/lib/media.ts'

// Artist submissions. Nothing is public until a reviewer approves it in /admin?tab=tranh.
const json = (body: unknown, status = 200) => Response.json(body, { status })
const LIMIT = { count: 10, hours: 1 }

export async function POST(req: Request) {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) return json({ error: 'Ảnh tối đa 4 MB' }, 413)
  const form = await req.formData().catch(() => null)
  if (!form) return json({ error: 'Dữ liệu không hợp lệ' }, 400)
  const s = (k: string, max = 200) => String(form.get(k) ?? '').trim().slice(0, max)
  if (s('website')) return json({ ok: true }) // honeypot

  const kind = s('kind') === 'cover' ? 'cover' : 'portrait'
  const file = form.get('file')
  const name = s('artist_name', 80), email = s('artist_email', 120), url = safeUrl(s('artist_url', 300))
  const license = s('license') as keyof typeof LICENSES
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Chưa chọn ảnh' }, 400)
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: 'Ảnh tối đa 4 MB' }, 413)
  if (name.length < 2) return json({ error: 'Hãy ghi tên hoặc bút danh họa sĩ' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Email không hợp lệ (chỉ dùng để liên hệ, không hiển thị)' }, 400)
  if (!(license in LICENSES)) return json({ error: 'Hãy chọn giấy phép' }, 400)
  if (!['author', 'original', 'no_spoiler'].every((k) => form.get(k) === 'on')) return json({ error: 'Cần xác nhận cả ba cam kết' }, 400)

  const [novel] = await sql<{ id: number; chapter_count: number }[]>`select id, chapter_count from novel where slug = ${s('novel')} and (is_live or is_sample)`
  if (!novel) return json({ error: 'Không tìm thấy truyện' }, 404)
  let entityId: number | null = null
  let fromCh = 0
  if (kind === 'portrait') {
    const [e] = await sql<{ id: number; first_ch: number }[]>`select id, first_ch from entity where novel_id = ${novel.id} and type = 'character' and slug = ${s('entity')}`
    if (!e) return json({ error: 'Không tìm thấy nhân vật' }, 404)
    entityId = e.id
    const asked = Number(s('from_ch'))
    fromCh = Number.isInteger(asked) && asked >= e.first_ch ? Math.min(asked, novel.chapter_count) : e.first_ch
  }

  const hash = ipHash(req)
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from media where ip_hash = ${hash} and created_at > now() - make_interval(hours => ${LIMIT.hours})`
  if (n >= LIMIT.count) return json({ error: 'Bạn gửi hơi nhiều, thử lại sau một giờ' }, 429)

  const img = await processImage(Buffer.from(await file.arrayBuffer()), kind === 'cover' ? 400 : 300)
  if (typeof img === 'string') return json({ error: img }, 400)
  await sql`insert into media (novel_id, entity_id, kind, source, from_ch, artist_name, artist_url, artist_email, license, width, height, bytes, thumb, ip_hash)
            values (${novel.id}, ${entityId}, ${kind}, 'artist', ${fromCh}, ${name}, ${url}, ${email}, ${license}, ${img.width}, ${img.height}, ${img.bytes}, ${img.thumb}, ${hash})`
  return json({ ok: true }, 201)
}
