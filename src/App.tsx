import { useState, useEffect, useMemo } from 'react'
import { 
  ChefHat, 
  UtensilsCrossed, 
  Layers, 
  Calculator, 
  Settings as SettingsIcon, 
  History, 
  Database, 
  Wifi, 
  ArrowRight,
  TrendingUp,
  Package,
  Truck,
  FolderPlus,
  WifiOff,
  Loader2,
  LogOut
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { IngredientRepository } from '@/repositories/ingredient.repository'
import { RecipeRepository } from '@/repositories/recipe.repository'
import { PriceHistoryRepository } from '@/repositories/price-history.repository'
import { IngredientsList } from '@/features/ingredients/components/ingredients-list'
import { CategoriesList } from '@/features/categories/components/categories-list'
import { SuppliersList } from '@/features/suppliers/components/suppliers-list'
import { RecipesList } from '@/features/recipes/components/recipes-list'
import { PricingSimulator } from '@/features/simulator/components/pricing-simulator'
import { Button } from '@/components/ui/button'
import { SettingsPanel } from '@/features/settings/components/settings-panel'
import { useApp } from '@/contexts/app-context'
import { auth, signOut } from '@/firebase/config'
import { LoginPage } from '@/features/auth/components/login-page'


const ingredientRepo = new IngredientRepository()
const recipeRepo = new RecipeRepository()
const priceHistoryRepo = new PriceHistoryRepository()

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

function App() {
  const { isLoadingAuth, isAuthenticated, user } = useApp()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [activeSubTab, setActiveSubTab] = useState('ingredients-list')
  const isOnline = useOnlineStatus()

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun ini?')) {
      try {
        await signOut(auth)
      } catch (err) {
        console.error('Logout failed:', err)
      }
    }
  }


  // Queries
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => ingredientRepo.list(),
    enabled: !isLoadingAuth,
  })

  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => recipeRepo.list(),
    enabled: !isLoadingAuth,
  })

  const { data: priceHistories = [] } = useQuery({
    queryKey: ['price_histories'],
    queryFn: () => priceHistoryRepo.list(),
    enabled: !isLoadingAuth,
  })

  // Dynamic stats
  const totalIngredients = ingredients.length
  const totalRecipes = recipes.length

  // Calculate average margin of parent recipes (exclude sub-recipes)
  const parentRecipes = useMemo(() => recipes.filter(r => !r.isSubRecipe), [recipes])
  const averageMargin = useMemo(() => {
    if (parentRecipes.length === 0) return 0
    let totalMargin = 0
    let count = 0
    for (const r of parentRecipes) {
      if (r.cachedCost > 0) {
        const m = ((r.cachedSellingPrice - r.cachedCost) / r.cachedCost) * 100
        totalMargin += m
        count++
      }
    }
    return count > 0 ? Math.round(totalMargin / count) : 0
  }, [parentRecipes])

  // Recent 5 price updates
  const recentPriceUpdates = useMemo(() => {
    const ingredientsMap = new Map(ingredients.map(i => [i.id, i]))
    return [...priceHistories]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(ph => {
        const ing = ingredientsMap.get(ph.ingredientId)
        return {
          id: ph.id,
          name: ing ? ing.name : 'Bahan Baku',
          price: ph.purchasePrice,
          qty: ph.purchaseQuantity,
          unit: ph.purchaseUnitId,
          date: new Date(ph.date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })
        }
      })
  }, [priceHistories, ingredients])

  // Top 3 recipes by margin
  const topRecipes = useMemo(() => {
    return parentRecipes
      .map(r => {
        const margin = r.cachedCost > 0 ? ((r.cachedSellingPrice - r.cachedCost) / r.cachedCost) * 100 : 0
        return {
          id: r.id,
          name: r.name,
          servings: r.servings,
          cost: `Rp ${r.cachedCost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`,
          price: `Rp ${r.cachedSellingPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`,
          margin: `${margin.toFixed(0)}%`
        }
      })
      .sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin))
      .slice(0, 3)
  }, [parentRecipes])

  const stats = [
    { name: 'Total Bahan Baku', value: String(totalIngredients), icon: Package, change: 'Sinkronisasi Aktif', changeType: 'neutral' },
    { name: 'Total Resep', value: String(totalRecipes), icon: ChefHat, change: 'Formula Terpelihara', changeType: 'neutral' },
    { name: 'Rata-rata Margin', value: `${averageMargin}%`, icon: TrendingUp, change: 'Dihitung Dinamis', changeType: 'neutral' },
  ]

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center font-sans">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-md max-w-sm w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-[#111827] text-white p-3 rounded-2xl animate-bounce">
              <ChefHat className="h-10 w-10" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="font-extrabold text-gray-900 text-lg tracking-tight">Hanip Bakery</h2>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Cost Calculator</p>
          </div>
          <div className="flex flex-col items-center gap-3 text-xs text-gray-500 font-medium">
            <Loader2 className="h-5 w-5 animate-spin text-gray-900" />
            <span>Menghubungkan ke database aman...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#111827] text-white p-2 rounded-xl">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-[#111827]">Hanip Bakery</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-[#E5E7EB] text-[#111827] rounded-full">Cost Calculator</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sync Status Badge */}
            {isOnline ? (
              <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
                <Wifi className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Online - Sinkronisasi Firestore Aktif</span>
                <span className="inline sm:hidden">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs font-medium">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Offline - Menyimpan Lokal (PWA)</span>
                <span className="inline sm:hidden">Offline</span>
              </div>
            )}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
              <Database className="h-3.5 w-3.5" />
              <span>Firebase Offline Cache Active</span>
            </div>

            {/* User Profile / Status */}
            {user && (
              <div className="flex items-center gap-2 border-l border-gray-200 pl-2 sm:pl-4">
                <div className="flex flex-col text-right hidden lg:block">
                  <span className="text-xs font-bold text-gray-900 leading-tight">
                    {user.isAnonymous ? 'Tamu' : (user.displayName || 'Pengguna')}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold truncate max-w-[120px]">
                    {user.isAnonymous ? 'Data Tersimpan Lokal' : user.email}
                  </span>
                </div>
                {/* Avatar/Initial */}
                <div className="h-8 w-8 rounded-full bg-[#111827] text-white flex items-center justify-center font-bold text-xs shadow-sm uppercase shrink-0">
                  {user.isAnonymous ? 'T' : (user.displayName ? user.displayName.slice(0, 2) : (user.email ? user.email.slice(0, 2) : 'U'))}
                </div>
                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  title="Keluar / Logout"
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>


      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Sidebar Navigation */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto pb-4 lg:pb-0 scrollbar-none">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: Layers },
              { id: 'ingredients', name: 'Master Data Bahan', icon: UtensilsCrossed },
              { id: 'recipes', name: 'Kelola Resep', icon: ChefHat },
              { id: 'calculator', name: 'Simulasi Kalkulator', icon: Calculator },
              { id: 'history', name: 'Riwayat Harga', icon: History },
              { id: 'settings', name: 'Pengaturan & Backup', icon: SettingsIcon },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 whitespace-nowrap ${
                    isActive 
                      ? 'bg-[#111827] text-white shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-[#111827]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fade-in">
              {/* Heading */}
              <div>
                <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight">Overview Dashboard</h1>
                <p className="mt-1 text-sm text-gray-500">Analisis HPP, harga jual, dan margin keuntungan bakery Anda.</p>
              </div>

              {/* Stats Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, idx) => {
                  const Icon = stat.icon
                  return (
                    <div key={idx} className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow duration-200">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{stat.name}</span>
                        <h3 className="text-3xl font-bold text-[#111827]">{stat.value}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>{stat.change}</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-gray-700">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Recent Recipes Card */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm xl:col-span-2 overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-center justify-between bg-gray-50/50">
                      <h2 className="font-bold text-gray-900">Resep Terpopuler & HPP</h2>
                      <button 
                        onClick={() => setActiveTab('recipes')} 
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Lihat Semua</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    {topRecipes.length === 0 ? (
                      <div className="p-12 text-center text-gray-400 text-xs">
                        Belum ada resep utama. Klik <button onClick={() => setActiveTab('recipes')} className="text-blue-600 font-bold hover:underline cursor-pointer">Kelola Resep</button> untuk menambahkan.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E5E7EB]">
                        {topRecipes.map((recipe) => (
                          <div key={recipe.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50/70 transition-colors duration-150">
                            <div>
                              <h4 className="font-semibold text-[#111827] text-sm">{recipe.name}</h4>
                              <span className="text-xs text-gray-500">Porsi: {recipe.servings} porsi</span>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <div>
                                <span className="block text-xs text-gray-400 font-medium">HPP</span>
                                <span className="font-semibold text-gray-900">{recipe.cost}</span>
                              </div>
                              <div>
                                <span className="block text-xs text-gray-400 font-medium">Jual</span>
                                <span className="font-semibold text-gray-900">{recipe.price}</span>
                              </div>
                              <div>
                                <span className="block text-xs text-gray-400 font-medium">Margin</span>
                                <span className="font-bold text-green-600">{recipe.margin}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-gray-50/30 border-t border-[#E5E7EB] flex flex-wrap gap-3">
                    <Button 
                      size="sm" 
                      onClick={() => { setActiveTab('ingredients'); setActiveSubTab('ingredients-list'); }}
                      className="bg-[#111827] text-white hover:bg-gray-800 text-xs font-semibold rounded-lg"
                    >
                      Tambah Bahan Baku
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setActiveTab('recipes')}
                      className="border-[#E5E7EB] text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg"
                    >
                      Buat Resep Baru
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setActiveTab('calculator')}
                      className="border-[#E5E7EB] text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg"
                    >
                      Simulasi Harga Jual
                    </Button>
                  </div>
                </div>

                {/* Right Side Dashboard Column */}
                <div className="space-y-6">
                  {/* Riwayat Perubahan Harga Card */}
                  <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#E5E7EB] bg-gray-50/50">
                      <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        <History className="h-4 w-4 text-gray-500" />
                        <span>Riwayat Perubahan Harga</span>
                      </h2>
                    </div>
                    {recentPriceUpdates.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs">
                        Belum ada riwayat perubahan harga.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E5E7EB]">
                        {recentPriceUpdates.map((update) => (
                          <div key={update.id} className="p-4 hover:bg-gray-50/50 transition-colors duration-150 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <h4 className="font-semibold text-gray-900 line-clamp-1">{update.name}</h4>
                              <span className="text-[10px] text-gray-400 block">{update.date}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-gray-900 block">
                                Rp {update.price.toLocaleString('id-ID')}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                / {update.qty} {update.unit}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Calculation Engine status */}
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm">
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-100 p-2.5 rounded-xl text-blue-700 w-fit">
                        <Calculator className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">Calculation Engine</h3>
                        <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
                          Seluruh penghitungan HPP menggunakan <code>Decimal.js</code> untuk presisi desimal absolut. Terintegrasi dengan deteksi rekursif sub-resep melingkar (Circular Dependency).
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-[#E5E7EB] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-500">Presisi Matematika</span>
                        <span className="font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 text-[10px]">Decimal.js Active</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-500">Circular Checker</span>
                        <span className="font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 text-[10px]">Safe / DFS Active</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'ingredients' && (
            <div className="space-y-6">
              {/* Heading */}
              <div>
                <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight">Master Data</h1>
                <p className="mt-1 text-sm text-gray-500">Kelola informasi dasar bahan baku, kategori, dan supplier Anda.</p>
              </div>

              {/* Sub tabs Selector */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8" aria-label="Tabs">
                  {[
                    { id: 'ingredients-list', name: 'Bahan Baku', icon: UtensilsCrossed },
                    { id: 'categories-list', name: 'Kategori', icon: FolderPlus },
                    { id: 'suppliers-list', name: 'Supplier', icon: Truck },
                  ].map((subtab) => {
                    const Icon = subtab.icon
                    const isSubActive = activeSubTab === subtab.id
                    return (
                      <button
                        key={subtab.id}
                        onClick={() => setActiveSubTab(subtab.id)}
                        className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all cursor-pointer ${
                          isSubActive
                            ? 'border-[#111827] text-[#111827]'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{subtab.name}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>

              {/* Render Component */}
              <div className="animate-fade-in">
                {activeSubTab === 'ingredients-list' && <IngredientsList />}
                {activeSubTab === 'categories-list' && <CategoriesList />}
                {activeSubTab === 'suppliers-list' && <SuppliersList />}
              </div>
            </div>
          )}

          {activeTab === 'recipes' && (
            <div className="space-y-6 animate-fade-in">
              <RecipesList />
            </div>
          )}

          {activeTab === 'calculator' && (
            <div className="space-y-6 animate-fade-in">
              <PricingSimulator />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <SettingsPanel />
            </div>
          )}

          {activeTab !== 'dashboard' && activeTab !== 'ingredients' && activeTab !== 'recipes' && activeTab !== 'calculator' && activeTab !== 'settings' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-12 text-center shadow-sm">
              <UtensilsCrossed className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-bold text-gray-900 uppercase">Fitur Sedang Dikembangkan</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                Modul "{activeTab}" saat ini sedang dipersiapkan dan dihubungkan ke Firebase offline repository.
              </p>
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className="mt-6 inline-flex items-center gap-2 bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <span>Kembali ke Dashboard</span>
              </button>
            </div>
          )}
        </main>

      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E5E7EB] py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Hanip Bakery Cost Calculator &bull; Built with React 19, Vite, Tailwind CSS v4 & Firebase.
        </div>
      </footer>
    </div>
  )
}

export default App
