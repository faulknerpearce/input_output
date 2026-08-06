import { formatDistance, formatDuration, formatLogTime } from '@input_output/shared'
import type { SharedActivityItem } from '../lib/sharing'
import { primaryButton } from '../lib/styles'
import Modal from './Modal'

interface SharedActivityViewModalProps {
  item: SharedActivityItem
  timeZone: string
  saving: boolean
  onAddToLog: () => Promise<void>
  onClose: () => void
}

export default function SharedActivityViewModal({
  item,
  timeZone,
  saving,
  onAddToLog,
  onClose,
}: SharedActivityViewModalProps) {
  const { activity, share } = item
  const alreadyLogged = share.savedCopyId !== null

  return (
    <Modal titleId="shared-activity-title" onClose={onClose}>
      <h3
        id="shared-activity-title"
        style={{
          fontFamily: "'Space Grotesk','Inter',sans-serif",
          fontSize: 22,
          fontWeight: 600,
          margin: '0 0 4px 0',
        }}
      >
        {activity.name}
      </h3>
      <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 20px 0' }}>
        Shared by {share.ownerDisplayName} · {activity.activityType}
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
          <span style={{ color: '#a1a1aa' }}>Duration</span>
          <div style={{ fontWeight: 600 }}>{formatDuration(activity.movingTimeSeconds)}</div>
        </div>
        <div>
          <span style={{ color: '#a1a1aa' }}>Distance</span>
          <div style={{ fontWeight: 600 }}>{formatDistance(activity.distanceMeters)}</div>
        </div>
        {activity.calories !== null && (
          <div>
            <span style={{ color: '#a1a1aa' }}>Calories burned</span>
            <div style={{ fontWeight: 600 }}>{activity.calories} kcal</div>
          </div>
        )}
        <div>
          <span style={{ color: '#a1a1aa' }}>Logged at</span>
          <div style={{ fontWeight: 600 }}>{formatLogTime(activity.loggedAt, timeZone)}</div>
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