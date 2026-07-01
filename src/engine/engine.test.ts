import { describe, it, expect } from 'vitest'
import { ConversionEngine } from './conversion.engine'
import { RecipeEngine } from './recipe.engine'
import type { RecipeDependencyNode } from './recipe.engine'
import { CalculationEngine } from './calculation.engine'
import type { Unit, Ingredient, Recipe } from '@/types'

// Mock Units
const mockUnits: Record<string, Unit> = {
  g: { id: 'g', name: 'Gram', abbreviation: 'g', type: 'weight', baseRatio: 1, isBase: true },
  kg: { id: 'kg', name: 'Kilogram', abbreviation: 'kg', type: 'weight', baseRatio: 1000, isBase: false },
  ml: { id: 'ml', name: 'Mililiter', abbreviation: 'ml', type: 'volume', baseRatio: 1, isBase: true },
  l: { id: 'l', name: 'Liter', abbreviation: 'l', type: 'volume', baseRatio: 1000, isBase: false },
  pcs: { id: 'pcs', name: 'Piece', abbreviation: 'pcs', type: 'count', baseRatio: 1, isBase: true },
  box: { id: 'box', name: 'Box', abbreviation: 'box', type: 'count', baseRatio: 12, isBase: false },
}

describe('ConversionEngine', () => {
  it('should convert same unit types correctly', () => {
    // 500g to kg: 500 * (1 / 1000) = 0.5 kg
    const res1 = ConversionEngine.convert(500, mockUnits.g, mockUnits.kg);
    expect(res1.toNumber()).toBe(0.5);

    // 2.5 kg to g: 2.5 * (1000 / 1) = 2500 g
    const res2 = ConversionEngine.convert(2.5, mockUnits.kg, mockUnits.g);
    expect(res2.toNumber()).toBe(2500);

    // 3 boxes to pcs: 3 * (12 / 1) = 36 pcs
    const res3 = ConversionEngine.convert(3, mockUnits.box, mockUnits.pcs);
    expect(res3.toNumber()).toBe(36);
  });

  it('should convert cross-type weight to volume using density', () => {
    // 1000g of water (density = 1.0) should be 1000 ml
    const res1 = ConversionEngine.convert(1000, mockUnits.g, mockUnits.ml, 1.0);
    expect(res1.toNumber()).toBe(1000);

    // 900g of oil (density = 0.9) should be 1000 ml
    const res2 = ConversionEngine.convert(900, mockUnits.g, mockUnits.ml, 0.9);
    expect(res2.toNumber()).toBe(1000);
  });

  it('should convert cross-type volume to weight using density', () => {
    // 500 ml of honey (density = 1.4) should be 700g
    const res1 = ConversionEngine.convert(500, mockUnits.ml, mockUnits.g, 1.4);
    expect(res1.toNumber()).toBe(700);
  });

  it('should throw error when converting incompatible types', () => {
    expect(() => {
      ConversionEngine.convert(10, mockUnits.g, mockUnits.pcs);
    }).toThrow();
  });
});

describe('RecipeEngine (Circular Dependency)', () => {
  it('should return null when there are no circular dependencies', () => {
    const graph: Record<string, RecipeDependencyNode> = {
      cake: {
        id: 'cake',
        name: 'Cake',
        items: [
          { type: 'ingredient', id: 'flour' },
          { type: 'recipe', id: 'cream' }
        ]
      },
      cream: {
        id: 'cream',
        name: 'Buttercream',
        items: [
          { type: 'ingredient', id: 'butter' },
          { type: 'ingredient', id: 'sugar' }
        ]
      }
    };

    const cycle = RecipeEngine.detectCircularDependency('cake', graph);
    expect(cycle).toBeNull();
  });

  it('should detect direct circular dependencies', () => {
    const graph: Record<string, RecipeDependencyNode> = {
      cake: {
        id: 'cake',
        name: 'Cake',
        items: [
          { type: 'recipe', id: 'cake' }
        ]
      }
    };

    const cycle = RecipeEngine.detectCircularDependency('cake', graph);
    expect(cycle).toEqual(['Cake', 'Cake']);
  });

  it('should detect transitive circular dependencies', () => {
    const graph: Record<string, RecipeDependencyNode> = {
      cake: {
        id: 'cake',
        name: 'Cake',
        items: [
          { type: 'recipe', id: 'cream' }
        ]
      },
      cream: {
        id: 'cream',
        name: 'Buttercream',
        items: [
          { type: 'recipe', id: 'cake' } // circular!
        ]
      }
    };

    const cycle = RecipeEngine.detectCircularDependency('cake', graph);
    expect(cycle).toEqual(['Cake', 'Buttercream', 'Cake']);
  });
});

