// Spoiler rules. Everything the site shows is decided here from the reader's chapter `ch`.
// `ch === null` means the reader has not told us yet: nothing past the intro is shown unmasked.

export type Review = 'auto' | 'verified' | 'disputed' | 'rejected'

/** Auto-extracted facts below this confidence are never shown. */
export const MIN_AUTO_CONFIDENCE = 0.6

export type Interval = { from_ch: number; to_ch: number | null }

/** Publicly visible: verified, or unreviewed with enough confidence. Disputed items wait for a human. */
export function shown(x: { review: Review; confidence: number }): boolean {
  return x.review === 'verified' || (x.review === 'auto' && x.confidence >= MIN_AUTO_CONFIDENCE)
}

/** Known by chapter `ch`. */
export const known = (fromCh: number, ch: number | null) => ch !== null && fromCh <= ch

/** True at chapter `ch`. An end that lies after `ch` is not revealed: the item simply reads as current. */
export const activeAt = (x: Interval, ch: number) => x.from_ch <= ch && (x.to_ch === null || x.to_ch > ch)

/** Ended on or before `ch` (so the reader already knows it ended). */
export const endedBy = (x: Interval, ch: number) => x.to_ch !== null && x.to_ch <= ch

/** Parse the chapter cookie. Anything malformed means "unknown". */
export function parseChapter(raw: string | undefined, chapterCount: number): number | null {
  if (!raw || !/^\d{1,6}$/.test(raw)) return null
  return Math.min(Number(raw), chapterCount)
}

/**
 * Appearance density in `size`-chapter bins, only up to `ch`.
 * Past `ch` we return nothing at all: even "how often they appear later" is a spoiler.
 */
export function mentionBins(mentions: { chapter: number; count: number }[], ch: number, size: number): number[] {
  const bins = new Array(Math.max(1, Math.ceil(ch / size))).fill(0)
  for (const m of mentions) if (m.chapter >= 1 && m.chapter <= ch) bins[Math.floor((m.chapter - 1) / size)] += m.count
  return bins
}

/** A round bin size that keeps the strip at most 40 dots. */
export const binSize = (ch: number) => [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((n) => n * 40 >= ch) ?? 1000
