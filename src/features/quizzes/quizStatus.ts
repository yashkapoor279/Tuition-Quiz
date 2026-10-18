import type { Quiz } from './types.ts'

export type QuizPhase = 'draft' | 'open' | 'closed'

/**
 * Display-only: works out whether a quiz is a draft, open or closed. The real deadline is enforced by
 * the database using its own clock, so a wrong clock on this device cannot let anyone submit late.
 */
export function quizPhase(quiz: Pick<Quiz, 'status' | 'closes_at'>, now: Date = new Date()): QuizPhase {
  if (quiz.status === 'draft' || !quiz.closes_at) return 'draft'
  return now.getTime() < new Date(quiz.closes_at).getTime() ? 'open' : 'closed'
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}
