import { useEffect, useRef, useState } from 'react'
import {
  foodIconOptions,
  type IconOption,
  type Ingredient,
  type IngredientInput,
} from '@input_output/shared'
import { focusIfDesktop } from '../lib/device'
import {
  inputBase,
  labelBase,
  modalFooterButton,
  modalPrimaryButton,
} from '../lib/styles'
import CatalogModalHeader from './catalog/CatalogModalHeader'
import IconPicker from './catalog/IconPicker'
import Modal from './Modal'

interface IngredientEditorModalProps {
  ingredient?: Ingredient
  onSave: (input: IngredientInput) => Promise<void>
  onClose: () => void
}

const PER_100G_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'caffeine'] as const

function iconFromIngredient(ingredient: Ingredient): IconOption {
  return (
    foodIconOptions.find((opt) => opt.icon === ingredient.icon) ?? {
      icon: ingredient.icon,
      label: 'Custom',
      bg: ingredient.iconBg,
      color: ingredient.iconColor,
    }
  )
}

export default function IngredientEditorModal({
  ingredient,
  onSave,
  onClose,
}: IngredientEditorModalProps) {
  const isEdit = ingredient !== undefined
  const [name, setName] = useState(ingredient?.name ?? '')
  const [description, setDescription] = useState(ingredient?.description ?? '')
  const [per100g, setPer100g] = useState<Record<(typeof PER_100G_FIELDS)[number], string>>(() => {
    const p = ingredient?.per100g
    return {
      calories: p?.calories ? String(p.calories) : '',
      protein: p?.protein ? String(p.protein) : '',
      carbs: p?.carbs ? String(p.carbs) : '',
      fat: p?.fat ? String(p.fat) : '',
      fiber: p?.fiber ? String(p.fiber) : '',
      caffeine: p?.caffeine ? String(p.caffeine) : '',
    }
  })
  const [selectedIcon, setSelectedIcon] = useState<IconOption>(() =>
    ingredient ? iconFromIngredient(ingredient) : foodIconOptions[0],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    focusIfDesktop(nameRef.current)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!name.trim()) {
      setError('Ingredient name is required')
      return
    }

    const macros: Record<(typeof PER_100G_FIELDS)[number], number> = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      caffeine: 0,
    }
    for (const field of PER_100G_FIELDS) {
      const raw = per100g[field]
      if (raw === '') continue
      const value = Number.parseInt(raw, 10)
      if (!Number.isFinite(value) || value < 0) {
        setError(`${field} (per 100g) must be a non-negative integer`)
        return
      }
      macros[field] = value
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        icon: selectedIcon.icon,
        iconBg: selectedIcon.bg,
        iconColor: selectedIcon.color,
        per100g: macros,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ingredient')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal titleId="ingredient-editor-title" onClose={onClose} size="wide">
      <CatalogModalHeader
        titleId="ingredient-editor-title"
        icon={selectedIcon.icon}
        iconBg={selectedIcon.bg}
        iconColor={selectedIcon.color}
        title={isEdit ? 'Edit Ingredient' : 'New Ingredient'}
        subtitle="Macros are per 100g. Recipes pull an ingredient in by weight and scale these to the grams used."
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
        id="ingredient-icon"
        label="Icon"
        options={foodIconOptions}
        selected={selectedIcon}
        onSelect={setSelectedIcon}
      />

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="ingredient-name" style={labelBase}>
          Name
        </label>
        <input
          id="ingredient-name"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chicken breast"
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="ingredient-description" style={labelBase}>
          Description
        </label>
        <input
          id="ingredient-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes"
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelBase}>Macros per 100g</label>
        <div className="modal-form-grid">
          {PER_100G_FIELDS.map((field) => (
            <div key={field}>
              <label htmlFor={`ingredient-${field}`} style={labelBase}>
                {field}
              </label>
              <input
                id={`ingredient-${field}`}
                type="number"
                min="0"
                value={per100g[field]}
                onChange={(e) => setPer100g((prev) => ({ ...prev, [field]: e.target.value }))}
                style={inputBase}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={modalFooterButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          style={modalPrimaryButton}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Ingredient'}
        </button>
      </div>
    </Modal>
  )
}