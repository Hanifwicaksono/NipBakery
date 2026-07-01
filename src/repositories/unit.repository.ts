import { BaseRepository } from './base.repository'
import type { Unit } from '@/types'

export class UnitRepository extends BaseRepository<Unit> {
  constructor() {
    super('units');
  }

  // Seed default units if collection is empty
  async seedDefaultUnits(): Promise<void> {
    try {
      const existing = await this.list();
      if (existing.length > 0) {
        return; // Units already seeded
      }

      const defaultUnits: Unit[] = [
        { id: 'g', name: 'Gram', abbreviation: 'g', type: 'weight', baseRatio: 1, isBase: true },
        { id: 'kg', name: 'Kilogram', abbreviation: 'kg', type: 'weight', baseRatio: 1000, isBase: false },
        { id: 'ml', name: 'Mililiter', abbreviation: 'ml', type: 'volume', baseRatio: 1, isBase: true },
        { id: 'l', name: 'Liter', abbreviation: 'l', type: 'volume', baseRatio: 1000, isBase: false },
        { id: 'pcs', name: 'Piece', abbreviation: 'pcs', type: 'count', baseRatio: 1, isBase: true },
        { id: 'box', name: 'Box', abbreviation: 'box', type: 'count', baseRatio: 12, isBase: false }
      ];

      for (const unit of defaultUnits) {
        await this.create(unit);
      }
      console.log('Default units seeded successfully.');
    } catch (error) {
      console.error('Failed to seed default units:', error);
    }
  }
}
