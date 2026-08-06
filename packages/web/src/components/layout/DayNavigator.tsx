import { formatDayLabel, formatMonthDayLabel, formatWeekdayHeadline } from '@input_output/shared'
import type { ReactNode } from 'react'
import GoToTodayButton from './GoToTodayButton'

interface DayNavigatorProps {
  date: string
  isToday: boolean
  meta?: ReactNode
  itemCount?: number
  itemLabel?: { singular: string; plural: string }
  canGoBack?: boolean
  canGoForward?: boolean
  compact?: boolean
  onPrevious: () => void
  onNext: () => void
  onGoToToday?: () => void
}

function NavArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next'
  disabled?: boolean
  onClick: () => void
}) {
  const isPrevious = direction === 'previous'

  return (
    <button
      type="button"
      className="inputs-day-nav-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrevious ? 'Previous day' : 'Next day'}
    >
      <i className={`fa-solid fa-chevron-${isPrevious ? 'left' : 'right'}`} aria-hidden="true" />
    </button>
  )
}

/**
 * Day browser bar:
 * [Day / date]  ·················  [Calendar] [←] [→]
 */
export default function DayNavigator({
  date,
  isToday,
  meta,
  itemCount = 0,
  itemLabel = { singular: 'entry', plural: 'entries' },
  canGoBack = true,
  canGoForward = false,
  compact = false,
  onPrevious,
  onNext,
  onGoToToday,
}: DayNavigatorProps) {
  const defaultMeta = `${itemCount} ${itemCount === 1 ? itemLabel.singular : itemLabel.plural}`
  const metaContent = meta ?? defaultMeta
  const headline = compact ? formatWeekdayHeadline(date) : formatDayLabel(date)

  return (
    <div
      className={`inputs-day-nav${isToday ? ' inputs-day-nav-today' : ' inputs-day-nav-history'}${compact ? ' inputs-day-nav-compact' : ''}`}
      role="group"
      aria-label="Day navigation"
    >
      <div className="inputs-day-nav-leading">
        <div className="inputs-day-nav-label">
          <div className="inputs-day-nav-title-row">
            <div className="inputs-day-nav-title">{headline}</div>
          </div>
          {compact ? (
            <div className="inputs-day-nav-calendar">{formatMonthDayLabel(date)}</div>
          ) : (
            <>
              <div className="inputs-day-nav-date">{date}</div>
              <div className="inputs-day-nav-meta">{metaContent}</div>
            </>
          )}
        </div>
      </div>

      <div className="inputs-day-nav-trailing">
        {onGoToToday ? (
          <GoToTodayButton isToday={isToday} onClick={onGoToToday} />
        ) : (
          <span className="go-to-today-icon go-to-today-icon-dormant" aria-hidden="true">
            <i className="fa-regular fa-calendar" />
          </span>
        )}
        <NavArrowButton direction="previous" disabled={!canGoBack} onClick={onPrevious} />
        <NavArrowButton direction="next" disabled={!canGoForward} onClick={onNext} />
      </div>
    </div>
  )
}
