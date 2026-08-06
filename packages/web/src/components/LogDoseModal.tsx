import { useEffect, useRef, useState } from 'react'
import {
  currentTimeInputValue,
  formatIntervalLabel,
  formatTimeInputValue,
  loggedAtFromDayAndTime,
  type Medication,
  type MedicationDose,
  type MedicationDoseInput,
} from '@input_output/shared'
import { focusIfDesktop } from '../lib/device'
import {
  inputBase,
  labelBase,
  modalFooterButton,
  modalPrimaryButton,
} from '../lib/styles'
import CatalogModalHeader from './catalog/CatalogModalHeader'
import Modal from './Modal'

interface LogDoseModalProps {
  medications: Medication[]
  doseDate: string
  timeZone: string
  dose?: MedicationDose
  initialMedicationId?: string
  onSave: (input: MedicationDoseInput) => Promise<void>
  onClose: () => void
}

const MED_ICON = 'fa-pills'
const MED_ICON_BG = '#ecfdf5'
const MED_ICON_COLOR = '#0E7A48'

export default function LogDoseModal({
  medications,
  doseDate,
  timeZone,
  dose,
  initialMedicationId,
  onSave,
  onClose,
}: LogDoseModalProps) {
  const isEdit = dose !== undefined
  const [medicationId, setMedicationId] = useState(
    dose?.medicationId ?? initialMedicationId ?? medications[0]?.id ?? '',
  )
  const [logTime, setLogTime] = useState(() =>
    dose ? formatTimeInputValue(dose.takenAt, timeZone) : currentTimeInputValue(timeZone),
  )
  const [notes, setNotes] = useState(dose?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const medRef = useRef<HTMLSelectElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const selected = medications.find((med) => med.id === medicationId)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    focusIfDesktop(medRef.current)

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
    if (!medicationId) {
      setError('Select a medication')
      return
    }

    const takenAt = loggedAtFromDayAndTime(doseDate, logTime, timeZone)
    if (!takenAt.ok) {
      setError(takenAt.error)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        medicationId,
        doseDate,
        takenAt: takenAt.value,
        notes: notes.trim(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log dose')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal titleId="log-dose-title" onClose={onClose}>
      <CatalogModalHeader
        icon={MED_ICON}
        iconBg={MED_ICON_BG}
        iconColor={MED_ICON_COLOR}
        titleId="log-dose-title"
        title={isEdit ? 'Edit Dose' : 'Log Dose'}
        subtitle={
          selected
            ? `Next dose will be due ${formatIntervalLabel(selected.intervalHours)} after taken time.`
            : 'Choose a medication and when it was taken.'
        }
      />

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

      {medications.length === 0 ? (
        <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 20px 0' }}>
          Add a medication first, then log a dose.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
          <div>
            <label htmlFor="dose-medication" style={labelBase}>
              Medication
            </label>
            <select
              id="dose-medication"
              ref={medRef}
              value={medicationId}
              onChange={(e) => setMedicationId(e.target.value)}
              style={inputBase}
            >
              {medications.map((med) => (
                <option key={med.id} value={med.id}>
                  {med.name}
                  {med.strength ? ` (${med.strength})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dose-time" style={labelBase}>
              Taken at
            </label>
            <input
              id="dose-time"
              type="time"
              value={logTime}
              onChange={(e) => setLogTime(e.target.value)}
              style={inputBase}
            />
          </div>

          <div>
            <label htmlFor="dose-notes" style={labelBase}>
              Notes
            </label>
            <input
              id="dose-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={inputBase}
              placeholder="Optional"
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={modalFooterButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || medications.length === 0}
          style={modalPrimaryButton}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Dose'}
        </button>
      </div>
    </Modal>
  )
}
