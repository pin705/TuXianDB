import Link from 'next/link'

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
  </svg>
)

export function SiteHeader({ q = '', right, search = true }: { q?: string; right?: React.ReactNode; search?: boolean }) {
  return (
    <>
      <header className="wrap site-header above">
        <Link href="/" className="logo"><span className="seal" aria-hidden="true">仙</span><b>TuXianDB</b></Link>
        <span className="spacer" />
        <nav className="nav" aria-label="Chính"><Link href="/#tang-thu">Tàng thư</Link></nav>
        {search && (
          <form action="/tim" role="search" className="brush search-box">
            <SearchIcon />
            <input type="search" name="q" defaultValue={q} aria-label="Tìm nhân vật" placeholder="Tìm nhân vật, bí danh, chữ Hán…" />
          </form>
        )}
        {right}
      </header>
      <div className="wrap above"><div className="hline" /></div>
    </>
  )
}
