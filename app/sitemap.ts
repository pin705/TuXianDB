import type { MetadataRoute } from 'next'
import { indexableEntities, listNovels } from '@/lib/queries.ts'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.SITE_URL ?? 'http://localhost:3000'
  const [novels, entities] = await Promise.all([listNovels(), indexableEntities()])
  return [
    { url: site },
    ...novels.filter((n) => !n.is_sample).map((n) => ({ url: `${site}/truyen/${n.slug}/nhan-vat` })),
    ...entities.map((e) => ({ url: `${site}/truyen/${e.novel_slug}/nhan-vat/${e.slug}` })),
  ]
}
