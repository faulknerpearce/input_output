import type { NetBalance } from '@input_output/shared'
import { cardSurface, iconTileSm, subtleSurface } from '../lib/styles'

interface NetBalanceCardProps {
  balance: NetBalance
  hasActivities: boolean
}

const statusColor: Record<NetBalance['status'], string> = {
  under: '#2563eb',
  in_range: '#059669',
  over: '#dc2626',
}

const statusBadgeBg: Record<NetBalance['status'], string> = {
  under: '#dbeafe',
  in_range: '#d1fae5',
  over: '#fee2e2',
}

interface EnergyBarProps {
  label: string
  value: number
  max: number
  color: string
  gradient: string
}

function EnergyBar({ label, value, max, color, gradient }: EnergyBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          gap: 12,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: '#71717a' }}>{label}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#3f3f46',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value.toLocaleString()}{' '}
          <span style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa' }}>kcal</span>
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 9999,
          background: '#f4f4f5',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 9999,
            background: gradient,
            boxShadow: `0 0 8px ${color}33`,
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  )
}

function GoalZoneTrack({ balance, max }: { balance: NetBalance; max: number }) {
  const lowPct = max > 0 ? (balance.goalLow / max) * 100 : 0
  const highPct = max > 0 ? (balance.goalHigh / max) * 100 : 0
  const netPct = max > 0 ? Math.min((balance.net / max) * 100, 100) : 0
  const color = statusColor[balance.status]

  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #e4e4e7' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: '#71717a',
            textTransform: 'uppercase',
          }}
        >
          Net vs goal
        </span>
        <span style={{ fontSize: 11, color: '#a1a1aa' }}>
          {balance.goalLow.toLocaleString()}–{balance.goalHigh.toLocaleString()} kcal
        </span>
      </div>
      <div style={{ position: 'relative', height: 28 }}>
        <div
          style={{
            position: 'absolute',
            inset: '10px 0',
            borderRadius: 9999,
            background: '#f4f4f5',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 10,
            bottom: 10,
            left: `${lowPct}%`,
            width: `${highPct - lowPct}%`,
            borderRadius: 9999,
            background: '#d1fae5',
            border: '1px solid #a7f3d0',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: `calc(${netPct}% - 6px)`,
            width: 12,
            height: 12,
            borderRadius: 9999,
            background: color,
            boxShadow: `0 0 0 3px white, 0 0 0 4px ${color}44`,
            transition: 'left 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  )
}

export default function NetBalanceCard({ balance, hasActivities }: NetBalanceCardProps) {
  const color = statusColor[balance.status]
  const chartMax = Math.max(balance.consumed, balance.net, balance.goalHigh, 1)

  return (
    <div
      style={{
        ...cardSurface,
        padding: 28,
        marginBottom: 32,
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 28, alignItems: 'stretch' }}>
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '1.5px',
              color: 'var(--zone-accent)',
              textTransform: 'uppercase',
              margin: '0 0 16px 0',
            }}
          >
            Net Energy
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                ...iconTileSm,
                background: statusBadgeBg[balance.status],
              }}
            >
              <i className="fa-solid fa-bolt" style={{ color, fontSize: 16 }}></i>
            </div>
            <span
              className="net-balance-value-mobile"
              style={{
                fontFamily: "'Space Grotesk','Inter',system-ui,sans-serif",
                fontSize: 52,
                fontWeight: 600,
                lineHeight: 1,
                color,
                letterSpacing: '-0.03em',
              }}
            >
              {balance.net.toLocaleString()}
            </span>
            <span style={{ fontSize: 16, fontWeight: 500, color: '#71717a' }}>kcal net</span>
          </div>

          <p style={{ fontSize: 13, color: '#71717a', margin: '14px 0 0 0', lineHeight: 1.5 }}>
            {balance.consumed.toLocaleString()} consumed · {balance.burned.toLocaleString()} burned
          </p>
          <p style={{ fontSize: 12, color: '#a1a1aa', margin: '6px 0 0 0' }}>
            {balance.contextMessage}
          </p>
          {!hasActivities && (
            <p style={{ fontSize: 12, color: '#a1a1aa', margin: '8px 0 0 0' }}>
              Log an activity on Outputs to track calories burned.
            </p>
          )}
        </div>

        <div
          style={{
            ...subtleSurface,
            padding: '20px 22px',
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: '#71717a',
              textTransform: 'uppercase',
              margin: '0 0 16px 0',
            }}
          >
            Energy breakdown
          </p>
          <EnergyBar
            label="Consumed"
            value={balance.consumed}
            max={chartMax}
            color="#ea580c"
            gradient="linear-gradient(90deg, #ea580c, #fb923c)"
          />
          <EnergyBar
            label="Burned"
            value={balance.burned}
            max={chartMax}
            color="#0d9488"
            gradient="linear-gradient(90deg, #0d9488, #14b8a6)"
          />
          <EnergyBar
            label="Net"
            value={balance.net}
            max={chartMax}
            color={color}
            gradient={`linear-gradient(90deg, ${color}, ${color}cc)`}
          />
          <GoalZoneTrack balance={balance} max={chartMax} />
        </div>
      </div>
    </div>
  )
}
