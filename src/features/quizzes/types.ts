export interface Quiz {
  id: string
  classroom_id: string
  title: string
  status: 'draft' | 'published'
  published_at: string | null
  closes_at: string | null
  created_at: string
}

export interface QuizOption {
  id: string
  question_id: string
  position: number
  body: string
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  position: number
  body: string
  marks: number
  options: QuizOption[]
  correct_option_id: string | null
}
