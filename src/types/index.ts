export type UnitType = 'weight' | 'volume' | 'count';

export interface Unit {
  id: string;
  name: string; // e.g. Grams, Liters, Pieces
  abbreviation: string; // e.g. g, l, pcs
  type: UnitType;
  baseRatio: number; // e.g. if unit is kg and base is g, baseRatio is 1000
  isBase: boolean;
}

export interface IngredientCategory {
  id: string;
  name: string;
}

export interface RecipeCategory {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  categoryId: string;
  supplierId: string | null;
  purchasePrice: number; // e.g. 50000
  purchaseQuantity: number; // e.g. 1
  purchaseUnitId: string; // e.g. 'kg'
  yieldPercentage: number; // e.g. 90 (means 10% wastage)
  notes?: string;
  imageStoragePath?: string | null;
  lastUpdated: string; // ISO date string
}

export interface PriceHistory {
  id: string;
  ingredientId: string;
  purchasePrice: number;
  purchaseQuantity: number;
  purchaseUnitId: string;
  date: string; // ISO date string
}

export type RecipeItemType = 'ingredient' | 'recipe';

export interface RecipeItem {
  type: RecipeItemType;
  id: string; // ingredientId or sub-recipeId
  quantity: number;
  unitId: string; // e.g. 'g', 'pcs'
}

export type OverheadType = 'fixed' | 'percentage';

export interface OverheadItem {
  id: string;
  name: string; // e.g. Utilities, Labor, Box
  type: OverheadType;
  value: number; // fixed amount in currency or percentage (0-100)
}

export interface Recipe {
  id: string;
  name: string;
  categoryId: string;
  description?: string;
  servings: number; // e.g. 10 (makes 10 pieces)
  servingUnitId: string; // e.g. 'g', 'ml', 'pcs'
  items: RecipeItem[];
  overheads: OverheadItem[];
  markupPercentage: number; // e.g. 100% markup (selling price = cost * 2)
  cachedCost: number; // HPP per batch
  cachedSellingPrice: number; // Recommended selling price per batch
  isSubRecipe: boolean; // Can it be used inside other recipes?
  imageStoragePath?: string | null;
  version: number;
  lastUpdated: string; // ISO date string
}

export interface RecipeVersion {
  id: string;
  recipeId: string;
  versionNumber: number;
  recipeData: Recipe; // snapshot
  createdAt: string; // ISO date string
}

export interface SystemSettings {
  id: string; // 'global'
  currency: string; // e.g. 'IDR'
  taxPercentage: number; // e.g. 10%
  defaultMarkup: number; // e.g. 100%
  lastBackupDate?: string | null;
}
