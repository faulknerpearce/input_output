import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NUTRITION_GOALS, type NutritionGoals } from '@input_output/shared'
import GoalsFormFields from '../components/GoalsFormFields'
import { renderWithProviders } from './testUtils'

function StatefulGoalsForm({ initialGoals = DEFAULT_NUTRITION_GOALS }: { initialGoals?: NutritionGoals }) {
  const [form, setForm] = useState(initialGoals)
  return (
    <>
      <GoalsFormFields form={form} onChange={setForm} idPrefix="test-goal" />
      <output data-testid="calories-high">{form.calories.high}</output>
    </>
  )
}

describe('GoalsFormFields', () => {
  it('lets the user replace a calorie high value after backspacing to a single digit', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StatefulGoalsForm />)

    const highInput = screen.getByLabelText('High (kcal)')
    expect(highInput).toHaveValue(3200)

    await user.clear(highInput)
    await user.type(highInput, '3500')

    expect(highInput).toHaveValue(3500)
    expect(screen.getByTestId('calories-high')).toHaveTextContent('3500')
  })

  it('allows clearing and retyping without getting stuck on a single digit', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StatefulGoalsForm />)

    const highInput = screen.getByLabelText('High (kcal)')

    await user.clear(highInput)
    expect(highInput).toHaveValue(null)

    await user.type(highInput, '3')
    expect(highInput).toHaveValue(3)

    await user.type(highInput, '600')
    expect(highInput).toHaveValue(3600)
    expect(screen.getByTestId('calories-high')).toHaveTextContent('3600')
  })
})