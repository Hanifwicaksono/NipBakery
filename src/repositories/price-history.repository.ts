import { BaseRepository } from './base.repository'
import type { PriceHistory } from '@/types'

export class PriceHistoryRepository extends BaseRepository<PriceHistory> {
  constructor() {
    super('price_histories');
  }

  // Get price history for a specific ingredient ordered by date
  async getByIngredientId(ingredientId: string): Promise<PriceHistory[]> {
    const list = await this.list();
    return list
      .filter((ph) => ph.ingredientId === ingredientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
