import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { parseLogDate, todayISOInTimeZone } from '@input_output/shared'
import type { InputOutputSupabase } from './supabase.js'
import {
  addActivityForDate,
  addFoodEntryForDate,
  deleteActivity,
  deleteFoodEntry,
  fetchUserTimeZone,
  getActivityTotalsForDate,
  getDailyTotalsForDate,
  isManageDayLogAction,
  listActivitiesForDate,
  listFoodEntriesForDate,
  manageDayLog,
  updateActivity,
  updateFoodEntry,
} from './toolHandlers.js'
import {
  deleteRecipe,
  getRecipe,
  listRecipes,
  logRecipeEntry,
  saveRecipe,
} from './recipeHandlers.js'
import {
  deleteWorkout,
  getWorkout,
  listWorkouts,
  logWorkoutEntry,
  saveWorkout,
} from './workoutHandlers.js'

export { createAuthenticatedSupabase, type InputOutputSupabase } from './supabase.js'

/** JSON Schema object inputs — strict shape Grok and other MCP clients expect. */
function objectSchema(
  properties: Record<string, Record<string, unknown>>,
  required?: string[],
): Tool['inputSchema'] {
  return {
    type: 'object',
    properties,
    ...(required?.length ? { required } : {}),
    additionalProperties: false,
  }
}

const dateProperty = {
  type: 'string',
  description: 'ISO date (YYYY-MM-DD). Defaults to today. Past dates are allowed.',
}

const loggedAtProperty = {
  type: 'string',
  description:
    'Optional ISO timestamp for when the entry was logged. Defaults to the current time.',
}

const foodFields = {
  name: { type: 'string', description: 'Name of the food item' },
  description: { type: 'string', description: 'Optional description (e.g. Lunch)' },
  calories: { type: 'number', description: 'Calories (kcal)' },
  protein: { type: 'number', description: 'Protein in grams' },
  carbs: { type: 'number', description: 'Carbohydrates in grams' },
  fat: { type: 'number', description: 'Fat in grams (default 0)' },
  fiber: { type: 'number', description: 'Fiber in grams (default 0)' },
  caffeine: { type: 'number', description: 'Caffeine in mg (default 0)' },
  icon: { type: 'string', description: 'Font Awesome icon class (default fa-utensils)' },
  iconBg: { type: 'string', description: 'Background color hex (default #f4f4f5)' },
  iconColor: { type: 'string', description: 'Icon color hex (default #71717a)' },
  portionUnit: {
    type: 'string',
    enum: ['servings', 'grams'],
    description: 'How the entry amount was logged (optional metadata for display)',
  },
  portionQuantity: {
    type: 'number',
    description: 'Servings count or grams eaten when portionUnit is set',
  },
  referenceWeightGrams: {
    type: 'number',
    description: 'Gram weight that the logged macro totals are based on',
  },
}

const activityFields = {
  name: { type: 'string', description: 'Name of the activity (e.g. Morning Run)' },
  activityType: {
    type: 'string',
    description: 'Activity type (e.g. Run, Ride, Swim, Walk, Workout)',
  },
  durationMinutes: {
    type: 'number',
    description: 'Duration in minutes (converted to seconds internally)',
  },
  distanceKm: {
    type: 'number',
    description: 'Optional distance in kilometers',
  },
  averageHeartrate: {
    type: 'number',
    description: 'Optional average heart rate in bpm',
  },
  maxHeartrate: { type: 'number', description: 'Optional max heart rate in bpm' },
  calories: { type: 'number', description: 'Optional calories burned' },
}

async function resolveLogDateArg(supabase: InputOutputSupabase, value: unknown): Promise<string> {
  const timeZone = await fetchUserTimeZone(supabase)
  const parsed = parseLogDate(value, {
    fallback: todayISOInTimeZone(timeZone),
    timeZone,
  })
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.value
}

async function resolveRequiredLogDateArg(
  supabase: InputOutputSupabase,
  value: unknown,
): Promise<string> {
  const timeZone = await fetchUserTimeZone(supabase)
  const parsed = parseLogDate(value, { timeZone })
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.value
}

export const SERVER_NAME = 'input_output'
export const SERVER_VERSION = '1.3.0'

