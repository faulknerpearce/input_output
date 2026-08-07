import { useCallback, useRef } from 'react'
import type { AppRoute } from '../lib/routing'
import PageHeader from '../components/layout/PageHeader'
import PageShell from '../components/layout/PageShell'
import ZoneButton from '../components/layout/ZoneButton'
import ZoneSubNav from '../components/layout/ZoneSubNav'
import InputsPage from './InputsPage'
import RecipesPage from './RecipesPage'
import IngredientsPage from './IngredientsPage'

interface InputsZoneProps {
  route: Extract<
    AppRoute,
    'inputs' | 'inputs/recipes' | 'inputs/ingredients'
  >
}

export default function InputsZone({ route }: InputsZoneProps) {
  const isRecipes = route === 'inputs/recipes'
  const isIngredients = route === 'inputs/ingredients'
  const openCreateRecipeRef = useRef<(() => void) | null>(null)
  const openCreateIngredientRef = useRef<(() => void) | null>(null)
  const openAddEntryRef = useRef<(() => void) | null>(null)
  const openBarcodeScannerRef = useRef<(() => void) | null>(null)
  const handleOpenCreateRecipeReady = useCallback((openCreate: () => void) => {
    openCreateRecipeRef.current = openCreate
  }, [])
  const handleOpenCreateIngredientReady = useCallback((openCreate: () => void) => {
    openCreateIngredientRef.current = openCreate
  }, [])
  const handleOpenAddEntryReady = useCallback((openAddEntry: () => void) => {
    openAddEntryRef.current = openAddEntry
  }, [])
  const handleOpenBarcodeScannerReady = useCallback((openBarcodeScanner: () => void) => {
    openBarcodeScannerRef.current = openBarcodeScanner
  }, [])

  return (
    <PageShell zone="inputs">
      <PageHeader
        eyebrow={isRecipes ? 'Inputs › Recipes' : isIngredients ? 'Inputs › Ingredients' : 'Inputs'}
        title={isRecipes ? 'Recipes' : isIngredients ? 'Ingredients' : 'Food Log'}
        description={
          isRecipes
            ? 'Saved meal templates for quick logging.'
            : isIngredients
              ? 'Reusable ingredients, with macros per 100g, to build recipes.'
              : 'Browse days and log food entries with stats and history.'
        }
        actions={
          isRecipes ? (
            <ZoneButton variant="primary" onClick={() => openCreateRecipeRef.current?.()}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> New Recipe
            </ZoneButton>
          ) : isIngredients ? (
            <ZoneButton variant="primary" onClick={() => openCreateIngredientRef.current?.()}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> New Ingredient
            </ZoneButton>
          ) : (
            <>
              <ZoneButton variant="secondary" onClick={() => openBarcodeScannerRef.current?.()}>
                <i className="fa-solid fa-barcode" aria-hidden="true" /> Scan Barcode
              </ZoneButton>
              <ZoneButton variant="primary" onClick={() => openAddEntryRef.current?.()}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add Entry
              </ZoneButton>
            </>
          )
        }
      />
      <ZoneSubNav
        active={route}
        items={[
          { route: 'inputs', label: 'Log' },
          { route: 'inputs/recipes', label: 'Recipes' },
          { route: 'inputs/ingredients', label: 'Ingredients' },
        ]}
      />
      {isRecipes ? (
        <RecipesPage onOpenCreateReady={handleOpenCreateRecipeReady} />
      ) : isIngredients ? (
        <IngredientsPage onOpenCreateReady={handleOpenCreateIngredientReady} />
      ) : (
        <InputsPage
          onOpenAddEntryReady={handleOpenAddEntryReady}
          onOpenBarcodeScannerReady={handleOpenBarcodeScannerReady}
        />
      )}
    </PageShell>
  )
}