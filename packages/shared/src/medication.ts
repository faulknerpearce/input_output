import type { ValidationResult } from './validation.js'

export type MedicationSchedule = 'scheduled' | 'as_needed'

export interface Medication {
  id: string
  name: string
  brandName: string
  strength: string
  intervalHours: number
  howToTake: string
  schedule: MedicationSchedule
  usedFor: string
  createdAt: string
  updatedAt: string
}

export interface MedicationInput {
  name: string
  brandName?: string
  strength?: string
  intervalHours: number
  howToTake?: string
  schedule?: MedicationSchedule
  usedFor?: string
}

export interface MedicationDose {
  id: string
  medicationId: string
  doseDate: string
  takenAt: string
  notes: string
  createdAt: string
  medicationName: string
  intervalHours: number
  schedule: MedicationSchedule
  strength: string
}

export interface MedicationDoseInput {
  medicationId: string
  doseDate: string
  takenAt: string
  notes?: string
}

export interface MedicationDoseDaySummary {
  date: string
  doses: MedicationDose[]
}

const SCHEDULES: MedicationSchedule[] = ['scheduled', 'as_needed']

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

export function isMedicationSchedule(value: unknown): value is MedicationSchedule {
  return typeof value === 'string' && SCHEDULES.includes(value as MedicationSchedule)
}

/** Next dose due = takenAt + intervalHours (Notion formula equivalent). */
export function nextDoseDue(takenAt: string | Date, intervalHours: number): Date {
  const base = typeof takenAt === 'string' ? new Date(takenAt) : takenAt
  return new Date(base.getTime() + intervalHours * 60 * 60 * 1000)
}

export function formatIntervalLabel(intervalHours: number): string {
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) return ''
  if (intervalHours === 1) return 'every 1 hour'
  if (Number.isInteger(intervalHours)) return `every ${intervalHours} hours`
  return `every ${intervalHours} hours`
}

export function mapMedicationRow(row: {
  id: string
  name: string
  brand_name: string
  strength: string
  interval_hours: number | string
  how_to_take: string
  schedule: string
  used_for: string
  created_at: string
  updated_at: string
}): Medication {
  const intervalHours = parsePositiveNumber(row.interval_hours) ?? 1
  const schedule: MedicationSchedule = isMedicationSchedule(row.schedule)
    ? row.schedule
    : 'as_needed'

  return {
    id: row.id,
    name: row.name,
    brandName: row.brand_name ?? '',
    strength: row.strength ?? '',
    intervalHours,
    howToTake: row.how_to_take ?? '',
    schedule,
    usedFor: row.used_for ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMedicationDoseRow(
  row: {
    id: string
    medication_id: string
    dose_date: string
    taken_at: string
    notes: string
    created_at: string
  },
  medication: Pick<Medication, 'name' | 'intervalHours' | 'schedule' | 'strength'>,
): MedicationDose {
  return {
    id: row.id,
    medicationId: row.medication_id,
    doseDate: row.dose_date,
    takenAt: row.taken_at,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    medicationName: medication.name,
    intervalHours: medication.intervalHours,
    schedule: medication.schedule,
    strength: medication.strength,
  }
}

export function validateMedicationInput(
  input: Partial<MedicationInput>,
): ValidationResult<MedicationInput> {
  if (typeof input.name !== 'string' || input.name.trim() === '') {
    return { ok: false, error: 'Medication name is required' }
  }
  if (input.name.trim().length > 120) {
    return { ok: false, error: 'Medication name must be 120 characters or fewer' }
  }

  const intervalHours = parsePositiveNumber(input.intervalHours)
  if (intervalHours === null) {
    return { ok: false, error: 'Interval hours must be greater than 0' }
  }

  const schedule =
    input.schedule === undefined
      ? 'as_needed'
      : isMedicationSchedule(input.schedule)
        ? input.schedule
        : null
  if (schedule === null) {
    return { ok: false, error: 'Schedule must be scheduled or as_needed' }
  }

  return {
    ok: true,
    value: {
      name: input.name.trim(),
      brandName: typeof input.brandName === 'string' ? input.brandName.trim() : '',
      strength: typeof input.strength === 'string' ? input.strength.trim() : '',
      intervalHours,
      howToTake: typeof input.howToTake === 'string' ? input.howToTake.trim() : '',
      schedule,
      usedFor: typeof input.usedFor === 'string' ? input.usedFor.trim() : '',
    },
  }
}

export function validateMedicationDoseInput(
  input: Partial<MedicationDoseInput>,
): ValidationResult<MedicationDoseInput> {
  if (typeof input.medicationId !== 'string' || input.medicationId.trim() === '') {
    return { ok: false, error: 'Medication is required' }
  }
  if (typeof input.doseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.doseDate)) {
    return { ok: false, error: 'Dose date must be YYYY-MM-DD' }
  }
  if (typeof input.takenAt !== 'string' || Number.isNaN(new Date(input.takenAt).getTime())) {
    return { ok: false, error: 'Taken at must be a valid timestamp' }
  }

  return {
    ok: true,
    value: {
      medicationId: input.medicationId.trim(),
      doseDate: input.doseDate,
      takenAt: new Date(input.takenAt).toISOString(),
      notes: typeof input.notes === 'string' ? input.notes.trim() : '',
    },
  }
}

export function buildMedicationInsertPayload(
  input: MedicationInput,
  userId: string,
  id?: string,
): {
  id?: string
  user_id: string
  name: string
  brand_name: string
  strength: string
  interval_hours: number
  how_to_take: string
  schedule: MedicationSchedule
  used_for: string
} {
  const validated = validateMedicationInput(input)
  if (!validated.ok) throw new Error(validated.error)
  const value = validated.value

  return {
    id,
    user_id: userId,
    name: value.name,
    brand_name: value.brandName ?? '',
    strength: value.strength ?? '',
    interval_hours: value.intervalHours,
    how_to_take: value.howToTake ?? '',
    schedule: value.schedule ?? 'as_needed',
    used_for: value.usedFor ?? '',
  }
}

export function buildMedicationUpdatePayload(input: MedicationInput): {
  name: string
  brand_name: string
  strength: string
  interval_hours: number
  how_to_take: string
  schedule: MedicationSchedule
  used_for: string
  updated_at: string
} {
  const validated = validateMedicationInput(input)
  if (!validated.ok) throw new Error(validated.error)
  const value = validated.value

  return {
    name: value.name,
    brand_name: value.brandName ?? '',
    strength: value.strength ?? '',
    interval_hours: value.intervalHours,
    how_to_take: value.howToTake ?? '',
    schedule: value.schedule ?? 'as_needed',
    used_for: value.usedFor ?? '',
    updated_at: new Date().toISOString(),
  }
}

export function buildMedicationDoseInsertPayload(
  input: MedicationDoseInput,
  userId: string,
  id?: string,
): {
  id?: string
  user_id: string
  medication_id: string
  dose_date: string
  taken_at: string
  notes: string
} {
  const validated = validateMedicationDoseInput(input)
  if (!validated.ok) throw new Error(validated.error)
  const value = validated.value

  return {
    id,
    user_id: userId,
    medication_id: value.medicationId,
    dose_date: value.doseDate,
    taken_at: value.takenAt,
    notes: value.notes ?? '',
  }
}
