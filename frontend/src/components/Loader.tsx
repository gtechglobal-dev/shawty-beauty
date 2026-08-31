export default function Loader({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-cream">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500 via-rose to-orange-400 opacity-30 blur-sm animate-pulse" />
        <div className="absolute inset-0 rounded-full border-4 border-rose/20 border-t-rose-dark animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-rose-dark">S</span>
      </div>
      <p className="mt-6 text-sm font-semibold text-rose-dark tracking-wide">Shawty Beauty Studio</p>
      <div className="mt-4 w-44 h-1 rounded-full bg-black/5 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-rose to-gold loader-progress" />
      </div>
      <p className="mt-3 text-xs text-muted tracking-wide animate-pulse">Preparing your experience…</p>
    </div>
  )
}
