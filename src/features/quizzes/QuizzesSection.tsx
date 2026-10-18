import { useEffect, useState, type FormEvent } from 'react'
import { validateName } from '../classrooms/validation.ts'
import { createQuiz, listQuizzes } from './api.ts'
import { QuizEditor } from './QuizEditor.tsx'
import { quizPhase } from './quizStatus.ts'
import type { Quiz } from './types.ts'

export function QuizzesSection({ classroomId }: { classroomId: string }) {
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null) // null = still loading
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    listQuizzes(classroomId)
      .then((rows) => active && setQuizzes(rows))
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [classroomId, reloadKey])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const problem = validateName(title, 'Quiz title', 120)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      await createQuiz(classroomId, title)
      setTitle('')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  const selected = quizzes?.find((q) => q.id === selectedId)
  if (selected) {
    return (
      <QuizEditor
        quiz={selected}
        onChanged={() => setReloadKey((k) => k + 1)}
        onBack={() => {
          setSelectedId(null)
          setReloadKey((k) => k + 1)
        }}
      />
    )
  }

  return (
    <section>
      <h4>Quizzes</h4>
      <form onSubmit={onCreate} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <label>
          New quiz title <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>Create quiz</button>
      </form>
      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
      {quizzes === null ? (
        <p>Loading quizzes…</p>
      ) : quizzes.length === 0 ? (
        <p>No quizzes yet.</p>
      ) : (
        <ul>
          {quizzes.map((q) => (
            <li key={q.id}>
              {q.title} <em>({quizPhase(q)})</em> <button onClick={() => setSelectedId(q.id)}>Open</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
