import { Decimal } from 'decimal.js'
import type { Ingredient, Recipe, Unit } from '@/types'
import { ConversionEngine } from './conversion.engine'

export interface CostBreakdown {
  rawIngredientsCost: Decimal;
  fixedOverheadsCost: Decimal;
  percentageOverheadsCost: Decimal;
  totalCost: Decimal; // HPP per batch
  costPerServing: Decimal; // HPP per pcs/portion
  sellingPrice: Decimal; // Recommended selling price per batch
  sellingPricePerServing: Decimal; // Recommended selling price per pcs/portion
}

export class CalculationEngine {
  /**
   * Calculates the cost per base unit of an ingredient.
   * Base units:
   * - weight: gram (g)
   * - volume: mililiter (ml)
   * - count: piece (pcs)
   */
  static calculateIngredientUnitCost(
    ingredient: Ingredient,
    unitsMap: Record<string, Unit>
  ): Decimal {
    const purchaseUnit = unitsMap[ingredient.purchaseUnitId];
    if (!purchaseUnit) {
      throw new Error(`Unit with ID '${ingredient.purchaseUnitId}' not found for ingredient '${ingredient.name}'`);
    }

    const price = new Decimal(ingredient.purchasePrice);
    const qty = new Decimal(ingredient.purchaseQuantity);
    const yieldPercentage = new Decimal(ingredient.yieldPercentage).div(100);
    const baseRatio = new Decimal(purchaseUnit.baseRatio);

    // Effective quantity in base units (e.g. total grams after yield loss)
    const effectiveQty = qty.mul(baseRatio).mul(yieldPercentage);

    if (effectiveQty.isZero()) {
      return new Decimal(0);
    }

    // Cost per base unit (e.g. IDR per gram)
    return price.div(effectiveQty);
  }

  /**
   * Recursively calculates the cost and selling price breakdown of a recipe.
   * Handles sub-recipes.
   */
  static calculateRecipeCost(
    recipe: Recipe,
    ingredientsMap: Record<string, Ingredient>,
    recipesMap: Record<string, Recipe>, // used to resolve sub-recipes
    unitsMap: Record<string, Unit>
  ): CostBreakdown {
    let rawIngredientsCost = new Decimal(0);

    for (const item of recipe.items) {
      const itemUnit = unitsMap[item.unitId];
      if (!itemUnit) {
        throw new Error(`Unit '${item.unitId}' not found for recipe item '${item.id}'`);
      }

      if (item.type === 'ingredient') {
        const ingredient = ingredientsMap[item.id];
        if (!ingredient) {
          throw new Error(`Ingredient with ID '${item.id}' not found`);
        }

        const ingPurchaseUnit = unitsMap[ingredient.purchaseUnitId];
        if (!ingPurchaseUnit) {
          throw new Error(`Purchase unit '${ingredient.purchaseUnitId}' not found for ingredient '${ingredient.name}'`);
        }

        // Get cost per base unit of the ingredient
        const unitCost = this.calculateIngredientUnitCost(ingredient, unitsMap);

        // Find the base unit for this type
        const baseUnit: Unit = {
          id: ingPurchaseUnit.type === 'weight' ? 'g' : ingPurchaseUnit.type === 'volume' ? 'ml' : 'pcs',
          name: ingPurchaseUnit.type === 'weight' ? 'Gram' : ingPurchaseUnit.type === 'volume' ? 'Mililiter' : 'Piece',
          abbreviation: ingPurchaseUnit.type === 'weight' ? 'g' : ingPurchaseUnit.type === 'volume' ? 'ml' : 'pcs',
          type: ingPurchaseUnit.type,
          baseRatio: 1,
          isBase: true
        };

        // Convert the item's quantity to the ingredient's base unit type
        const convertedQty = ConversionEngine.convert(item.quantity, itemUnit, baseUnit);
        const itemCost = convertedQty.mul(unitCost);

        rawIngredientsCost = rawIngredientsCost.plus(itemCost);
      } else if (item.type === 'recipe') {
        const subRecipe = recipesMap[item.id];
        if (!subRecipe) {
          throw new Error(`Sub-recipe with ID '${item.id}' not found`);
        }

        // Recursively calculate sub-recipe cost
        const subRecipeBreakdown = this.calculateRecipeCost(subRecipe, ingredientsMap, recipesMap, unitsMap);
        const subRecipeUnit = unitsMap[subRecipe.servingUnitId];
        if (!subRecipeUnit) {
          throw new Error(`Serving unit '${subRecipe.servingUnitId}' not found for sub-recipe '${subRecipe.name}'`);
        }

        // Calculate cost per single output unit of the sub-recipe (e.g. cost per 1 gram or 1 pcs)
        // subRecipeTotalCost / (subRecipeServings * subRecipeUnit.baseRatio)
        const totalServingsBase = new Decimal(subRecipe.servings).mul(subRecipeUnit.baseRatio);
        if (totalServingsBase.isZero()) {
          throw new Error(`Servings for sub-recipe '${subRecipe.name}' cannot be 0`);
        }
        const costPerBaseUnit = subRecipeBreakdown.totalCost.div(totalServingsBase);

        // Find the base unit for this type
        const baseUnit: Unit = {
          id: subRecipeUnit.type === 'weight' ? 'g' : subRecipeUnit.type === 'volume' ? 'ml' : 'pcs',
          name: subRecipeUnit.type === 'weight' ? 'Gram' : subRecipeUnit.type === 'volume' ? 'Mililiter' : 'Piece',
          abbreviation: subRecipeUnit.type === 'weight' ? 'g' : subRecipeUnit.type === 'volume' ? 'ml' : 'pcs',
          type: subRecipeUnit.type,
          baseRatio: 1,
          isBase: true
        };

        // Convert quantity used in parent recipe to the base unit
        const convertedQty = ConversionEngine.convert(item.quantity, itemUnit, baseUnit);
        const itemCost = convertedQty.mul(costPerBaseUnit);

        rawIngredientsCost = rawIngredientsCost.plus(itemCost);
      }
    }

    // Calculate overheads
    let fixedOverheadsCost = new Decimal(0);
    let percentageOverheadsCost = new Decimal(0);

    for (const overhead of recipe.overheads) {
      if (overhead.type === 'fixed') {
        fixedOverheadsCost = fixedOverheadsCost.plus(overhead.value);
      } else if (overhead.type === 'percentage') {
        const valueDecimal = new Decimal(overhead.value).div(100);
        const calculated = rawIngredientsCost.mul(valueDecimal);
        percentageOverheadsCost = percentageOverheadsCost.plus(calculated);
      }
    }

    const totalCost = rawIngredientsCost.plus(fixedOverheadsCost).plus(percentageOverheadsCost);
    
    const servingsDecimal = new Decimal(recipe.servings);
    const costPerServing = servingsDecimal.isZero() ? new Decimal(0) : totalCost.div(servingsDecimal);

    // Calculate selling price based on markup
    const markupDecimal = new Decimal(recipe.markupPercentage).div(100);
    const sellingPrice = totalCost.mul(new Decimal(1).plus(markupDecimal));
    const sellingPricePerServing = servingsDecimal.isZero() ? new Decimal(0) : sellingPrice.div(servingsDecimal);

    return {
      rawIngredientsCost,
      fixedOverheadsCost,
      percentageOverheadsCost,
      totalCost,
      costPerServing,
      sellingPrice,
      sellingPricePerServing
    };
  }
}
