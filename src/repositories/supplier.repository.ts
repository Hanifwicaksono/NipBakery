import { BaseRepository } from './base.repository'
import type { Supplier } from '@/types'

export class SupplierRepository extends BaseRepository<Supplier> {
  constructor() {
    super('suppliers');
  }
}
