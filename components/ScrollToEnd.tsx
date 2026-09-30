'use client'
import { useEffect, useRef } from 'react'

/** Opens the hand-scroll at its newest milestone, next to the reader's chapter. */
export function ScrollToEnd() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current?.closest<HTMLElement>('[data-scroll-end]')
    if (el) el.scrollLeft = el.scrollWidth
  }, [])
  return <span ref={ref} hidden />
}
