import type { Metadata } from 'next'
import { Be_Vietnam_Pro, Cormorant_Garamond, Ma_Shan_Zheng, Noto_Serif_SC } from 'next/font/google'
import './globals.css'

const body = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--f-body' })
const display = Cormorant_Garamond({ subsets: ['latin', 'vietnamese'], weight: ['500', '600', '700'], variable: '--f-display' })
// CJK fonts are split by unicode-range; nothing to preload.
const brush = Ma_Shan_Zheng({ weight: '400', variable: '--f-brush', preload: false })
const zh = Noto_Serif_SC({ weight: ['500', '700'], variable: '--f-zh', preload: false })

const site = process.env.SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'TuXianDB · Đọc đến đâu, tra đến đó', template: '%s · TuXianDB' },
  description: 'Hồ sơ nhân vật, nhân duyên và cảnh giới trong truyện tu tiên. Mọi thông tin gắn số chương, không lộ chương sau.',
  openGraph: { siteName: 'TuXianDB', locale: 'vi_VN', type: 'website' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${body.variable} ${display.variable} ${brush.variable} ${zh.variable}`}>
      <body>{children}</body>
    </html>
  )
}
