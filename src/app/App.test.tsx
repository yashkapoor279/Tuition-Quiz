import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Fake Supabase: no network, no session.
vi.mock('../lib/supabase.ts', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

import App from './App.tsx'

describe('App', () => {
  it('shows the product name and the login form when signed out', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'TuitionQuiz' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Teacher login' })).toBeInTheDocument()
  })
})