describe('CalculationEngine', () => {
  // Mock Ingredients
  const mockIngredients: Record<string, Ingredient> = {
    flour: {
      id: 'flour',
      name: 'Flour',
      categoryId: 'baking',
      supplierId: null,
      purchasePrice: 15000, // IDR 15,000
      purchaseQuantity: 1,
      purchaseUnitId: 'kg', // 1 kg
      yieldPercentage: 100, // 100% yield
      lastUpdated: new Date().toISOString()
    },
    butter: {
      id: 'butter',
      name: 'Butter',
      categoryId: 'dairy',
      supplierId: null,
      purchasePrice: 40000, // IDR 40,000
      purchaseQuantity: 500,
      purchaseUnitId: 'g', // 500g
      yieldPercentage: 90, // 90% yield (10% waste)
      lastUpdated: new Date().toISOString()
    }
  };

  it('should calculate ingredient unit cost per base unit correctly', () => {
    // Flour: 15000 / (1 * 1000 * 1.0) = 15 IDR/gram
    const flourCost = CalculationEngine.calculateIngredientUnitCost(mockIngredients.flour, mockUnits);
    expect(flourCost.toNumber()).toBe(15);

    // Butter: 40000 / (500 * 1 * 0.9) = 40000 / 450 = 88.8888... IDR/gram
    const butterCost = CalculationEngine.calculateIngredientUnitCost(mockIngredients.butter, mockUnits);
    expect(butterCost.toNumber()).toBeCloseTo(88.89, 2);
  });

  it('should calculate recipe HPP and selling price correctly', () => {
    const recipe: Recipe = {
      id: 'simple_bread',
      name: 'Simple Bread',
      categoryId: 'bread',
      servings: 10,
      servingUnitId: 'pcs',
      items: [
        { type: 'ingredient', id: 'flour', quantity: 500, unitId: 'g' }, // 500g * 15 = 7500
        { type: 'ingredient', id: 'butter', quantity: 100, unitId: 'g' } // 100g * (40000/450) = 8888.88...
      ],
      overheads: [
        { id: 'gas', name: 'Gas', type: 'fixed', value: 2000 },
        { id: 'labor', name: 'Labor', type: 'percentage', value: 10 } // 10% of raw cost
      ],
      markupPercentage: 100, // 100% markup (2x cost)
      cachedCost: 0,
      cachedSellingPrice: 0,
      isSubRecipe: false,
      version: 1,
      lastUpdated: new Date().toISOString()
    };

    const result = CalculationEngine.calculateRecipeCost(recipe, mockIngredients, {}, mockUnits);
    
    // Raw ingredients cost = 7500 + 8888.888... = 16388.888...
    expect(result.rawIngredientsCost.toNumber()).toBeCloseTo(16388.89, 2);
    
    // Fixed overheads = 2000
    expect(result.fixedOverheadsCost.toNumber()).toBe(2000);
    
    // Percentage overheads = 10% of 16388.888... = 1638.888...
    expect(result.percentageOverheadsCost.toNumber()).toBeCloseTo(1638.89, 2);
    
    // Total HPP cost = 16388.888... + 2000 + 1638.888... = 20027.777...
    expect(result.totalCost.toNumber()).toBeCloseTo(20027.78, 2);
    
    // HPP per serving = 20027.777... / 10 = 2002.777...
    expect(result.costPerServing.toNumber()).toBeCloseTo(2002.78, 2);

    // Selling price (100% markup) = 20027.777... * 2 = 40055.555...
    expect(result.sellingPrice.toNumber()).toBeCloseTo(40055.56, 2);
  });

  it('should recursively calculate costs for sub-recipes', () => {
    // 1. Buttercream recipe (sub-recipe)
    const buttercream: Recipe = {
      id: 'buttercream',
      name: 'Buttercream',
      categoryId: 'frosting',
      servings: 500, // yields 500 grams
      servingUnitId: 'g',
      items: [
        { type: 'ingredient', id: 'butter', quantity: 250, unitId: 'g' } // 250 * (40000/450) = 22222.22...
      ],
      overheads: [],
      markupPercentage: 0,
      cachedCost: 0,
      cachedSellingPrice: 0,
      isSubRecipe: true,
      version: 1,
      lastUpdated: new Date().toISOString()
    };

    // 2. Parent Cake recipe
    const cake: Recipe = {
      id: 'cake',
      name: 'Cake',
      categoryId: 'cakes',
      servings: 1,
      servingUnitId: 'pcs',
      items: [
        { type: 'ingredient', id: 'flour', quantity: 200, unitId: 'g' }, // 200 * 15 = 3000
        { type: 'recipe', id: 'buttercream', quantity: 150, unitId: 'g' } // 150g buttercream
      ],
      overheads: [],
      markupPercentage: 50, // 50% markup
      cachedCost: 0,
      cachedSellingPrice: 0,
      isSubRecipe: false,
      version: 1,
      lastUpdated: new Date().toISOString()
    };

    const recipesMap = { buttercream, cake };
    const result = CalculationEngine.calculateRecipeCost(cake, mockIngredients, recipesMap, mockUnits);

    // Buttercream total HPP cost = 22222.22... (no overheads)
    // Buttercream cost per base unit (gram) = 22222.22... / 500 = 44.444...
    // Cake buttercream item cost = 150 * 44.444... = 6666.66...
    // Cake flour item cost = 3000
    // Cake total cost = 3000 + 6666.66... = 9666.66...
    expect(result.totalCost.toNumber()).toBeCloseTo(9666.67, 2);
    
    // Cake selling price (50% markup) = 9666.66... * 1.5 = 14500
    expect(result.sellingPrice.toNumber()).toBeCloseTo(14500, 2);
  });
});
