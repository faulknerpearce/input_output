import { useEffect, useRef, useState } from 'react'
import {
  currentTimeInputValue,
  entryMacrosPerServing,
  loggedAtFromDayAndTime,
  scaleEntryToPortion,
  todayISOInTimeZone,
  type FoodEntry,
  type FoodEntryWrite,
  type PortionUnit,
} from '@input_output/shared'
import { focusIfDesktop } from '../lib/device'
import { inputBase, labelBase } from '../lib/styles'
import Modal from './Modal'

interface RelogEntryModalProps {
  entry: FoodEntry
  /** Default calendar day for the new log (usually today or the day being viewed). */
  logDate: string
  timeZone: string
  onLog: (entry: FoodEntryWrite, options: { entryDate: string }) => Promise<void>
  onClose: () => void
}

export default function RelogEntryModal({
  entry,
  logDate,
  timeZone,
  onLog,
  onClose,
}: RelogEntryModalProps) {
  const derived = entryMacrosPerServing(entry)
  const defaultUnit: PortionUnit =
    entry.portionUnit === 'grams' && derived.allowsGrams ? 'grams' : 'servings'
  const defaultQty =
    entry.portionQuantity != null && entry.portionQuantity > 0
      ? String(entry.portionQuantity)
      : '1'

  // Prefer today for quick re-logs; user can still pick any past day.
  const [entryDate, setEntryDate] = useState(() => todayISOInTimeZone(timeZone) || logDate)
  const [logTime, setLogTime] = useState(() => currentTimeInputValue(timeZone))
  const [portionUnit, setPortionUnit] = useState<PortionUnit>(defaultUnit)
  const [portionQuantity, setPortionQuantity] = useState(defaultQty)
  const [servingWeightGrams, setServingWeightGrams] = useState(
    derived.referenceWeightGrams ? String(derived.referenceWeightGrams) : '',
  )
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const portionRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const servingWeightNum = Number.parseFloat(servingWeightGrams)
  const resolvedServingWeight =
    Number.isFinite(servingWeightNum) && servingWeightNum > 0 ? servingWeightNum : undefined
  const allowsGrams = Boolean(resolvedServingWeight)
  const effectiveUnit: PortionUnit =
    allowsGrams && portionUnit === 'grams' ? 'grams' : 'servings'
  const portionQuantityNum = Number.parseFloat(portionQuantity)

  const scaled =
    portionQuantity !== '' && Number.isFinite(portionQuantityNum)
      ? scaleEntryToPortion(entry, {
          portionUnit: effectiveUnit,
          portionQuantity: portionQuantityNum,
          servingWeightGrams: resolvedServingWeight,
        })
      : null
  const previewTotals = scaled?.ok ? scaled.totals : null

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
    if (!Number.isFinite(portionQuantityNum) || portionQuantityNum <= 0) {
      setError(
        effectiveUnit === 'grams' ? 'Weight must be greater than 0' : 'Servings must be greater than 0',
      )
      return
    }

    const result = scaleEntryToPortion(entry, {
      portionUnit: effectiveUnit,
      portionQuantity: portionQuantityNum,
      servingWeightGrams: resolvedServingWeight,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }

    const loggedAt = loggedAtFromDayAndTime(entryDate, logTime, timeZone)
    if (!loggedAt.ok) {
      setError(loggedAt.error)
      return
    }

    const write: FoodEntryWrite = {
      icon: entry.icon,
      iconBg: entry.iconBg,
      iconColor: entry.iconColor,
      name: entry.name,
      description: entry.description,
      calories: result.totals.calories,
      protein: result.totals.protein,
      carbs: result.totals.carbs,
      fat: result.totals.fat,
      fiber: result.totals.fiber,
      caffeine: result.totals.caffeine,
      portionUnit: result.meta.portionUnit,
      portionQuantity: result.meta.portionQuantity,
      referenceWeightGrams: result.meta.referenceWeightGrams,
      loggedAt: loggedAt.value,
    }

    setLogging(true)
    setError(null)
    try {
      await onLog(write, { entryDate })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log entry')
    } finally {
      setLogging(false)
    }
  }

  const today = todayISOInTimeZone(timeZone)

  return (
    <Modal titleId="relog-entry-title" onClose={onClose}>
      <h3
        id="relog-entry-title"
        style={{
          fontFamily: "'Space Grotesk','Inter',sans-serif",
          fontSize: 22,
          fontWeight: 600,
          margin: '0 0 4px 0',
        }}
      >
        Log again
      </h3>
      <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 24px 0' }}>
        Re-log <strong style={{ color: '#18181b' }}>{entry.name}</strong> with a new date, time, and
        amount. The original entry is not changed.
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

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="relog-date" style={labelBase}>
          Log date
        </label>
        <input
          id="relog-date"
          type="date"
          value={entryDate}
          max={today}
          onChange={(e) => setEntryDate(e.target.value || entryDate)}
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="relog-time" style={labelBase}>
          Log time
        </label>
        <input
          id="relog-time"
          type="time"
          value={logTime}
          onChange={(e) => setLogTime(e.target.value)}
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="relog-serving-weight" style={labelBase}>
          Weight of 1 serving (g)
        </label>
        <input
          id="relog-serving-weight"
          type="number"
          min="1"
          step="1"
          value={servingWeightGrams}
          onChange={(e) => {
            setServingWeightGrams(e.target.value)
            if (!e.target.value) setPortionUnit('servings')
          }}
          placeholder="Optional — enables log by grams"
          style={inputBase}
        />
        <p style={{ fontSize: 12, color: '#a1a1aa', margin: '6px 0 0 0' }}>
          From the prior log when available. Set this to log by grams instead of servings.
        </p>
      </div>

      {allowsGrams && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['servings', 'grams'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPortionUnit(value)}
              style={{
                padding: '8px 14px',
                borderRadius: 9999,
                border:
                  effectiveUnit === value ? '1px solid var(--zone-accent)' : '1px solid #e4e4e7',
                background: effectiveUnit === value ? 'var(--zone-accent)' : 'white',
                color: effectiveUnit === value ? 'white' : '#52525b',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {value === 'servings' ? 'Servings' : 'Weight (g)'}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="relog-portion" style={labelBase}>
          {effectiveUnit === 'grams'
            ? 'How many grams did you have?'
            : 'How many servings did you have?'}
        </label>
        <input
          id="relog-portion"
          ref={portionRef}
          type="number"
          min={effectiveUnit === 'grams' ? '1' : '0.25'}
          step={effectiveUnit === 'grams' ? '1' : '0.25'}
          value={portionQuantity}
          onChange={(e) => setPortionQuantity(e.target.value)}
          style={inputBase}
        />
      </div>

      {previewTotals && (
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 16,
            background: '#ecfdf5',
            color: '#065f46',
            fontSize: 13,
          }}
        >
          This will add {previewTotals.calories} kcal, {previewTotals.protein}g protein,{' '}
          {previewTotals.carbs}g carbs
          {previewTotals.fat > 0 ? `, ${previewTotals.fat}g fat` : ''}.
        </div>
      )}

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
          onClick={() => void submit()}
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
          {logging ? 'Logging...' : 'Add to Log'}
        </button>
      </div>
    </Modal>
  )
}
