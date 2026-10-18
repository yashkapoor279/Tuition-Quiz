export interface Classroom {
  id: string
  name: string
  join_code: string
  created_at: string
}

export interface Student {
  id: string
  classroom_id: string
  full_name: string
  login_code: string
  created_at: string
}
