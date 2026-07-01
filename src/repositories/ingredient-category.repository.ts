import { BaseRepository } from './base.repository'
import type { IngredientCategory } from '@/types'

export class IngredientCategoryRepository extends BaseRepository<IngredientCategory> {
  constructor() {
    super('ingredient_categories');
  }
}
