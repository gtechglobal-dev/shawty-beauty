import { useEffect, useRef, useState, memo } from 'react'

interface CountUpProps {
  end: number
  suffix?: string
  prefix?: string
  duration?: number
  className?: string
}

const CountUp = memo(function CountUp({
  end,
  suffix = '',
  prefix = '',
  duration = 1400,
  className = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [val, setVal] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setVal(end)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true
            const start = performance.now()
            const tick = (now: number) => {
              const progress = Math.min((now - start) / duration, 1)
              const eased = 1 - Math.pow(1 - progress, 4)
              setVal(Math.round(eased * end))
              if (progress < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.3, rootMargin: '0px 0px -50px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {suffix || val % 1 === 0 ? val : val.toFixed(1)}
      {suffix}
    </span>
  )
})

export default CountUp
