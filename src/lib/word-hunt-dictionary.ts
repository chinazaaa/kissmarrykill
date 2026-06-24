import fs from 'fs'
import path from 'path'
import {
  WORD_HUNT_GRID_SIZE,
  WORD_HUNT_MIN_VALID_WORDS,
  WORD_HUNT_MIN_VOWEL_CELLS,
  WORD_HUNT_MIN_WORD_LENGTH,
  countVowelCells,
  generateWordHuntGrid,
  indexToRowCol,
  isValidPath,
  letterAt,
  rowColToIndex,
  wordFromPath,
  type WordHuntMetadata,
} from '@/lib/word-hunt'

const MAX_WORD_LENGTH = 8
const NEIGHBORS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const

type TrieNode = {
  children: Map<string, TrieNode>
  isWord: boolean
}

let wordSet: Set<string> | null = null
let trieRoot: TrieNode | null = null

function loadWordSet(): Set<string> {
  if (wordSet) return wordSet
  const filePath = path.join(process.cwd(), 'src/data/word-hunt-words.txt')
  const content = fs.readFileSync(filePath, 'utf8')
  wordSet = new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length >= WORD_HUNT_MIN_WORD_LENGTH && line.length <= MAX_WORD_LENGTH)
  )
  return wordSet
}

function getTrieRoot(): TrieNode {
  if (trieRoot) return trieRoot
  const root: TrieNode = { children: new Map(), isWord: false }
  for (const word of loadWordSet()) {
    let node = root
    for (const ch of word) {
      let child = node.children.get(ch)
      if (!child) {
        child = { children: new Map(), isWord: false }
        node.children.set(ch, child)
      }
      node = child
    }
    node.isWord = true
  }
  trieRoot = root
  return root
}

function tileChars(grid: string[][], index: number): string[] {
  return letterAt(grid, index).toLowerCase().split('')
}

/** All dictionary words formable on this grid (computed once per round). */
export function enumerateValidGridWords(grid: string[][]): Set<string> {
  const root = getTrieRoot()
  const results = new Set<string>()
  const visited = new Set<number>()

  function dfs(index: number, node: TrieNode, prefix: string) {
    if (node.isWord && prefix.length >= WORD_HUNT_MIN_WORD_LENGTH) {
      results.add(prefix)
    }
    if (prefix.length >= MAX_WORD_LENGTH) return

    const [row, col] = indexToRowCol(index)
    for (const [dr, dc] of NEIGHBORS) {
      const nr = row + dr
      const nc = col + dc
      if (nr < 0 || nr >= WORD_HUNT_GRID_SIZE || nc < 0 || nc >= WORD_HUNT_GRID_SIZE) continue
      const nextIndex = rowColToIndex(nr, nc)
      if (visited.has(nextIndex)) continue

      let nextNode = node
      let nextPrefix = prefix
      let ok = true
      for (const ch of tileChars(grid, nextIndex)) {
        const child = nextNode.children.get(ch)
        if (!child) {
          ok = false
          break
        }
        nextNode = child
        nextPrefix += ch
      }
      if (!ok) continue

      visited.add(nextIndex)
      dfs(nextIndex, nextNode, nextPrefix)
      visited.delete(nextIndex)
    }
  }

  for (let index = 0; index < WORD_HUNT_GRID_SIZE * WORD_HUNT_GRID_SIZE; index++) {
    let node = root
    let prefix = ''
    let ok = true
    for (const ch of tileChars(grid, index)) {
      const child = node.children.get(ch)
      if (!child) {
        ok = false
        break
      }
      node = child
      prefix += ch
    }
    if (!ok) continue

    visited.add(index)
    dfs(index, node, prefix)
    visited.delete(index)
  }

  return results
}

export function buildWordHuntMetadata(seed: number): WordHuntMetadata {
  let best: WordHuntMetadata | null = null

  for (let attempt = 0; attempt < 48; attempt++) {
    const grid = generateWordHuntGrid(seed + attempt * 9973)
    if (countVowelCells(grid) < WORD_HUNT_MIN_VOWEL_CELLS) continue

    const valid_words = Array.from(enumerateValidGridWords(grid))
    if (valid_words.length >= WORD_HUNT_MIN_VALID_WORDS) {
      return { grid, valid_words }
    }

    if (!best || valid_words.length > (best.valid_words?.length ?? 0)) {
      best = { grid, valid_words }
    }
  }

  if (best) return best

  const grid = generateWordHuntGrid(seed)
  return {
    grid,
    valid_words: Array.from(enumerateValidGridWords(grid)),
  }
}

export function validWordsSetForMetadata(metadata: WordHuntMetadata): Set<string> {
  if (metadata.valid_words?.length) return new Set(metadata.valid_words)
  return enumerateValidGridWords(metadata.grid)
}

export function isValidWordHuntWord(word: string, validWords?: Set<string>): boolean {
  const normalized = word.trim().toLowerCase()
  if (normalized.length < WORD_HUNT_MIN_WORD_LENGTH || normalized.length > MAX_WORD_LENGTH) return false
  if (validWords) return validWords.has(normalized)
  return loadWordSet().has(normalized)
}

/** Server-only — validates path, spelling, and dictionary membership. */
export function validateWordSubmission(
  grid: string[][],
  word: string,
  path: number[],
  validWords?: Set<string>
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
  if (!isValidWordHuntWord(normalized, validWords)) {
    return { ok: false, error: 'Not a valid word' }
  }
  return { ok: true, normalized }
}
