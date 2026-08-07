import type { Totals } from './types.js'

/** Macros definitions per 1 total of an ingredient. */
export interface Per100gTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  caffeine: number
}

/**
 * Scale per-100g ingredient macros up/down to a gram amount.
 * e.g. scaleMacrosToGrams(per100g, 150) => macros for 150g.
 * Uses a single round after multiplying, like recipe serving scaling.
 */
export function scaleMacrosToGrams(totals: Per100gTotals, grams: number): Totals {
  if (!Number.isFinite(grams) || grams < 0) {
    throw new Error('grams must be a non-negative number')
  }
  const factor = grams / 100
  return {
    calories: Math.round(totals.calories * factor),
    protein: Math.round(totals.protein * factor),
    carbs: Math.round(totals.carbs * factor),
    caffeine: Math.round(totals.caffeine * factor),
    fat: Math.round(totals.fat * factor),
    fiber: Math.round(totals.fiber * factor),
  }
}

/**
 * Derive a per-100g macro reference from a line whose macros were entered for a
 * given gram weight (used during legacy recipe backfill). Each macro is scaled
 * to 100g using the same single-round convention.
 */
export function per100gFromGrams(macros: Totals, grams: number): Per100gTotals {
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error('grams must be greater than 0')
  }
  const factor = 100 / grams
  return {
    calories: Math.round(macros.calories * factor),
    protein: Math.round(macros.protein * factor),
    carbs: Math.round(macros.carbs * factor),
    caffeine: Math.round(macros.caffeine * factor),
    fat: Math.round(macros.fat * factor),
    fiber: Math.round(macros.fiber * factor),
  }
}

/** Parse "150g" / "150 g" style amounts into a gram value, or null if unrecognized. */
export function parseGramsFromAmount(amount: string): number | null {
  const match = amount.trim().match(/^(\d+(?:\.\d+)?)\s*g$/i)
  if (!match) return null
  const grams = Number.parseFloat(match[1])
  return Number.isFinite(grams) && grams > 0 ? grams : null
}