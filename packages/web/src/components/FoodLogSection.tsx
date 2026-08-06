import { formatPortionLabel } from '@input_output/shared'
import { useState } from 'react'
import type { MappedBarcodeProduct } from '../lib/openFoodFacts'
import type { FoodEntry, FoodEntryWrite } from '../lib/entries'
import { neutrals, radius } from '../lib/design-tokens'

/** Soft cool off-white for meal entry tiles (brand swatch). */
const FOOD_LOG_CARD_BG = '#FAFBFC'
import AddEntryModal from './AddEntryModal'
import BarcodeScannerModal from './BarcodeScannerModal'
import FoodLogEntryStats from './FoodLogEntryStats'
import RelogEntryModal from './RelogEntryModal'
import ShareModal from './ShareModal'
import { Button, Card, EmptyState } from './ui'

interface FoodLogSectionProps {
  entries: FoodEntry[]
  logDate: string
  timeZone: string
  onAdd?: (
    entry: FoodEntryWrite,
    options?: {
      saveAsRecipe?: boolean
      perServing?: FoodEntryWrite
      servingWeightGrams?: number
      entryDate?: string
    },
  ) => Promise<void>
  onLogRecipe?: (
    recipeId: string,
    options: {
      portionUnit: import('@input_output/shared').PortionUnit
      portionQuantity: number
      servingWeightGrams?: number
      loggedAt?: string
      entryDate?: string
    },
  ) => Promise<void>
  onEdit?: (id: string, entry: FoodEntryWrite) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  /** Re-log a prior entry as a new row (does not mutate the source). Uses onAdd when set. */
  onRelog?: (
    entry: FoodEntryWrite,
    options: { entryDate: string },
  ) => Promise<void>
  readOnly?: boolean
  title?: string
  subtitle?: string
  defaultExpanded?: boolean
  collapsible?: boolean
  showActions?: boolean
  showEntryStats?: boolean
  addFormOpen?: boolean
  onAddFormOpenChange?: (open: boolean) => void
  scannerOpen?: boolean
  onScannerOpenChange?: (open: boolean) => void
  prefillEntry?: FoodEntryWrite | null
  onPrefillEntryChange?: (entry: FoodEntryWrite | null) => void
}

/** Prefer total grams when we can derive them; otherwise portion label. */
function formatMealWeight(entry: FoodEntry): string | null {
  if (entry.portionUnit === 'grams' && entry.portionQuantity != null) {
    return formatPortionLabel(entry)
  }
  if (
    entry.portionUnit === 'servings' &&
    entry.portionQuantity != null &&
    entry.referenceWeightGrams != null &&
    entry.referenceWeightGrams > 0
  ) {
    const grams = entry.portionQuantity * entry.referenceWeightGrams
    return grams % 1 === 0 ? `${grams}g total` : `${grams.toFixed(1)}g total`
  }
  return formatPortionLabel(entry)
}

