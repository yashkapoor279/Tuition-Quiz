/** Returns an error message, or null when valid. Mirrors the database rule (2-80 characters). */
export function validateName(value: string, label: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < 2) return `${label} must be at least 2 characters.`
  if (trimmed.length > 80) return `${label} must be 80 characters or fewer.`
  return null
}
