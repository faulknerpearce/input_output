import { useEffect, useRef, useState } from 'react'
import {
  foodIconOptions,
  parseGramsFromAmount,
  perServingTotals,
  scaleMacrosToGrams,
  sumRecipeIngredients,
  type IconOption,
  type Ingredient,
  type NewRecipeIngredient,
  type RecipeInput,
  type RecipeWithIngredients,
} from '@input_output/shared'
import CatalogListSection from './catalog/CatalogListSection'
import CatalogModalHeader from './catalog/CatalogModalHeader'
import IconPicker from './catalog/IconPicker'
import { focusIfDesktop } from '../lib/device'
import type { MappedBarcodeProduct } from '../lib/openFoodFacts'
import { fetchIngredients } from '../lib/ingredients'
import {
  catalogItemCard,
  inputBase,
  labelBase,
  modalFooterButton,
  modalPrimaryButton,
  summaryPanel,
} from '../lib/styles'
import BarcodeScannerModal from './BarcodeScannerModal'
import Modal from './Modal'

interface RecipeEditorModalProps {
  recipe?: RecipeWithIngredients
  onSave: (input: RecipeInput) => Promise<void>
  onClose: () => void
}

interface IngredientForm {
  ingredientId: string
  name: string
  amount: string
  calories: string
  protein: string
  carbs: string
  fat: string
  fiber: string
  caffeine: string
}

const EMPTY_INGREDIENT: IngredientForm = {
  ingredientId: '',
  name: '',
  amount: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  caffeine: '',
}

function iconFromRecipe(recipe: RecipeWithIngredients): IconOption {
  return (
    foodIconOptions.find((opt) => opt.icon === recipe.icon) ?? {
      icon: recipe.icon,
      label: 'Custom',
      bg: recipe.iconBg,
      color: recipe.iconColor,
    }
  )
}

function ingredientFormFromRecipe(recipe: RecipeWithIngredients): IngredientForm[] {
  return recipe.ingredients.map((ingredient) => ({
    ingredientId: ingredient.ingredientId ?? '',
    name: ingredient.name,
    amount: ingredient.amount,
    calories: String(ingredient.calories),
    protein: String(ingredient.protein),
    carbs: String(ingredient.carbs),
    fat: String(ingredient.fat),
    fiber: String(ingredient.fiber),
    caffeine: String(ingredient.caffeine),
  }))
}

function parseIngredient(form: IngredientForm, sortOrder: number): NewRecipeIngredient | null {
  const calories = form.calories === '' ? NaN : parseInt(form.calories, 10)
  const protein = form.protein === '' ? NaN : parseInt(form.protein, 10)
  if (!form.name.trim() || !Number.isFinite(calories) || !Number.isFinite(protein)) return null

  return {
    name: form.name.trim(),
    amount: form.amount.trim(),
    sortOrder,
    ingredientId: form.ingredientId.trim() || null,
    amountGrams: form.ingredientId ? parseGramsFromAmount(form.amount.trim()) : null,
    calories,
    protein,
    carbs: form.carbs === '' ? 0 : parseInt(form.carbs, 10) || 0,
    fat: form.fat === '' ? 0 : parseInt(form.fat, 10) || 0,
    fiber: form.fiber === '' ? 0 : parseInt(form.fiber, 10) || 0,
    caffeine: form.caffeine === '' ? 0 : parseInt(form.caffeine, 10) || 0,
  }
}

function macroField(value: number): string {
  if (!Number.isFinite(value)) return ''
  return Number.isInteger(value) ? String(value) : String(value)
}

function ingredientFromProduct(product: MappedBarcodeProduct): IngredientForm {
  const { entry } = product
  const amount =
    product.referenceWeightGrams > 0
      ? `${product.referenceWeightGrams}g`
      : product.servingNote || ''
  return {
    ingredientId: '',
    name: entry.name,
    amount,
    calories: macroField(entry.calories),
    protein: macroField(entry.protein),
    carbs: macroField(entry.carbs),
    fat: macroField(entry.fat),
    fiber: macroField(entry.fiber),
    caffeine: macroField(entry.caffeine),
  }
}

function isBlankIngredient(row: IngredientForm): boolean {
  return (
    !row.name.trim() &&
    !row.amount.trim() &&
    row.calories === '' &&
    row.protein === '' &&
    row.carbs === '' &&
    row.fat === '' &&
    row.fiber === '' &&
    row.caffeine === ''
  )
}

