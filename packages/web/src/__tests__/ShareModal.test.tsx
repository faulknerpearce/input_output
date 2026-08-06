import type { RecipeShareRecord } from '@input_output/shared'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShareModal from '../components/ShareModal'
import { renderWithProviders } from './testUtils'

const mockRecipeShare: RecipeShareRecord = {
  id: 'share-1',
  recipeId: 'recipe-1',
  ownerId: 'user-1',
  sharedWithUserId: 'user-2',
  ownerDisplayName: 'Alex',
  sharedWithDisplayName: 'Jordan',
  savedCopyId: null,
  createdAt: '2026-06-30T12:00:00Z',
}

vi.mock('../lib/device', () => ({
  focusIfDesktop: vi.fn(),
}))

vi.mock('../lib/sharing', () => ({
  fetchRecipeSharesForResource: vi.fn(),
  findUsersForShare: vi.fn(),
  shareRecipe: vi.fn(),
  revokeRecipeShare: vi.fn(),
  fetchWorkoutSharesForResource: vi.fn(),
  shareWorkout: vi.fn(),
  revokeWorkoutShare: vi.fn(),
  fetchEntrySharesForResource: vi.fn(),
  shareEntry: vi.fn(),
  revokeEntryShare: vi.fn(),
  fetchActivitySharesForResource: vi.fn(),
  shareActivity: vi.fn(),
  revokeActivityShare: vi.fn(),
}))

import { fetchRecipeSharesForResource, findUsersForShare, shareRecipe } from '../lib/sharing'

describe('ShareModal', () => {
  beforeEach(() => {
    vi.mocked(fetchRecipeSharesForResource).mockResolvedValue([])
    vi.mocked(findUsersForShare).mockResolvedValue([])
    vi.mocked(shareRecipe).mockResolvedValue(mockRecipeShare)
  })

  it('renders the recipe share title and resource name', async () => {
    renderWithProviders(
      <ShareModal
        resourceType="recipe"
        resourceId="recipe-1"
        resourceName="Overnight oats"
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Share Recipe' })).toBeInTheDocument()
    expect(screen.getByText('Overnight oats')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Not shared with anyone yet.')).toBeInTheDocument()
    })
  })

  it('searches for users after typing at least two characters', async () => {
    vi.mocked(findUsersForShare).mockResolvedValue([
      { id: 'user-2', displayName: 'Jordan', emailHint: 'j***@example.com' },
    ])
    const user = userEvent.setup()
    renderWithProviders(
      <ShareModal
        resourceType="recipe"
        resourceId="recipe-1"
        resourceName="Overnight oats"
        onClose={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Email or display name'), 'jo')

    await waitFor(() => {
      expect(findUsersForShare).toHaveBeenCalledWith('jo')
    })
    expect(await screen.findByText('Jordan')).toBeInTheDocument()
  })

  it('shares a recipe with the selected user', async () => {
    vi.mocked(findUsersForShare).mockResolvedValue([
      { id: 'user-2', displayName: 'Jordan', emailHint: 'j***@example.com' },
    ])
    const user = userEvent.setup()
    renderWithProviders(
      <ShareModal
        resourceType="recipe"
        resourceId="recipe-1"
        resourceName="Overnight oats"
        onClose={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Email or display name'), 'jo')
    await screen.findByText('Jordan')
    await user.click(screen.getByRole('button', { name: /Jordan.*Select/ }))
    await user.click(screen.getByRole('button', { name: /Send$/ }))

    await waitFor(() => {
      expect(shareRecipe).toHaveBeenCalledWith('recipe-1', 'user-2', 'Jordan')
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Shared with Jordan')
  })

  it('calls onClose when Done is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <ShareModal
        resourceType="recipe"
        resourceId="recipe-1"
        resourceName="Overnight oats"
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Done' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
