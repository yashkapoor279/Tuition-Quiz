import { describe, expect, it } from 'vitest'
import { validateAuthInput } from './validation.ts'

const ok = { mode: 'signup', fullName: 'Asha Rao', email: 'asha@example.com', password: 'longenough1' } as const

describe('validateAuthInput', () => {
  it('accepts valid signup input', () => {
    expect(validateAuthInput(ok)).toBeNull()
  })
  it('requires a name only when signing up', () => {
    expect(validateAuthInput({ ...ok, fullName: '' })).toMatch(/name/i)
    expect(validateAuthInput({ ...ok, mode: 'login', fullName: '' })).toBeNull()
  })
  it('rejects bad emails', () => {
    expect(validateAuthInput({ ...ok, email: 'not-an-email' })).toMatch(/email/i)
    expect(validateAuthInput({ ...ok, email: 'a@b' })).toMatch(/email/i)
  })
  it('rejects short passwords', () => {
    expect(validateAuthInput({ ...ok, password: '1234567' })).toMatch(/8 characters/)
  })
})
