import { BaseRepository } from './base.repository'
import type { Recipe, RecipeVersion, Ingredient, Unit } from '@/types'
import { RecipeVersionRepository } from './recipe-version.repository'
import { IngredientRepository } from './ingredient.repository'
import { UnitRepository } from './unit.repository'
import { CalculationEngine } from '@/engine/calculation.engine'
import { updateDoc } from 'firebase/firestore'

export class RecipeRepository extends BaseRepository<Recipe> {
  private versionRepo = new RecipeVersionRepository();

  constructor() {
    super('recipes');
  }

  // Override create to log version 1 snapshot
  override async create(data: Recipe): Promise<void> {
    const recipeData = { ...data, version: 1, lastUpdated: new Date().toISOString() };
    await super.create(recipeData);

    const versionSnapshot: RecipeVersion = {
      id: `${data.id}_v1`,
      recipeId: data.id,
      versionNumber: 1,
      recipeData: recipeData,
      createdAt: new Date().toISOString(),
    };
    await this.versionRepo.create(versionSnapshot);
  }

  // Override update to increment version and save snapshot
  override async update(id: string, data: Partial<Recipe>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Recipe with ID '${id}' not found`);
    }

    const nextVersion = existing.version + 1;
    const updatedRecipe: Recipe = {
      ...existing,
      ...data,
      version: nextVersion,
      lastUpdated: new Date().toISOString(),
    };

    await super.update(id, updatedRecipe);

    const versionSnapshot: RecipeVersion = {
      id: `${id}_v${nextVersion}`,
      recipeId: id,
      versionNumber: nextVersion,
      recipeData: updatedRecipe,
      createdAt: new Date().toISOString(),
    };
    await this.versionRepo.create(versionSnapshot);
  }

  // Specific method to update cached costs from automatic recalculation without incrementing version
  async updateCachedCosts(id: string, cost: number, sellingPrice: number): Promise<void> {
    const docRef = this.getDocRef(id);
    await updateDoc(docRef, {
      cachedCost: cost,
      cachedSellingPrice: sellingPrice,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Static recalculation hook to propagate ingredient price changes
  static async recalculateAffectedRecipes(ingredientId: string, _newPrice: number): Promise<void> {
    const recipeRepo = new RecipeRepository();
    const ingredientRepo = new IngredientRepository();
    const unitRepo = new UnitRepository();

    const recipes = await recipeRepo.list();
    const ingredients = await ingredientRepo.list();
    const units = await unitRepo.list();

    // 1. Build lookups
    const recipesMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));

    const recipesRecord: Record<string, Recipe> = {};
    recipes.forEach((r) => { recipesRecord[r.id] = r; });

    const ingredientsRecord: Record<string, Ingredient> = {};
    ingredients.forEach((i) => { ingredientsRecord[i.id] = i; });

    const unitsRecord: Record<string, Unit> = {};
    units.forEach((u) => { unitsRecord[u.id] = u; });

    // 2. Find directly affected recipes
    const affected = new Set<string>();
    for (const recipe of recipes) {
      const usesIng = recipe.items.some(
        (item) => item.type === 'ingredient' && item.id === ingredientId
      );
      if (usesIng) {
        affected.add(recipe.id);
      }
    }

    // 3. Propagate to parents transitively
    let added = true;
    while (added) {
      added = false;
      for (const recipe of recipes) {
        if (affected.has(recipe.id)) continue;
        const usesAffectedSub = recipe.items.some(
          (item) => item.type === 'recipe' && affected.has(item.id)
        );
        if (usesAffectedSub) {
          affected.add(recipe.id);
          added = true;
        }
      }
    }

    if (affected.size === 0) return;

    // 4. Topological sort of affected recipes (children first, parents later)
    const ordered: string[] = [];
    const visited = new Set<string>();
    const tempVisited = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (tempVisited.has(id)) return; // prevent loop locks in case of validation escapes
      tempVisited.add(id);

      const r = recipesMap.get(id);
      if (r) {
        for (const item of r.items) {
          if (item.type === 'recipe' && affected.has(item.id)) {
            visit(item.id);
          }
        }
      }

      tempVisited.delete(id);
      visited.add(id);
      ordered.push(id);
    };

    for (const id of affected) {
      visit(id);
    }

    // 5. Recalculate and update databases
    for (const id of ordered) {
      const recipe = recipesMap.get(id);
      if (!recipe) continue;

      try {
        const breakdown = CalculationEngine.calculateRecipeCost(
          recipe,
          ingredientsRecord,
          recipesRecord,
          unitsRecord
        );

        recipe.cachedCost = breakdown.totalCost.toNumber();
        recipe.cachedSellingPrice = breakdown.sellingPrice.toNumber();
        recipe.lastUpdated = new Date().toISOString();

        // Save updated cache values
        await recipeRepo.updateCachedCosts(recipe.id, recipe.cachedCost, recipe.cachedSellingPrice);

        // Update map/records for parents in next iterations
        recipesRecord[id] = recipe;
        recipesMap.set(id, recipe);
      } catch (err) {
        console.error(`Failed to automatically recalculate recipe ID '${id}':`, err);
      }
    }
  }
}
export default RecipeRepository
