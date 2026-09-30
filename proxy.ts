import { NextResponse, type NextRequest } from 'next/server'

// Basic auth for the reviewer area. Locked entirely when ADMIN_PASSWORD is unset.
// ponytail: one shared reviewer account; move to per-user login (Auth.js) when there is more than one reviewer.
function equal(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function proxy(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD
  const [scheme, encoded] = (req.headers.get('authorization') ?? '').split(' ')
  if (pass && scheme === 'Basic' && encoded) {
    const [user, ...rest] = atob(encoded).split(':')
    if (equal(user, process.env.ADMIN_USER ?? 'admin') && equal(rest.join(':'), pass)) return NextResponse.next()
  }
  return new NextResponse('Cần đăng nhập', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="TuXianDB admin", charset="UTF-8"' } })
}

export const config = { matcher: ['/admin', '/admin/:path*'] }
