import { useEffect, useState, type FormEvent } from 'react'
import { createClassroom, listClassrooms } from './api.ts'
import { ClassroomDetail } from './ClassroomDetail.tsx'
import type { Classroom } from './types.ts'
import { validateName } from './validation.ts'

export function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null) // null = still loading
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    listClassrooms()
      .then((rows) => active && setClassrooms(rows))
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [reloadKey])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const problem = validateName(name, 'Classroom name')
    if (problem) return setError(problem)
    setBusy(true)
    try {
      await createClassroom(name)
      setName('')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  const selected = classrooms?.find((c) => c.id === selectedId)
  if (selected) {
    return (
      <ClassroomDetail
        classroom={selected}
        onBack={() => {
          setSelectedId(null)
          setReloadKey((k) => k + 1)
        }}
      />
    )
  }

  return (
    <section>
      <h3>Your classrooms</h3>
      <form onSubmit={onCreate} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <label>
          New classroom name{' '}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>Create classroom</button>
      </form>
      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
      {classrooms === null ? (
        <p>Loading classrooms…</p>
      ) : classrooms.length === 0 ? (
        <p>No classrooms yet. Create your first one above.</p>
      ) : (
        <ul>
          {classrooms.map((c) => (
            <li key={c.id}>
              {c.name} <code>{c.join_code}</code>{' '}
              <button onClick={() => setSelectedId(c.id)}>Open</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
