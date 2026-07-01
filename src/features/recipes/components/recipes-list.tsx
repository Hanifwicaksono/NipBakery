import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Fuse from 'fuse.js'
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2, 
  Search, 
  ChefHat, 
  Layers,
  Percent
} from 'lucide-react'
import { RecipeRepository } from '@/repositories/recipe.repository'
import { RecipeCategoryRepository } from '@/repositories/recipe-category.repository'
import type { Recipe, RecipeCategory } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RecipeForm } from './recipe-form'

const recipeRepo = new RecipeRepository()
const categoryRepo = new RecipeCategoryRepository()

export const RecipesList: React.FC = () => {
  const queryClient = useQueryClient()
  
  // View states: 'list' | 'create' | 'edit'
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')

  // TanStack Queries
  const { data: recipes = [], isLoading: loadingRecipes, error } = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: () => recipeRepo.list(),
  })

  const { data: categories = [] } = useQuery<RecipeCategory[]>({
    queryKey: ['recipe_categories'],
    queryFn: () => categoryRepo.list(),
  })

  // Mapping category list to map for quick lookup
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories])

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => recipeRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
    },
  })

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus resep ini?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe)
    setView('edit')
  }

  const handleCreate = () => {
    setEditingRecipe(null)
    setView('create')
  }

  const handleFormClose = () => {
    setView('list')
    setEditingRecipe(null)
  }

  // Filter & Search Logic
  const filteredRecipes = useMemo(() => {
    let list = [...recipes]

    // Category Filter
    if (selectedCategoryFilter !== 'all') {
      list = list.filter(r => r.categoryId === selectedCategoryFilter)
    }

    // Search Query
    if (searchQuery.trim() !== '') {
      const fuse = new Fuse(list, {
        keys: ['name', 'description'],
        threshold: 0.3,
      })
      list = fuse.search(searchQuery).map(res => res.item)
    }

    return list
  }, [recipes, searchQuery, selectedCategoryFilter])

  if (view === 'create' || view === 'edit') {
    return (
      <RecipeForm 
        recipe={editingRecipe} 
        onClose={handleFormClose} 
      />
    )
  }

  return (
    <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5 bg-gray-50/50">
        <div>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-gray-600" />
            <span>Resep & Sub-Resep</span>
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 mt-1">
            Buat resep baru, kelola formula sub-resep melingkar, dan pantau HPP serta harga jual dinamis.
          </CardDescription>
        </div>
        <Button onClick={handleCreate} className="bg-[#111827] text-white hover:bg-gray-800 rounded-xl flex items-center gap-2 font-medium shrink-0">
          <Plus className="h-4 w-4" />
          <span>Buat Resep Baru</span>
        </Button>
      </CardHeader>

      {/* Filter and Search Bar */}
      <div className="p-6 border-b border-[#E5E7EB] flex flex-col sm:flex-row gap-4 bg-gray-50/10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari nama resep..."
            className="pl-9 rounded-lg border-[#E5E7EB] bg-white text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
            <SelectTrigger className="rounded-lg border-[#E5E7EB] bg-white text-sm">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#E5E7EB]">
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <CardContent className="p-6">
        {loadingRecipes ? (
          <div className="p-12 flex justify-center items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Memuat resep...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 text-sm">
            Gagal memuat resep. Silakan coba lagi.
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Tidak ada resep ditemukan.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => {
              // Calculate margin percent
              const hpp = recipe.cachedCost
              const price = recipe.cachedSellingPrice
              const margin = hpp > 0 ? ((price - hpp) / hpp) * 100 : 0

              return (
                <div 
                  key={recipe.id} 
                  className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
                >
                  <div className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md uppercase tracking-wider mb-2">
                          {categoriesMap.get(recipe.categoryId) || 'Resep'}
                        </span>
                        <h3 className="font-bold text-gray-900 leading-snug line-clamp-1">{recipe.name}</h3>
                      </div>
                      
                      {recipe.isSubRecipe && (
                        <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md">
                          <Layers className="h-3 w-3" />
                          <span>Sub-Resep</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2 h-8 leading-relaxed">
                      {recipe.description || 'Tidak ada deskripsi.'}
                    </p>

                    {/* Cost Indicators */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#E5E7EB]">
                      <div>
                        <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">HPP / Serving</span>
                        <span className="text-sm font-extrabold text-[#111827]">
                          Rp {(recipe.cachedCost / recipe.servings).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Jual / Serving</span>
                        <span className="text-sm font-extrabold text-gray-900">
                          {recipe.isSubRecipe ? (
                            <span className="text-gray-400 font-semibold text-xs">N/A</span>
                          ) : (
                            `Rp ${(recipe.cachedSellingPrice / recipe.servings).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Bottom Bar */}
                  <div className="px-5 py-4 border-t border-[#E5E7EB] bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                      <Percent className="h-3.5 w-3.5" />
                      <span>{recipe.isSubRecipe ? 'N/A' : `${margin.toFixed(0)}% Margin`}</span>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(recipe)}
                        className="h-8 w-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(recipe.id)}
                        className="h-8 w-8 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
export default RecipesList
