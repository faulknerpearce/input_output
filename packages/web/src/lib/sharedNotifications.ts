import {
  fetchActivitiesSharedWithMe,
  fetchEntriesSharedWithMe,
  fetchRecipesSharedWithMe,
  fetchWorkoutsSharedWithMe,
} from './sharing'

const SEEN_KEY = 'input-output-shared-seen-at'

export function getSharedSeenAt(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function toEpochMs(isoTimestamp: string): number {
  const ms = Date.parse(isoTimestamp)
  return Number.isFinite(ms) ? ms : 0
}

/** True when the share arrived after the user last left Shared With Me. */
export function isShareNew(shareCreatedAt: string, seenAtBaseline: string | null): boolean {
  if (!seenAtBaseline) return true
  return toEpochMs(shareCreatedAt) > toEpochMs(seenAtBaseline)
}

export function markSharedAsSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
  } catch {
    // ignore storage errors
  }
}

export async function fetchNewSharedCount(): Promise<number> {
  const seenAt = getSharedSeenAt()
  const [recipes, workouts, entries, activities] = await Promise.all([
    fetchRecipesSharedWithMe(),
    fetchWorkoutsSharedWithMe(),
    fetchEntriesSharedWithMe(),
    fetchActivitiesSharedWithMe(),
  ])

  const createdAts = [
    ...recipes.map((item) => item.share.createdAt),
    ...workouts.map((item) => item.share.createdAt),
    ...entries.map((item) => item.share.createdAt),
    ...activities.map((item) => item.share.createdAt),
  ]

  if (!seenAt) return createdAts.length
  return createdAts.filter((createdAt) => isShareNew(createdAt, seenAt)).length
}