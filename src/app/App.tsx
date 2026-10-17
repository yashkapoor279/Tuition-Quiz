import { AuthProvider } from '../features/auth/AuthProvider.tsx'
import { AuthForm } from '../features/auth/AuthForm.tsx'
import { useAuth } from '../features/auth/useAuth.ts'
import { Dashboard } from './Dashboard.tsx'

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <p>Loading…</p>
  return session ? <Dashboard /> : <AuthForm />
}

function App() {
  return (
    <main>
      <h1>TuitionQuiz</h1>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </main>
  )
}

export default App
