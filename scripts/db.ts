// npm run db:migrate  -> apply db/schema.sql (idempotent)
// npm run db:seed     -> load clearly-marked SAMPLE data for Phàm Nhân Tu Tiên (dev / demo only)
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { normalize, slugify } from '../lib/text.ts'

const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} })
const cmd = process.argv[2]

async function migrate() {
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  console.log('schema applied')
}

// ---- sample data (illustrative, NOT verified against the novel) ----
type C = [zh: string, vi: string, pinyin: string, first: number, intro: string, role?: 'chinh']
const characters: C[] = [
  ['韩立', 'Hàn Lập', 'Hán Lì', 1, 'Thiếu niên nhà nông được người chú đưa vào Thất Huyền Môn. Linh căn tầm thường, bước vào con đường tu tiên nhờ một chiếc bình nhỏ bí ẩn.', 'chinh'],
  ['厉飞雨', 'Lệ Phi Vũ', 'Lì Fēiyǔ', 11, 'Đệ tử trẻ có tiếng của Thất Huyền Môn, giỏi võ nghệ, kết thân với Hàn Lập từ những ngày đầu.'],
  ['墨大夫', 'Mặc đại phu', 'Mò Dàfū', 6, 'Thầy thuốc của Thất Huyền Môn, nhận Hàn Lập làm đệ tử ký danh.'],
  ['张铁', 'Trương Thiết', 'Zhāng Tiě', 3, 'Thiếu niên cùng vào Thất Huyền Môn một đợt với Hàn Lập.'],
  ['李化元', 'Lý Hóa Nguyên', 'Lǐ Huàyuán', 118, 'Trưởng lão Hoàng Phong Cốc, tính tình nghiêm khắc.'],
  ['墨彩环', 'Mặc Thải Hoàn', 'Mò Cǎihuán', 60, 'Con gái út của Mặc đại phu.'],
  ['陈巧倩', 'Trần Xảo Thiến', 'Chén Qiǎoqiàn', 180, 'Nữ đệ tử Hoàng Phong Cốc.'],
  ['南宫婉', 'Nam Cung Uyển', 'Nángōng Wǎn', 300, 'Nữ tu sĩ Yểm Nguyệt Tông, dung mạo xinh đẹp, tu vi cao.'],
  ['曲魂', 'Khúc Hồn', 'Qū Hún', 470, 'Nhân vật xuất hiện ở giữa truyện.'],
  ['紫灵', 'Tử Linh', 'Zǐ Líng', 520, 'Nhân vật xuất hiện ở Loạn Tinh Hải.'],
  ['元瑶', 'Nguyên Dao', 'Yuán Yáo', 610, 'Nữ tu sĩ gặp ở Loạn Tinh Hải.'],
]
const factions: [string, string, number][] = [
  ['七玄门', 'Thất Huyền Môn', 1], ['黄枫谷', 'Hoàng Phong Cốc', 100], ['掩月宗', 'Yểm Nguyệt Tông', 290],
  ['灵兽山', 'Linh Thú Sơn', 150], ['清虚门', 'Thanh Hư Môn', 150],
]
// [who, attr, value_vi, value_zh, from, to, review, confidence, flag?]
type F = [string, 'realm' | 'faction' | 'location' | 'status', string, string, number, number | null, 'verified' | 'auto' | 'disputed', number, string?]
const facts: F[] = [
  ['韩立', 'faction', 'Thất Huyền Môn', '七玄门', 3, 102, 'verified', 0.95],
  ['韩立', 'faction', 'Hoàng Phong Cốc', '黄枫谷', 102, 402, 'verified', 0.95],
  ['韩立', 'realm', 'Luyện Khí kỳ', '炼气', 38, 247, 'verified', 0.9],
  ['韩立', 'realm', 'Trúc Cơ kỳ', '筑基', 247, 489, 'verified', 0.92],
  ['韩立', 'realm', 'Kết Đan kỳ', '结丹', 489, 812, 'verified', 0.9],
  ['韩立', 'realm', 'Nguyên Anh kỳ', '元婴', 812, null, 'verified', 0.9],
  ['韩立', 'location', 'Việt quốc', '越国', 1, 402, 'auto', 0.91],
  ['韩立', 'location', 'Loạn Tinh Hải', '乱星海', 402, null, 'auto', 0.88],
  ['厉飞雨', 'faction', 'Thất Huyền Môn', '七玄门', 11, null, 'verified', 0.93],
  ['墨大夫', 'faction', 'Thất Huyền Môn', '七玄门', 6, null, 'verified', 0.9],
  ['墨大夫', 'status', 'Đã mất', '死亡', 26, null, 'verified', 0.95],
  ['张铁', 'faction', 'Thất Huyền Môn', '七玄门', 3, null, 'verified', 0.9],
  ['张铁', 'status', 'Đã mất', '死亡', 20, null, 'verified', 0.9],
  ['张铁', 'location', 'Thất Huyền Môn', '七玄门', 131, null, 'disputed', 0.62, 'after_death'],
  ['李化元', 'faction', 'Hoàng Phong Cốc', '黄枫谷', 118, null, 'verified', 0.94],
  ['李化元', 'realm', 'Kết Đan kỳ', '结丹', 118, null, 'verified', 0.9],
  ['陈巧倩', 'faction', 'Hoàng Phong Cốc', '黄枫谷', 180, null, 'verified', 0.9],
  ['陈巧倩', 'realm', 'Trúc Cơ kỳ', '筑基', 201, 233, 'auto', 0.7],
  ['陈巧倩', 'realm', 'Luyện Khí kỳ', '炼气', 233, null, 'disputed', 0.66, 'realm_regression'],
  ['南宫婉', 'faction', 'Yểm Nguyệt Tông', '掩月宗', 300, null, 'verified', 0.93],
  ['南宫婉', 'realm', 'Kết Đan kỳ', '结丹', 300, null, 'verified', 0.9],
]
type R = [string, string, string, number, number | null, 'verified' | 'auto', number]
const relations: R[] = [
  ['韩立', '墨大夫', 'master', 6, 26, 'verified', 0.95],
  ['韩立', '李化元', 'master', 247, null, 'auto', 0.86],
  ['韩立', '厉飞雨', 'friend', 11, null, 'verified', 0.95],
  ['韩立', '张铁', 'friend', 3, 20, 'verified', 0.9],
  ['韩立', '墨彩环', 'acquaintance', 60, null, 'auto', 0.8],
  ['韩立', '陈巧倩', 'colleague', 180, null, 'verified', 0.88],
  ['韩立', '南宫婉', 'acquaintance', 300, 640, 'verified', 0.9],
  ['韩立', '南宫婉', 'dao_companion', 640, null, 'verified', 0.9],
  ['韩立', '曲魂', 'acquaintance', 470, null, 'auto', 0.75],
  ['韩立', '紫灵', 'acquaintance', 520, null, 'verified', 0.85],
  ['韩立', '元瑶', 'acquaintance', 610, null, 'verified', 0.85],
  ['厉飞雨', '张铁', 'colleague', 11, 20, 'verified', 0.85],
]
const extraAliases: [string, string, string, number, string][] = [
  ['韩立', '韩师弟', 'Hàn sư đệ', 102, 'cách gọi ở Hoàng Phong Cốc'],
  ['韩立', '韩小子', 'Hàn tiểu tử', 5, 'cách người lớn tuổi gọi'],
  ['韩立', '韩前辈', 'Hàn tiền bối', 500, ''],
  ['韩立', '韩老魔', 'Hàn lão ma', 700, ''],
  ['厉飞雨', '厉师兄', 'Lệ sư huynh', 11, 'cách gọi trong môn phái'],
]
// Deterministic appearance pattern per character: [first, last, density].
const presence: Record<string, [number, number, number]> = {
  韩立: [1, 2446, 0.97], 厉飞雨: [11, 140, 0.25], 墨大夫: [6, 26, 0.8], 张铁: [3, 20, 0.7], 李化元: [118, 480, 0.12],
  墨彩环: [60, 130, 0.12], 陈巧倩: [180, 420, 0.08], 南宫婉: [300, 2400, 0.05], 曲魂: [470, 1500, 0.04], 紫灵: [520, 1900, 0.05], 元瑶: [610, 1300, 0.04],
}

