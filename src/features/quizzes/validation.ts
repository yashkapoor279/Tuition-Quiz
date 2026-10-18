export interface QuestionPayload {
  body: string
  marks: number
  options: string[] // 2 to 4 non-blank options, in order
  correctIndex: number // 0-based index into `options`
}

export interface QuestionFormValues {
  body: string
  marks: string
  options: string[] // the raw form fields (blanks allowed)
  correctIndex: number | null // index into the raw form fields
}

export type BuildResult = { ok: true; payload: QuestionPayload } | { ok: false; error: string }

/** Turns raw form values into a payload for the server, or explains what is wrong. Mirrors the server rules. */
export function buildQuestionPayload(form: QuestionFormValues): BuildResult {
  const body = form.body.trim()
  if (body.length < 1) return { ok: false, error: 'Please enter the question.' }
  if (body.length > 1000) return { ok: false, error: 'The question must be 1000 characters or fewer.' }

  if (!/^\d+$/.test(form.marks.trim())) return { ok: false, error: 'Marks must be a whole number from 1 to 100.' }
  const marks = Number(form.marks.trim())
  if (marks < 1 || marks > 100) return { ok: false, error: 'Marks must be a whole number from 1 to 100.' }

  const options: string[] = []
  let correctIndex = -1
  form.options.forEach((raw, i) => {
    const text = raw.trim()
    if (text === '') return
    if (i === form.correctIndex) correctIndex = options.length
    options.push(text)
  })

  if (options.length < 2) return { ok: false, error: 'Please enter at least 2 options.' }
  if (options.some((o) => o.length > 300)) return { ok: false, error: 'Each option must be 300 characters or fewer.' }
  if (form.correctIndex === null) return { ok: false, error: 'Please select the correct option.' }
  if (correctIndex === -1) return { ok: false, error: 'The correct option cannot be empty.' }

  return { ok: true, payload: { body, marks, options, correctIndex } }
}
