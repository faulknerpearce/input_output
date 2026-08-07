import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Ingredient, IngredientInput } from '@input_output/shared'
import CatalogRow from '../components/layout/CatalogRow'
import { PageLoading } from '../components/layout/PageState'
import ZoneButton from '../components/layout/ZoneButton'
import IngredientEditorModal from '../components/IngredientEditorModal'
import { EmptyState } from '../components/ui'
import { inputBase } from '../lib/styles'
import {
  addIngredient,
  deleteIngredient,
  fetchIngredients,
  updateIngredient,
} from '../lib/ingredients'

interface IngredientsPageProps {
  onOpenCreateReady?: (openCreate: () => void) => void
}

function ingredientSubtitle(ingredient: Ingredient): string {
  const { per100g } = ingredient
  return `Per 100g: ${per100g.calories} kcal · ${per100g.protein}g protein · ${per100g.carbs}g carbs · ${per100g.fat}g fat`
}

export default function IngredientsPage({ onOpenCreateReady }: IngredientsPageProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null | undefined>(
    undefined,
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const visibleIngredients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return ingredients
    return ingredients.filter((ingredient) => {
      return (
        ingredient.name.toLowerCase().includes(query) ||
        ingredient.description.toLowerCase().includes(query)
      )
    })
  }, [ingredients, searchQuery])

  useEffect(() => {
    fetchIngredients()
      .then((data) => {
        setIngredients(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load ingredients')
        setLoading(false)
      })
  }, [])

  const openCreate = useCallback(() => setEditingIngredient(null), [])

  useEffect(() => {
    onOpenCreateReady?.(openCreate)
  }, [onOpenCreateReady, openCreate])

  const handleSave = async (input: IngredientInput) => {
    if (editingIngredient) {
      const updated = await updateIngredient(editingIngredient.id, input)
      setIngredients((prev) =>
        prev.map((ing) => (ing.id === updated.id ? updated : ing)).sort((a, b) => a.name.localeCompare(b.name)),
      )
    } else {
      const created = await addIngredient(input)
      setIngredients((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this ingredient? Recipes that reference it keep their existing macro lines.')) {
      return
    }
    setDeletingId(id)
    setError(null)
    try {
      await deleteIngredient(id)
      setIngredients((prev) => prev.filter((ing) => ing.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ingredient')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <PageLoading message="Loading ingredients..." />

  return (
    <div>
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

      {ingredients.length > 0 && (
        <div className="day-accordion" style={{ padding: 20, marginBottom: 20 }}>
          <div>
            <label
              htmlFor="ingredient-search"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: '#52525b',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Search ingredients
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
                id="ingredient-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or description..."
                style={{ ...inputBase, paddingLeft: 38 }}
              />
            </div>
          </div>
        </div>
      )}

      {ingredients.length === 0 ? (
        <div className="day-accordion">
          <EmptyState
            icon="fa-solid fa-seedling"
            title="No ingredients yet"
            description="Add reusable ingredients with per-100g macros, then build recipes from them."
            action={
              <ZoneButton variant="primary" onClick={openCreate}>
                <i className="fa-solid fa-plus" aria-hidden="true" />
                New Ingredient
              </ZoneButton>
            }
          />
        </div>
      ) : visibleIngredients.length === 0 ? (
        <div className="day-accordion" style={{ padding: 32, textAlign: 'center', color: '#71717a' }}>
          <p style={{ margin: 0, fontWeight: 500, color: '#52525b' }}>No matching ingredients</p>
        </div>
      ) : (
        <div className="catalog-list">
          {visibleIngredients.map((ingredient) => (
            <CatalogRow
              key={ingredient.id}
              icon={ingredient.icon}
              iconBg={ingredient.iconBg}
              iconColor={ingredient.iconColor}
              title={ingredient.name}
              subtitle={ingredientSubtitle(ingredient)}
              onView={() => setEditingIngredient(ingredient)}
              actions={
                <>
                  <button
                    type="button"
                    className="delicate-icon-action"
                    onClick={() => setEditingIngredient(ingredient)}
                    aria-label={`Edit ${ingredient.name}`}
                    title="Edit ingredient"
                  >
                    <i className="fa-solid fa-pen" />
                  </button>
                  <button
                    type="button"
                    className="delicate-icon-action"
                    onClick={() => handleDelete(ingredient.id)}
                    disabled={deletingId === ingredient.id}
                    aria-label={`Delete ${ingredient.name}`}
                    title="Delete ingredient"
                  >
                    <i className="fa-regular fa-trash-can" />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      {editingIngredient !== undefined && (
        <IngredientEditorModal
          ingredient={editingIngredient ?? undefined}
          onSave={handleSave}
          onClose={() => setEditingIngredient(undefined)}
        />
      )}
    </div>
  )
}