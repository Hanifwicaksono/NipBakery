export interface RecipeDependencyNode {
  id: string;
  name: string;
  items: Array<{
    type: 'ingredient' | 'recipe';
    id: string;
  }>;
}

export class RecipeEngine {
  /**
   * Detects circular dependencies in the recipe graph starting from a recipe.
   * If a cycle is detected, returns the path of the cycle (list of recipe names/IDs).
   * Otherwise returns null.
   */
  static detectCircularDependency(
    recipeId: string,
    allRecipesMap: Record<string, RecipeDependencyNode>,
    path: string[] = [],
    visited: Set<string> = new Set()
  ): string[] | null {
    // If the recipe is already in the current traversal path, a cycle is found
    const pathIndex = path.indexOf(recipeId);
    if (pathIndex !== -1) {
      const cycle = path.slice(pathIndex);
      cycle.push(recipeId); // close the loop
      return cycle.map(id => allRecipesMap[id]?.name || id);
    }

    // If already fully visited and verified cycle-free, skip
    if (visited.has(recipeId)) {
      return null;
    }

    const recipe = allRecipesMap[recipeId];
    if (!recipe) {
      return null;
    }

    path.push(recipeId);

    for (const item of recipe.items) {
      if (item.type === 'recipe') {
        const cyclePath = this.detectCircularDependency(item.id, allRecipesMap, path, visited);
        if (cyclePath) {
          return cyclePath;
        }
      }
    }

    path.pop();
    visited.add(recipeId);
    return null;
  }
}
