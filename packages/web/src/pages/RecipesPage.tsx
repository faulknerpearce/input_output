import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RecipeSummary, RecipeWithIngredients } from '@input_output/shared'
import CatalogRow from '../components/layout/CatalogRow'
import { PageLoading } from '../components/layout/PageState'
import ZoneButton from '../components/layout/ZoneButton'
import { EmptyState } from '../components/ui'
import LogRecipeModal from '../components/LogRecipeModal'
import type { RecipeLogSubmitOptions } from '../lib/recipeLogForm'
import RecipeEditorModal from '../components/RecipeEditorModal'
import RecipeViewModal from '../components/RecipeViewModal'
import ShareModal from '../components/ShareModal'
import { useProfile } from '../context/useProfile'
import {
  filterAndSortRecipes,
  RECIPE_SORT_OPTIONS,
  type RecipeSortOption,
} from '../lib/recipeFilters'
import { deleteRecipe, fetchRecipeSummaries, logRecipe, saveRecipe } from '../lib/recipes'
import { inputBase } from '../lib/styles'

interface RecipesPageProps {
  onOpenCreateReady?: (openCreate: () => void) => void
}

export default function RecipesPage({ onOpenCreateReady }: RecipesPageProps) {
  const { profile } = useProfile()
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingRecipe, setEditingRecipe] = useState<RecipeWithIngredients | null | undefined>(
    undefined,
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loggingRecipe, setLoggingRecipe] = useState<RecipeSummary | null>(null)
  const [viewingRecipeId, setViewingRecipeId] = useState<string | null>(null)
  const [logSuccess, setLogSuccess] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<RecipeSortOption>('name-asc')
  const [sharingRecipe, setSharingRecipe] = useState<{ id: string; name: string } | null>(null)

  const visibleRecipes = useMemo(
    () => filterAndSortRecipes(recipes, searchQuery, sortBy),
    [recipes, searchQuery, sortBy],
  )
  const hasActiveFilters = searchQuery.trim() !== '' || sortBy !== 'name-asc'

  const loadRecipes = async () => {
    const data = await fetchRecipeSummaries()
    setRecipes(data)
  }

  useEffect(() => {
    fetchRecipeSummaries()
      .then((data) => {
        setRecipes(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load recipes')
        setLoading(false)
      })
  }, [])

  const openCreate = useCallback(() => setEditingRecipe(null), [])

  useEffect(() => {
    onOpenCreateReady?.(openCreate)
  }, [onOpenCreateReady, openCreate])

  const handleLogRecipe = async (options: RecipeLogSubmitOptions) => {
    if (!loggingRecipe) return
    await logRecipe({
      recipeId: loggingRecipe.id,
      portionUnit: options.portionUnit,
      portionQuantity: options.portionQuantity,
      servingWeightGrams: options.servingWeightGrams,
      entryDate: options.entryDate,
      loggedAt: options.loggedAt,
    })
    setLogSuccess(`Added ${loggingRecipe.name} to your food log.`)
    setLoggingRecipe(null)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setError(null)
    try {
      await deleteRecipe(id)
      setRecipes((prev) => prev.filter((recipe) => recipe.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipe')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <PageLoading message="Loading recipes..." />

  return (
    <div>
      {logSuccess && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#ecfdf5',
            color: '#065f46',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {logSuccess}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {recipes.length > 0 && (
        <div className="day-accordion" style={{ padding: 20, marginBottom: 20 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 220px)',
              gap: 12,
              alignItems: 'end',
            }}
            className="recipe-toolbar"
          >
            <div>
              <label
                htmlFor="recipe-search"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#52525b',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Search recipes
              </label>
              <div style={{ position: 'relative' }}>
                <i
                  className="fa-solid fa-magnifying-glass"
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#a1a1aa',
                    fontSize: 13,
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="recipe-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or description..."
                  style={{ ...inputBase, paddingLeft: 38 }}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="recipe-sort"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#52525b',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Sort by
              </label>
              <select
                id="recipe-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as RecipeSortOption)}
                style={{ ...inputBase, paddingRight: 12 }}
              >
                {RECIPE_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: 12,
              color: '#71717a',
              marginTop: 16,
            }}
          >
            <span>
              Showing {visibleRecipes.length} of {recipes.length}{' '}
              {recipes.length === 1 ? 'recipe' : 'recipes'}
            </span>
            {hasActiveFilters && (
              <ZoneButton
                onClick={() => {
                  setSearchQuery('')
                  setSortBy('name-asc')
                }}
              >
                Clear filters
              </ZoneButton>
            )}
          </div>
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="day-accordion">
          <EmptyState
            icon="fa-solid fa-book"
            title="No recipes yet"
            description="Create one to speed up logging everyday meals."
            action={
              <ZoneButton variant="primary" onClick={() => setEditingRecipe(null)}>
                <i className="fa-solid fa-plus" aria-hidden="true" />
                New Recipe
              </ZoneButton>
            }
          />
        </div>
      ) : visibleRecipes.length === 0 ? (
        <div className="day-accordion" style={{ padding: 32, textAlign: 'center', color: '#71717a' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 500, color: '#52525b' }}>No matching recipes</p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Try a different search term or{' '}
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--zone-accent)',
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              clear your search
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="catalog-list">
          {visibleRecipes.map((recipe) => (
            <CatalogRow
              key={recipe.id}
              icon={recipe.icon}
              iconBg={recipe.iconBg}
              iconColor={recipe.iconColor}
              title={recipe.name}
              subtitle={`${recipe.ingredientCount} ingredients · ${recipe.defaultServings} servings/batch · ${recipe.perServingTotals.calories} kcal/serving`}
              onView={() => setViewingRecipeId(recipe.id)}
              actions={
                <>
                  <button
                    type="button"
                    className="delicate-icon-action"
                    onClick={() => setViewingRecipeId(recipe.id)}
                    aria-label="View recipe"
                    title="View recipe"
                  >
                    <i className="fa-regular fa-eye" />
                  </button>
                  <button
                    type="button"
                    className="delicate-icon-action"
                    onClick={() => setSharingRecipe({ id: recipe.id, name: recipe.name })}
                    aria-label="Share recipe"
                    title="Share recipe"
                  >
                    <i className="fa-regular fa-share-from-square" />
                  </button>
                  <button
                    type="button"
                    className="delicate-icon-action"
                    onClick={() => handleDelete(recipe.id)}
                    disabled={deletingId === recipe.id}
                    aria-label="Delete recipe"
                    title="Delete recipe"
                  >
                    <i className="fa-regular fa-trash-can" />
                  </button>
                  <button
                    type="button"
                    className="catalog-add-log-button"
                    onClick={() => {
                      setLogSuccess(null)
                      setLoggingRecipe(recipe)
                    }}
                    aria-label="Add to log"
                    title="Add to log"
                  >
                    <i className="fa-solid fa-plus" />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      {editingRecipe !== undefined && (
        <RecipeEditorModal
          recipe={editingRecipe ?? undefined}
          onClose={() => setEditingRecipe(undefined)}
          onSave={async (input) => {
            await saveRecipe(input, editingRecipe?.id)
            await loadRecipes()
          }}
        />
      )}

      {loggingRecipe && (
        <LogRecipeModal
          recipe={loggingRecipe}
          timeZone={profile.timeZone}
          onLog={handleLogRecipe}
          onClose={() => setLoggingRecipe(null)}
        />
      )}

      {viewingRecipeId && (
        <RecipeViewModal
          recipeId={viewingRecipeId}
          onClose={() => setViewingRecipeId(null)}
          onEdit={(recipe) => {
            setViewingRecipeId(null)
            setEditingRecipe(recipe)
          }}
          onShare={(recipe) => setSharingRecipe({ id: recipe.id, name: recipe.name })}
        />
      )}

      {sharingRecipe && (
        <ShareModal
          resourceType="recipe"
          resourceId={sharingRecipe.id}
          resourceName={sharingRecipe.name}
          onClose={() => setSharingRecipe(null)}
        />
      )}
    </div>
  )
}