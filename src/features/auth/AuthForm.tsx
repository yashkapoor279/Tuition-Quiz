import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase.ts'
import { validateAuthInput, type AuthMode } from './validation.ts'

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const problem = validateAuthInput({ mode, fullName, email, password })
    if (problem) return setError(problem)

    setBusy(true)
    if (mode === 'signup') {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      if (err) setError(err.message)
      else if (!data.session) setNotice('Account created. Check your email to confirm it, then log in.')
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem', maxWidth: 360 }}>
      <h2>{mode === 'login' ? 'Teacher login' : 'Create teacher account'}</h2>
      {mode === 'signup' && (
        <label>
          Full name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" style={{ display: 'block', width: '100%' }} />
        </label>
      )}
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={{ display: 'block', width: '100%' }} />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      {error && <p role="alert" style={{ color: 'crimson', margin: 0 }}>{error}</p>}
      {notice && <p role="status" style={{ margin: 0 }}>{notice}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError(null)
          setNotice(null)
        }}
      >
        {mode === 'login' ? 'New teacher? Create an account' : 'Already have an account? Log in'}
      </button>
    </form>
  )
}
