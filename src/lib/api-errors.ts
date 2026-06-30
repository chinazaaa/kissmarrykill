/**
 * Turn an unexpected internal/DB failure into a client-safe message.
 *
 * Raw Supabase/Postgres errors can leak schema details — table names, foreign-key
 * constraints, SQL — to anyone hitting the API (e.g. a player saw a
 * `..._describer_player_id_fkey` violation). Log the real error server-side and
 * hand the caller a generic line instead.
 *
 * Use this only for *unexpected* failures. Intentional, user-facing validation
 * messages ("Clue is empty", "It's not your team's turn") are safe and should be
 * returned as-is.
 */
export function internalErrorMessage(context: string, error: unknown): string {
  console.error(`[${context}]`, error)
  return 'Something went wrong. Please try again.'
}
