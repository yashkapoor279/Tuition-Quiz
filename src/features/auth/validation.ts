export type AuthMode = 'login' | 'signup'

export interface AuthInput {
  mode: AuthMode
  fullName: string
  email: string
  password: string
}

/** Returns an error message, or null when the input is valid. */
export function validateAuthInput({ mode, fullName, email, password }: AuthInput): string | null {
  if (mode === 'signup' && fullName.trim().length < 2) return 'Please enter your full name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  return null
}
