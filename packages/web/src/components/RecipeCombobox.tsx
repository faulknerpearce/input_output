import type { RecipeSummary } from '@input_output/shared'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { filterRecipesForPicker, recipeOptionLabel } from '../lib/recipeFilters'
import { inputBase, labelBase } from '../lib/styles'

interface RecipeComboboxProps {
  id: string
  label: string
  recipes: RecipeSummary[]
  value: string
  onChange: (recipeId: string) => void
  disabled?: boolean
  emptyMessage?: string
  placeholder?: string
}

export default function RecipeCombobox({
  id,
  label,
  recipes,
  value,
  onChange,
  disabled = false,
  emptyMessage = 'No recipes yet',
  placeholder = 'Type recipe name',
}: RecipeComboboxProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedRecipe = recipes.find((recipe) => recipe.id === value)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const filteredRecipes = useMemo(() => filterRecipesForPicker(recipes, query), [recipes, query])
  const displayValue = isOpen ? query : selectedRecipe ? recipeOptionLabel(selectedRecipe) : ''

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen, selectedRecipe])

  const selectRecipe = (recipe: RecipeSummary) => {
    onChange(recipe.id)
    setIsOpen(false)
    setActiveIndex(0)
  }

  const openList = (prefillQuery?: string) => {
    if (disabled || recipes.length === 0) return
    setIsOpen(true)
    setActiveIndex(0)
    if (prefillQuery !== undefined) {
      setQuery(prefillQuery)
    }
  }

  const handleInputChange = (nextQuery: string) => {
    setQuery(nextQuery)
    setIsOpen(true)
    setActiveIndex(0)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || recipes.length === 0) return

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault()
        if (!isOpen) {
          openList()
          return
        }
        if (filteredRecipes.length === 0) return
        setActiveIndex((index) => (index + 1) % filteredRecipes.length)
        break
      }
      case 'ArrowUp': {
        event.preventDefault()
        if (!isOpen) {
          openList()
          return
        }
        if (filteredRecipes.length === 0) return
        setActiveIndex((index) => (index - 1 + filteredRecipes.length) % filteredRecipes.length)
        break
      }
      case 'Enter': {
        if (!isOpen || filteredRecipes.length === 0) return
        event.preventDefault()
        selectRecipe(filteredRecipes[activeIndex]!)
        break
      }
      case 'Escape': {
        event.preventDefault()
        setIsOpen(false)
        break
      }
      default:
        break
    }
  }

  const activeOptionId =
    isOpen && filteredRecipes.length > 0
      ? `${listboxId}-option-${filteredRecipes[activeIndex]?.id}`
      : undefined

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <label htmlFor={id} style={labelBase}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={activeOptionId}
        value={displayValue}
        placeholder={recipes.length === 0 ? emptyMessage : placeholder}
        disabled={disabled || recipes.length === 0}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => openList(selectedRecipe ? selectedRecipe.name : '')}
        onKeyDown={handleKeyDown}
        style={inputBase}
        autoComplete="off"
      />

      {isOpen && recipes.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            margin: 0,
            padding: 4,
            listStyle: 'none',
            maxHeight: 240,
            overflowY: 'auto',
            background: 'white',
            border: '1px solid #e4e4e7',
            borderRadius: 12,
            boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
            zIndex: 20,
          }}
        >
          {filteredRecipes.length === 0 ? (
            <li
              role="option"
              aria-disabled="true"
              style={{ padding: '10px 12px', fontSize: 13, color: '#a1a1aa' }}
            >
              No matching recipes
            </li>
          ) : (
            filteredRecipes.map((recipe, index) => {
              const isSelected = recipe.id === value
              const isActive = index === activeIndex
              return (
                <li
                  key={recipe.id}
                  id={`${listboxId}-option-${recipe.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectRecipe(recipe)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#3f3f46',
                    cursor: 'pointer',
                    background: isActive ? '#ecfdf5' : 'transparent',
                  }}
                >
                  {recipeOptionLabel(recipe)}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
