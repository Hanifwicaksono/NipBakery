import { BaseRepository } from './base.repository'
import type { Ingredient, PriceHistory } from '@/types'
import { PriceHistoryRepository } from './price-history.repository'

export class IngredientRepository extends BaseRepository<Ingredient> {
  private priceHistoryRepo = new PriceHistoryRepository();

  // Callback to trigger recipe recalculations when price changes
  public static onPriceChange: ((ingredientId: string, newPrice: number) => Promise<void>) | null = null;

  constructor() {
    super('ingredients');
  }

  // Override create to log price history and trigger recalculations
  override async create(data: Ingredient): Promise<void> {
    const existing = await this.getById(data.id);
    await super.create(data);

    const priceChanged = !existing || existing.purchasePrice !== data.purchasePrice || existing.purchaseQuantity !== data.purchaseQuantity || existing.purchaseUnitId !== data.purchaseUnitId;

    if (priceChanged) {
      // Log to price history
      const historyId = `${data.id}_${Date.now()}`;
      const historyEntry: PriceHistory = {
        id: historyId,
        ingredientId: data.id,
        purchasePrice: data.purchasePrice,
        purchaseQuantity: data.purchaseQuantity,
        purchaseUnitId: data.purchaseUnitId,
        date: new Date().toISOString(),
      };
      await this.priceHistoryRepo.create(historyEntry);

      // Trigger recipe recalculations
      if (IngredientRepository.onPriceChange) {
        await IngredientRepository.onPriceChange(data.id, data.purchasePrice);
      }
    }
  }

  // Override update to check for price change and trigger recalculations
  override async update(id: string, data: Partial<Ingredient>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;

    await super.update(id, data);

    const newPrice = data.purchasePrice !== undefined ? data.purchasePrice : existing.purchasePrice;
    const newQuantity = data.purchaseQuantity !== undefined ? data.purchaseQuantity : existing.purchaseQuantity;
    const newUnit = data.purchaseUnitId !== undefined ? data.purchaseUnitId : existing.purchaseUnitId;

    const priceChanged = existing.purchasePrice !== newPrice || existing.purchaseQuantity !== newQuantity || existing.purchaseUnitId !== newUnit;

    if (priceChanged) {
      const historyId = `${id}_${Date.now()}`;
      const historyEntry: PriceHistory = {
        id: historyId,
        ingredientId: id,
        purchasePrice: newPrice,
        purchaseQuantity: newQuantity,
        purchaseUnitId: newUnit,
        date: new Date().toISOString(),
      };
      await this.priceHistoryRepo.create(historyEntry);

      if (IngredientRepository.onPriceChange) {
        await IngredientRepository.onPriceChange(id, newPrice);
      }
    }
  }
}
