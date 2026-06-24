import fs from 'fs'
import path from 'path'
import {
  WORD_HUNT_MIN_WORD_LENGTH,
  isValidPath,
  wordFromPath,
} from '@/lib/word-hunt'

let wordSet: Set<string> | null = null

function loadWordSet(): Set<string> {
  if (wordSet) return wordSet
  const filePath = path.join(process.cwd(), 'src/data/word-hunt-words.txt')
  const content = fs.readFileSync(filePath, 'utf8')
  wordSet = new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length >= 3 && line.length <= 8)
  )
  return wordSet
}

export function isValidWordHuntWord(word: string): boolean {
  const normalized = word.trim().toLowerCase()
  if (normalized.length < 3 || normalized.length > 8) return false
  return loadWordSet().has(normalized)
}

/** Server-only — validates path, spelling, and dictionary membership. */
export function validateWordSubmission(
  grid: string[][],
  word: string,
  path: number[]
): { ok: true; normalized: string } | { ok: false; error: string } {
  const normalized = word.trim().toLowerCase()
  if (normalized.length < WORD_HUNT_MIN_WORD_LENGTH) {
    return { ok: false, error: `Words must be at least ${WORD_HUNT_MIN_WORD_LENGTH} letters` }
  }
  if (!isValidPath(path)) {
    return { ok: false, error: 'Invalid letter path — use adjacent cells without repeating' }
  }
  const formed = wordFromPath(grid, path)
  if (formed !== normalized) {
    return { ok: false, error: 'Selected letters do not match the word' }
  }
  if (!isValidWordHuntWord(normalized)) {
    return { ok: false, error: 'Not a valid word' }
  }
  return { ok: true, normalized }
}