function FoodLogEntryRow({
  item,
  deleting,
  readOnly,
  canEdit,
  canDelete,
  canRelog,
  onShare,
  onEdit,
  onRelog,
  onRemove,
}: {
  item: FoodEntry
  deleting: boolean
  readOnly: boolean
  canEdit: boolean
  canDelete: boolean
  canRelog: boolean
  onShare: () => void
  onEdit: () => void
  onRelog: () => void
  onRemove: () => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const weightLabel = formatMealWeight(item)

  return (
    <div
      className="log-entry-card"
      style={{
        background: FOOD_LOG_CARD_BG,
        border: `1px solid ${neutrals.border}`,
        borderRadius: radius.lg,
        padding: '16px 20px',
        opacity: deleting ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9999,
            background: item.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <i className={`fa-solid ${item.icon}`} style={{ color: item.iconColor, fontSize: 15 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: neutrals.textPrimary }}>{item.name}</div>
          {weightLabel && (
            <div style={{ fontSize: 13, color: neutrals.textMuted, marginTop: 2 }}>{weightLabel}</div>
          )}
          <div
            className="food-macro-grid"
            style={{
              marginTop: 8,
              fontSize: 12,
            }}
          >
            <span>
              <span style={{ fontWeight: 500, color: '#ea580c' }}>{item.calories}</span>{' '}
              <span style={{ color: '#a1a1aa' }}>kcal</span>
            </span>
            <span>
              <span style={{ fontWeight: 500, color: '#059669' }}>{item.protein}g</span>{' '}
              <span style={{ color: '#a1a1aa' }}>protein</span>
            </span>
            <span>
              <span style={{ fontWeight: 500, color: '#d97706' }}>{item.carbs}g</span>{' '}
              <span style={{ color: '#a1a1aa' }}>carbs</span>
            </span>
            <span>
              <span style={{ fontWeight: 500, color: '#db2777' }}>{item.fat}g</span>{' '}
              <span style={{ color: '#a1a1aa' }}>fat</span>
            </span>
            {item.fiber > 0 && (
              <span>
                <span style={{ fontWeight: 500, color: '#65a30d' }}>{item.fiber}g</span>{' '}
                <span style={{ color: '#a1a1aa' }}>fiber</span>
              </span>
            )}
            {item.caffeine > 0 && (
              <span>
                <span style={{ fontWeight: 500, color: '#7c3aed' }}>{item.caffeine}mg</span>{' '}
                <span style={{ color: '#a1a1aa' }}>caffeine</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {(canEdit || canRelog || !readOnly) && (
        <>
          <div style={{ borderTop: `1px solid ${neutrals.border}`, marginTop: 16, paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {canRelog && (
                <button
                  type="button"
                  className="delicate-icon-action"
                  onClick={onRelog}
                  aria-label="Log again"
                  title="Log again"
                >
                  <i className="fa-solid fa-rotate-right" />
                </button>
              )}
              {!readOnly && (
                <button
                  type="button"
                  className="delicate-icon-action"
                  onClick={onShare}
                  aria-label="Share entry"
                  title="Share entry"
                >
                  <i className="fa-regular fa-share-from-square" />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="delicate-icon-action"
                  onClick={onEdit}
                  aria-label="Edit entry"
                  title="Edit entry"
                >
                  <i className="fa-regular fa-pen-to-square" />
                </button>
              )}
              {!readOnly && canDelete && (
                <button
                  type="button"
                  className="delicate-icon-action"
                  onClick={onRemove}
                  disabled={deleting}
                  aria-label="Remove entry"
                  title="Remove entry"
                >
                  <i className="fa-regular fa-trash-can" />
                </button>
              )}
            </div>
            <button
              type="button"
              className="delicate-icon-action"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              aria-label={detailsOpen ? 'Hide meal details' : 'Show meal details'}
              title={detailsOpen ? 'Hide details' : 'Details'}
            >
              <i
                className="fa-solid fa-chevron-down"
                style={{
                  transition: 'transform 0.2s ease',
                  transform: detailsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  fontSize: 12,
                }}
              />
            </button>
          </div>
        </>
      )}

      {detailsOpen && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${neutrals.border}`,
            fontSize: 12,
            color: neutrals.textMuted,
          }}
        >
          {item.description ? (
            <p style={{ margin: 0, color: neutrals.textSecondary }}>{item.description}</p>
          ) : (
            <p style={{ margin: 0, color: neutrals.textFaint }}>No description</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function FoodLogSection({
  entries,
  logDate,
  timeZone,
  onAdd,
  onLogRecipe,
  onEdit,
  onDelete,
  onRelog,
  readOnly = false,
  title = "Today's Food Log",
  subtitle,
  defaultExpanded = false,
  collapsible = true,
  showActions = true,
  showEntryStats = true,
  addFormOpen,
  onAddFormOpenChange,
  scannerOpen,
  onScannerOpenChange,
  prefillEntry,
  onPrefillEntryChange,
}: FoodLogSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const [internalShowAddForm, setInternalShowAddForm] = useState(false)
  const [internalShowScanner, setInternalShowScanner] = useState(false)
  const [internalPrefillEntry, setInternalPrefillEntry] = useState<FoodEntryWrite | null>(null)
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null)
  const [reloggingEntry, setReloggingEntry] = useState<FoodEntry | null>(null)
  const [sharingEntry, setSharingEntry] = useState<FoodEntry | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const relogHandler = onRelog ?? onAdd

  const expanded = collapsible ? internalExpanded : true
  const showAddForm = addFormOpen ?? internalShowAddForm
  const setShowAddForm = onAddFormOpenChange ?? setInternalShowAddForm
  const showScanner = scannerOpen ?? internalShowScanner
  const setShowScanner = onScannerOpenChange ?? setInternalShowScanner
  const currentPrefillEntry = prefillEntry !== undefined ? prefillEntry : internalPrefillEntry
  const setPrefillEntry = onPrefillEntryChange ?? setInternalPrefillEntry

  const removeEntry = async (id: string) => {
    if (!onDelete) return
    setDeleting(id)
    try {
      await onDelete(id)
    } finally {
      setDeleting(null)
    }
  }

  const entryCount = entries.length

  const entryList = (
    <>
      {entryCount === 0 ? (
        <EmptyState
          icon="fa-solid fa-utensils"
          title="No entries yet"
          description={
            showActions
              ? 'Click "Add Entry" to log your first food item.'
              : 'Use the buttons above to log your first food item.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 20 }}>
          {entries.map((item) => (
            <FoodLogEntryRow
              key={item.id}
              item={item}
              deleting={deleting === item.id}
              readOnly={readOnly}
              canEdit={Boolean(onEdit)}
              canDelete={Boolean(onDelete)}
              canRelog={Boolean(relogHandler) && !readOnly}
              onShare={() => setSharingEntry(item)}
              onEdit={() => setEditingEntry(item)}
              onRelog={() => setReloggingEntry(item)}
              onRemove={() => void removeEntry(item.id)}
            />
          ))}
        </div>
      )}

      {showEntryStats && entryCount > 0 && (
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #f4f4f5' }}>
          <FoodLogEntryStats entries={entries} />
        </div>
      )}
    </>
  )

  const modals = (
    <>
      {showScanner && onAdd && (
        <BarcodeScannerModal
          onProductFound={(product: MappedBarcodeProduct) => {
            setPrefillEntry({
              ...product.entry,
              referenceWeightGrams: product.referenceWeightGrams,
              nutritionBasisNote: product.servingNote,
            })
            setShowScanner(false)
            setShowAddForm(true)
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
      {showAddForm && onAdd && (
        <AddEntryModal
          prefill={currentPrefillEntry ?? undefined}
          logDate={logDate}
          timeZone={timeZone}
          onAdd={onAdd}
          onLogRecipe={onLogRecipe}
          onClose={() => {
            setShowAddForm(false)
            setPrefillEntry(null)
          }}
        />
      )}
      {editingEntry && onEdit && (
        <AddEntryModal
          entry={editingEntry}
          logDate={logDate}
          timeZone={timeZone}
          onAdd={async (entry) => {
            await onEdit(editingEntry.id, entry)
            setEditingEntry(null)
          }}
          onClose={() => setEditingEntry(null)}
        />
      )}
      {reloggingEntry && relogHandler && (
        <RelogEntryModal
          entry={reloggingEntry}
          logDate={logDate}
          timeZone={timeZone}
          onLog={async (entry, options) => {
            await relogHandler(entry, options)
            setReloggingEntry(null)
          }}
          onClose={() => setReloggingEntry(null)}
        />
      )}
      {sharingEntry && (
        <ShareModal
          resourceType="entry"
          resourceId={sharingEntry.id}
          resourceName={sharingEntry.name}
          onClose={() => setSharingEntry(null)}
        />
      )}
    </>
  )

  if (!collapsible) {
    return (
      <>
        {entryList}
        {modals}
      </>
    )
  }

  return (
    <Card tone="neutral">
      <div
        className="log-section-header"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
        }}
      >
        <button
          type="button"
          onClick={() => setInternalExpanded((value) => !value)}
          className="log-section-header-toggle"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
            marginRight: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color: neutrals.textSubtle,
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 12, color: neutrals.textFaint }}>
              {subtitle ?? 'Chronological order (earliest → latest)'} • {entryCount}{' '}
              {entryCount === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          <i
            className="fa-solid fa-chevron-down"
            style={{
              color: neutrals.textSubtle,
              fontSize: 14,
              transition: 'transform 0.2s ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              flexShrink: 0,
              marginLeft: 16,
            }}
          />
        </button>
        {!readOnly && onAdd && showActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Button
              variant="primary"
              onClick={() => {
                setPrefillEntry(null)
                setShowAddForm(true)
                setInternalExpanded(true)
              }}
            >
              <i className="fa-solid fa-plus" style={{ fontSize: 11 }} aria-hidden="true" />
              Add Entry
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowScanner(true)
                setInternalExpanded(true)
              }}
            >
              <i className="fa-solid fa-barcode" style={{ fontSize: 11 }} aria-hidden="true" />
              Scan Barcode
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div
          className="log-section-content"
          style={{
            padding: '0 24px 24px',
            borderTop: `1px solid ${neutrals.surfaceHover}`,
          }}
        >
          {entryList}
        </div>
      )}

      {modals}
    </Card>
  )
}
