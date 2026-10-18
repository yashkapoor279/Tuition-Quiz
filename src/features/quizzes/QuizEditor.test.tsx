import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api.ts', () => ({
  listQuizzes: vi.fn(),
  createQuiz: vi.fn(),
  renameQuiz: vi.fn(),
  deleteQuiz: vi.fn(),
  loadQuestions: vi.fn(),
  saveQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  publishQuiz: vi.fn(),
}))

import * as api from './api.ts'
import { QuizEditor } from './QuizEditor.tsx'
import { QuizzesSection } from './QuizzesSection.tsx'
import type { Quiz, QuizQuestion } from './types.ts'

const draft: Quiz = { id: 'z1', classroom_id: 'c1', title: 'Fractions Test', status: 'draft', published_at: null, closes_at: null, created_at: '2026-10-20T00:00:00Z' }
const published: Quiz = { ...draft, status: 'published', published_at: '2026-10-20T00:00:00Z', closes_at: '2026-10-21T00:00:00Z' }

const question: QuizQuestion = {
  id: 'q1',
  quiz_id: 'z1',
  position: 1,
  body: 'What is 1/2 + 1/2?',
  marks: 2,
  correct_option_id: 'o2',
  options: [
    { id: 'o1', question_id: 'q1', position: 1, body: 'Half' },
    { id: 'o2', question_id: 'q1', position: 2, body: 'One' },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.loadQuestions).mockResolvedValue([question])
})

describe('QuizEditor', () => {
  it('shows questions, the marked correct answer and total marks', async () => {
    render(<QuizEditor quiz={draft} onBack={() => {}} />)
    expect(await screen.findByText(/What is 1\/2 \+ 1\/2\?/)).toBeInTheDocument()
    expect(screen.getByText(/1 question · 2 marks in total/)).toBeInTheDocument()
    const correct = screen.getByLabelText('correct answer')
    expect(correct.closest('li')).toHaveTextContent('One')
  })

  it('adds a question with the right payload', async () => {
    vi.mocked(api.saveQuestion).mockResolvedValue()
    render(<QuizEditor quiz={draft} onBack={() => {}} />)
    await screen.findByText(/What is 1\/2/)
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Capital of India?' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Mumbai' } })
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'Delhi' } })
    fireEvent.click(screen.getByLabelText('Option 2 is correct'))
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }))
    await waitFor(() =>
      expect(api.saveQuestion).toHaveBeenCalledWith('z1', null, {
        body: 'Capital of India?',
        marks: 1,
        options: ['Mumbai', 'Delhi'],
        correctIndex: 1,
      }),
    )
    await waitFor(() => expect(api.loadQuestions).toHaveBeenCalledTimes(2))
  })

  it('refuses to save a question without a correct option', async () => {
    render(<QuizEditor quiz={draft} onBack={() => {}} />)
    await screen.findByText(/What is 1\/2/)
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Q?' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'a' } })
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/correct option/i)
    expect(api.saveQuestion).not.toHaveBeenCalled()
  })

  it('pre-selects the existing correct option when editing', async () => {
    render(<QuizEditor quiz={draft} onBack={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Option 2 is correct')).toBeChecked()
    expect(screen.getByLabelText('Option 1 is correct')).not.toBeChecked()
  })

  it('is read-only once published', async () => {
    render(<QuizEditor quiz={published} onBack={() => {}} />)
    await screen.findByText(/What is 1\/2/)
    expect(screen.queryByRole('button', { name: 'Add question' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })
})

describe('publishing', () => {
  it('cannot publish a quiz with no questions', async () => {
    vi.mocked(api.loadQuestions).mockResolvedValue([])
    render(<QuizEditor quiz={draft} onBack={() => {}} />)
    expect(await screen.findByText(/Add at least one question to publish/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish quiz' })).toBeDisabled()
  })

  it('cannot publish while a question has no correct answer', async () => {
    vi.mocked(api.loadQuestions).mockResolvedValue([{ ...question, correct_option_id: null }])
    render(<QuizEditor quiz={draft} onBack={() => {}} />)
    expect(await screen.findByText(/needs at least 2 options and a correct answer/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish quiz' })).toBeDisabled()
  })

  it('publishes after confirmation and tells the parent to refresh', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.publishQuiz).mockResolvedValue()
    const onChanged = vi.fn()
    render(<QuizEditor quiz={draft} onBack={() => {}} onChanged={onChanged} />)
    const button = await screen.findByRole('button', { name: 'Publish quiz' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    await waitFor(() => expect(api.publishQuiz).toHaveBeenCalledWith('z1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('does nothing if the teacher cancels the confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<QuizEditor quiz={draft} onBack={() => {}} />)
    const button = await screen.findByRole('button', { name: 'Publish quiz' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    expect(api.publishQuiz).not.toHaveBeenCalled()
  })

  it('shows the server error if publishing fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.publishQuiz).mockRejectedValue(new Error('This quiz is already published'))
    render(<QuizEditor quiz={draft} onBack={() => {}} />)
    const button = await screen.findByRole('button', { name: 'Publish quiz' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent(/already published/)
  })

  it('shows publish and closing times, and no publish button, for a published quiz', async () => {
    render(<QuizEditor quiz={published} onBack={() => {}} />)
    await screen.findByText(/What is 1\/2/)
    expect(screen.getByText(/Closes:/)).toBeInTheDocument()
    expect(screen.getByText(/Published:/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish quiz' })).not.toBeInTheDocument()
  })
})

describe('QuizzesSection', () => {
  it('lists quizzes and creates a new one', async () => {
    vi.mocked(api.listQuizzes).mockResolvedValue([draft])
    vi.mocked(api.createQuiz).mockResolvedValue()
    render(<QuizzesSection classroomId="c1" />)
    const item = (await screen.findByText(/Fractions Test/)).closest('li')!
    expect(within(item).getByText('(draft)')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/New quiz title/), { target: { value: 'Decimals Quiz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create quiz' }))
    await waitFor(() => expect(api.createQuiz).toHaveBeenCalledWith('c1', 'Decimals Quiz'))
  })

  it('rejects a too-short title locally', async () => {
    vi.mocked(api.listQuizzes).mockResolvedValue([])
    render(<QuizzesSection classroomId="c1" />)
    await screen.findByText('No quizzes yet.')
    fireEvent.change(screen.getByLabelText(/New quiz title/), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create quiz' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 2/)
    expect(api.createQuiz).not.toHaveBeenCalled()
  })
})
