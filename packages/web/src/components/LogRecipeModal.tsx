import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { RecipeSummary } from '@input_output/shared'
import { focusIfDesktop } from '../lib/device'
import Modal from './Modal'
import RecipeLogFields from './RecipeLogFields'
import {
  defaultRecipeLogFieldValues,
  validateRecipeLogFields,
  type RecipeLogFieldValues,
  type RecipeLogSubmitOptions,
} from '../lib/recipeLogForm'

interface LogRecipeModalProps {
  recipe: RecipeSummary
  timeZone: string
  onLog: (options: RecipeLogSubmitOptions) => Promise<void>
  onClose: () => void
  /** Optional subtitle override (e.g. shared-by context). */
  subtitle?: ReactNode
}

export default function LogRecipeModal({
  recipe,
  timeZone,
  onLog,
  onClose,
  subtitle,
}: LogRecipeModalProps) {
  const [values, setValues] = useState<RecipeLogFieldValues>(() =>
    defaultRecipeLogFieldValues(timeZone, recipe),
  )
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const portionRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    focusIfDesktop(portionRef.current)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previousFocusRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    const result = validateRecipeLogFields(recipe, values, timeZone)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setLogging(true)
    setError(null)
    try {
      await onLog(result.value)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log recipe')
    } finally {
      setLogging(false)
    }
  }

  return (
    <Modal titleId="log-recipe-title" onClose={onClose}>
      <h3
        id="log-recipe-title"
        style={{
          fontFamily: "'Space Grotesk','Inter',sans-serif",
          fontSize: 22,
          fontWeight: 600,
          margin: '0 0 4px 0',
        }}
      >
        Add to Log
      </h3>
      <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 24px 0' }}>
        {subtitle ?? (
          <>
            Log <strong style={{ color: '#18181b' }}>{recipe.name}</strong> to your food log.
          </>
        )}
      </p>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <RecipeLogFields
        recipe={recipe}
        timeZone={timeZone}
        values={values}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        idPrefix="log-recipe"
        quantityInputRef={portionRef}
      />

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '10px 20px',
            borderRadius: 9999,
            border: '1px solid #e4e4e7',
            background: 'white',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            color: '#52525b',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={logging}
          style={{
            padding: '10px 20px',
            borderRadius: 9999,
            border: 'none',
            background: logging ? '#6b7280' : 'var(--zone-accent)',
            color: 'white',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {logging ? 'Adding...' : 'Add to Log'}
        </button>
      </div>
    </Modal>
  )
}
