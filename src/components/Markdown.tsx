import { Fragment, type ReactNode } from 'react'

/**
 * Sehr kleiner Markdown-Renderer für die KI-Antworten.
 * Bewusst ohne Bibliothek: die Antworten nutzen nur Absätze, Listen,
 * **fett**, *kursiv* und `code`. Es wird kein HTML interpretiert,
 * dadurch kann kein fremdes Markup in die Seite gelangen.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)

  return (
    <div className="space-y-2.5">
      {blocks.map((block, bi) => {
        const lines = block.split('\n')
        const isBullet = lines.every((l) => /^\s*[-*•]\s+/.test(l) || !l.trim())
        const isNumbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l) || !l.trim())

        if (isBullet && lines.some((l) => l.trim())) {
          return (
            <ul key={bi} className="space-y-1.5 pl-1">
              {lines
                .filter((l) => l.trim())
                .map((l, li) => (
                  <li key={li} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-teal" />
                    <span className="flex-1">{inline(l.replace(/^\s*[-*•]\s+/, ''))}</span>
                  </li>
                ))}
            </ul>
          )
        }

        if (isNumbered && lines.some((l) => l.trim())) {
          return (
            <ol key={bi} className="space-y-1.5">
              {lines
                .filter((l) => l.trim())
                .map((l, li) => (
                  <li key={li} className="flex gap-2.5">
                    <span className="tnum mt-[1px] shrink-0 text-[12px] font-bold text-brand-blue">
                      {li + 1}.
                    </span>
                    <span className="flex-1">{inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</span>
                  </li>
                ))}
            </ol>
          )
        }

        if (/^#{1,6}\s/.test(block)) {
          return (
            <p key={bi} className="text-[15px] font-semibold text-ink">
              {inline(block.replace(/^#{1,6}\s/, ''))}
            </p>
          )
        }

        return (
          <p key={bi} className="leading-relaxed">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

/** **fett**, *kursiv* und `code` innerhalb einer Zeile */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={match.index} className="rounded bg-white/8 px-1 py-0.5 text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>)
    }
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
