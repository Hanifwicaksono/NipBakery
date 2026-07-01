import { BaseRepository } from './base.repository'
import type { RecipeVersion } from '@/types'

export class RecipeVersionRepository extends BaseRepository<RecipeVersion> {
  constructor() {
    super('recipe_versions');
  }

  // Get all versions for a specific recipe, sorted by version number descending
  async getByRecipeId(recipeId: string): Promise<RecipeVersion[]> {
    const list = await this.list();
    return list
      .filter((rv) => rv.recipeId === recipeId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }
}
