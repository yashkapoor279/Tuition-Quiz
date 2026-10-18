import { describe, expect, it } from 'vitest'
import { buildQuestionPayload } from './validation.ts'

const valid = { body: ' What is 2 + 2? ', marks: '2', options: ['3', '4', '', ''], correctIndex: 1 }

describe('buildQuestionPayload', () => {
  it('builds a payload and trims text', () => {
    expect(buildQuestionPayload(valid)).toEqual({
      ok: true,
      payload: { body: 'What is 2 + 2?', marks: 2, options: ['3', '4'], correctIndex: 1 },
    })
  })

  it('maps the correct index when a blank field sits before it', () => {
    const r = buildQuestionPayload({ ...valid, options: ['a', '', 'c', 'd'], correctIndex: 2 })
    expect(r).toEqual({ ok: true, payload: { body: 'What is 2 + 2?', marks: 2, options: ['a', 'c', 'd'], correctIndex: 1 } })
  })

  it('needs a question', () => {
    expect(buildQuestionPayload({ ...valid, body: '  ' })).toMatchObject({ ok: false })
  })

  it('needs whole-number marks from 1 to 100', () => {
    for (const marks of ['0', '101', '1.5', '-2', 'abc', '']) {
      expect(buildQuestionPayload({ ...valid, marks })).toMatchObject({ ok: false })
    }
    expect(buildQuestionPayload({ ...valid, marks: '100' })).toMatchObject({ ok: true })
  })

  it('needs at least 2 non-blank options', () => {
    expect(buildQuestionPayload({ ...valid, options: ['only', '', '', ''], correctIndex: 0 })).toMatchObject({ ok: false })
  })

  it('needs a correct option, and it must not be blank', () => {
    expect(buildQuestionPayload({ ...valid, correctIndex: null })).toMatchObject({ ok: false })
    expect(buildQuestionPayload({ ...valid, correctIndex: 2 })).toMatchObject({ ok: false })
  })
})
