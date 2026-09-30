import { redirect } from 'next/navigation'

export default async function NovelIndex({ params }: { params: Promise<{ novel: string }> }) {
  redirect(`/truyen/${(await params).novel}/nhan-vat`)
}
