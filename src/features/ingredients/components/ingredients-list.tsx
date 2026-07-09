import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Fuse from 'fuse.js'
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2, 
  Search, 
  UtensilsCrossed, 
  Scale
} from 'lucide-react'

import { IngredientRepository } from '@/repositories/ingredient.repository'
import { IngredientCategoryRepository } from '@/repositories/ingredient-category.repository'
import { SupplierRepository } from '@/repositories/supplier.repository'
import { UnitRepository } from '@/repositories/unit.repository'
import { CalculationEngine } from '@/engine/calculation.engine'

import type { Ingredient, IngredientCategory, Supplier, Unit } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ingredientRepo = new IngredientRepository()
const categoryRepo = new IngredientCategoryRepository()
const supplierRepo = new SupplierRepository()
const unitRepo = new UnitRepository()

const FormSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  supplierId: z.string().nullable().optional(),
  purchasePrice: z.coerce.number().nonnegative('Price must be greater than or equal to 0'),
  purchaseQuantity: z.coerce.number().positive('Quantity must be greater than 0'),
  purchaseUnitId: z.string().min(1, 'Purchase unit is required'),
  yieldPercentage: z.coerce.number().min(1, 'Yield must be at least 1%').max(100, 'Yield cannot exceed 100%'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof FormSchema>;

export const IngredientsList: React.FC = () => {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')

  // TanStack Queries
  const { data: ingredients = [], isLoading: loadingIngs } = useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: () => ingredientRepo.list(),
  })

  const { data: categories = [] } = useQuery<IngredientCategory[]>({
    queryKey: ['categories'],
    queryFn: () => categoryRepo.list(),
  })

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => supplierRepo.list(),
  })

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: () => unitRepo.list(),
  })

  // Mapping lists to maps for easy lookup in table
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories])
  const suppliersMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers])
  const unitsMap = useMemo(() => new Map(units.map(u => [u.id, u])), [units])

  // Form setup
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      supplierId: null,
      purchasePrice: 0,
      purchaseQuantity: 1,
      purchaseUnitId: '',
      yieldPercentage: 100,
      notes: '',
    },
  })

  // Watch fields for live calculation inside Form
  const watchPrice = watch('purchasePrice')
  const watchQty = watch('purchaseQuantity')
  const watchUnitId = watch('purchaseUnitId')
  const watchYield = watch('yieldPercentage')

  // Live calculation of price per base unit (Rp / gram or ml or pcs)
  const liveCostCalculation = useMemo(() => {
    if (!watchPrice || !watchQty || !watchUnitId || !watchYield) return null

    const selectedUnit = unitsMap.get(watchUnitId)
    if (!selectedUnit) return null

    try {
      const tempIng: Ingredient = {
        id: 'temp',
        name: 'Temp',
        categoryId: 'temp',
        supplierId: null,
        purchasePrice: watchPrice,
        purchaseQuantity: watchQty,
        purchaseUnitId: watchUnitId,
        yieldPercentage: watchYield,
        lastUpdated: new Date().toISOString(),
      }

      // Convert unitsMap object back to record
      const unitsRecord: Record<string, Unit> = {}
      unitsMap.forEach((u, id) => {
        unitsRecord[id] = u
      })

      const costPerBase = CalculationEngine.calculateIngredientUnitCost(tempIng, unitsRecord)
      
      const baseUnitAbbr = selectedUnit.type === 'weight' ? 'g' : selectedUnit.type === 'volume' ? 'ml' : 'pcs'
      return {
        cost: costPerBase.toNumber(),
        unit: baseUnitAbbr,
      }
    } catch {
      return null
    }
  }, [watchPrice, watchQty, watchUnitId, watchYield, unitsMap])

  // Mutate create
  const createMutation = useMutation({
    mutationFn: (newIng: Ingredient) => ingredientRepo.create(newIng),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] }) // Invalidate recipes as their costing will change!
      closeDialog()
    },
  })

  // Mutate update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Ingredient> }) => ingredientRepo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      closeDialog()
    },
  })

  // Mutate delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => ingredientRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
    },
  })

  const onSubmit = (data: FormData) => {
    const cleanData = {
      name: data.name,
      categoryId: data.categoryId,
      supplierId: data.supplierId || null,
      purchasePrice: data.purchasePrice,
      purchaseQuantity: data.purchaseQuantity,
      purchaseUnitId: data.purchaseUnitId,
      yieldPercentage: data.yieldPercentage,
      notes: data.notes || '',
    }

    if (editingIngredient) {
      updateMutation.mutate({
        id: editingIngredient.id,
        data: cleanData,
      })
    } else {
      const newIng: Ingredient = {
        id: `ing_${Date.now()}`,
        ...cleanData,
        lastUpdated: new Date().toISOString(),
      }
      createMutation.mutate(newIng)
    }
  }

  const openNewDialog = () => {
    setEditingIngredient(null)
    reset({
      name: '',
      categoryId: categories[0]?.id || '',
      supplierId: null,
      purchasePrice: 0,
      purchaseQuantity: 1,
      purchaseUnitId: units[0]?.id || '',
      yieldPercentage: 100,
      notes: '',
    })
    setIsOpen(true)
  }

  const openEditDialog = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient)
    reset({
      name: ingredient.name,
      categoryId: ingredient.categoryId,
      supplierId: ingredient.supplierId,
      purchasePrice: ingredient.purchasePrice,
      purchaseQuantity: ingredient.purchaseQuantity,
      purchaseUnitId: ingredient.purchaseUnitId,
      yieldPercentage: ingredient.yieldPercentage,
      notes: ingredient.notes || '',
    })
    setIsOpen(true)
  }

  const closeDialog = () => {
    setIsOpen(false)
    setEditingIngredient(null)
    reset()
  }

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus bahan baku ini? Seluruh resep yang merujuk bahan ini akan terdampak.')) {
      deleteMutation.mutate(id)
    }
  }

  const [isSeeding, setIsSeeding] = useState(false)

  const handleSeedCommonIngredients = async () => {
    const confirmed = confirm(
      'Apakah Anda ingin mengisi database dengan 20+ bahan baku umum bakery? Bahan yang sudah ada dengan nama yang sama akan dilewati.'
    )
    if (!confirmed) return

    setIsSeeding(true)
    try {
      // 1. Create categories if they don't exist
      const defaultCategories = [
        { id: 'cat_tepung', name: 'Tepung & Pati' },
        { id: 'cat_gula', name: 'Gula & Pemanis' },
        { id: 'cat_lemak', name: 'Lemak & Minyak' },
        { id: 'cat_dairy', name: 'Susu & Olahan Dairy' },
        { id: 'cat_pengembang', name: 'Ragi & Pengembang' },
        { id: 'cat_telur', name: 'Telur' },
        { id: 'cat_flavor', name: 'Perasa, Cokelat & Rempah' },
      ]

      const existingCats = await categoryRepo.list()
      const existingCatNames = new Set(existingCats.map(c => c.name.toLowerCase()))

      for (const cat of defaultCategories) {
        if (!existingCatNames.has(cat.name.toLowerCase())) {
          const idExists = existingCats.some(c => c.id === cat.id)
          const finalId = idExists ? `cat_${Date.now()}_${Math.floor(Math.random() * 1000)}` : cat.id
          await categoryRepo.create({ id: finalId, name: cat.name })
        }
      }

      // Refresh categories list
      const freshCats = await categoryRepo.list()
      const catMapByName = new Map(freshCats.map(c => [c.name.toLowerCase(), c.id]))

      // Helper to find category ID by name
      const getCatId = (name: string) => {
        return catMapByName.get(name.toLowerCase()) || 'cat_umum'
      }

      // 2. Define common ingredients
      const commonIngredients = [
        { name: 'Tepung Terigu Protein Tinggi (Cakra Kembar)', categoryName: 'Tepung & Pati', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Tepung Terigu Protein Sedang (Segitiga Biru)', categoryName: 'Tepung & Pati', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Tepung Terigu Protein Rendah (Kunci Biru)', categoryName: 'Tepung & Pati', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Tepung Maizena', categoryName: 'Tepung & Pati', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Tepung Tapioka', categoryName: 'Tepung & Pati', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Gula Pasir', categoryName: 'Gula & Pemanis', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Gula Halus', categoryName: 'Gula & Pemanis', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Brown Sugar', categoryName: 'Gula & Pemanis', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Madu', categoryName: 'Gula & Pemanis', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Mentega / Butter Wijsman', categoryName: 'Lemak & Minyak', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Mentega / Butter Anchor (Unsalted)', categoryName: 'Lemak & Minyak', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Margarin Blue Band', categoryName: 'Lemak & Minyak', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Korsvet / Puff Pastry Margarine', categoryName: 'Lemak & Minyak', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Minyak Sayur', categoryName: 'Lemak & Minyak', qty: 1000, unit: 'ml', yield: 100 },
        { name: 'Susu UHT Full Cream', categoryName: 'Susu & Olahan Dairy', qty: 1000, unit: 'ml', yield: 100 },
        { name: 'Susu Bubuk Full Cream (Indomilk/Anchor)', categoryName: 'Susu & Olahan Dairy', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Whipping Cream Cair', categoryName: 'Susu & Olahan Dairy', qty: 1000, unit: 'ml', yield: 100 },
        { name: 'Keju Cheddar Kraft', categoryName: 'Susu & Olahan Dairy', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Keju Mozzarella', categoryName: 'Susu & Olahan Dairy', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Ragi Instan (Fermipan)', categoryName: 'Ragi & Pengembang', qty: 500, unit: 'g', yield: 100 },
        { name: 'Baking Powder', categoryName: 'Ragi & Pengembang', qty: 100, unit: 'g', yield: 100 },
        { name: 'Soda Kue (Bicarbonate of Soda)', categoryName: 'Ragi & Pengembang', qty: 100, unit: 'g', yield: 100 },
        { name: 'TBM / SP / Ovalett', categoryName: 'Ragi & Pengembang', qty: 100, unit: 'g', yield: 100 },
        { name: 'Telur Ayam Utuh', categoryName: 'Telur', qty: 1, unit: 'pcs', yield: 90 },
        { name: 'Kuning Telur', categoryName: 'Telur', qty: 1, unit: 'pcs', yield: 100 },
        { name: 'Putih Telur', categoryName: 'Telur', qty: 1, unit: 'pcs', yield: 100 },
        { name: 'Cokelat Bubuk (Van Houten)', categoryName: 'Perasa, Cokelat & Rempah', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Cokelat Batang / DCC (Colatta)', categoryName: 'Perasa, Cokelat & Rempah', qty: 1000, unit: 'g', yield: 100 },
        { name: 'Pasta Vanilla', categoryName: 'Perasa, Cokelat & Rempah', qty: 100, unit: 'ml', yield: 100 },
        { name: 'Garam Halus', categoryName: 'Perasa, Cokelat & Rempah', qty: 1000, unit: 'g', yield: 100 },
      ]

      const existingIngs = await ingredientRepo.list()
      const existingIngNames = new Set(existingIngs.map(i => i.name.toLowerCase()))

      let addedCount = 0
      for (const item of commonIngredients) {
        if (!existingIngNames.has(item.name.toLowerCase())) {
          const newIng: Ingredient = {
            id: `ing_seed_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: item.name,
            categoryId: getCatId(item.categoryName),
            supplierId: null,
            purchasePrice: 0,
            purchaseQuantity: item.qty,
            purchaseUnitId: item.unit,
            yieldPercentage: item.yield,
            notes: 'Bahan baku umum bakery bawaan sistem.',
            lastUpdated: new Date().toISOString(),
          }
          await ingredientRepo.create(newIng)
          addedCount++
        }
      }

      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      alert(`Berhasil menambahkan ${addedCount} bahan baku umum beserta kategorinya!`)
    } catch (error) {
      console.error('Failed to seed ingredients:', error)
      alert('Gagal menambahkan bahan baku umum. Silakan coba lagi.')
    } finally {
      setIsSeeding(false)
    }
  }

  // Filter and Search logic
  const filteredIngredients = useMemo(() => {
    let list = [...ingredients]

    // Category Filter
    if (selectedCategoryFilter !== 'all') {
      list = list.filter(ing => ing.categoryId === selectedCategoryFilter)
    }

    // Search Query
    if (searchQuery.trim() !== '') {
      const fuse = new Fuse(list, {
        keys: ['name', 'notes'],
        threshold: 0.3,
      })
      list = fuse.search(searchQuery).map(res => res.item)
    }

    return list
  }, [ingredients, searchQuery, selectedCategoryFilter])

  const isSaving = createMutation.isPending || updateMutation.isPending
  const isLoading = loadingIngs

  return (
    <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5 bg-gray-50/50">
        <div>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-gray-600" />
            <span>Master Data Bahan Baku</span>
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 mt-1">
            Kelola data bahan baku, harga beli, persentase yield, serta kalkulasi harga satuan dasar.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            onClick={handleSeedCommonIngredients}
            disabled={isSeeding}
            variant="outline"
            className="border-[#E5E7EB] hover:border-gray-900 rounded-xl flex items-center gap-2 font-semibold bg-white transition-all cursor-pointer h-8 text-xs"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Isi Bahan Umum</span>
          </Button>
          <Button onClick={openNewDialog} className="bg-[#111827] text-white hover:bg-gray-800 rounded-xl flex items-center gap-2 font-medium shrink-0 h-8 text-xs">
            <Plus className="h-4 w-4" />
            <span>Bahan Baku Baru</span>
          </Button>
        </div>
      </CardHeader>


      {/* Filter and Search Bar */}
      <div className="p-6 border-b border-[#E5E7EB] flex flex-col sm:flex-row gap-4 bg-gray-50/10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari nama bahan baku..."
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

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Memuat bahan baku...</span>
          </div>
        ) : filteredIngredients.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Tidak ada bahan baku ditemukan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/30">
                <TableRow className="border-b border-[#E5E7EB]">
                  <TableHead className="text-xs font-semibold text-gray-500">Nama Bahan</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500">Kategori</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500">Supplier</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500">Harga Beli</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500">Yield</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500">Satuan Dasar</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-gray-500 w-[120px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.map((ing) => {
                  const unit = unitsMap.get(ing.purchaseUnitId)
                  let displayCost = 'N/A'
                  let baseUnitAbbr = ''
                  
                  if (unit) {
                    try {
                      const unitsRecord: Record<string, Unit> = {}
                      unitsMap.forEach((u, id) => {
                        unitsRecord[id] = u
                      })
                      const costDecimal = CalculationEngine.calculateIngredientUnitCost(ing, unitsRecord)
                      baseUnitAbbr = unit.type === 'weight' ? 'g' : unit.type === 'volume' ? 'ml' : 'pcs'
                      displayCost = `Rp ${costDecimal.toNumber().toLocaleString('id-ID', { maximumFractionDigits: 2 })}`
                    } catch {}
                  }

                  return (
                    <TableRow key={ing.id} className="border-b border-[#E5E7EB] hover:bg-gray-50/50 transition-colors duration-150">
                      <TableCell className="font-semibold text-gray-900">{ing.name}</TableCell>
                      <TableCell className="text-gray-600 text-sm">{categoriesMap.get(ing.categoryId) || <span className="text-gray-400">-</span>}</TableCell>
                      <TableCell className="text-gray-600 text-sm">{suppliersMap.get(ing.supplierId || '') || <span className="text-gray-400">-</span>}</TableCell>
                      <TableCell className="text-gray-700 text-sm font-medium">
                        Rp {ing.purchasePrice.toLocaleString('id-ID')} / {ing.purchaseQuantity} {unit?.abbreviation || ing.purchaseUnitId}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm font-semibold text-center sm:text-left">
                        {ing.yieldPercentage}%
                      </TableCell>
                      <TableCell className="text-gray-900 text-sm font-bold">
                        {displayCost} / {baseUnitAbbr}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(ing)}
                            className="h-8 w-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(ing.id)}
                            className="h-8 w-8 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog Form Bahan Baku */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl border-[#E5E7EB] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              {editingIngredient ? 'Edit Bahan Baku' : 'Bahan Baku Baru'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="ing-name" className="text-sm font-semibold text-gray-700">Nama Bahan *</label>
              <Input
                id="ing-name"
                placeholder="misal: Tepung Segitiga Biru, Mentega Anchor"
                className="rounded-lg border-[#E5E7EB]"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Kategori *</label>
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

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Supplier</label>
                <Select
                  value={watch('supplierId') || 'none'}
                  onValueChange={(val) => setValue('supplierId', val === 'none' ? null : val)}
                >
                  <SelectTrigger className="rounded-lg border-[#E5E7EB]">
                    <SelectValue placeholder="Pilih Supplier" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-[#E5E7EB]">
                    <SelectItem value="none">Tanpa Supplier</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-2">
                <label htmlFor="price" className="text-sm font-semibold text-gray-700">Harga Pembelian *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-gray-400">Rp</span>
                  <Input
                    id="price"
                    type="number"
                    placeholder="50000"
                    className="pl-8 rounded-lg border-[#E5E7EB]"
                    {...register('purchasePrice')}
                  />
                </div>
                {errors.purchasePrice && (
                  <p className="text-xs text-red-500 font-medium">{errors.purchasePrice.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="yield" className="text-sm font-semibold text-gray-700">Yield % *</label>
                <Input
                  id="yield"
                  type="number"
                  placeholder="100"
                  className="rounded-lg border-[#E5E7EB]"
                  {...register('yieldPercentage')}
                />
                {errors.yieldPercentage && (
                  <p className="text-xs text-red-500 font-medium">{errors.yieldPercentage.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="qty" className="text-sm font-semibold text-gray-700">Jumlah Beli *</label>
                <Input
                  id="qty"
                  type="number"
                  step="any"
                  placeholder="1"
                  className="rounded-lg border-[#E5E7EB]"
                  {...register('purchaseQuantity')}
                />
                {errors.purchaseQuantity && (
                  <p className="text-xs text-red-500 font-medium">{errors.purchaseQuantity.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Satuan Beli *</label>
                <Select
                  value={watch('purchaseUnitId')}
                  onValueChange={(val) => setValue('purchaseUnitId', val)}
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
                {errors.purchaseUnitId && (
                  <p className="text-xs text-red-500 font-medium">{errors.purchaseUnitId.message}</p>
                )}
              </div>
            </div>

            {/* Live HPP Preview Box */}
            {liveCostCalculation && (
              <div className="bg-[#111827] text-white p-4 rounded-xl border border-gray-800 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-400 font-medium">Satuan Dasar Terkalkulasi</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">
                    Rp {liveCostCalculation.cost.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-gray-400"> / {liveCostCalculation.unit}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-semibold text-gray-700">Catatan</label>
              <Input
                id="notes"
                placeholder="misal: Masa kedaluwarsa 6 bulan, beli di toko X"
                className="rounded-lg border-[#E5E7EB]"
                {...register('notes')}
              />
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-[#E5E7EB]">
                Batal
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-[#111827] text-white hover:bg-gray-800 rounded-xl flex items-center gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{editingIngredient ? 'Simpan Perubahan' : 'Tambah Bahan'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
export default IngredientsList
