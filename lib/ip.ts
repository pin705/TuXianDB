import { createHash } from 'node:crypto'

/** Salted hash of the client IP: enough for rate limits, never the raw address. */
export function ipHash(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`${process.env.REPORT_SALT ?? ''}:${ip}`).digest('hex').slice(0, 32)
}
