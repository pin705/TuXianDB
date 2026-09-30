'use server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { editInterval, resolveConflict, resolveReport, setReview } from '@/lib/admin.ts'
import type { Review } from '@/lib/spoiler.ts'
import table from '@/data/hanviet.json' with { type: 'json' }

// Server actions are POSTs to /admin, which proxy.ts already guards; check again so a misconfigured matcher can't open them.
async function guard() {
  const auth = (await headers()).get('authorization') ?? ''
  const pass = process.env.ADMIN_PASSWORD
  if (!pass || !auth.startsWith('Basic ') || atob(auth.slice(6)).split(':').slice(1).join(':') !== pass) throw new Error('unauthorized')
}

const kindOf = (v: FormDataEntryValue | null) => (v === 'relation' ? 'relation' : 'fact')
const int = (v: FormDataEntryValue | null) => (v === null || v === '' ? null : Number(v))

export async function review(form: FormData) {
  await guard()
  await setReview(kindOf(form.get('kind')), Number(form.get('id')), String(form.get('review')) as Review)
  revalidatePath('/admin')
}

export async function edit(form: FormData) {
  await guard()
  await editInterval(kindOf(form.get('kind')), Number(form.get('id')), Number(form.get('from')), int(form.get('to')), String(form.get('value') ?? ''))
  revalidatePath('/admin')
}

export async function closeReport(form: FormData) {
  await guard()
  await resolveReport(Number(form.get('id')))
  revalidatePath('/admin')
}

export async function settleConflict(form: FormData) {
  await guard()
  const choice = String(form.get('choice'))
  const pick = choice === 'new' ? { create: true as const } : choice === 'dismiss' ? { dismiss: true as const } : { entityId: Number(choice) }
  await resolveConflict(Number(form.get('id')), pick, table as unknown as Record<string, [string, string]>)
  revalidatePath('/admin')
}
