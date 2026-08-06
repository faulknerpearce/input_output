import { formatLogTime } from '@input_output/shared'
import type { SharedEntryItem } from '../lib/sharing'
import { primaryButton } from '../lib/styles'
import Modal from './Modal'

interface SharedEntryViewModalProps {
  item: SharedEntryItem
  timeZone: string
  saving: boolean
  onAddToLog: () => Promise<void>
  onClose: () => void
}

export default function SharedEntryViewModal({
  item,
  timeZone,
  saving,
  onAddToLog,
  onClose,
}: SharedEntryViewModalProps) {
  const { entry, share } = item
  const alreadyLogged = share.savedCopyId !== null

  return (
    <Modal titleId="shared-entry-title" onClose={onClose}>
      <h3
        id="shared-entry-title"
        style={{
          fontFamily: "'Space Grotesk','Inter',sans-serif",
          fontSize: 22,
          fontWeight: 600,
          margin: '0 0 4px 0',
        }}
      >
        {entry.name}
      </h3>
      <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 20px 0' }}>
        Shared by {share.ownerDisplayName}
        {entry.description ? ` · ${entry.description}` : ''}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 24,
          fontSize: 13,
        }}
      >
        <div>
          <span style={{ color: '#a1a1aa' }}>Calories</span>
          <div style={{ fontWeight: 600 }}>{entry.calories} kcal</div>
        </div>
        <div>
          <span style={{ color: '#a1a1aa' }}>Protein</span>
          <div style={{ fontWeight: 600 }}>{entry.protein}g</div>
        </div>
        <div>
          <span style={{ color: '#a1a1aa' }}>Carbs</span>
          <div style={{ fontWeight: 600 }}>{entry.carbs}g</div>
        </div>
        <div>
          <span style={{ color: '#a1a1aa' }}>Fat</span>
          <div style={{ fontWeight: 600 }}>{entry.fat}g</div>
        </div>
        {entry.fiber > 0 && (
          <div>
            <span style={{ color: '#a1a1aa' }}>Fiber</span>
            <div style={{ fontWeight: 600 }}>{entry.fiber}g</div>
          </div>
        )}
        {entry.caffeine > 0 && (
          <div>
            <span style={{ color: '#a1a1aa' }}>Caffeine</span>
            <div style={{ fontWeight: 600 }}>{entry.caffeine}mg</div>
          </div>
        )}
        <div>
          <span style={{ color: '#a1a1aa' }}>Logged at</span>
          <div style={{ fontWeight: 600 }}>{formatLogTime(entry.loggedAt, timeZone)}</div>
        </div>
      </div>

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
          Close
        </button>
        <button
          type="button"
          onClick={() => void onAddToLog()}
          disabled={alreadyLogged || saving}
          style={{
            ...primaryButton,
            background: alreadyLogged || saving ? '#6b7280' : 'var(--zone-accent)',
          }}
        >
          {alreadyLogged ? 'Already added' : saving ? 'Adding...' : 'Add to my log'}
        </button>
      </div>
    </Modal>
  )
}