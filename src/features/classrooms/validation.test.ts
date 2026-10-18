import { describe, expect, it } from 'vitest'
import { validateName } from './validation.ts'

describe('validateName', () => {
  it('accepts normal names', () => {
    expect(validateName('Class 5 Maths', 'Classroom name')).toBeNull()
  })
  it('ignores surrounding spaces when counting', () => {
    expect(validateName('  a  ', 'Name')).toMatch(/at least 2/)
  })
  it('rejects names over 80 characters', () => {
    expect(validateName('x'.repeat(81), 'Name')).toMatch(/80/)
  })
})
