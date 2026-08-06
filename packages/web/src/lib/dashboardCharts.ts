import { type NetBalance, type Totals } from '@input_output/shared'

export interface RingProgress {
  pct: number
  capped: number
  overGoal: boolean
}

export interface MacroSegment {
  label: string
  grams: number
  calories: number
  color: string
}

export interface ActivityBarRow {
  label: string
  value: number
  displayValue: string
  max: number
  color: string
  gradient: string
}

const MACRO_COLORS = {
  protein: '#059669',
  carbs: '#d97706',
  fat: '#db2777',
} as const

export function ringProgress(value: number, goal: number): RingProgress {
  const pct = goal > 0 ? Math.round((value / goal) * 100) : 0
  const capped = goal > 0 ? Math.min((value / goal) * 100, 100) : 0
  return { pct, capped, overGoal: goal > 0 && value > goal }
}

export function netRingProgress(balance: NetBalance): RingProgress {
  return ringProgress(balance.net, balance.goalHigh)
}

export function macroCalorieSplit(totals: Totals): MacroSegment[] {
  const proteinCal = totals.protein * 4
  const carbsCal = totals.carbs * 4
  const fatCal = totals.fat * 9

  return [
    { label: 'Protein', grams: totals.protein, calories: proteinCal, color: MACRO_COLORS.protein },
    { label: 'Carbs', grams: totals.carbs, calories: carbsCal, color: MACRO_COLORS.carbs },
    { label: 'Fat', grams: totals.fat, calories: fatCal, color: MACRO_COLORS.fat },
  ]
}

export function macroTotalCalories(segments: readonly MacroSegment[]): number {
  return segments.reduce((sum, s) => sum + s.calories, 0)
}

