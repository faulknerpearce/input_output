import {
  detectBrowserTimeZone,
  formatIntervalLabel,
  formatLogTime,
  nextDoseDue,
  shiftISODate,
  todayISOInTimeZone,
  type Medication,
  type MedicationDose,
  type MedicationDoseDaySummary,
  type MedicationDoseInput,
  type MedicationInput,
} from '@input_output/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import CatalogRow from '../components/layout/CatalogRow'
import DayNavigator from '../components/layout/DayNavigator'
import PageHeader from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageState'
import ZoneButton from '../components/layout/ZoneButton'
import LogDoseModal from '../components/LogDoseModal'
import MedicationEditorModal from '../components/MedicationEditorModal'
import { EmptyState } from '../components/ui'
import { useProfile } from '../context/useProfile'
import { neutrals, radius, status } from '../lib/design-tokens'
import {
  addDose,
  addMedication,
  deleteDose,
  deleteMedication,
  fetchDoseDaySummaries,
  fetchDoses,
  fetchMedications,
  updateDose,
  updateMedication,
} from '../lib/medications'

const MED_ICON = 'fa-pills'
const MED_ICON_BG = '#ecfdf5'
const MED_ICON_COLOR = '#0E7A48'

function emptyDaySummary(date: string): MedicationDoseDaySummary {
  return { date, doses: [] }
}

function medicationSubtitle(med: Medication): string {
  const parts: string[] = []
  if (med.strength) parts.push(med.strength)
  parts.push(formatIntervalLabel(med.intervalHours))
  parts.push(med.schedule === 'scheduled' ? 'Scheduled' : 'As needed')
  if (med.brandName) parts.push(med.brandName)
  if (med.usedFor) parts.push(med.usedFor)
  return parts.join(' · ')
}

