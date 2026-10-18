import { supabase } from '../../lib/supabase.ts'
import type { Classroom, Student } from './types.ts'

const CLASSROOM_COLUMNS = 'id, name, join_code, created_at'
const STUDENT_COLUMNS = 'id, classroom_id, full_name, login_code, created_at'

// Row-level security in the database guarantees a teacher only ever gets their own rows back.

export async function listClassrooms(): Promise<Classroom[]> {
  const { data, error } = await supabase.from('classrooms').select(CLASSROOM_COLUMNS).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Classroom[]
}

export async function createClassroom(name: string): Promise<void> {
  const { error } = await supabase.from('classrooms').insert({ name: name.trim() })
  if (error) throw new Error(error.message)
}

export async function deleteClassroom(id: string): Promise<void> {
  const { error } = await supabase.from('classrooms').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listStudents(classroomId: string): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select(STUDENT_COLUMNS)
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Student[]
}

export async function addStudent(classroomId: string, fullName: string): Promise<void> {
  const { error } = await supabase.from('students').insert({ classroom_id: classroomId, full_name: fullName.trim() })
  if (error) throw new Error(error.message)
}

export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
