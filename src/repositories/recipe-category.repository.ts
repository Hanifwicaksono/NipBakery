import { BaseRepository } from './base.repository'
import type { RecipeCategory } from '@/types'

export class RecipeCategoryRepository extends BaseRepository<RecipeCategory> {
  constructor() {
    super('recipe_categories');
  }

  // Seed default category on startup if empty
  async seedDefaultRecipeCategory(): Promise<void> {
    const list = await this.list();
    if (list.length === 0) {
      const defaultCat: RecipeCategory = {
        id: 'cat_umum',
        name: 'Umum',
      };
      await this.create(defaultCat);
    }
  }
}
