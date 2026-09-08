export default function Loader({
  show,
  fading = false,
  onFadeEnd,
}: {
  show: boolean
  fading?: boolean
  onFadeEnd?: () => void
}) {
  const render = show || fading
  if (!render) return null

  return (
    <div
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && fading && onFadeEnd) onFadeEnd()
      }}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-b from-cream via-blush to-cream transition-all duration-700 ease-out ${fading ? 'opacity-0 scale-[1.02]' : 'opacity-100 scale-100'}`}
      style={{ minHeight: '100dvh' }}>
      <div className="relative w-20 h-20 transition-all duration-700 ease-out ${fading ? 'opacity-0 -translate-y-4 scale-90' : 'opacity-100 translate-y-0 scale-100'}">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rose via-pinkgold to-gold opacity-30 blur-md animate-pulse" />
        <div className="absolute inset-0 rounded-full border-2 border-rose/20 border-t-rose-dark animate-spin" />
        <div className="absolute -inset-2 rounded-full border border-pinkgold/30" />
        <span className="absolute inset-0 flex items-center justify-center font-display text-3xl font-bold text-rose-deep">S</span>
      </div>
      <div className="relative flex items-center gap-2.5 mt-6 transition-all duration-700 ease-out ${fading ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'}">
        <span className="w-1.5 h-1.5 rounded-full bg-rose" />
        <p className="text-sm font-semibold text-rose-deep tracking-[0.22em] uppercase">Shawty Beauty Studio</p>
        <span className="w-1.5 h-1.5 rounded-full bg-pinkgold" />
      </div>
      <div className="mt-4 w-44 h-1 rounded-full bg-black/5 overflow-hidden transition-all duration-700 ease-out ${fading ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'}">
        <div className="h-full rounded-full bg-gradient-to-r from-rose via-pinkgold to-gold loader-progress" />
      </div>
      <p className="mt-3 text-xs text-muted tracking-wide animate-pulse transition-all duration-700 ease-out ${fading ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'}">Preparing your experience…</p>
    </div>
  )
}