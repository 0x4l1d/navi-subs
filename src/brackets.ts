// top-level bracket groups of a file name. brackets inside brackets stay part of their group:
// "[BD (US) 1080p][DBD-Raws]" is two groups, "BD (US) 1080p" and "DBD-Raws"

const OPEN = '[(【'
const CLOSE = '])】'

export interface Split {
  // the name with its groups cut out
  outside: string
  groups: string[]
}

export function splitBrackets (text: string): Split {
  const groups: string[] = []
  let outside = ''
  let depth = 0
  let start = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (OPEN.includes(char)) {
      if (!depth) start = i
      depth++
    } else if (CLOSE.includes(char) && depth) {
      depth--
      if (!depth) {
        groups.push(text.slice(start + 1, i).trim())
        outside += ' '
      }
    } else if (!depth) {
      outside += char
    }
  }
  // a bracket that never closes is just text
  if (depth) outside += text.slice(start)
  return { outside, groups }
}

// "BD (US) 1080p" without what its own brackets hold: "BD 1080p"
export const flat = (group: string) => splitBrackets(group).outside.replace(/\s+/g, ' ').trim()
