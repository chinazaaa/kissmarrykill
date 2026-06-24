import {
  WORD_HUNT_MIN_WORD_LENGTH,
  isValidPath,
  wordFromPath,
} from '@/lib/word-hunt'

/** Instant client-side check using the round's precomputed word list. */
export function validateWordHuntSubmissionClient(
  grid: string[][],
  path: number[],
  validWords: ReadonlySet<string>,
  foundWords: ReadonlySet<string>
): { ok: true; normalized: string } | { ok: false; error: string } {
  if (path.length < WORD_HUNT_MIN_WORD_LENGTH) {
    return { ok: false, error: `Words must be at least ${WORD_HUNT_MIN_WORD_LENGTH} letters` }
  }
  if (!isValidPath(path)) {
    return { ok: false, error: 'Invalid letter path — use adjacent cells without repeating' }
  }

  const normalized = wordFromPath(grid, path)
  if (normalized.length < WORD_HUNT_MIN_WORD_LENGTH) {
    return { ok: false, error: `Words must be at least ${WORD_HUNT_MIN_WORD_LENGTH} letters` }
  }
  if (foundWords.has(normalized)) {
    return { ok: false, error: 'You already found this word' }
  }
  if (validWords.size > 0 && !validWords.has(normalized)) {
    return { ok: false, error: 'Not a valid word' }
  }

  return { ok: true, normalized }
}

export function validWordsSetFromMetadata(validWords?: string[] | null): Set<string> {
  return new Set(validWords ?? [])
}
