import { Fragment, type ReactNode } from 'react'

// Matches *bold* and **bold** (asterisk emphasis). Emojis pass straight
// through as plain text. No innerHTML is used — output is safe by construction.
const BOLD_RE = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g

function renderLine(line: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let i = 0
  BOLD_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = BOLD_RE.exec(line)) !== null) {
    if (match.index > last) nodes.push(line.slice(last, match.index))
    const token = match[0]
    const inner = token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1)
    nodes.push(<strong key={`${keyPrefix}-${i}`}>{inner}</strong>)
    last = match.index + token.length
    i++
  }
  if (last < line.length) nodes.push(line.slice(last))
  return nodes
}

/** Render plain text with *asterisk* emphasis and line breaks preserved. */
export default function RichText({ text, className }: { text?: string; className?: string }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <span className={className}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {renderLine(line, String(li))}
        </Fragment>
      ))}
    </span>
  )
}