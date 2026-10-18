import { useEffect, useState, type FormEvent } from 'react'
import { addStudent, deleteClassroom, deleteStudent, listStudents } from './api.ts'
import type { Classroom, Student } from './types.ts'
import { validateName } from './validation.ts'
import { QuizzesSection } from '../quizzes/QuizzesSection.tsx'

interface Props {
  classroom: Classroom
  onBack: () => void
}

export function ClassroomDetail({ classroom, onBack }: Props) {
  const [students, setStudents] = useState<Student[] | null>(null) // null = still loading
  const [reloadKey, setReloadKey] = useState(0)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    listStudents(classroom.id)
      .then((rows) => active && setStudents(rows))
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [classroom.id, reloadKey])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const problem = validateName(name, 'Student name')
    if (problem) return setError(problem)
    await run(async () => {
      await addStudent(classroom.id, name)
      setName('')
      setReloadKey((k) => k + 1)
    })
  }

  async function onRemoveStudent(student: Student) {
    if (!window.confirm(`Remove ${student.full_name}? Their results will be deleted too.`)) return
    await run(async () => {
      await deleteStudent(student.id)
      setReloadKey((k) => k + 1)
    })
  }

  async function onDeleteClassroom() {
    if (!window.confirm(`Delete "${classroom.name}" and all its students? This cannot be undone.`)) return
    await run(async () => {
      await deleteClassroom(classroom.id)
      onBack()
    })
  }

  return (
    <section>
      <button onClick={onBack}>← All classrooms</button>
      <h3>{classroom.name}</h3>
      <p>
        Classroom code: <strong>{classroom.join_code}</strong>
      </p>

      <form onSubmit={onAdd} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <label>
          Student full name{' '}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>Add student</button>
      </form>

      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}

      {students === null ? (
        <p>Loading students…</p>
      ) : students.length === 0 ? (
        <p>No students yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Login code</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.full_name}</td>
                <td><code>{s.login_code}</code></td>
                <td>
                  <button onClick={() => onRemoveStudent(s)} disabled={busy}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr />
      <QuizzesSection classroomId={classroom.id} />
      <hr />

      <p>
        <button onClick={onDeleteClassroom} disabled={busy}>Delete this classroom</button>
      </p>
    </section>
  )
}
