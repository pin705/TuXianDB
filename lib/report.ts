// Validation for reader error reports (a public, unauthenticated endpoint).

export type ReportInput = { novelId: number; targetType: 'fact' | 'relation' | 'alias' | 'entity'; targetId: number; message: string }

const TYPES = new Set(['fact', 'relation', 'alias', 'entity'])
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) < 2 ** 31

export function parseReport(body: unknown): ReportInput | string {
  if (!body || typeof body !== 'object') return 'Dữ liệu không hợp lệ'
  const b = body as Record<string, unknown>
  if (b.website) return 'spam' // honeypot field, invisible to humans
  if (!isId(b.novelId) || !isId(b.targetId)) return 'Thiếu mục cần báo'
  if (typeof b.targetType !== 'string' || !TYPES.has(b.targetType)) return 'Loại mục không hợp lệ'
  const message = typeof b.message === 'string' ? b.message.trim() : ''
  if (message.length < 3) return 'Hãy viết ít nhất vài chữ'
  if (message.length > 1000) return 'Tối đa 1000 ký tự'
  return { novelId: b.novelId, targetType: b.targetType as ReportInput['targetType'], targetId: b.targetId, message }
}

/** Max reports per IP per window. */
export const REPORT_LIMIT = { count: 5, minutes: 10 }
