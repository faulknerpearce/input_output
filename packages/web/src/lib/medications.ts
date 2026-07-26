import {
  buildMedicationDoseInsertPayload,
  buildMedicationInsertPayload,
  buildMedicationUpdatePayload,
  mapMedicationDoseRow,
  mapMedicationRow,
  offsetDateISO,
  todayISO,
  validateMedicationDoseInput,
  validateMedicationInput,
  type Medication,
  type MedicationDose,
  type MedicationDoseDaySummary,
  type MedicationDoseInput,
  type MedicationInput,
} from '@body-io/shared'
import { supabase } from './supabase'

export type { Medication, MedicationDose, MedicationDoseDaySummary, MedicationDoseInput, MedicationInput }

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('Not signed in')
  return user.id
}

export async function fetchMedications(): Promise<Medication[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapMedicationRow)
}

export async function addMedication(input: MedicationInput): Promise<Medication> {
  const userId = await requireUserId()
  const validated = validateMedicationInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const payload = buildMedicationInsertPayload(validated.value, userId, crypto.randomUUID())
  const { data, error } = await supabase.from('medications').insert(payload).select('*').single()
  if (error) throw new Error(error.message)
  return mapMedicationRow(data)
}

export async function updateMedication(id: string, input: MedicationInput): Promise<Medication> {
  await requireUserId()
  const validated = validateMedicationInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const payload = buildMedicationUpdatePayload(validated.value)
  const { data, error } = await supabase
    .from('medications')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapMedicationRow(data)
}

export async function deleteMedication(id: string): Promise<void> {
  await requireUserId()
  const { error } = await supabase.from('medications').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

function medicationLookup(medications: Medication[]): Map<string, Medication> {
  return new Map(medications.map((med) => [med.id, med]))
}

function mapDoseWithMedication(
  row: {
    id: string
    medication_id: string
    dose_date: string
    taken_at: string
    notes: string
    created_at: string
  },
  byId: Map<string, Medication>,
): MedicationDose | null {
  const med = byId.get(row.medication_id)
  if (!med) return null
  return mapMedicationDoseRow(row, med)
}

export async function fetchDoses(date: string = todayISO()): Promise<MedicationDose[]> {
  const userId = await requireUserId()
  const [dosesResult, medications] = await Promise.all([
    supabase
      .from('medication_doses')
      .select('*')
      .eq('user_id', userId)
      .eq('dose_date', date)
      .order('taken_at', { ascending: true }),
    fetchMedications(),
  ])
  if (dosesResult.error) throw new Error(dosesResult.error.message)

  const byId = medicationLookup(medications)
  return (dosesResult.data ?? [])
    .map((row) => mapDoseWithMedication(row, byId))
    .filter((dose): dose is MedicationDose => dose !== null)
}

export async function fetchDoseDaySummaries(daysBack = 30): Promise<MedicationDoseDaySummary[]> {
  const userId = await requireUserId()
  const today = todayISO()
  const startDate = offsetDateISO(daysBack)

  const [dosesResult, medications] = await Promise.all([
    supabase
      .from('medication_doses')
      .select('*')
      .eq('user_id', userId)
      .gte('dose_date', startDate)
      .lte('dose_date', today)
      .order('dose_date', { ascending: false })
      .order('taken_at', { ascending: true }),
    fetchMedications(),
  ])
  if (dosesResult.error) throw new Error(dosesResult.error.message)

  const byId = medicationLookup(medications)
  const byDate = new Map<string, MedicationDose[]>()
  for (const row of dosesResult.data ?? []) {
    const dose = mapDoseWithMedication(row, byId)
    if (!dose) continue
    const list = byDate.get(dose.doseDate) ?? []
    list.push(dose)
    byDate.set(dose.doseDate, list)
  }

  if (!byDate.has(today)) {
    byDate.set(today, [])
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, doses]) => ({ date, doses }))
}

export async function addDose(input: MedicationDoseInput): Promise<MedicationDose> {
  const userId = await requireUserId()
  const validated = validateMedicationDoseInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const payload = buildMedicationDoseInsertPayload(validated.value, userId, crypto.randomUUID())
  const { data, error } = await supabase
    .from('medication_doses')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  const { data: medRow, error: medError } = await supabase
    .from('medications')
    .select('*')
    .eq('id', data.medication_id)
    .single()
  if (medError) throw new Error(medError.message)

  return mapMedicationDoseRow(data, mapMedicationRow(medRow))
}

export async function updateDose(id: string, input: MedicationDoseInput): Promise<MedicationDose> {
  await requireUserId()
  const validated = validateMedicationDoseInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const { data, error } = await supabase
    .from('medication_doses')
    .update({
      medication_id: validated.value.medicationId,
      dose_date: validated.value.doseDate,
      taken_at: validated.value.takenAt,
      notes: validated.value.notes ?? '',
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  const { data: medRow, error: medError } = await supabase
    .from('medications')
    .select('*')
    .eq('id', data.medication_id)
    .single()
  if (medError) throw new Error(medError.message)

  return mapMedicationDoseRow(data, mapMedicationRow(medRow))
}

export async function deleteDose(id: string): Promise<void> {
  await requireUserId()
  const { error } = await supabase.from('medication_doses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
