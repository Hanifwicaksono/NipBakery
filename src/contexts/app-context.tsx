import React, { createContext, useContext, useEffect, useState } from 'react'
import { initAuth } from '@/firebase/config'
import { UnitRepository } from '@/repositories/unit.repository'
import { IngredientRepository } from '@/repositories/ingredient.repository'
import { RecipeRepository } from '@/repositories/recipe.repository'
import { SystemSettingsRepository } from '@/repositories/system-settings.repository'
import { RecipeCategoryRepository } from '@/repositories/recipe-category.repository'

interface AppContextProps {
  userId: string | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
}

const AppContext = createContext<AppContextProps>({
  userId: null,
  isAuthenticated: false,
  isLoadingAuth: true,
})

export const useApp = () => useContext(AppContext)

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true)

  useEffect(() => {
    // Register recalculation engine callback
    IngredientRepository.onPriceChange = RecipeRepository.recalculateAffectedRecipes

    let active = true

    const authenticate = async () => {
      try {
        const uid = await initAuth()
        if (active) {
          setUserId(uid)
          setIsAuthenticated(true)

          // Once authenticated, trigger the default units & settings seeding
          const unitRepo = new UnitRepository()
          await unitRepo.seedDefaultUnits()

          const settingsRepo = new SystemSettingsRepository()
          await settingsRepo.getOrCreateGlobalSettings()

          const recipeCatRepo = new RecipeCategoryRepository()
          await recipeCatRepo.seedDefaultRecipeCategory()
        }
      } catch (error) {
        console.error('Failed to initialize app authentication & seeding:', error)
      } finally {
        if (active) {
          setIsLoadingAuth(false)
        }
      }
    }

    authenticate()

    return () => {
      active = false
    }
  }, [])

  return (
    <AppContext.Provider value={{ userId, isAuthenticated, isLoadingAuth }}>
      {children}
    </AppContext.Provider>
  )
}
export default AppContext
