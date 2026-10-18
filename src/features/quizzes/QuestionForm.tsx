import { useState, type FormEvent } from 'react'
import type { QuizQuestion } from './types.ts'
import { buildQuestionPayload, type QuestionPayload } from './validation.ts'

interface Props {
  initial?: QuizQuestion
  busy: boolean
  onSave: (payload: QuestionPayload) => void | Promise<void>
  onCancel: () => void
}

const MAX_OPTIONS = 4

function sortedOptions(q?: QuizQuestion) {
  return [...(q?.options ?? [])].sort((a, b) => a.position - b.position)
}

export function QuestionForm({ initial, busy, onSave, onCancel }: Props) {
  const [body, setBody] = useState(initial?.body ?? '')
  const [marks, setMarks] = useState(String(initial?.marks ?? 1))
  const [options, setOptions] = useState<string[]>(() => {
    const texts = sortedOptions(initial).map((o) => o.body)
    while (texts.length < MAX_OPTIONS) texts.push('')
    return texts
  })
  const [correctIndex, setCorrectIndex] = useState<number | null>(() => {
    const idx = sortedOptions(initial).findIndex((o) => o.id === initial?.correct_option_id)
    return idx >= 0 ? idx : null
  })
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const result = buildQuestionPayload({ body, marks, options, correctIndex })
    if (!result.ok) return setError(result.error)
    setError(null)
    void onSave(result.payload)
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '0.5rem', margin: '0.75rem 0', padding: '0.75rem', border: '1px solid #8884' }}>
      <label>
        Question
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ display: 'block', width: '100%' }} />
      </label>
      <label>
        Marks
        <input value={marks} onChange={(e) => setMarks(e.target.value)} inputMode="numeric" style={{ width: '5rem', marginLeft: '0.5rem' }} />
      </label>
      <fieldset>
        <legend>Options (fill at least 2, then select the correct one)</legend>
        {options.map((text, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
            <input
              type="radio"
              name="correct-option"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              aria-label={`Option ${i + 1} is correct`}
            />
            <input
              value={text}
              aria-label={`Option ${i + 1}`}
              placeholder={`Option ${i + 1}`}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
              style={{ flex: 1 }}
            />
          </div>
        ))}
      </fieldset>
      {error && <p role="alert" style={{ color: 'crimson', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={busy}>Save question</button>
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  )
}