async function seed() {
  await migrate()
  await sql.begin(async (tx) => {
    await tx`delete from novel where slug = 'pham-nhan-tu-tien' and is_sample`
    const realms = [['炼气', 'Luyện Khí'], ['筑基', 'Trúc Cơ'], ['结丹', 'Kết Đan'], ['元婴', 'Nguyên Anh'], ['化神', 'Hóa Thần'], ['炼虚', 'Luyện Hư'], ['合体', 'Hợp Thể'], ['大乘', 'Đại Thừa']]
      .map(([zh, vi]) => ({ zh, vi }))
    const [novel] = await tx<{ id: number }[]>`
      insert into novel (slug, title_zh, title_vi, author_vi, chapter_count, realms, cover, is_sample)
      values ('pham-nhan-tu-tien', '凡人修仙传', 'Phàm Nhân Tu Tiên', 'Vong Ngữ', 2446, ${tx.json(realms)}, '#1A2847', true)
      returning id`
    const ids = new Map<string, number>()
    for (const [zh, vi, py, first, intro, role] of characters) {
      const [e] = await tx<{ id: number }[]>`
        insert into entity (novel_id, type, name_zh, name_vi, pinyin, slug, first_ch, intro_safe, role)
        values (${novel.id}, 'character', ${zh}, ${vi}, ${py}, ${slugify(vi)}, ${first}, ${intro}, ${role ?? 'phu'}) returning id`
      ids.set(zh, e.id)
      await tx`insert into alias ${tx({ entity_id: e.id, name: zh, name_vi: vi, pinyin: py, search: normalize(`${vi} ${py}`), first_ch: first })}`
    }
    for (const [zh, vi, first] of factions) {
      await tx`insert into entity (novel_id, type, name_zh, name_vi, slug, first_ch) values (${novel.id}, 'faction', ${zh}, ${vi}, ${slugify(vi)}, ${first})`
    }
    for (const [who, zh, vi, first, note] of extraAliases) {
      await tx`insert into alias ${tx({ entity_id: ids.get(who)!, name: zh, name_vi: vi, search: normalize(vi), first_ch: first, note })}`
    }
    for (const [who, attr, value, value_zh, from, to, review, confidence, flag] of facts) {
      const [f] = await tx<{ id: number }[]>`
        insert into fact (entity_id, attr, value, value_zh, from_ch, to_ch, evidence_ch, confidence, review, flag)
        values (${ids.get(who)!}, ${attr}, ${value}, ${value_zh}, ${from}, ${to}, ${[from]}, ${confidence}, ${review}, ${flag ?? ''}) returning id`
      await tx`insert into evidence (target_type, target_id, chapter, quote) values ('fact', ${f.id}, ${from}, '[đoạn trích mẫu]')`
    }
    for (const [a, b, type, from, to, review, confidence] of relations) {
      const [x, y] = type === 'master' ? [ids.get(a)!, ids.get(b)!] : [ids.get(a)!, ids.get(b)!].sort((p, q) => p - q)
      await tx`insert into relation (a_id, b_id, type, from_ch, to_ch, evidence_ch, confidence, review)
               values (${x}, ${y}, ${type}, ${from}, ${to}, ${[from]}, ${confidence}, ${review})`
    }
    const rows: { entity_id: number; chapter: number; count: number }[] = []
    for (const [zh, [first, last, density]] of Object.entries(presence)) {
      for (let c = first; c <= last; c++) {
        const r = Math.abs(Math.sin(c * 12.9898 + zh.length * 78.233)) // stable pseudo-random
        if (c === first || r < density) rows.push({ entity_id: ids.get(zh)!, chapter: c, count: 1 + Math.floor(r * 10) })
      }
    }
    for (let i = 0; i < rows.length; i += 5000) await tx`insert into mention ${tx(rows.slice(i, i + 5000))}`
    await tx`update entity e set mention_total = coalesce((select sum(count) from mention m where m.entity_id = e.id), 0) where novel_id = ${novel.id}`
    await tx`insert into alias_conflict (novel_id, surface, candidates, chapters) values
      (${novel.id}, '韩兄', ${tx.json([{ name_zh: '韩立', chapters: [212, 215, 230] }, { name_zh: '韩平', chapters: [218, 219] }])}, ${[212, 215, 218, 219, 230]})`
    await tx`insert into report (novel_id, target_type, target_id, message, ip_hash)
      select ${novel.id}, 'relation', id, 'Quan hệ sư đồ kết thúc ở ch. 25 chứ không phải 26', 'seed' from relation
      where a_id = ${ids.get('韩立')!} and b_id = ${ids.get('墨大夫')!}`
  })
  console.log('sample data loaded (is_sample = true)')
}

try {
  if (cmd === 'migrate') await migrate()
  else if (cmd === 'seed') await seed()
  else console.log('usage: node scripts/db.ts migrate|seed')
} finally {
  await sql.end()
}
