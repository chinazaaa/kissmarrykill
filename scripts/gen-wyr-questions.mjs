import fs from 'fs'

const raw = fs.readFileSync(new URL('./wyr-questions.txt', import.meta.url), 'utf8')
const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean)

function parse(full) {
  const stripped = full.replace(/^Would you rather\s+/i, '').replace(/\?\s*$/, '').trim()
  const orIdx = stripped.lastIndexOf(' or ')
  if (orIdx === -1) return { optionA: stripped, optionB: '?' }
  return { optionA: stripped.slice(0, orIdx).trim(), optionB: stripped.slice(orIdx + 4).trim() }
}

const parsed = lines.map(parse)
const out = `/** Built-in Would You Rather prompts — ${parsed.length} questions */

export interface WyrQuestion {
  optionA: string
  optionB: string
}

export const WYR_QUESTIONS: WyrQuestion[] = ${JSON.stringify(parsed, null, 2)}

export const WYR_QUESTION_COUNT = WYR_QUESTIONS.length

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Pick \`count\` random unique questions for a game. */
export function pickWyrQuestions(count: number): WyrQuestion[] {
  if (count <= 0) return []
  return shuffleInPlace([...WYR_QUESTIONS]).slice(0, Math.min(count, WYR_QUESTIONS.length))
}
`

fs.writeFileSync(new URL('../src/lib/would-you-rather-questions.ts', import.meta.url), out)
console.log('wrote', parsed.length, 'questions')
