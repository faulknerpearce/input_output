import { useEffect, useState } from 'react'
import type { RecipeWithIngredients } from '@input_output/shared'
import { fetchRecipe } from '../lib/recipes'
import {
  catalogItemCard,
  modalFooterButton,
  modalPrimaryButton,
  summaryPanel,
} from '../lib/styles'
import CatalogListSection from './catalog/CatalogListSection'
import CatalogModalHeader from './catalog/CatalogModalHeader'
import Modal from './Modal'

interface RecipeViewModalProps {
  recipeId: string
  onClose: () => void
  mode?: 'owned' | 'shared'
  ownerDisplayName?: string
  savedCopyId?: string | null
  savingCopy?: boolean
  onShare?: (recipe: RecipeWithIngredients) => void
  onEdit?: (recipe: RecipeWithIngredients) => void
  onSaveCopy?: () => void
  /** Shared mode: log this recipe to the food log without forking to library. */
  onLogToMeals?: () => void
}

function formatMacro(value: number, unit: string): string {
  return `${value}${unit}`
}

export default function RecipeViewModal({
  recipeId,
  onClose,
  mode = 'owned',
  ownerDisplayName,
  savedCopyId,
  savingCopy = false,
  onShare,
  onEdit,
  onSaveCopy,
  onLogToMeals,
}: RecipeViewModalProps) {
  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)

    fetchRecipe(recipeId)
      .then((data) => {
        setRecipe(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load recipe')
        setLoading(false)
      })

    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId])

  return (
    <Modal titleId="recipe-view-title" onClose={onClose} size="wide">
      {loading ? (
        <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>Loading recipe...</p>
      ) : error ? (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : recipe ? (
        <>
          <CatalogModalHeader
            titleId="recipe-view-title"
            icon={recipe.icon}
            iconBg={recipe.iconBg}
            iconColor={recipe.iconColor}
            title={recipe.name}
            subtitle={
              <>
                {mode === 'shared' && ownerDisplayName ? `Shared by ${ownerDisplayName} · ` : ''}
                {recipe.defaultServings} servings per batch · {recipe.ingredients.length} ingredients
                {recipe.servingWeightGrams ? ` · 1 serving = ${recipe.servingWeightGrams}g` : ''}
              </>
            }
            description={recipe.description || undefined}
          />

          <div style={{ ...summaryPanel, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Per serving</div>
            {recipe.perServingTotals.calories} kcal · {recipe.perServingTotals.protein}g protein ·{' '}
            {recipe.perServingTotals.carbs}g carbs
            {recipe.perServingTotals.fat > 0 && ` · ${recipe.perServingTotals.fat}g fat`}
            {recipe.perServingTotals.fiber > 0 && ` · ${recipe.perServingTotals.fiber}g fiber`}
            {recipe.perServingTotals.caffeine > 0 && ` · ${recipe.perServingTotals.caffeine}mg caffeine`}
            <div style={{ marginTop: 10, color: '#047857' }}>
              Full batch: {recipe.batchTotals.calories} kcal · {recipe.batchTotals.protein}g protein ·{' '}
              {recipe.batchTotals.carbs}g carbs
            </div>
          </div>

          <CatalogListSection title="Ingredients">
            {recipe.ingredients.map((ingredient) => (
              <div key={ingredient.id} style={catalogItemCard}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#18181b' }}>{ingredient.name}</div>
                {ingredient.amount && (
                  <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>{ingredient.amount}</div>
                )}
                <div style={{ fontSize: 12, color: '#52525b', marginTop: 8 }}>
                  {formatMacro(ingredient.calories, ' kcal')} · {formatMacro(ingredient.protein, 'g protein')} ·{' '}
                  {formatMacro(ingredient.carbs, 'g carbs')}
                  {ingredient.fat > 0 && ` · ${ingredient.fat}g fat`}
                </div>
              </div>
            ))}
          </CatalogListSection>
        </>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        {mode === 'owned' && recipe && onEdit && (
          <button type="button" onClick={() => onEdit(recipe)} style={modalFooterButton}>
            Edit
          </button>
        )}
        {mode === 'owned' && recipe && onShare && (
          <button
            type="button"
            onClick={() => onShare(recipe)}
            style={{ ...modalFooterButton, color: 'var(--zone-accent)' }}
          >
            Share
          </button>
        )}
        {mode === 'shared' && onLogToMeals && (
          <button
            type="button"
            onClick={onLogToMeals}
            style={{
              ...modalPrimaryButton,
              background: 'var(--zone-accent)',
            }}
          >
            Log to meals
          </button>
        )}
        {mode === 'shared' && onSaveCopy && (
          <button
            type="button"
            onClick={onSaveCopy}
            disabled={!!savedCopyId || savingCopy}
            style={{
              ...modalFooterButton,
              color: savedCopyId ? '#71717a' : 'var(--zone-accent)',
              cursor: savedCopyId ? 'default' : 'pointer',
            }}
          >
            {savedCopyId ? 'Already in library' : savingCopy ? 'Saving...' : 'Save to my library'}
          </button>
        )}
        <button type="button" onClick={onClose} style={modalFooterButton}>
          Close
        </button>
      </div>
    </Modal>
  )
}