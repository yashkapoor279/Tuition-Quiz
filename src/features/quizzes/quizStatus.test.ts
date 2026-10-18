import { describe, expect, it } from 'vitest'
import { quizPhase } from './quizStatus.ts'

const published = { status: 'published' as const, closes_at: '2026-10-21T10:00:00.000Z' }

describe('quizPhase', () => {
  it('treats drafts as drafts', () => {
    expect(quizPhase({ status: 'draft', closes_at: null })).toBe('draft')
  })
  it('is open before the deadline', () => {
    expect(quizPhase(published, new Date('2026-10-21T09:59:59.999Z'))).toBe('open')
  })
  it('is closed exactly at the deadline and after', () => {
    expect(quizPhase(published, new Date('2026-10-21T10:00:00.000Z'))).toBe('closed')
    expect(quizPhase(published, new Date('2026-10-22T00:00:00.000Z'))).toBe('closed')
  })
})
