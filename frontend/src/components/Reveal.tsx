import { useEffect, useRef, ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'section' | 'span' | 'li' | 'article'
  variant?: 'up' | 'left' | 'right' | 'zoom' | 'fade'
}

export default function Reveal({
  children,
  className = '',
  delay = 0,
  as = 'div',
  variant = 'up',
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.style.transitionDelay = `${delay}ms`
            el.classList.add('reveal-in')
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.12 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  const Tag = as as any

  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${variant} ${className}`}
    >
      {children}
    </Tag>
  )
}