export const tools: Tool[] = [
  {
    name: 'list_food_entries',
    description:
      'Input Output: list food log entries and meals for a day (calories, protein, carbs, fat, fiber, caffeine). Works for past days.',
    inputSchema: objectSchema({ date: dateProperty }),
  },
  {
    name: 'add_food_entry',
    description:
      'Input Output: add a food or meal entry to the daily nutrition log with calories and macros. Pass date to log on a past day.',
    inputSchema: objectSchema(
      {
        date: dateProperty,
        loggedAt: loggedAtProperty,
        ...foodFields,
      },
      ['name', 'calories', 'protein'],
    ),
  },
  {
    name: 'update_food_entry',
    description:
      'Input Output: update an existing food log entry by id. Pass date to move the entry to another day.',
    inputSchema: objectSchema(
      {
        id: { type: 'string', description: 'ID of the entry to update' },
        date: dateProperty,
        loggedAt: loggedAtProperty,
        name: { type: 'string' },
        description: { type: 'string' },
        calories: { type: 'number' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
        fiber: { type: 'number' },
        caffeine: { type: 'number' },
        icon: { type: 'string' },
        iconBg: { type: 'string' },
        iconColor: { type: 'string' },
      },
      ['id'],
    ),
  },
  {
    name: 'delete_food_entry',
    description: 'Input Output: delete a food log entry by id.',
    inputSchema: objectSchema(
      { id: { type: 'string', description: 'ID of the entry to delete' } },
      ['id'],
    ),
  },
  {
    name: 'get_daily_totals',
    description:
      'Input Output: get daily nutrition totals (calories, protein, carbs, fat, fiber, caffeine) and remaining macro goals. Works for past days.',
    inputSchema: objectSchema({ date: dateProperty }),
  },
  {
    name: 'list_activities',
    description:
      'Input Output: list activity outputs (workouts) for a day — type, duration, distance, heart rate, calories burned. Works for past days.',
    inputSchema: objectSchema({ date: dateProperty }),
  },
  {
    name: 'add_activity',
    description:
      'Input Output: log a manual activity output with type, duration, distance, heart rate, and calories burned. Pass date to log on a past day.',
    inputSchema: objectSchema(
      {
        date: dateProperty,
        loggedAt: loggedAtProperty,
        ...activityFields,
      },
      ['name', 'activityType', 'durationMinutes'],
    ),
  },
  {
    name: 'update_activity',
    description:
      'Input Output: update an existing activity output by id. Pass date to move the activity to another day.',
    inputSchema: objectSchema(
      {
        id: { type: 'string', description: 'ID of the activity to update' },
        date: dateProperty,
        loggedAt: loggedAtProperty,
        name: { type: 'string' },
        activityType: { type: 'string' },
        durationMinutes: { type: 'number' },
        distanceKm: { type: 'number' },
        averageHeartrate: { type: 'number' },
        maxHeartrate: { type: 'number' },
        calories: { type: 'number' },
      },
      ['id'],
    ),
  },
  {
    name: 'delete_activity',
    description: 'Input Output: delete an activity output by id.',
    inputSchema: objectSchema(
      { id: { type: 'string', description: 'ID of the activity to delete' } },
      ['id'],
    ),
  },
  {
    name: 'get_activity_totals',
    description:
      'Input Output: get daily activity totals (calories burned, total duration, total distance). Works for past days.',
    inputSchema: objectSchema({ date: dateProperty }),
  },
  {
    name: 'manage_day_log',
    description:
      'Input Output: add, list, or edit food and activity logs for any calendar day, including past days. Use action=list to read a day; add_food/add_activity to create; update_* to edit by id; delete_* to remove.',
    inputSchema: objectSchema(
      {
        date: {
          type: 'string',
          description: 'ISO date (YYYY-MM-DD) for the day to manage (required)',
        },
        action: {
          type: 'string',
          enum: [
            'list',
            'add_food',
            'update_food',
            'delete_food',
            'add_activity',
            'update_activity',
            'delete_activity',
          ],
          description: 'Operation to perform for the given date',
        },
        id: { type: 'string', description: 'Entry id (required for update/delete actions)' },
        ...foodFields,
        ...activityFields,
      },
      ['date', 'action'],
    ),
  },
  {
    name: 'list_recipes',
    description:
      'Input Output: list saved meal recipes with per-serving macro totals and ingredient counts.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'get_recipe',
    description: 'Input Output: get a saved recipe with all ingredient lines and macro totals.',
    inputSchema: objectSchema(
      { id: { type: 'string', description: 'Recipe id' } },
      ['id'],
    ),
  },
  {
    name: 'save_recipe',
    description:
      'Input Output: create or update a saved recipe and its ingredient lines. Pass id to update.',
    inputSchema: objectSchema({
      id: { type: 'string', description: 'Recipe id when updating' },
      name: { type: 'string', description: 'Recipe name' },
      description: { type: 'string', description: 'Optional description' },
      defaultServings: {
        type: 'number',
        description: 'How many servings the ingredient batch yields',
      },
      servingWeightGrams: {
        type: 'number',
        description: 'Weight in grams of one serving (enables logging by grams)',
      },
      icon: { type: 'string' },
      iconBg: { type: 'string' },
      iconColor: { type: 'string' },
      ingredients: {
        type: 'array',
        description: 'Ingredient lines that sum to the full recipe batch',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'string' },
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fat: { type: 'number' },
            fiber: { type: 'number' },
            caffeine: { type: 'number' },
          },
          required: ['name', 'calories', 'protein'],
        },
      },
    }, ['name', 'ingredients']),
  },
  {
    name: 'delete_recipe',
    description: 'Input Output: delete a saved recipe by id.',
    inputSchema: objectSchema({ id: { type: 'string', description: 'Recipe id' } }, ['id']),
  },
  {
    name: 'log_recipe',
    description:
      'Input Output: log one food entry from a saved recipe. Scale by servings or by grams eaten (requires recipe serving weight). Creates a single aggregated food log row.',
    inputSchema: objectSchema(
      {
        recipeId: { type: 'string', description: 'Recipe id to log' },
        servings: {
          type: 'number',
          description: 'Number of servings to log (default 1). Alias for portionQuantity when logging by servings.',
        },
        portionUnit: {
          type: 'string',
          enum: ['servings', 'grams'],
          description: 'Log by recipe servings or by grams eaten (default servings)',
        },
        portionQuantity: {
          type: 'number',
          description: 'Servings count or grams eaten depending on portionUnit',
        },
        date: dateProperty,
      },
      ['recipeId'],
    ),
  },
  {
    name: 'list_workouts',
    description:
      'Input Output: list saved workout templates with exercise counts and total target sets.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'get_workout',
    description: 'Input Output: get a saved workout with all exercise lines.',
    inputSchema: objectSchema({ id: { type: 'string', description: 'Workout id' } }, ['id']),
  },
  {
    name: 'save_workout',
    description:
      'Input Output: create or update a saved workout and its exercise lines. Pass id to update.',
    inputSchema: objectSchema(
      {
        id: { type: 'string', description: 'Workout id when updating' },
        name: { type: 'string', description: 'Workout name' },
        description: { type: 'string', description: 'Optional description' },
        icon: { type: 'string' },
        iconBg: { type: 'string' },
        iconColor: { type: 'string' },
        defaultDurationMinutes: {
          type: 'number',
          description: 'Minutes for one full set of the workout',
        },
        defaultCalories: {
          type: 'number',
          description: 'Calories burned for one full set of the workout',
        },
        exercises: {
          type: 'array',
          description: 'Exercise lines with target reps',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              targetReps: { type: 'number' },
            },
            required: ['name', 'targetReps'],
          },
        },
      },
      ['name', 'exercises'],
    ),
  },
  {
    name: 'delete_workout',
    description: 'Input Output: delete a saved workout by id.',
    inputSchema: objectSchema({ id: { type: 'string', description: 'Workout id' } }, ['id']),
  },
  {
    name: 'log_workout',
    description:
      'Input Output: log one activity from a saved workout. setsLogged is how many full rounds of the workout were completed (default 1).',
    inputSchema: objectSchema(
      {
        workoutId: { type: 'string', description: 'Workout id to log' },
        setsLogged: {
          type: 'number',
          description: 'How many full sets/rounds of the workout were completed (default 1)',
        },
        durationMinutes: { type: 'number', description: 'Optional session duration in minutes' },
        calories: { type: 'number', description: 'Optional calories burned' },
        date: dateProperty,
      },
      ['workoutId'],
    ),
  },
]

