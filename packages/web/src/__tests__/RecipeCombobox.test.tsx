import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RecipeSummary } from '@input_output/shared'
import RecipeCombobox from '../components/RecipeCombobox'
import { renderWithProviders } from './testUtils'

const emptyTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  caffeine: 0,
}

function recipe(
  partial: Partial<RecipeSummary> & Pick<RecipeSummary, 'id' | 'name'>,
): RecipeSummary {
  return {
    description: '',
    icon: 'fa-utensils',
    iconBg: '#f4f4f5',
    iconColor: '#71717a',
    defaultServings: 1,
    servingWeightGrams: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    batchTotals: emptyTotals,
    perServingTotals: emptyTotals,
    ingredientCount: 1,
    ...partial,
  }
}

const recipes = [
  recipe({ id: '1', name: 'Banana Bread', perServingTotals: { ...emptyTotals, calories: 300 } }),
  recipe({ id: '2', name: 'Berry Bowl', perServingTotals: { ...emptyTotals, calories: 250 } }),
  recipe({ id: '3', name: 'Chicken Salad', perServingTotals: { ...emptyTotals, calories: 400 } }),
]

describe('RecipeCombobox', () => {
  it('starts empty with a type-to-search placeholder when nothing is selected', () => {
    renderWithProviders(
      <RecipeCombobox
        id="entry-recipe"
        label="Saved recipe"
        recipes={recipes}
        value=""
        onChange={vi.fn()}
      />,
    )

    const combobox = screen.getByRole('combobox', { name: 'Saved recipe' })
    expect(combobox).toHaveValue('')
    expect(combobox).toHaveAttribute('placeholder', 'Type recipe name')
  })

  it('exposes combobox semantics and the selected recipe label', () => {
    renderWithProviders(
      <RecipeCombobox
        id="entry-recipe"
        label="Saved recipe"
        recipes={recipes}
        value="2"
        onChange={vi.fn()}
      />,
    )

    const combobox = screen.getByRole('combobox', { name: 'Saved recipe' })
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
    expect(combobox).toHaveValue('Berry Bowl (250 kcal/serving)')
  })

  it('filters recipes as the user types', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RecipeCombobox
        id="entry-recipe"
        label="Saved recipe"
        recipes={recipes}
        value="1"
        onChange={vi.fn()}
      />,
    )

    const combobox = screen.getByRole('combobox', { name: 'Saved recipe' })
    await user.click(combobox)
    await user.clear(combobox)
    await user.type(combobox, 'bo')

    const listbox = screen.getByRole('listbox', { name: 'Saved recipe' })
    const options = within(listbox).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Berry Bowl (250 kcal/serving)'])
  })

  it('selects a recipe with the keyboard', async () => {
    const user = userEvent.setup()

    function StatefulCombobox() {
      const [value, setValue] = useState('1')
      return (
        <RecipeCombobox
          id="entry-recipe"
          label="Saved recipe"
          recipes={recipes}
          value={value}
          onChange={setValue}
        />
      )
    }

    renderWithProviders(<StatefulCombobox />)

    const combobox = screen.getByRole('combobox', { name: 'Saved recipe' })
    await user.click(combobox)
    await user.clear(combobox)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(combobox).toHaveValue('Chicken Salad (400 kcal/serving)')
  })
})
