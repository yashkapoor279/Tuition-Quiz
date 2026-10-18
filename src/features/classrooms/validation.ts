/** Returns an error message, or null when valid. Mirrors the database rule (2 to `max` characters). */
export function validateName(value: string, label: string, max = 80): string | null {
  const trimmed = value.trim()
  if (trimmed.length < 2) return `${label} must be at least 2 characters.`
  if (trimmed.length > max) return `${label} must be ${max} characters or fewer.`
  return null
}
