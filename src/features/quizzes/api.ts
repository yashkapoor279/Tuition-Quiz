import { supabase } from '../../lib/supabase.ts'
import type { Quiz, QuizOption, QuizQuestion } from './types.ts'
import type { QuestionPayload } from './validation.ts'

const QUIZ_COLUMNS = 'id, classroom_id, title, status, published_at, closes_at, created_at'

// Reads rely on row-level security. Question writes go through database functions that validate
// everything and save the question, options and answer key together (or not at all).

export async function listQuizzes(classroomId: string): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select(QUIZ_COLUMNS)
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Quiz[]
}

export async function createQuiz(classroomId: string, title: string): Promise<void> {
  const { error } = await supabase.from('quizzes').insert({ classroom_id: classroomId, title: title.trim() })
  if (error) throw new Error(error.message)
}

export async function renameQuiz(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('quizzes').update({ title: title.trim() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteQuiz(id: string): Promise<void> {
  const { error } = await supabase.from('quizzes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function loadQuestions(quizId: string): Promise<QuizQuestion[]> {
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, quiz_id, position, body, marks')
    .eq('quiz_id', quizId)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = (questions ?? []) as Omit<QuizQuestion, 'options' | 'correct_option_id'>[]
  if (rows.length === 0) return []

  const ids = rows.map((q) => q.id)
  const [optionsRes, keysRes] = await Promise.all([
    supabase.from('options').select('id, question_id, position, body').in('question_id', ids),
    supabase.from('answer_keys').select('question_id, correct_option_id').in('question_id', ids),
  ])
  if (optionsRes.error) throw new Error(optionsRes.error.message)
  if (keysRes.error) throw new Error(keysRes.error.message)

  const options = (optionsRes.data ?? []) as QuizOption[]
  const keys = (keysRes.data ?? []) as { question_id: string; correct_option_id: string }[]

  return rows.map((q) => ({
    ...q,
    options: options.filter((o) => o.question_id === q.id).sort((a, b) => a.position - b.position),
    correct_option_id: keys.find((k) => k.question_id === q.id)?.correct_option_id ?? null,
  }))
}

/** Creates a question (questionId = null) or replaces an existing one. */
export async function saveQuestion(quizId: string, questionId: string | null, payload: QuestionPayload): Promise<void> {
  const { error } = await supabase.rpc('save_question', {
    p_quiz_id: quizId,
    p_question_id: questionId,
    p_body: payload.body,
    p_marks: payload.marks,
    p_options: payload.options,
    p_correct_index: payload.correctIndex,
  })
  if (error) throw new Error(error.message)
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_question', { p_question_id: questionId })
  if (error) throw new Error(error.message)
}

/** Publishes a draft quiz. The database sets the publish time and the deadline (exactly 24 hours later). */
export async function publishQuiz(quizId: string): Promise<void> {
  const { error } = await supabase.rpc('publish_quiz', { p_quiz_id: quizId })
  if (error) throw new Error(error.message)
}
