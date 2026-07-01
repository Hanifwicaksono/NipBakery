import React, { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Loader2, 
  Sparkles,
  AlertTriangle,
  Layers,
  HelpCircle
} from 'lucide-react'

import { RecipeRepository } from '@/repositories/recipe.repository'
import { RecipeCategoryRepository } from '@/repositories/recipe-category.repository'
import { IngredientRepository } from '@/repositories/ingredient.repository'
import { UnitRepository } from '@/repositories/unit.repository'
import { CalculationEngine } from '@/engine/calculation.engine'
import { RecipeEngine } from '@/engine/recipe.engine'
import type { RecipeDependencyNode } from '@/engine/recipe.engine'

import type { Recipe, RecipeCategory, Ingredient, Unit, RecipeItem, OverheadItem } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'

const recipeRepo = new RecipeRepository()
const categoryRepo = new RecipeCategoryRepository()
const ingredientRepo = new IngredientRepository()
const unitRepo = new UnitRepository()

const FormSchema = z.object({
  name: z.string().min(1, 'Recipe name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  servings: z.coerce.number().int('Must be integer').positive('Must be positive'),
  servingUnitId: z.string().min(1, 'Serving unit is required'),
  markupPercentage: z.coerce.number().nonnegative('Markup must be non-negative'),
  isSubRecipe: z.boolean(),
  items: z.array(z.object({
    type: z.enum(['ingredient', 'recipe']),
    id: z.string().min(1, 'Select an item'),
    quantity: z.coerce.number().positive('Must be positive'),
    unitId: z.string().min(1, 'Select unit'),
  })).min(1, 'At least one ingredient or sub-recipe is required'),
  overheads: z.array(z.object({
    name: z.string().min(1, 'Overhead name is required'),
    type: z.enum(['fixed', 'percentage']),
    value: z.coerce.number().nonnegative('Must be non-negative'),
  })),
})

type FormData = z.infer<typeof FormSchema>;

interface RecipeFormProps {
  recipe: Recipe | null;
  onClose: () => void;
}

export const RecipeForm: React.FC<RecipeFormProps> = ({ recipe, onClose }) => {
  const queryClient = useQueryClient()

  // Queries for selectors
  const { data: categories = [] } = useQuery<RecipeCategory[]>({
    queryKey: ['recipe_categories'],
    queryFn: () => categoryRepo.list(),
  })

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: () => ingredientRepo.list(),
  })

  const { data: allRecipes = [] } = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: () => recipeRepo.list(),
  })

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: () => unitRepo.list(),
  })

  // Lookups maps
  const unitsMap = useMemo(() => new Map(units.map(u => [u.id, u])), [units])
  const ingredientsMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients])
  const subRecipesMap = useMemo(() => {
    // Only map recipes marked as isSubRecipe, and exclude the current editing recipe to prevent cycle check self-clash
    const filtered = allRecipes.filter(r => r.isSubRecipe && (!recipe || r.id !== recipe.id))
    return new Map(filtered.map(r => [r.id, r]))
  }, [allRecipes, recipe])

  // Form initialization
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: recipe?.name || '',
      categoryId: recipe?.categoryId || categories[0]?.id || '',
      description: recipe?.description || '',
      servings: recipe?.servings || 1,
      servingUnitId: recipe?.servingUnitId || 'pcs',
      markupPercentage: recipe?.markupPercentage || 100,
      isSubRecipe: recipe?.isSubRecipe || false,
      items: recipe?.items || [
        { type: 'ingredient', id: '', quantity: 1, unitId: 'g' }
      ],
      overheads: recipe?.overheads || [],
    },
  })

  // Dynamic arrays
  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control,
    name: 'items',
  })

  const { fields: overheadFields, append: appendOverhead, remove: removeOverhead } = useFieldArray({
    control,
    name: 'overheads',
  })

  // Watch entire form for live HPP computation
  const watchedForm = watch()

  // Live Cost Breakdown calculation
  const liveCostBreakdown = useMemo(() => {
    const items = watchedForm.items || []
    const overheads = watchedForm.overheads || []
    const servings = watchedForm.servings || 1
    const markupPercentage = watchedForm.markupPercentage || 0
    const servingUnitId = watchedForm.servingUnitId || 'pcs'

    if (items.length === 0 || !servingUnitId) return null

    // Check if all items are fully filled (have ID and unit)
    const validItems = items.filter(item => item.id && item.unitId && item.quantity > 0)
    if (validItems.length === 0) return null

    try {
      // 1. Construct temporary Recipe object
      const tempRecipe: Recipe = {
        id: recipe?.id || 'temp',
        name: watchedForm.name || 'Temp',
        categoryId: watchedForm.categoryId || 'temp',
        servings,
        servingUnitId,
        items: validItems as RecipeItem[],
        overheads: overheads.map((o, idx) => ({ id: `o_${idx}`, ...o })) as OverheadItem[],
        markupPercentage,
        cachedCost: 0,
        cachedSellingPrice: 0,
        isSubRecipe: watchedForm.isSubRecipe || false,
        version: 1,
        lastUpdated: new Date().toISOString(),
      }

      // 2. Build records for CalculationEngine
      const ingredientsRecord: Record<string, Ingredient> = {}
      ingredients.forEach(i => { ingredientsRecord[i.id] = i })

      const recipesRecord: Record<string, Recipe> = {}
      allRecipes.forEach(r => { recipesRecord[r.id] = r })
      // If we are editing, overwrite current recipe in calculation map
      if (recipe) {
        recipesRecord[recipe.id] = tempRecipe
      }

      const unitsRecord: Record<string, Unit> = {}
      units.forEach(u => { unitsRecord[u.id] = u })

      // 3. Compute cost
      const breakdown = CalculationEngine.calculateRecipeCost(
        tempRecipe,
        ingredientsRecord,
        recipesRecord,
        unitsRecord
      )

      return breakdown
    } catch (err) {
      console.warn('Live calculation skipped: ', err)
      return null
    }
  }, [watchedForm, ingredients, allRecipes, units, recipe])

  // Circular dependency check helper
  const circularDependencyError = useMemo(() => {
    const items = watchedForm.items || []
    const validSubRecipes = items.filter(item => item.type === 'recipe' && item.id)

    if (validSubRecipes.length === 0) return null

    // 1. Build temporary dependency graph
    const graph: Record<string, RecipeDependencyNode> = {}
    allRecipes.forEach(r => {
      graph[r.id] = { id: r.id, name: r.name, items: r.items }
    })

    const tempId = recipe?.id || 'temp_recipe'
    graph[tempId] = {
      id: tempId,
      name: watchedForm.name || 'Resep Baru',
      items: items.filter(item => item.id).map(item => ({ type: item.type, id: item.id }))
    }

    // 2. Detect cycle starting from current recipe
    const cycle = RecipeEngine.detectCircularDependency(tempId, graph)
    return cycle
  }, [watchedForm.items, watchedForm.name, allRecipes, recipe])

  // Mutation Save
  const saveMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const HppCost = liveCostBreakdown ? liveCostBreakdown.totalCost.toNumber() : 0
      const sellingPrice = liveCostBreakdown ? liveCostBreakdown.sellingPrice.toNumber() : 0

      const cleanRecipe: Recipe = {
        id: recipe?.id || `rec_${Date.now()}`,
        name: formData.name,
        categoryId: formData.categoryId,
        description: formData.description || '',
        servings: formData.servings,
        servingUnitId: formData.servingUnitId,
        items: formData.items as RecipeItem[],
        overheads: formData.overheads.map((o, idx) => ({ id: `o_${idx}`, ...o })) as OverheadItem[],
        markupPercentage: formData.markupPercentage,
        cachedCost: HppCost,
        cachedSellingPrice: sellingPrice,
        isSubRecipe: formData.isSubRecipe,
        version: recipe?.version || 1,
        lastUpdated: new Date().toISOString(),
      }

      if (recipe) {
        await recipeRepo.update(recipe.id, cleanRecipe)
      } else {
        await recipeRepo.create(cleanRecipe)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      onClose()
    },
  })

  const onSubmit = (data: FormData) => {
    if (circularDependencyError) {
      alert('Gagal menyimpan resep: Terdeteksi circular dependency melingkar!')
      return
    }
    saveMutation.mutate(data)
  }

  const isSaving = saveMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {recipe ? `Edit Resep: ${recipe.name}` : 'Buat Resep Baru'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Definisikan takaran bahan baku dan sub-resep formulasi.</p>
          </div>
        </div>
        <Button 
          onClick={handleSubmit(onSubmit)} 
          disabled={isSaving || !!circularDependencyError} 
          className="bg-[#111827] text-white hover:bg-gray-800 rounded-xl px-5 flex items-center gap-2 font-medium"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{recipe ? 'Simpan Resep' : 'Buat Resep'}</span>
        </Button>
      </div>

      {/* Cycle Warning Banner */}
      {circularDependencyError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Circular Dependency Terdeteksi!</h4>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              Resep tidak dapat disimpan karena terdeteksi ketergantungan melingkar: <br />
              <span className="font-mono bg-red-100/60 px-1 py-0.5 rounded text-red-900 text-xs font-bold mt-1 inline-block">
                {circularDependencyError.join(' → ')}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Validation Errors Banner */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 animate-fade-in">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Formulir Tidak Valid!</h4>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              Periksa kolom-kolom berikut sebelum menyimpan resep:
            </p>
            <ul className="list-disc pl-4 text-xs mt-1 space-y-0.5 text-red-700">
              {errors.name && <li>Nama resep wajib diisi.</li>}
              {errors.categoryId && <li>Kategori resep wajib dipilih (buat kategori terlebih dahulu).</li>}
              {errors.servings && <li>Jumlah porsi wajib berupa angka positif.</li>}
              {errors.servingUnitId && <li>Satuan porsi wajib dipilih.</li>}
              {errors.items && <li>Daftar bahan baku wajib memiliki minimal 1 baris terisi lengkap.</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Main Grid: Form Left, HPP Breakdown Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Recipe Form Fields */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm">
            <CardHeader className="border-b border-[#E5E7EB] px-6 py-4 bg-gray-50/50">
              <CardTitle className="text-base font-bold text-gray-900">Informasi Umum</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label htmlFor="rec-name" className="text-sm font-semibold text-gray-700">Nama Resep *</label>
                  <Input
                    id="rec-name"
                    placeholder="misal: Roti Sobek Keju, Ganache Chocolate Base"
                    className="rounded-lg border-[#E5E7EB]"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Kategori Resep *</label>
                  <Select
                    value={watch('categoryId')}
                    onValueChange={(val) => setValue('categoryId', val)}
                  >
                    <SelectTrigger className="rounded-lg border-[#E5E7EB]">
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#E5E7EB]">
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                    <p className="text-xs text-red-500 font-medium">{errors.categoryId.message}</p>
                  )}
                </div>

                <div className="space-y-1.5 flex items-center justify-between border border-[#E5E7EB] rounded-lg p-3 mt-4">
                  <div>
                    <label htmlFor="is-sub" className="text-sm font-bold text-gray-900 flex items-center gap-1.5 cursor-pointer">
                      <Layers className="h-4 w-4 text-gray-500" />
                      <span>Jadikan Sub-Resep</span>
                    </label>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Dapat digunakan di resep lain.</span>
                  </div>
                  <Controller
                    control={control}
                    name="isSubRecipe"
                    render={({ field }) => (
                      <Checkbox
                        id="is-sub"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(!!checked)}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="servings" className="text-sm font-semibold text-gray-700">Hasil Porsi (Servings) *</label>
                  <Input
                    id="servings"
                    type="number"
                    placeholder="1"
                    className="rounded-lg border-[#E5E7EB]"
                    {...register('servings')}
                  />
                  {errors.servings && (
                    <p className="text-xs text-red-500 font-medium">{errors.servings.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Satuan Hasil *</label>
                  <Select
                    value={watch('servingUnitId')}
                    onValueChange={(val) => setValue('servingUnitId', val)}
                  >
                    <SelectTrigger className="rounded-lg border-[#E5E7EB]">
                      <SelectValue placeholder="Pilih Satuan" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#E5E7EB]">
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.servingUnitId && (
                    <p className="text-xs text-red-500 font-medium">{errors.servingUnitId.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="markup" className="text-sm font-semibold text-gray-700">Markup Jual % *</label>
                  <Input
                    id="markup"
                    type="number"
                    placeholder="100"
                    className="rounded-lg border-[#E5E7EB]"
                    {...register('markupPercentage')}
                  />
                  {errors.markupPercentage && (
                    <p className="text-xs text-red-500 font-medium">{errors.markupPercentage.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="desc" className="text-sm font-semibold text-gray-700">Deskripsi Resep</label>
                <Input
                  id="desc"
                  placeholder="Keterangan cara pembuatan atau detail penyimpanan"
                  className="rounded-lg border-[#E5E7EB]"
                  {...register('description')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recipe Items (Ingredients & Sub-Recipes List) */}
          <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm">
            <CardHeader className="border-b border-[#E5E7EB] px-6 py-4 bg-gray-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-gray-900">Bahan Baku & Sub-Resep *</CardTitle>
                <span className="text-[10px] text-gray-400 block mt-0.5">Tentukan takaran bahan baku / sub-resep.</span>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => appendItem({ type: 'ingredient', id: '', quantity: 1, unitId: 'g' })}
                className="rounded-xl border-[#E5E7EB] text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Tambah Bahan</span>
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {itemFields.map((field, idx) => {
                const itemType = watch(`items.${idx}.type`)
                const selectedItemId = watch(`items.${idx}.id`)
                
                // Determine valid units for selection
                let itemTypeCategory: 'weight' | 'volume' | 'count' = 'weight'
                if (itemType === 'ingredient') {
                  const ing = ingredientsMap.get(selectedItemId)
                  const ingUnit = ing ? unitsMap.get(ing.purchaseUnitId) : null
                  itemTypeCategory = ingUnit ? ingUnit.type : 'weight'
                } else {
                  const sub = subRecipesMap.get(selectedItemId)
                  const subUnit = sub ? unitsMap.get(sub.servingUnitId) : null
                  itemTypeCategory = subUnit ? subUnit.type : 'weight'
                }

                const filteredUnits = units.filter(u => u.type === itemTypeCategory)

                const rowError = errors.items?.[idx]
                return (
                  <div key={field.id} className="border-b border-[#E5E7EB] pb-4 last:border-0 last:pb-0">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* Type Choice */}
                      <div className="sm:col-span-2">
                        <Select
                          value={itemType}
                          onValueChange={(val) => {
                            setValue(`items.${idx}.type`, val as 'ingredient' | 'recipe')
                            setValue(`items.${idx}.id`, '') // clear item selection
                          }}
                        >
                          <SelectTrigger className="rounded-lg border-[#E5E7EB] text-xs h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-[#E5E7EB]">
                            <SelectItem value="ingredient">Bahan Baku</SelectItem>
                            <SelectItem value="recipe">Sub-Resep</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Item Selection */}
                      <div className="sm:col-span-4">
                        <Select
                          value={selectedItemId}
                          onValueChange={(val) => {
                            setValue(`items.${idx}.id`, val)
                            // Auto set default unit matching base category type
                            if (itemType === 'ingredient') {
                              const ing = ingredientsMap.get(val)
                              const unit = ing ? unitsMap.get(ing.purchaseUnitId) : null
                              if (unit) setValue(`items.${idx}.unitId`, unit.type === 'weight' ? 'g' : unit.type === 'volume' ? 'ml' : 'pcs')
                            } else {
                              const sub = subRecipesMap.get(val)
                              const unit = sub ? unitsMap.get(sub.servingUnitId) : null
                              if (unit) setValue(`items.${idx}.unitId`, unit.type === 'weight' ? 'g' : unit.type === 'volume' ? 'ml' : 'pcs')
                            }
                          }}
                        >
                          <SelectTrigger className="rounded-lg border-[#E5E7EB] text-xs h-9">
                            <SelectValue placeholder={itemType === 'ingredient' ? 'Pilih Bahan Baku' : 'Pilih Sub-Resep'} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-[#E5E7EB]">
                            {itemType === 'ingredient' ? (
                              ingredients.map((ing) => (
                                <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                              ))
                            ) : (
                              Array.from(subRecipesMap.values()).map((sub) => (
                                <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2">
                        <Input
                          type="number"
                          step="any"
                          placeholder="Jumlah"
                          className="rounded-lg border-[#E5E7EB] h-9 text-xs"
                          {...register(`items.${idx}.quantity`)}
                        />
                      </div>

                      {/* Unit Selection */}
                      <div className="sm:col-span-3">
                        <Select
                          value={watch(`items.${idx}.unitId`)}
                          onValueChange={(val) => setValue(`items.${idx}.unitId`, val)}
                        >
                          <SelectTrigger className="rounded-lg border-[#E5E7EB] text-xs h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-[#E5E7EB]">
                            {filteredUnits.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Delete Item Row */}
                      <div className="sm:col-span-1 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={itemFields.length === 1}
                          onClick={() => removeItem(idx)}
                          className="h-9 w-9 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {rowError && (
                      <div className="flex gap-4 mt-1.5 text-[10px] text-red-500 font-semibold pl-1 animate-fade-in">
                        {rowError.id && <span>* Bahan/sub-resep wajib dipilih.</span>}
                        {rowError.quantity && <span>* Jumlah harus positif (&gt; 0).</span>}
                        {rowError.unitId && <span>* Satuan wajib dipilih.</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Overheads Costs List */}
          <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm">
            <CardHeader className="border-b border-[#E5E7EB] px-6 py-4 bg-gray-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-gray-900">Overhead Cost (Biaya Tambahan)</CardTitle>
                <span className="text-[10px] text-gray-400 block mt-0.5">Biaya lain (misal: Kemasan Kotak, Gas, Gaji Pekerja).</span>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => appendOverhead({ name: '', type: 'fixed', value: 0 })}
                className="rounded-xl border-[#E5E7EB] text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Tambah Overhead</span>
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {overheadFields.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Belum ada biaya overhead tambahan.</p>
              ) : (
                overheadFields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Name */}
                    <div className="sm:col-span-5">
                      <Input
                        placeholder="Nama overhead (misal: Dus Box)"
                        className="rounded-lg border-[#E5E7EB] h-9 text-xs"
                        {...register(`overheads.${idx}.name`)}
                      />
                    </div>

                    {/* Type Selector */}
                    <div className="sm:col-span-3">
                      <Select
                        value={watch(`overheads.${idx}.type`)}
                        onValueChange={(val) => setValue(`overheads.${idx}.type`, val as 'fixed' | 'percentage')}
                      >
                        <SelectTrigger className="rounded-lg border-[#E5E7EB] text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-[#E5E7EB]">
                          <SelectItem value="fixed">Fixed (Rupiah)</SelectItem>
                          <SelectItem value="percentage">Persentase (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Value */}
                    <div className="sm:col-span-3">
                      <Input
                        type="number"
                        placeholder="Value"
                        className="rounded-lg border-[#E5E7EB] h-9 text-xs"
                        {...register(`overheads.${idx}.value`)}
                      />
                    </div>

                    {/* Delete Overhead Row */}
                    <div className="sm:col-span-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOverhead(idx)}
                        className="h-9 w-9 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: HPP LIVE PREVIEW Breakdown Panel */}
        <div className="space-y-6">
          <Card className="border-gray-800 bg-[#111827] text-white rounded-xl shadow-lg sticky top-24 overflow-hidden">
            <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
              <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2 text-white">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <span>Live HPP Preview</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/20 text-green-400 rounded-md border border-green-500/20">
                Active
              </span>
            </div>

            {liveCostBreakdown ? (
              <div className="p-6 space-y-6">
                
                {/* Massive Pricing Callouts */}
                <div className="space-y-4">
                  <div className="pb-4 border-b border-gray-800 flex justify-between items-end">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">HPP per Batch</span>
                      <span className="text-3xl font-extrabold tracking-tight">
                        Rp {liveCostBreakdown.totalCost.toNumber().toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">HPP per Porsi</span>
                      <span className="text-2xl font-extrabold tracking-tight">
                        Rp {liveCostBreakdown.costPerServing.toNumber().toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      / {watchedForm.servingUnitId || 'pcs'}
                    </span>
                  </div>

                  {!watchedForm.isSubRecipe && (
                    <div className="pt-4 border-t border-gray-800 flex justify-between items-end text-yellow-400">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Rekomendasi Jual per Porsi</span>
                        <span className="text-2xl font-extrabold tracking-tight">
                          Rp {liveCostBreakdown.sellingPricePerServing.toNumber().toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        / {watchedForm.servingUnitId || 'pcs'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Technical Breakdowns list */}
                <div className="space-y-3 pt-4 border-t border-gray-800 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bahan Baku (Raw Cost)</span>
                    <span className="font-semibold">
                      Rp {liveCostBreakdown.rawIngredientsCost.toNumber().toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Overhead Tetap (Fixed)</span>
                    <span className="font-semibold">
                      Rp {liveCostBreakdown.fixedOverheadsCost.toNumber().toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Overhead Persen (%)</span>
                    <span className="font-semibold">
                      Rp {liveCostBreakdown.percentageOverheadsCost.toNumber().toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  {!watchedForm.isSubRecipe && (
                    <div className="flex justify-between text-yellow-500/90 font-semibold pt-1">
                      <span>Total Harga Jual (Batch)</span>
                      <span>
                        Rp {liveCostBreakdown.sellingPrice.toNumber().toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <HelpCircle className="h-8 w-8 text-gray-600" />
                <p>Masukkan bahan baku untuk memproses live preview HPP secara otomatis.</p>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  )
}
export default RecipeForm
