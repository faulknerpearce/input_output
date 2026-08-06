import type { NutritionGoals } from '@input_output/shared'
import { useEffect, useRef, useState } from 'react'
import { GOAL_FIELDS, parseGoalField, type GoalKey } from '../lib/goalsForm'
import { inputBase, labelBase } from '../lib/styles'

interface GoalsFormFieldsProps {
  form: NutritionGoals
  onChange: (next: NutritionGoals) => void
  idPrefix?: string
}

type GoalField = 'value' | 'low' | 'high'

function fieldKey(key: GoalKey, field: GoalField): string {
  return `${key}.${field}`
}

function toTextFields(goals: NutritionGoals): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const { key } of GOAL_FIELDS) {
    for (const field of ['value', 'low', 'high'] as const) {
      fields[fieldKey(key, field)] = String(goals[key][field])
    }
  }
  return fields
}

export default function GoalsFormFields({ form, onChange, idPrefix = 'goal' }: GoalsFormFieldsProps) {
  const [textFields, setTextFields] = useState(() => toTextFields(form))
  const formSnapshotRef = useRef(JSON.stringify(form))

  useEffect(() => {
    const nextSnapshot = JSON.stringify(form)
    if (nextSnapshot === formSnapshotRef.current) return
    formSnapshotRef.current = nextSnapshot
    setTextFields(toTextFields(form))
  }, [form])

  const updateGoal = (key: GoalKey, field: GoalField, value: string) => {
    setTextFields((current) => ({ ...current, [fieldKey(key, field)]: value }))

    if (value.trim() === '') return

    const parsed = parseGoalField(value)
    if (!Number.isFinite(parsed)) return

    onChange({
      ...form,
      [key]: {
        ...form[key],
        [field]: parsed,
      },
    })
  }

  const restoreGoalField = (key: GoalKey, field: GoalField) => {
    setTextFields((current) => ({
      ...current,
      [fieldKey(key, field)]: String(form[key][field]),
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {GOAL_FIELDS.map(({ key, label, unit, showRange }) => (
          <div
            key={key}
            style={{
              padding: 16,
              borderRadius: 16,
              border: '1px solid #f4f4f5',
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3f3f46', marginBottom: 12 }}>
              {label}
            </div>
            <div className="modal-form-grid">
              <div>
                <label htmlFor={`${idPrefix}-${key}-value`} style={labelBase}>
                  Target ({unit})
                </label>
                <input
                  id={`${idPrefix}-${key}-value`}
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={textFields[fieldKey(key, 'value')]}
                  onChange={(e) => updateGoal(key, 'value', e.target.value)}
                  onBlur={(event) => {
                    if (event.currentTarget.value.trim() === '') {
                      restoreGoalField(key, 'value')
                    }
                  }}
                  style={inputBase}
                />
              </div>
              {showRange ? (
                <>
                  <div>
                    <label htmlFor={`${idPrefix}-${key}-low`} style={labelBase}>
                      Low ({unit})
                    </label>
                    <input
                      id={`${idPrefix}-${key}-low`}
                      type="number"
                      min={key === 'caffeine' ? 0 : 1}
                      inputMode="numeric"
                      value={textFields[fieldKey(key, 'low')]}
                      onChange={(e) => updateGoal(key, 'low', e.target.value)}
                      onBlur={(event) => {
                        if (event.currentTarget.value.trim() === '') {
                          restoreGoalField(key, 'low')
                        }
                      }}
                      style={inputBase}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idPrefix}-${key}-high`} style={labelBase}>
                      High ({unit})
                    </label>
                    <input
                      id={`${idPrefix}-${key}-high`}
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={textFields[fieldKey(key, 'high')]}
                      onChange={(e) => updateGoal(key, 'high', e.target.value)}
                      onBlur={(event) => {
                        if (event.currentTarget.value.trim() === '') {
                          restoreGoalField(key, 'high')
                        }
                      }}
                      style={inputBase}
                    />
                  </div>
                </>
              ) : (
                <div aria-hidden="true" />
              )}
            </div>
          </div>
      ))}
    </div>
  )
}