export default function RecipeEditorModal({ recipe, onSave, onClose }: RecipeEditorModalProps) {
  const isEdit = recipe !== undefined
  const [name, setName] = useState(recipe?.name ?? '')
  const [description, setDescription] = useState(recipe?.description ?? '')
  const [defaultServings, setDefaultServings] = useState(
    recipe ? String(recipe.defaultServings) : '1',
  )
  const [servingWeightGrams, setServingWeightGrams] = useState(
    recipe?.servingWeightGrams ? String(recipe.servingWeightGrams) : '',
  )
  const [ingredients, setIngredients] = useState<IngredientForm[]>(() =>
    recipe ? ingredientFormFromRecipe(recipe) : [{ ...EMPTY_INGREDIENT }],
  )
  const [selectedIcon, setSelectedIcon] = useState<IconOption>(() =>
    recipe ? iconFromRecipe(recipe) : foodIconOptions[0],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [catalogIngredients, setCatalogIngredients] = useState<Ingredient[]>([])
  const nameRef = useRef<HTMLInputElement | null>(null)
  const showScannerRef = useRef(false)

  useEffect(() => {
    showScannerRef.current = showScanner
  }, [showScanner])

  useEffect(() => {
    let cancelled = false
    fetchIngredients()
      .then((list) => {
        if (!cancelled) setCatalogIngredients(list)
      })
      .catch(() => {
        // Catalog is a convenience; a failed fetch falls back to manual lines.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    focusIfDesktop(nameRef.current)

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (showScannerRef.current) {
        setShowScanner(false)
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const previewIngredients = ingredients
    .map((form, index) => parseIngredient(form, index))
    .filter((ingredient): ingredient is NewRecipeIngredient => ingredient !== null)

  const batchTotals = sumRecipeIngredients(previewIngredients)
  const servings = defaultServings === '' ? 1 : Number.parseFloat(defaultServings) || 1
  const servingTotals =
    servings > 0 ? perServingTotals(batchTotals, servings) : batchTotals

  const updateIngredient = (index: number, patch: Partial<IngredientForm>) => {
    setIngredients((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    )
  }

  const addIngredientRow = () => {
    setIngredients((prev) => [...prev, { ...EMPTY_INGREDIENT }])
  }

  const removeIngredientRow = (index: number) => {
    setIngredients((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const applyCatalogIngredient = (index: number, selected: Ingredient) => {
    updateIngredient(index, {
      ingredientId: selected.id,
      name: selected.name,
      amount: '100g',
      calories: String(selected.per100g.calories),
      protein: String(selected.per100g.protein),
      carbs: String(selected.per100g.carbs),
      fat: String(selected.per100g.fat),
      fiber: String(selected.per100g.fiber),
      caffeine: String(selected.per100g.caffeine),
    })
  }

const handleAmountChange = (index: number, amount: string) => {
    const row = ingredients[index]
    updateIngredient(index, { amount })
    if (!row?.ingredientId) return
    const ingredient = catalogIngredients.find((c) => c.id === row.ingredientId)
    if (!ingredient) return
    const grams = parseGramsFromAmount(amount.trim())
    if (grams === null) return
    const totals = scaleMacrosToGrams(ingredient.per100g, grams)
    updateIngredient(index, {
      calories: String(totals.calories),
      protein: String(totals.protein),
      carbs: String(totals.carbs),
      fat: String(totals.fat),
      fiber: String(totals.fiber),
      caffeine: String(totals.caffeine),
    })
  }

  const applyScannedIngredient = (product: MappedBarcodeProduct) => {
    const next = ingredientFromProduct(product)
    setIngredients((prev) => {
      const blankIndex = prev.findIndex(isBlankIngredient)
      if (blankIndex >= 0) {
        return prev.map((row, i) => (i === blankIndex ? next : row))
      }
      return [...prev, next]
    })
    setName((current) => (current.trim() ? current : product.entry.name))
    setError(null)
    setShowScanner(false)
  }

  const submit = async () => {
    const parsedIngredients = ingredients
      .map((form, index) => parseIngredient(form, index))
      .filter((ingredient): ingredient is NewRecipeIngredient => ingredient !== null)

    if (parsedIngredients.length === 0) {
      setError('Add at least one ingredient with name, calories, and protein')
      return
    }

    const parsedServingWeight =
      servingWeightGrams.trim() === '' ? null : Number.parseFloat(servingWeightGrams)
    if (
      servingWeightGrams.trim() !== '' &&
      (parsedServingWeight === null ||
        !Number.isFinite(parsedServingWeight) ||
        parsedServingWeight <= 0)
    ) {
      setError('Serving weight must be greater than 0')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        name,
        description,
        icon: selectedIcon.icon,
        iconBg: selectedIcon.bg,
        iconColor: selectedIcon.color,
        defaultServings: servings,
        servingWeightGrams: parsedServingWeight,
        ingredients: parsedIngredients,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Modal titleId="recipe-editor-title" onClose={onClose} size="wide">
      <CatalogModalHeader
        titleId="recipe-editor-title"
        icon={selectedIcon.icon}
        iconBg={selectedIcon.bg}
        iconColor={selectedIcon.color}
        title={isEdit ? 'Edit Recipe' : 'New Recipe'}
        subtitle="Build a reusable meal template. Ingredient macros sum to the full batch; servings split that batch when logging."
      />

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <IconPicker
        id="recipe-icon"
        label="Icon"
        options={foodIconOptions}
        selected={selectedIcon}
        onSelect={setSelectedIcon}
      />

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="recipe-name" style={labelBase}>
          Recipe name
        </label>
        <input
          id="recipe-name"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chicken rice bowl"
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="recipe-description" style={labelBase}>
          Description
        </label>
        <input
          id="recipe-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes"
          style={inputBase}
        />
      </div>

      <div className="modal-form-grid" style={{ marginBottom: 20 }}>
        <div>
          <label htmlFor="recipe-servings" style={labelBase}>
            Servings per batch
          </label>
          <input
            id="recipe-servings"
            type="number"
            min="0.25"
            step="0.25"
            value={defaultServings}
            onChange={(e) => setDefaultServings(e.target.value)}
            style={inputBase}
          />
        </div>
        <div>
          <label htmlFor="recipe-serving-weight" style={labelBase}>
            Weight of one serving (g)
          </label>
          <input
            id="recipe-serving-weight"
            type="number"
            min="1"
            step="1"
            value={servingWeightGrams}
            onChange={(e) => setServingWeightGrams(e.target.value)}
            placeholder="Optional"
            style={inputBase}
          />
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#a1a1aa', margin: '-8px 0 20px 0' }}>
        How many grams is one serving of this recipe? Enables logging by grams (e.g. ate 300g of the
        meal) instead of only by servings.
      </p>

      <CatalogListSection
        title="Ingredients"
        action={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--zone-accent)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fa-solid fa-barcode" aria-hidden="true" />
              Scan barcode
            </button>
            <button
              type="button"
              onClick={addIngredientRow}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--zone-accent)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              + Add ingredient
            </button>
          </div>
        }
      >
        {ingredients.map((row, index) => (
          <div key={index} style={catalogItemCard}>
            <div className="modal-form-grid" style={{ marginBottom: 12 }}>
              <div>
                <label style={labelBase}>From ingredients</label>
                <select
                  value={row.ingredientId}
                  onChange={(e) => {
                    const id = e.target.value
                    if (!id) {
                      updateIngredient(index, { ingredientId: '' })
                      return
                    }
                    const selected = catalogIngredients.find((c) => c.id === id)
                    if (selected) applyCatalogIngredient(index, selected)
                  }}
                  style={inputBase}
                >
                  <option value="">— Manual entry —</option>
                  {catalogIngredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelBase}>Name</label>
                <input
                  value={row.name}
                  onChange={(e) => updateIngredient(index, { name: e.target.value })}
                  placeholder="Ingredient"
                  style={inputBase}
                />
              </div>
            </div>
            <div className="modal-form-grid" style={{ marginBottom: 12 }}>
              <div>
                <label style={labelBase}>Amount</label>
                <input
                  value={row.amount}
                  onChange={(e) => handleAmountChange(index, e.target.value)}
                  placeholder={row.ingredientId ? '150g' : 'Optional (150g)'}
                  style={inputBase}
                />
              </div>
              <div />
            </div>
            <div className="modal-form-grid">
              {(['calories', 'protein', 'carbs', 'fat', 'fiber', 'caffeine'] as const).map(
                (field) => (
                  <div key={field}>
                    <label style={labelBase}>{field}</label>
                    <input
                      type="number"
                      min="0"
                      value={row[field]}
                      onChange={(e) => updateIngredient(index, { [field]: e.target.value })}
                      style={inputBase}
                    />
                  </div>
                ),
              )}
            </div>
            {row.ingredientId && (
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#a1a1aa' }}>
                Linked to{' '}
                {catalogIngredients.find((c) => c.id === row.ingredientId)?.name ?? 'ingredient'}.
                Enter an amount like 150g to auto-fill macros from per-100g values.
              </p>
            )}
            {ingredients.length > 1 && (
              <button
                type="button"
                onClick={() => removeIngredientRow(index)}
                style={{
                  marginTop: 12,
                  border: 'none',
                  background: 'transparent',
                  color: '#b91c1c',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Remove ingredient
              </button>
            )}
          </div>
        ))}
      </CatalogListSection>

      <div style={{ ...summaryPanel, marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Nutrition preview</div>
        Batch: {batchTotals.calories} kcal · {batchTotals.protein}g protein · Per serving ({servings}
        ): {servingTotals.calories} kcal · {servingTotals.protein}g protein
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={modalFooterButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          style={{
            ...modalPrimaryButton,
            background: saving ? '#6b7280' : 'var(--zone-accent)',
          }}
        >
          {saving ? 'Saving...' : isEdit ? 'Save Recipe' : 'Create Recipe'}
        </button>
      </div>
    </Modal>
    {showScanner && (
      <BarcodeScannerModal
        onProductFound={applyScannedIngredient}
        onClose={() => setShowScanner(false)}
      />
    )}
    </>
  )
}