export function createServer(supabase: InputOutputSupabase): Server {
  const foodTools = tools
    .filter(
      (t) =>
        t.name.endsWith('_food_entry') ||
        t.name === 'get_daily_totals' ||
        t.name === 'manage_day_log',
    )
    .map((t) => t.name)
  const activityTools = tools
    .filter(
      (t) =>
        t.name.endsWith('_activity') ||
        t.name === 'get_activity_totals' ||
        t.name === 'manage_day_log',
    )
    .map((t) => t.name)
  const recipeTools = tools
    .filter((t) => t.name.endsWith('_recipe') || t.name === 'list_recipes')
    .map((t) => t.name)
  const workoutTools = tools
    .filter((t) => t.name.endsWith('_workout') || t.name === 'list_workouts')
    .map((t) => t.name)
  const instructions = `input output tools for food inputs, saved recipes, saved workouts, and activity outputs. Food: ${foodTools.join(', ')}. Recipes: ${recipeTools.join(', ')}. Workouts: ${workoutTools.join(', ')}. Activities: ${activityTools.join(', ')}. Use log_recipe or add_food_entry to log meals; log_workout or add_activity for outputs. All data is scoped to the signed-in user.`

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: { tools: { listChanged: false } },
      instructions,
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const a = (args ?? {}) as Record<string, unknown>

    try {
      switch (name) {
        case 'list_food_entries': {
          const date = await resolveLogDateArg(supabase, a.date)
          const entries = await listFoodEntriesForDate(supabase, date)
          return { content: [{ type: 'text', text: JSON.stringify(entries) }] }
        }

        case 'add_food_entry': {
          const date = await resolveLogDateArg(supabase, a.date)
          const entry = await addFoodEntryForDate(supabase, date, a)
          return { content: [{ type: 'text', text: JSON.stringify(entry) }] }
        }

        case 'update_food_entry': {
          if (typeof a.date === 'string') a.date = await resolveRequiredLogDateArg(supabase, a.date)
          const entry = await updateFoodEntry(supabase, a)
          return { content: [{ type: 'text', text: JSON.stringify(entry) }] }
        }

        case 'delete_food_entry': {
          const result = await deleteFoodEntry(supabase, a)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'get_daily_totals': {
          const date = await resolveLogDateArg(supabase, a.date)
          const result = await getDailyTotalsForDate(supabase, date)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'list_activities': {
          const date = await resolveLogDateArg(supabase, a.date)
          const entries = await listActivitiesForDate(supabase, date)
          return { content: [{ type: 'text', text: JSON.stringify(entries) }] }
        }

        case 'add_activity': {
          const date = await resolveLogDateArg(supabase, a.date)
          const activity = await addActivityForDate(supabase, date, a)
          return { content: [{ type: 'text', text: JSON.stringify(activity) }] }
        }

        case 'update_activity': {
          if (typeof a.date === 'string') a.date = await resolveRequiredLogDateArg(supabase, a.date)
          const activity = await updateActivity(supabase, a)
          return { content: [{ type: 'text', text: JSON.stringify(activity) }] }
        }

        case 'delete_activity': {
          const result = await deleteActivity(supabase, a)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'get_activity_totals': {
          const date = await resolveLogDateArg(supabase, a.date)
          const result = await getActivityTotalsForDate(supabase, date)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'manage_day_log': {
          const date = await resolveRequiredLogDateArg(supabase, a.date)
          if (!isManageDayLogAction(a.action)) {
            throw new Error(
              'action is required (list, add_food, update_food, delete_food, add_activity, update_activity, delete_activity)',
            )
          }
          const result = await manageDayLog(supabase, date, a.action, a)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'list_recipes': {
          const recipes = await listRecipes(supabase)
          return { content: [{ type: 'text', text: JSON.stringify(recipes) }] }
        }

        case 'get_recipe': {
          if (typeof a.id !== 'string' || a.id === '') throw new Error('id is required')
          const recipe = await getRecipe(supabase, a.id)
          return { content: [{ type: 'text', text: JSON.stringify(recipe) }] }
        }

        case 'save_recipe': {
          const recipe = await saveRecipe(supabase, a)
          return { content: [{ type: 'text', text: JSON.stringify(recipe) }] }
        }

        case 'delete_recipe': {
          if (typeof a.id !== 'string' || a.id === '') throw new Error('id is required')
          const result = await deleteRecipe(supabase, a.id)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'log_recipe': {
          const entry = await logRecipeEntry(supabase, a)
          return { content: [{ type: 'text', text: JSON.stringify(entry) }] }
        }

        case 'list_workouts': {
          const workouts = await listWorkouts(supabase)
          return { content: [{ type: 'text', text: JSON.stringify(workouts) }] }
        }

        case 'get_workout': {
          if (typeof a.id !== 'string' || a.id === '') throw new Error('id is required')
          const workout = await getWorkout(supabase, a.id)
          return { content: [{ type: 'text', text: JSON.stringify(workout) }] }
        }

        case 'save_workout': {
          const workout = await saveWorkout(supabase, a)
          return { content: [{ type: 'text', text: JSON.stringify(workout) }] }
        }

        case 'delete_workout': {
          if (typeof a.id !== 'string' || a.id === '') throw new Error('id is required')
          const result = await deleteWorkout(supabase, a.id)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }

        case 'log_workout': {
          const activity = await logWorkoutEntry(supabase, a)
          return { content: [{ type: 'text', text: JSON.stringify(activity) }] }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      }
    }
  })

  return server
}