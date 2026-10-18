import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../features/auth/useAuth.ts'
import { ClassroomsPage } from '../features/classrooms/ClassroomsPage.tsx'

export function Dashboard() {
  const { session } = useAuth()
  const [name, setName] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    let active = true
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setProblem(error.message)
        else setName(data.full_name)
      })
    return () => {
      active = false
    }
  }, [userId])

  return (
    <section>
      <h2>Teacher dashboard</h2>
      {problem ? <p role="alert">Could not load profile: {problem}</p> : <p>Welcome, {name ?? '…'}.</p>}
      <ClassroomsPage />
      <p>Quizzes are coming in a later phase.</p>
      <button onClick={() => supabase.auth.signOut()}>Log out</button>
    </section>
  )
}
