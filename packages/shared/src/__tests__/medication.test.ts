import { describe, expect, it } from 'vitest'
import {
  buildMedicationDoseInsertPayload,
  buildMedicationInsertPayload,
  formatIntervalLabel,
  mapMedicationDoseRow,
  mapMedicationRow,
  nextDoseDue,
  validateMedicationDoseInput,
  validateMedicationInput,
} from '../medication.js'

describe('nextDoseDue', () => {
  it('adds interval hours to taken-at', () => {
    const takenAt = '2026-07-25T13:45:00.000Z'
    expect(nextDoseDue(takenAt, 4).toISOString()).toBe('2026-07-25T17:45:00.000Z')
    expect(nextDoseDue(takenAt, 8).toISOString()).toBe('2026-07-25T21:45:00.000Z')
  })
})

describe('formatIntervalLabel', () => {
  it('formats common intervals', () => {
    expect(formatIntervalLabel(1)).toBe('every 1 hour')
    expect(formatIntervalLabel(4)).toBe('every 4 hours')
    expect(formatIntervalLabel(12.5)).toBe('every 12.5 hours')
  })
})

describe('validateMedicationInput', () => {
  it('requires name and positive interval', () => {
    expect(validateMedicationInput({ intervalHours: 4 }).ok).toBe(false)
    expect(validateMedicationInput({ name: 'Ibuprofen', intervalHours: 0 }).ok).toBe(false)
    expect(validateMedicationInput({ name: 'Ibuprofen', intervalHours: 8 }).ok).toBe(true)
  })

  it('normalizes optional fields and schedule', () => {
    const result = validateMedicationInput({
      name: '  Aspirin  ',
      intervalHours: 12,
      schedule: 'scheduled',
      brandName: '  ',
      strength: '81 mg',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      name: 'Aspirin',
      brandName: '',
      strength: '81 mg',
      intervalHours: 12,
      howToTake: '',
      schedule: 'scheduled',
      usedFor: '',
    })
  })
})

describe('validateMedicationDoseInput', () => {
  it('validates medication, date, and taken-at', () => {
    expect(
      validateMedicationDoseInput({
        medicationId: 'med-1',
        doseDate: '2026-07-25',
        takenAt: '2026-07-25T13:45:00.000Z',
      }).ok,
    ).toBe(true)
    expect(
      validateMedicationDoseInput({
        medicationId: '',
        doseDate: '2026-07-25',
        takenAt: '2026-07-25T13:45:00.000Z',
      }).ok,
    ).toBe(false)
  })
})

describe('mapMedicationRow', () => {
  it('maps snake_case row to domain type', () => {
    const med = mapMedicationRow({
      id: 'm1',
      name: 'Ibuprofen',
      brand_name: '',
      strength: '600 mg',
      interval_hours: '8',
      how_to_take: 'Take 3 tablets',
      schedule: 'as_needed',
      used_for: 'Pain Relief',
      created_at: '2026-07-22T00:00:00.000Z',
      updated_at: '2026-07-22T00:00:00.000Z',
    })
    expect(med.intervalHours).toBe(8)
    expect(med.schedule).toBe('as_needed')
    expect(med.usedFor).toBe('Pain Relief')
  })
})

describe('mapMedicationDoseRow', () => {
  it('joins medication display fields', () => {
    const dose = mapMedicationDoseRow(
      {
        id: 'd1',
        medication_id: 'm1',
        dose_date: '2026-07-25',
        taken_at: '2026-07-25T13:45:00.000Z',
        notes: '',
        created_at: '2026-07-25T13:45:00.000Z',
      },
      {
        name: 'Ibuprofen',
        intervalHours: 8,
        schedule: 'as_needed',
        strength: '600 mg',
      },
    )
    expect(dose.medicationName).toBe('Ibuprofen')
    expect(dose.intervalHours).toBe(8)
  })
})

describe('build payloads', () => {
  it('builds insert payloads', () => {
    const med = buildMedicationInsertPayload(
      { name: 'Aspirin', intervalHours: 12, schedule: 'scheduled' },
      'user-1',
      'med-1',
    )
    expect(med).toMatchObject({
      id: 'med-1',
      user_id: 'user-1',
      name: 'Aspirin',
      interval_hours: 12,
      schedule: 'scheduled',
    })

    const dose = buildMedicationDoseInsertPayload(
      {
        medicationId: 'med-1',
        doseDate: '2026-07-25',
        takenAt: '2026-07-25T13:45:00.000Z',
        notes: 'pain was at 7',
      },
      'user-1',
    )
    expect(dose).toMatchObject({
      user_id: 'user-1',
      medication_id: 'med-1',
      dose_date: '2026-07-25',
      notes: 'pain was at 7',
    })
  })
})
