// npm run pipeline:portraits -- <slug> [--limit 50] [--dry-run]
// AI ink-wash portraits for characters that have a described look but no artist portrait yet.
// Images land as `pending`; a reviewer approves them in /admin?tab=tranh. Claude does not generate images,
// so this step uses the OpenAI Images API (OPENAI_API_KEY, IMAGE_MODEL).
import { parseArgs } from 'node:util'
import postgres from 'postgres'
import { processImage } from '../../lib/images.ts'
import { loadConfig } from './common.ts'

const { values, positionals } = parseArgs({ allowPositionals: true, options: { limit: { type: 'string' }, 'dry-run': { type: 'boolean' } } })
const cfg = loadConfig(positionals[0])
const MODEL = process.env.IMAGE_MODEL || 'gpt-image-2.5-flare'
const limit = Number(values.limit ?? 50)

// No names: the model should draw from the text description, not from any existing donghua design.
const STYLE = 'Traditional Chinese ink wash painting (shuimo) portrait on rice paper. Monochrome ink with a few muted colour accents, ' +
  'loose expressive brush strokes, half-length figure, plain misty background. No text, no signature, no seal, no watermark. ' +
  'An original character design that does not imitate any existing animation, comic or game.'

const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} })
try {
  const todo = await sql<{ id: number; novel_id: number; name_vi: string; appearance: string; appearance_ch: number }[]>`
    select e.id, e.novel_id, e.name_vi, e.appearance, e.appearance_ch from entity e join novel n on n.id = e.novel_id
    where n.slug = ${cfg.slug} and e.type = 'character' and e.appearance <> '' and e.appearance_ch is not null
      and not exists (select 1 from media m where m.entity_id = e.id and (m.source = 'ai' or m.status <> 'rejected'))
    order by e.mention_total desc limit ${limit}`
  console.log(`${todo.length} characters need a portrait (${MODEL})`)
  for (const e of todo) {
    const prompt = `${STYLE}\n\nThe person: ${e.appearance}`
    if (values['dry-run']) { console.log(`- ${e.name_vi} (ch. ${e.appearance_ch}): ${e.appearance.slice(0, 120)}`); continue }
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, size: '1024x1536', quality: 'medium', output_format: 'webp', n: 1 }),
    })
    const body = await res.json().catch(() => null) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null
    const b64 = body?.data?.[0]?.b64_json
    if (!res.ok || !b64) { console.log(`  skip ${e.name_vi}: ${res.status} ${body?.error?.message ?? 'no image'}`); continue }
    const img = await processImage(Buffer.from(b64, 'base64'))
    if (typeof img === 'string') { console.log(`  skip ${e.name_vi}: ${img}`); continue }
    await sql`insert into media (novel_id, entity_id, kind, source, from_ch, prompt, width, height, bytes, thumb)
              values (${e.novel_id}, ${e.id}, 'portrait', 'ai', ${e.appearance_ch}, ${prompt}, ${img.width}, ${img.height}, ${img.bytes}, ${img.thumb})`
    console.log(`  ok ${e.name_vi}`)
  }
} finally {
  await sql.end()
}