function DoseRow({
  dose,
  timeZone,
  deleting,
  onEdit,
  onDelete,
}: {
  dose: MedicationDose
  timeZone: string
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const due = nextDoseDue(dose.takenAt, dose.intervalHours)
  const dueLabel = formatLogTime(due.toISOString(), timeZone)

  return (
    <div
      className="log-entry-card"
      style={{
        background: neutrals.surfaceMuted,
        border: `1px solid ${neutrals.border}`,
        borderRadius: radius.lg,
        padding: '16px 20px',
        opacity: deleting ? 0.5 : 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              background: MED_ICON_BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <i className={`fa-solid ${MED_ICON}`} style={{ color: MED_ICON_COLOR }} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                color: neutrals.textPrimary,
                fontSize: 15,
              }}
            >
              {dose.medicationName}
              {dose.strength ? (
                <span style={{ fontWeight: 400, color: neutrals.textMuted }}>
                  {' '}
                  · {dose.strength}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 12, color: neutrals.textFaint, marginTop: 2 }}>
              Taken {formatLogTime(dose.takenAt, timeZone)}
              {dose.notes ? ` · ${dose.notes}` : ''}
            </div>
          </div>
        </div>
        <div
          style={{
            marginLeft: 46,
            fontSize: 13,
            color: neutrals.textSecondary,
            fontWeight: 500,
          }}
        >
          Next dose due {dueLabel}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          className="delicate-icon-action"
          aria-label={`Edit ${dose.medicationName} dose`}
          onClick={onEdit}
        >
          <i className="fa-solid fa-pen" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="delicate-icon-action"
          aria-label={`Delete ${dose.medicationName} dose`}
          onClick={onDelete}
          disabled={deleting}
        >
          <i className="fa-solid fa-trash" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default function MedicationsPage() {
  const { profile, loading: profileLoading } = useProfile()
  const [medications, setMedications] = useState<Medication[]>([])
  const [days, setDays] = useState<MedicationDoseDaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(() =>
    todayISOInTimeZone(detectBrowserTimeZone()),
  )
  const [editingMedication, setEditingMedication] = useState<Medication | null | undefined>(
    undefined,
  )
  const [loggingDose, setLoggingDose] = useState(false)
  const [logDoseMedicationId, setLogDoseMedicationId] = useState<string | undefined>(undefined)
  const [editingDose, setEditingDose] = useState<MedicationDose | null>(null)
  const [deletingMedId, setDeletingMedId] = useState<string | null>(null)
  const [deletingDoseId, setDeletingDoseId] = useState<string | null>(null)

  const resolvedTimeZone = profileLoading ? detectBrowserTimeZone() : profile.timeZone
  const today = todayISOInTimeZone(resolvedTimeZone)
  const isToday = selectedDate === today

  const activeDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? emptyDaySummary(selectedDate),
    [days, selectedDate],
  )

  useEffect(() => {
    Promise.all([fetchMedications(), fetchDoseDaySummaries()])
      .then(([meds, summaries]) => {
        setMedications(meds)
        setDays(summaries)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load medications')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (loading) return
    if (days.some((day) => day.date === selectedDate)) return

    let cancelled = false
    fetchDoses(selectedDate)
      .then((doses) => {
        if (cancelled) return
        setDays((prev) => {
          if (prev.some((day) => day.date === selectedDate)) return prev
          return [...prev, { date: selectedDate, doses }].sort((a, b) =>
            b.date.localeCompare(a.date),
          )
        })
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load doses for', selectedDate, err)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loading, selectedDate, days])

  const openAddMedication = useCallback(() => setEditingMedication(null), [])
  const openLogDose = useCallback((medicationId?: string) => {
    setLogDoseMedicationId(medicationId)
    setLoggingDose(true)
  }, [])
  const updateDayDoses = (date: string, updater: (doses: MedicationDose[]) => MedicationDose[]) => {
    setDays((prev) => {
      const existing = prev.find((day) => day.date === date)
      if (!existing) {
        return [...prev, { date, doses: updater([]) }].sort((a, b) => b.date.localeCompare(a.date))
      }
      return prev.map((day) =>
        day.date === date ? { ...day, doses: updater(day.doses) } : day,
      )
    })
  }

  const handleSaveMedication = async (input: MedicationInput) => {
    if (editingMedication) {
      const updated = await updateMedication(editingMedication.id, input)
      setMedications((prev) =>
        prev
          .map((med) => (med.id === updated.id ? updated : med))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      setDays((prev) =>
        prev.map((day) => ({
          ...day,
          doses: day.doses.map((dose) =>
            dose.medicationId === updated.id
              ? {
                  ...dose,
                  medicationName: updated.name,
                  intervalHours: updated.intervalHours,
                  schedule: updated.schedule,
                  strength: updated.strength,
                }
              : dose,
          ),
        })),
      )
    } else {
      const created = await addMedication(input)
      setMedications((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      )
    }
  }

  const handleDeleteMedication = async (id: string) => {
    if (!window.confirm('Delete this medication and all of its dose logs?')) return
    setDeletingMedId(id)
    try {
      await deleteMedication(id)
      setMedications((prev) => prev.filter((med) => med.id !== id))
      setDays((prev) =>
        prev.map((day) => ({
          ...day,
          doses: day.doses.filter((dose) => dose.medicationId !== id),
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete medication')
    } finally {
      setDeletingMedId(null)
    }
  }

  const handleSaveDose = async (input: MedicationDoseInput) => {
    if (editingDose) {
      const updated = await updateDose(editingDose.id, input)
      setDays((prev) => {
        const without = prev.map((day) => ({
          ...day,
          doses: day.doses.filter((dose) => dose.id !== updated.id),
        }))
        const target = without.find((day) => day.date === updated.doseDate)
        if (!target) {
          return [...without, { date: updated.doseDate, doses: [updated] }].sort((a, b) =>
            b.date.localeCompare(a.date),
          )
        }
        return without.map((day) =>
          day.date === updated.doseDate
            ? {
                ...day,
                doses: [...day.doses, updated].sort((a, b) =>
                  a.takenAt.localeCompare(b.takenAt),
                ),
              }
            : day,
        )
      })
      setEditingDose(null)
    } else {
      const created = await addDose(input)
      updateDayDoses(created.doseDate, (doses) =>
        [...doses, created].sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
      )
      setLoggingDose(false)
    }
  }

  const handleDeleteDose = async (id: string) => {
    setDeletingDoseId(id)
    try {
      await deleteDose(id)
      setDays((prev) =>
        prev.map((day) => ({
          ...day,
          doses: day.doses.filter((dose) => dose.id !== id),
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dose')
    } finally {
      setDeletingDoseId(null)
    }
  }

  if (loading) return <PageLoading message="Loading medications…" />
  if (error && medications.length === 0 && days.length === 0) {
    return <PageError message={error} />
  }

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Medications"
        description="Track your medications and log doses with next-due times."
        actions={
          <>
            <ZoneButton variant="secondary" onClick={openAddMedication}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Add Medication
            </ZoneButton>
            <ZoneButton variant="primary" onClick={() => openLogDose()}>
              <i className="fa-solid fa-pills" aria-hidden="true" /> Log Dose
            </ZoneButton>
          </>
        }
      />

      <div style={{ display: 'grid', gap: 28 }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            background: status.danger.bg,
            color: status.danger.textStrong,
            borderRadius: radius.lg,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 600,
                margin: 0,
                color: neutrals.textPrimary,
              }}
            >
              Your medications
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: neutrals.textFaint }}>
              Interval hours drive next-dose times in the log below.
            </p>
          </div>
        </div>

        {medications.length === 0 ? (
          <EmptyState
            icon="fa-solid fa-pills"
            title="No medications yet"
            description="Add the medications you take, including how often they are due."
            action={
              <ZoneButton variant="primary" onClick={openAddMedication}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add Medication
              </ZoneButton>
            }
          />
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {medications.map((med) => (
              <CatalogRow
                key={med.id}
                icon={MED_ICON}
                iconBg={MED_ICON_BG}
                iconColor={MED_ICON_COLOR}
                title={med.name}
                subtitle={medicationSubtitle(med)}
                onView={() => setEditingMedication(med)}
                actions={
                  <>
                    <button
                      type="button"
                      className="delicate-icon-action"
                      aria-label={`Log dose of ${med.name}`}
                      onClick={() => openLogDose(med.id)}
                      title="Log dose"
                    >
                      <i className="fa-solid fa-plus" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="delicate-icon-action"
                      aria-label={`Edit ${med.name}`}
                      onClick={() => setEditingMedication(med)}
                    >
                      <i className="fa-solid fa-pen" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="delicate-icon-action"
                      aria-label={`Delete ${med.name}`}
                      onClick={() => handleDeleteMedication(med.id)}
                      disabled={deletingMedId === med.id}
                    >
                      <i className="fa-solid fa-trash" aria-hidden="true" />
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ marginBottom: 12 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              color: neutrals.textPrimary,
            }}
          >
            Dose log
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: neutrals.textFaint }}>
            What was taken, when, and when the next dose is due.
          </p>
        </div>

        <DayNavigator
          date={selectedDate}
          isToday={isToday}
          itemCount={activeDay.doses.length}
          itemLabel={{ singular: 'dose', plural: 'doses' }}
          canGoForward={!isToday}
          onPrevious={() => setSelectedDate((d) => shiftISODate(d, -1))}
          onNext={() => {
            if (!isToday) setSelectedDate((d) => shiftISODate(d, 1))
          }}
          onGoToToday={() => setSelectedDate(today)}
        />

        <div
          className={`inputs-day-content${isToday ? ' inputs-day-content-today' : ''}`}
          style={{ marginTop: 16 }}
        >
          {activeDay.doses.length === 0 ? (
            <EmptyState
              icon="fa-solid fa-clock"
              title="No doses logged"
              description={
                medications.length === 0
                  ? 'Add a medication first, then log when you take it.'
                  : 'Log a dose to track taken time and next due.'
              }
              action={
                medications.length > 0 ? (
                  <ZoneButton variant="primary" onClick={() => openLogDose()}>
                    <i className="fa-solid fa-pills" aria-hidden="true" /> Log Dose
                  </ZoneButton>
                ) : undefined
              }
            />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {activeDay.doses.map((dose) => (
                <DoseRow
                  key={dose.id}
                  dose={dose}
                  timeZone={resolvedTimeZone}
                  deleting={deletingDoseId === dose.id}
                  onEdit={() => setEditingDose(dose)}
                  onDelete={() => handleDeleteDose(dose.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {editingMedication !== undefined && (
        <MedicationEditorModal
          medication={editingMedication ?? undefined}
          onSave={handleSaveMedication}
          onClose={() => setEditingMedication(undefined)}
        />
      )}

      {(loggingDose || editingDose) && (
        <LogDoseModal
          medications={medications}
          doseDate={editingDose?.doseDate ?? selectedDate}
          timeZone={resolvedTimeZone}
          dose={editingDose ?? undefined}
          initialMedicationId={editingDose?.medicationId ?? logDoseMedicationId}
          onSave={handleSaveDose}
          onClose={() => {
            setLoggingDose(false)
            setLogDoseMedicationId(undefined)
            setEditingDose(null)
          }}
        />
      )}
      </div>
    </div>
  )
}
