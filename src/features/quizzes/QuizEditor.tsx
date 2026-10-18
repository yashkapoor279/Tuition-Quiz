import { useEffect, useState } from 'react'
import { validateName } from '../classrooms/validation.ts'
import { deleteQuestion, deleteQuiz, loadQuestions, publishQuiz, renameQuiz, saveQuestion } from './api.ts'
import { QuestionForm } from './QuestionForm.tsx'
import { formatDateTime, quizPhase } from './quizStatus.ts'
import type { Quiz, QuizQuestion } from './types.ts'
import type { QuestionPayload } from './validation.ts'

interface Props {
  quiz: Quiz
  onBack: () => void
  /** Called after the quiz itself changed on the server (e.g. it was published). */
  onChanged?: () => void
}

export function QuizEditor({ quiz, onBack, onChanged }: Props) {
  const [title, setTitle] = useState(quiz.title)
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null) // null = still loading
  const [reloadKey, setReloadKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null) // a question id, 'new', or null
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const editable = quiz.status === 'draft'

  useEffect(() => {
    let active = true
    loadQuestions(quiz.id)
      .then((rows) => active && setQuestions(rows))
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [quiz.id, reloadKey])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  const onSaveTitle = () => {
    const problem = validateName(title, 'Quiz title', 120)
    if (problem) return setError(problem)
    return run(async () => {
      await renameQuiz(quiz.id, title)
      setNotice('Title saved.')
    })
  }

  const onSaveQuestion = (questionId: string | null) => (payload: QuestionPayload) =>
    run(async () => {
      await saveQuestion(quiz.id, questionId, payload)
      setEditingId(null)
      setReloadKey((k) => k + 1)
    })

  const onDeleteQuestion = (q: QuizQuestion) => {
    if (!window.confirm('Delete this question?')) return
    return run(async () => {
      await deleteQuestion(q.id)
      setReloadKey((k) => k + 1)
    })
  }

  const onDeleteQuiz = () => {
    if (!window.confirm(`Delete "${quiz.title}" and all its questions? This cannot be undone.`)) return
    return run(async () => {
      await deleteQuiz(quiz.id)
      onBack()
    })
  }

  const totalMarks = (questions ?? []).reduce((sum, q) => sum + q.marks, 0)

  const publishProblem =
    questions === null
      ? 'Loading…'
      : questions.length === 0
        ? 'Add at least one question to publish.'
        : questions.some((q) => q.options.length < 2 || q.correct_option_id === null)
          ? 'Every question needs at least 2 options and a correct answer.'
          : null

  const onPublish = () => {
    const ok = window.confirm(
      `Publish "${quiz.title}"?\n\nStudents will have exactly 24 hours from now to attempt it. ` +
        'You will not be able to edit or unpublish it afterwards.',
    )
    if (!ok) return
    return run(async () => {
      await publishQuiz(quiz.id)
      setEditingId(null)
      onChanged?.()
    })
  }

  return (
    <section>
      <button onClick={onBack}>← All quizzes</button>
      <h4>Quiz: {quiz.title}</h4>
      {editable ? (
        <p>Status: <strong>Draft</strong></p>
      ) : (
        <p>
          Status: <strong>{quizPhase(quiz) === 'open' ? 'Published — open' : 'Published — closed'}</strong>
          <br />
          Published: {quiz.published_at ? formatDateTime(quiz.published_at) : '—'}
          <br />
          Closes: {quiz.closes_at ? formatDateTime(quiz.closes_at) : '—'}
          <br />
          <small>Published quizzes can no longer be edited.</small>
        </p>
      )}

      {editable && (
        <p style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label>
            Quiz title <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <button onClick={onSaveTitle} disabled={busy}>Save title</button>
        </p>
      )}

      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {questions === null ? (
        <p>Loading questions…</p>
      ) : (
        <>
          <p>
            {questions.length} question{questions.length === 1 ? '' : 's'} · {totalMarks} marks in total
          </p>
          <ol style={{ paddingLeft: '1.25rem' }}>
            {questions.map((q) => (
              <li key={q.id} style={{ marginBottom: '0.75rem' }}>
                {editingId === q.id ? (
                  <QuestionForm key={q.id} initial={q} busy={busy} onSave={onSaveQuestion(q.id)} onCancel={() => setEditingId(null)} />
                ) : (
                  <>
                    <div>
                      {q.body} <em>({q.marks} mark{q.marks === 1 ? '' : 's'})</em>
                    </div>
                    <ul style={{ listStyle: 'none', paddingLeft: '1rem', margin: '0.25rem 0' }}>
                      {q.options.map((o) => (
                        <li key={o.id}>
                          {o.body}
                          {o.id === q.correct_option_id && <strong aria-label="correct answer"> ✓</strong>}
                        </li>
                      ))}
                      {q.correct_option_id === null && <li style={{ color: 'crimson' }}>No correct answer set</li>}
                    </ul>
                    {editable && (
                      <>
                        <button onClick={() => setEditingId(q.id)} disabled={busy}>Edit</button>{' '}
                        <button onClick={() => onDeleteQuestion(q)} disabled={busy}>Delete</button>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>

          {editable &&
            (editingId === 'new' ? (
              <QuestionForm key="new" busy={busy} onSave={onSaveQuestion(null)} onCancel={() => setEditingId(null)} />
            ) : (
              <button onClick={() => setEditingId('new')} disabled={busy}>Add question</button>
            ))}
        </>
      )}

      {editable && (
        <p>
          <button onClick={onPublish} disabled={busy || publishProblem !== null}>Publish quiz</button>{' '}
          {publishProblem && <small>{publishProblem}</small>}
        </p>
      )}

      {editable && (
        <p>
          <button onClick={onDeleteQuiz} disabled={busy}>Delete this quiz</button>
        </p>
      )}
    </section>
  )
}
