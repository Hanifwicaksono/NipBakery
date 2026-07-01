import { z } from 'zod'

export const UnitSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  abbreviation: z.string().min(1, 'Abbreviation is required'),
  type: z.enum(['weight', 'volume', 'count']),
  baseRatio: z.number().positive('Base ratio must be positive'),
  isBase: z.boolean(),
})

export const IngredientCategorySchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Category name is required'),
})

export const RecipeCategorySchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Category name is required'),
})

export const SupplierSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Supplier name is required'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')).optional(),
  address: z.string().optional(),
})

export const IngredientSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Ingredient name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  supplierId: z.string().nullable(),
  purchasePrice: z.number().nonnegative('Price must be greater than or equal to 0'),
  purchaseQuantity: z.number().positive('Quantity must be greater than 0'),
  purchaseUnitId: z.string().min(1, 'Purchase unit is required'),
  yieldPercentage: z.number().min(1, 'Yield must be at least 1%').max(100, 'Yield cannot exceed 100%'),
  notes: z.string().optional(),
  imageStoragePath: z.string().nullable().optional(),
  lastUpdated: z.string().datetime().or(z.string()),
})

export const RecipeItemSchema = z.object({
  type: z.enum(['ingredient', 'recipe']),
  id: z.string().min(1, 'ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitId: z.string().min(1, 'Unit is required'),
})

export const OverheadItemSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['fixed', 'percentage']),
  value: z.number().nonnegative('Value must be greater than or equal to 0'),
})

export const RecipeSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Recipe name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  servings: z.number().int('Servings must be an integer').positive('Servings must be positive'),
  servingUnitId: z.string().min(1, 'Serving unit is required'),
  items: z.array(RecipeItemSchema).min(1, 'Recipe must have at least one ingredient or sub-recipe'),
  overheads: z.array(OverheadItemSchema),
  markupPercentage: z.number().nonnegative('Markup must be non-negative'),
  cachedCost: z.number().nonnegative(),
  cachedSellingPrice: z.number().nonnegative(),
  isSubRecipe: z.boolean(),
  imageStoragePath: z.string().nullable().optional(),
  version: z.number().int().positive(),
  lastUpdated: z.string().datetime().or(z.string()),
})

export const SystemSettingsSchema = z.object({
  id: z.string().min(1),
  currency: z.string().min(1, 'Currency symbol/code is required'),
  taxPercentage: z.number().min(0).max(100),
  defaultMarkup: z.number().min(0),
  lastBackupDate: z.string().nullable().optional(),
})

// Schema for JSON Backup / Restore validation
export const BackupDataSchema = z.object({
  version: z.literal(1),
  timestamp: z.string(),
  units: z.array(UnitSchema),
  ingredientCategories: z.array(IngredientCategorySchema),
  suppliers: z.array(SupplierSchema),
  ingredients: z.array(IngredientSchema),
  recipes: z.array(RecipeSchema),
  settings: SystemSettingsSchema,
})
