import { useEffect, useRef, useState } from 'react'
import type { Medication, MedicationInput, MedicationSchedule } from '@body-io/shared'
import { focusIfDesktop } from '../lib/device'
import {
  inputBase,
  labelBase,
  modalFooterButton,
  modalPrimaryButton,
} from '../lib/styles'
import CatalogModalHeader from './catalog/CatalogModalHeader'
import Modal from './Modal'

interface MedicationEditorModalProps {
  medication?: Medication
  onSave: (input: MedicationInput) => Promise<void>
  onClose: () => void
}

const MED_ICON = 'fa-pills'
const MED_ICON_BG = '#ecfdf5'
const MED_ICON_COLOR = '#0E7A48'

export default function MedicationEditorModal({
  medication,
  onSave,
  onClose,
}: MedicationEditorModalProps) {
  const isEdit = medication !== undefined
  const [name, setName] = useState(medication?.name ?? '')
  const [brandName, setBrandName] = useState(medication?.brandName ?? '')
  const [strength, setStrength] = useState(medication?.strength ?? '')
  const [intervalHours, setIntervalHours] = useState(
    medication ? String(medication.intervalHours) : '',
  )
  const [howToTake, setHowToTake] = useState(medication?.howToTake ?? '')
  const [schedule, setSchedule] = useState<MedicationSchedule>(
    medication?.schedule ?? 'as_needed',
  )
  const [usedFor, setUsedFor] = useState(medication?.usedFor ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    focusIfDesktop(nameRef.current)

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
    const parsedInterval = Number.parseFloat(intervalHours)
    if (!name.trim()) {
      setError('Medication name is required')
      return
    }
    if (!Number.isFinite(parsedInterval) || parsedInterval <= 0) {
      setError('Interval hours must be greater than 0')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        brandName: brandName.trim(),
        strength: strength.trim(),
        intervalHours: parsedInterval,
        howToTake: howToTake.trim(),
        schedule,
        usedFor: usedFor.trim(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save medication')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal titleId="medication-editor-title" onClose={onClose}>
      <CatalogModalHeader
        icon={MED_ICON}
        iconBg={MED_ICON_BG}
        iconColor={MED_ICON_COLOR}
        titleId="medication-editor-title"
        title={isEdit ? 'Edit Medication' : 'Add Medication'}
        subtitle="Set the dosing interval used to calculate next dose due."
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

      <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
        <div>
          <label htmlFor="med-name" style={labelBase}>
            Medication
          </label>
          <input
            id="med-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputBase}
            placeholder="e.g. Ibuprofen"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label htmlFor="med-brand" style={labelBase}>
              Brand name
            </label>
            <input
              id="med-brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              style={inputBase}
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="med-strength" style={labelBase}>
              Strength
            </label>
            <input
              id="med-strength"
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              style={inputBase}
              placeholder="e.g. 600 mg"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label htmlFor="med-interval" style={labelBase}>
              Interval hours
            </label>
            <input
              id="med-interval"
              type="number"
              min="0.25"
              step="0.25"
              value={intervalHours}
              onChange={(e) => setIntervalHours(e.target.value)}
              style={inputBase}
              placeholder="e.g. 4"
            />
          </div>
          <div>
            <label htmlFor="med-schedule" style={labelBase}>
              Schedule
            </label>
            <select
              id="med-schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as MedicationSchedule)}
              style={inputBase}
            >
              <option value="as_needed">As Needed</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="med-how" style={labelBase}>
            How to take
          </label>
          <input
            id="med-how"
            value={howToTake}
            onChange={(e) => setHowToTake(e.target.value)}
            style={inputBase}
            placeholder="e.g. Take 1 tablet every 4 hours as needed"
          />
        </div>

        <div>
          <label htmlFor="med-used-for" style={labelBase}>
            Used for
          </label>
          <input
            id="med-used-for"
            value={usedFor}
            onChange={(e) => setUsedFor(e.target.value)}
            style={inputBase}
            placeholder="e.g. Pain Relief"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={modalFooterButton}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={saving} style={modalPrimaryButton}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Medication'}
        </button>
      </div>
    </Modal>
  )
}
