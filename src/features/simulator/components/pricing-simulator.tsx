import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Calculator, 
  HelpCircle, 
  TrendingUp, 
  DollarSign, 
  Scale, 
  Sparkles
} from 'lucide-react'
import { RecipeRepository } from '@/repositories/recipe.repository'
import { UnitRepository } from '@/repositories/unit.repository'
import type { Recipe, Unit } from '@/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const recipeRepo = new RecipeRepository()
const unitRepo = new UnitRepository()

export const PricingSimulator: React.FC = () => {
  // Query all recipes
  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: () => recipeRepo.list(),
  })

  // Query units for abbreviations
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: () => unitRepo.list(),
  })

  const unitsMap = useMemo(() => new Map(units.map(u => [u.id, u])), [units])

  // Filter parent recipes (exclude sub-recipes because they don't have direct selling markups)
  const parentRecipes = useMemo(() => recipes.filter(r => !r.isSubRecipe), [recipes])

  // Simulation State
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('')
  
  // Selected Recipe
  const selectedRecipe = useMemo(() => {
    return parentRecipes.find(r => r.id === selectedRecipeId) || null
  }, [parentRecipes, selectedRecipeId])

  // Simulated overrides
  const [simulatedMarkup, setSimulatedMarkup] = useState<number>(100)
  const [simulatedServings, setSimulatedServings] = useState<number>(1)
  const [simulatedSellingPricePerServing, setSimulatedSellingPricePerServing] = useState<number>(0)

  // Initialize simulation parameters when a recipe is selected
  React.useEffect(() => {
    if (selectedRecipe) {
      setSimulatedMarkup(selectedRecipe.markupPercentage)
      setSimulatedServings(selectedRecipe.servings)
      
      const costPerServing = selectedRecipe.cachedCost / selectedRecipe.servings
      const defaultSellingPrice = costPerServing * (1 + selectedRecipe.markupPercentage / 100)
      setSimulatedSellingPricePerServing(Math.round(defaultSellingPrice))
    }
  }, [selectedRecipe])

  // Handle markup adjustments
  const handleMarkupChange = (newMarkup: number) => {
    if (!selectedRecipe) return
    setSimulatedMarkup(newMarkup)
    
    // Calculate new selling price per serving based on new markup
    const costPerServing = selectedRecipe.cachedCost / simulatedServings
    const newPrice = costPerServing * (1 + newMarkup / 100)
    setSimulatedSellingPricePerServing(Math.round(newPrice))
  }

  // Handle selling price adjustments (back-calculate markup)
  const handleSellingPriceChange = (newPrice: number) => {
    if (!selectedRecipe) return
    setSimulatedSellingPricePerServing(newPrice)
    
    const costPerServing = selectedRecipe.cachedCost / simulatedServings
    if (costPerServing > 0) {
      const newMarkup = ((newPrice - costPerServing) / costPerServing) * 100
      setSimulatedMarkup(Math.max(0, parseFloat(newMarkup.toFixed(1))))
    }
  }

  // Handle servings changes (HPP per serving shifts, HPP batch stays same)
  const handleServingsChange = (newServings: number) => {
    if (!selectedRecipe) return
    setSimulatedServings(Math.max(1, newServings))
    
    // Recalculate price per serving keeping the markup constant
    const costPerServing = selectedRecipe.cachedCost / Math.max(1, newServings)
    const newPrice = costPerServing * (1 + simulatedMarkup / 100)
    setSimulatedSellingPricePerServing(Math.round(newPrice))
  }

  // Simulated metrics computations
  const simulationMetrics = useMemo(() => {
    if (!selectedRecipe) return null

    const hppBatch = selectedRecipe.cachedCost
    const hppPerServing = hppBatch / simulatedServings
    const sellingPricePerServing = simulatedSellingPricePerServing
    const sellingPriceBatch = sellingPricePerServing * simulatedServings
    
    const profitPerServing = sellingPricePerServing - hppPerServing
    const profitPerBatch = sellingPriceBatch - hppBatch
    const profitMarginPercent = hppBatch > 0 ? (profitPerBatch / hppBatch) * 100 : 0

    // Determine margin rating
    let rating = 'Low'
    let ratingColor = 'text-red-500 bg-red-50 border-red-200'
    let ratingText = 'Margin Rendah (Kurang Aman)'

    if (profitMarginPercent >= 30 && profitMarginPercent < 70) {
      rating = 'Medium'
      ratingColor = 'text-orange-500 bg-orange-50 border-orange-200'
      ratingText = 'Margin Sedang (Cukup)'
    } else if (profitMarginPercent >= 70 && profitMarginPercent < 150) {
      rating = 'Good'
      ratingColor = 'text-green-500 bg-green-50 border-green-200'
      ratingText = 'Margin Bagus (Menguntungkan)'
    } else if (profitMarginPercent >= 150) {
      rating = 'Premium'
      ratingColor = 'text-purple-500 bg-purple-50 border-purple-200'
      ratingText = 'Margin Premium (Sangat Untung)'
    }

    return {
      hppBatch,
      hppPerServing,
      sellingPricePerServing,
      sellingPriceBatch,
      profitPerServing,
      profitPerBatch,
      profitMarginPercent,
      rating,
      ratingColor,
      ratingText
    }
  }, [selectedRecipe, simulatedServings, simulatedSellingPricePerServing])

  const servingUnitAbbr = selectedRecipe ? (unitsMap.get(selectedRecipe.servingUnitId)?.abbreviation || selectedRecipe.servingUnitId) : ''

  return (
    <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm">
      <CardHeader className="border-b border-[#E5E7EB] px-6 py-5 bg-gray-50/50">
        <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-gray-600" />
          <span>Simulasi Harga Jual</span>
        </CardTitle>
        <CardDescription className="text-xs text-gray-500 mt-1">
          Uji skenario persentase markup, target harga jual, dan porsi hasil resep secara langsung tanpa mengubah data asli resep.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Selector */}
        <div className="max-w-md space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Pilih Resep untuk Simulasi</label>
          <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
            <SelectTrigger className="rounded-lg border-[#E5E7EB] bg-white text-sm">
              <SelectValue placeholder="Pilih Resep Utama" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#E5E7EB]">
              {isLoading ? (
                <SelectItem value="loading" disabled>Memuat resep...</SelectItem>
              ) : parentRecipes.length === 0 ? (
                <SelectItem value="none" disabled>Belum ada resep utama.</SelectItem>
              ) : (
                parentRecipes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedRecipe && simulationMetrics ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Simulation Controllers */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Parameter Inputs */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-6 shadow-sm">
                <h3 className="font-bold text-sm text-gray-900 pb-3 border-b border-[#E5E7EB]">Parameter Simulasi</h3>
                
                {/* Servings Modifier */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5" />
                      <span>Hasil Porsi (Servings)</span>
                    </label>
                    <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                      {simulatedServings} {servingUnitAbbr}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={Math.max(100, selectedRecipe.servings * 4)}
                    value={simulatedServings}
                    onChange={(e) => handleServingsChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>1 {servingUnitAbbr}</span>
                    <span>Asli: {selectedRecipe.servings} {servingUnitAbbr}</span>
                    <span>{Math.max(100, selectedRecipe.servings * 4)} {servingUnitAbbr}</span>
                  </div>
                </div>

                {/* Markup Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>Persentase Markup</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={simulatedMarkup}
                        onChange={(e) => handleMarkupChange(parseFloat(e.target.value) || 0)}
                        className="w-16 h-7 px-1.5 text-center text-xs font-bold border-[#E5E7EB]"
                      />
                      <span className="text-xs font-bold text-gray-500">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="5"
                    value={simulatedMarkup}
                    onChange={(e) => handleMarkupChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>0% (HPP Murni)</span>
                    <span>Asli: {selectedRecipe.markupPercentage}%</span>
                    <span>500% Markup</span>
                  </div>
                </div>

                {/* Target Price Input */}
                <div className="space-y-2">
                  <label htmlFor="target-price" className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>Target Harga Jual per Porsi (Rp)</span>
                  </label>
                  <div className="relative max-w-xs">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-gray-400">Rp</span>
                    <Input
                      id="target-price"
                      type="number"
                      value={simulatedSellingPricePerServing}
                      onChange={(e) => handleSellingPriceChange(parseInt(e.target.value) || 0)}
                      className="pl-8 rounded-lg border-[#E5E7EB] text-sm font-bold text-gray-900 h-9"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 block">Mengetik di sini akan secara otomatis menghitung ulang persentase markup yang dibutuhkan.</span>
                </div>

              </div>

              {/* Base HPP vs Simulated Comparison Table */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-sm text-gray-900 pb-3 border-b border-[#E5E7EB]">Tabel Perbandingan</h3>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="py-2">Metrik</th>
                        <th className="py-2 text-right">Data Asli Resep</th>
                        <th className="py-2 text-right text-gray-900">Hasil Simulasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-gray-700">
                      <tr>
                        <td className="py-3 font-medium">Hasil Porsi (Servings)</td>
                        <td className="py-3 text-right">{selectedRecipe.servings} {servingUnitAbbr}</td>
                        <td className="py-3 text-right font-semibold text-gray-900">{simulatedServings} {servingUnitAbbr}</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium">HPP per Porsi</td>
                        <td className="py-3 text-right">Rp {(selectedRecipe.cachedCost / selectedRecipe.servings).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                        <td className="py-3 text-right font-semibold text-gray-900">Rp {simulationMetrics.hppPerServing.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium">Harga Jual per Porsi</td>
                        <td className="py-3 text-right">Rp {(selectedRecipe.cachedSellingPrice / selectedRecipe.servings).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                        <td className="py-3 text-right font-semibold text-gray-900">Rp {simulationMetrics.sellingPricePerServing.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium">Laba per Porsi</td>
                        <td className="py-3 text-right">
                          Rp {((selectedRecipe.cachedSellingPrice - selectedRecipe.cachedCost) / selectedRecipe.servings).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 text-right font-semibold text-green-700 bg-green-50/30">
                          Rp {simulationMetrics.profitPerServing.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Simulation Dashboard Summary */}
            <div className="space-y-6">
              <Card className="border-gray-800 bg-[#111827] text-white rounded-xl shadow-lg sticky top-24 overflow-hidden">
                <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
                  <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2 text-white">
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                    <span>Laba Bersih & Margin</span>
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-yellow-400/20 text-yellow-400 rounded-md border border-yellow-400/20">
                    Simulated
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  
                  {/* Rating Badge */}
                  <div className={`p-3 rounded-xl border text-center text-xs font-bold ${simulationMetrics.ratingColor}`}>
                    {simulationMetrics.ratingText}
                  </div>

                  {/* Calculations breakdown */}
                  <div className="space-y-4 pt-2">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">HPP Satu Batch</span>
                      <span className="text-xl font-bold">
                        Rp {simulationMetrics.hppBatch.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Pendapatan Satu Batch</span>
                      <span className="text-xl font-bold">
                        Rp {simulationMetrics.sellingPriceBatch.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <div className="pb-4 border-b border-gray-800">
                      <span className="text-[10px] text-yellow-400 font-bold block uppercase tracking-wider">Laba Bersih Per Batch</span>
                      <span className="text-2xl font-extrabold text-green-400">
                        Rp {simulationMetrics.profitPerBatch.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-2">
                      <span className="text-gray-400 font-medium">Persentase Margin Hasil</span>
                      <span className="font-bold text-green-400 text-sm">
                        {simulationMetrics.profitMarginPercent.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 text-[10px] text-gray-400 leading-relaxed">
                    * Perhitungan didasarkan pada harga beli bahan baku saat ini. Biaya overhead tetap dan persentase dimasukkan dalam hitungan HPP Batch.
                  </div>

                </div>
              </Card>
            </div>

          </div>
        ) : (
          <div className="p-16 text-center text-gray-400 text-sm flex flex-col items-center gap-3">
            <HelpCircle className="h-10 w-10 text-gray-300" />
            <p className="font-semibold text-gray-700">Tidak ada resep utama yang dipilih.</p>
            <p className="text-xs text-gray-400 max-w-sm">Silakan pilih salah satu resep kue utama di atas untuk memulai simulasi harga dan keuntungan porsi.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
export default PricingSimulator
