import { Decimal } from 'decimal.js'
import type { Unit } from '@/types'

export class ConversionEngine {
  // Convert a quantity from source unit to destination unit
  static convert(
    quantity: number,
    sourceUnit: Unit,
    destUnit: Unit,
    density: number = 1.0 // density in g/ml (used if converting between weight and volume)
  ): Decimal {
    const qtyDecimal = new Decimal(quantity);

    if (sourceUnit.type === destUnit.type) {
      // Standard conversion within the same type:
      // qty * (sourceUnit.baseRatio / destUnit.baseRatio)
      const srcRatio = new Decimal(sourceUnit.baseRatio);
      const destRatio = new Decimal(destUnit.baseRatio);
      return qtyDecimal.mul(srcRatio).div(destRatio);
    }

    // Cross-type conversion: weight <-> volume
    if (sourceUnit.type === 'weight' && destUnit.type === 'volume') {
      // 1. Convert source weight to grams (base weight unit)
      const qtyInGrams = qtyDecimal.mul(sourceUnit.baseRatio);
      // 2. Convert grams to ml (base volume unit) using density: ml = g / density
      const qtyInMl = qtyInGrams.div(density);
      // 3. Convert ml to destination volume unit
      return qtyInMl.div(destUnit.baseRatio);
    }

    if (sourceUnit.type === 'volume' && destUnit.type === 'weight') {
      // 1. Convert source volume to ml (base volume unit)
      const qtyInMl = qtyDecimal.mul(sourceUnit.baseRatio);
      // 2. Convert ml to grams (base weight unit) using density: g = ml * density
      const qtyInGrams = qtyInMl.mul(density);
      // 3. Convert grams to destination weight unit
      return qtyInGrams.div(destUnit.baseRatio);
    }

    throw new Error(
      `Cannot convert unit of type '${sourceUnit.type}' (${sourceUnit.abbreviation}) ` +
      `to unit of type '${destUnit.type}' (${destUnit.abbreviation})`
    );
  }
}
