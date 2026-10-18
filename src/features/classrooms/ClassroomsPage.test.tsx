import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api.ts', () => ({
  listClassrooms: vi.fn(),
  createClassroom: vi.fn(),
  deleteClassroom: vi.fn(),
  listStudents: vi.fn(),
  addStudent: vi.fn(),
  deleteStudent: vi.fn(),
}))

import * as api from './api.ts'
import { ClassroomsPage } from './ClassroomsPage.tsx'

const classroom = { id: 'c1', name: 'Class 5 Maths', join_code: 'K7M2QX', created_at: '2026-10-19T00:00:00Z' }
const student = { id: 's1', classroom_id: 'c1', full_name: 'Rohan Kumar Sharma', login_code: 'RKS-4821', created_at: '2026-10-19T00:00:00Z' }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listClassrooms).mockResolvedValue([classroom])
  vi.mocked(api.listStudents).mockResolvedValue([student])
})

describe('ClassroomsPage', () => {
  it('lists classrooms with their codes', async () => {
    render(<ClassroomsPage />)
    expect(await screen.findByText(/Class 5 Maths/)).toBeInTheDocument()
    expect(screen.getByText('K7M2QX')).toBeInTheDocument()
  })

  it('blocks a too-short classroom name without calling the server', async () => {
    render(<ClassroomsPage />)
    await screen.findByText(/Class 5 Maths/)
    fireEvent.change(screen.getByLabelText(/New classroom name/), { target: { value: 'a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create classroom' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 2/)
    expect(api.createClassroom).not.toHaveBeenCalled()
  })

  it('creates a classroom and reloads the list', async () => {
    vi.mocked(api.createClassroom).mockResolvedValue()
    render(<ClassroomsPage />)
    await screen.findByText(/Class 5 Maths/)
    fireEvent.change(screen.getByLabelText(/New classroom name/), { target: { value: 'Class 6 English' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create classroom' }))
    await waitFor(() => expect(api.createClassroom).toHaveBeenCalledWith('Class 6 English'))
    await waitFor(() => expect(api.listClassrooms).toHaveBeenCalledTimes(2))
  })

  it('opens a classroom and shows student login codes', async () => {
    render(<ClassroomsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    expect(await screen.findByText('Rohan Kumar Sharma')).toBeInTheDocument()
    expect(screen.getByText('RKS-4821')).toBeInTheDocument()
  })

  it('adds a student', async () => {
    vi.mocked(api.addStudent).mockResolvedValue()
    render(<ClassroomsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByText('Rohan Kumar Sharma')
    fireEvent.change(screen.getByLabelText(/Student full name/), { target: { value: 'Asha Rao' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add student' }))
    await waitFor(() => expect(api.addStudent).toHaveBeenCalledWith('c1', 'Asha Rao'))
  })
})
