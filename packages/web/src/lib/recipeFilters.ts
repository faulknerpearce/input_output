import type { RecipeSummary } from '@input_output/shared'

export type RecipeSortOption =
  | 'name-asc'
  | 'name-desc'
  | 'updated-desc'
  | 'updated-asc'
  | 'calories-desc'
  | 'calories-asc'
  | 'ingredients-desc'
  | 'ingredients-asc'

export const RECIPE_SORT_OPTIONS: { value: RecipeSortOption; label: string }[] = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'updated-desc', label: 'Recently updated' },
  { value: 'updated-asc', label: 'Oldest first' },
  { value: 'calories-desc', label: 'Calories (high to low)' },
  { value: 'calories-asc', label: 'Calories (low to high)' },
  { value: 'ingredients-desc', label: 'Most ingredients' },
  { value: 'ingredients-asc', label: 'Fewest ingredients' },
]

export function recipeMatchesQuery(recipe: RecipeSummary, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    recipe.name.toLowerCase().includes(normalized) ||
    recipe.description.toLowerCase().includes(normalized)
  )
}

function compareRecipes(a: RecipeSummary, b: RecipeSummary, sort: RecipeSortOption): number {
  switch (sort) {
    case 'name-asc':
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    case 'name-desc':
      return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
    case 'updated-desc':
      return b.updatedAt.localeCompare(a.updatedAt)
    case 'updated-asc':
      return a.updatedAt.localeCompare(b.updatedAt)
    case 'calories-desc':
      return b.perServingTotals.calories - a.perServingTotals.calories
    case 'calories-asc':
      return a.perServingTotals.calories - b.perServingTotals.calories
    case 'ingredients-desc':
      return b.ingredientCount - a.ingredientCount
    case 'ingredients-asc':
      return a.ingredientCount - b.ingredientCount
    default:
      return 0
  }
}

export function filterAndSortRecipes(
  recipes: RecipeSummary[],
  query: string,
  sort: RecipeSortOption,
): RecipeSummary[] {
  return recipes
    .filter((recipe) => recipeMatchesQuery(recipe, query))
    .sort((a, b) => compareRecipes(a, b, sort))
}

export function sortRecipesByName(recipes: RecipeSummary[]): RecipeSummary[] {
  return [...recipes].sort((a, b) => compareRecipes(a, b, 'name-asc'))
}

/** Alphabetical picker list with prefix matches ranked above substring matches. */
export function filterRecipesForPicker(recipes: RecipeSummary[], query: string): RecipeSummary[] {
  const sorted = sortRecipesByName(recipes)
  const normalized = query.trim().toLowerCase()
  if (!normalized) return sorted

  const prefixMatches: RecipeSummary[] = []
  const substringMatches: RecipeSummary[] = []

  for (const recipe of sorted) {
    const name = recipe.name.toLowerCase()
    if (name.startsWith(normalized)) {
      prefixMatches.push(recipe)
    } else if (name.includes(normalized)) {
      substringMatches.push(recipe)
    }
  }

  return [...prefixMatches, ...substringMatches]
}

export function recipeOptionLabel(recipe: RecipeSummary): string {
  return `${recipe.name} (${recipe.perServingTotals.calories} kcal/serving)`
}
