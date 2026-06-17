/** Record separator for composite pool-usage keys (Postgres jsonb rejects U+0000). */
export const POOL_KEY_SEP = '\u001e'

export function participantPoolKey(name: string, gender: string): string {
  return `${name.trim().toLowerCase()}${POOL_KEY_SEP}${gender.toLowerCase()}`
}

export function wyrQuestionKey(optionA: string, optionB: string): string {
  return `${optionA}${POOL_KEY_SEP}${optionB}`
}

/** Rewrite legacy null-byte keys so they can be stored in jsonb. */
export function migratePoolKey(key: string): string {
  return key.includes('\0') ? key.replace(/\0/g, POOL_KEY_SEP) : key
}
