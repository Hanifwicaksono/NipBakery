import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  AlertTriangle, 
  Loader2, 
  CheckCircle,
  Database,
  RefreshCw,
  LogOut,
  User as UserIcon
} from 'lucide-react'

import { SystemSettingsRepository } from '@/repositories/system-settings.repository'
import { UnitRepository } from '@/repositories/unit.repository'
import { IngredientCategoryRepository } from '@/repositories/ingredient-category.repository'
import { SupplierRepository } from '@/repositories/supplier.repository'
import { IngredientRepository } from '@/repositories/ingredient.repository'
import { RecipeRepository } from '@/repositories/recipe.repository'

import { BackupDataSchema } from '@/schemas'
import type { SystemSettings } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useApp } from '@/contexts/app-context'
import { auth, signOut } from '@/firebase/config'


const settingsRepo = new SystemSettingsRepository()
const unitRepo = new UnitRepository()
const categoryRepo = new IngredientCategoryRepository()
const supplierRepo = new SupplierRepository()
const ingredientRepo = new IngredientRepository()
const recipeRepo = new RecipeRepository()

const FormSchema = z.object({
  currency: z.string().min(1, 'Currency symbol is required'),
  taxPercentage: z.coerce.number().min(0).max(100, 'Tax percentage cannot exceed 100%'),
  defaultMarkup: z.coerce.number().nonnegative('Markup must be non-negative'),
})

type FormData = z.infer<typeof FormSchema>;

export const SettingsPanel: React.FC = () => {
  const queryClient = useQueryClient()
  const { user } = useApp()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // States for backup/restore
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])
  
  // Security check for reset
  const [resetConfirmInput, setResetConfirmInput] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun ini?')) {
      try {
        await signOut(auth)
      } catch (err) {
        console.error('Logout failed:', err)
      }
    }
  }

  // Query global settings
  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['settings'],
    queryFn: () => settingsRepo.getOrCreateGlobalSettings(),
  })


  // Form setup
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    values: {
      currency: settings?.currency || 'Rp',
      taxPercentage: settings?.taxPercentage ?? 0,
      defaultMarkup: settings?.defaultMarkup ?? 100,
    },
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: FormData) => settingsRepo.update('global', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      triggerToast('Pengaturan berhasil disimpan!')
    },
  })

  const triggerToast = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const triggerError = (msg: string) => {
    setErrorMessage(msg)
    setTimeout(() => setErrorMessage(null), 5000)
  }

  const onSubmit = (data: FormData) => {
    updateSettingsMutation.mutate(data)
  }

  // Backup Export Logic
  const handleExport = async () => {
    setIsExporting(true)
    try {
      // Fetch all collections
      const units = await unitRepo.list()
      const categories = await categoryRepo.list()
      const suppliers = await supplierRepo.list()
      const ingredients = await ingredientRepo.list()
      const recipes = await recipeRepo.list()
      const globalSettings = await settingsRepo.getOrCreateGlobalSettings()

      const backupObj = {
        version: 1,
        timestamp: new Date().toISOString(),
        units,
        ingredientCategories: categories,
        suppliers,
        ingredients,
        recipes,
        settings: globalSettings,
      }

      // Convert to json string
      const jsonString = JSON.stringify(backupObj, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      // Download trigger
      const link = document.createElement('a')
      const timestampStr = new Date().toISOString().slice(0, 10)
      link.href = url
      link.download = `kuehanip_backup_${timestampStr}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      triggerToast('Backup berkas JSON berhasil diekspor!')
    } catch (err) {
      console.error(err)
      triggerError('Gagal melakukan ekspor data backup.')
    } finally {
      setIsExporting(false)
    }
  }

  // Backup Import Logic
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportErrors([])
    setIsImporting(true)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      // Validate schema
      const result = BackupDataSchema.safeParse(parsed)
      if (!result.success) {
        const errorList = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        setImportErrors(errorList)
        triggerError('Format berkas backup tidak valid.')
        setIsImporting(false)
        return
      }

      const confirmed = confirm(
        'PERINGATAN: Mengimpor data backup akan MENGHAPUS seluruh data Anda saat ini dan menimpanya dengan isi berkas backup ini. Apakah Anda yakin ingin melanjutkan?'
      )
      if (!confirmed) {
        setIsImporting(false)
        return
      }

      const backupData = result.data

      // 1. Wipe current collections
      const currentUnits = await unitRepo.list()
      const currentCategories = await categoryRepo.list()
      const currentSuppliers = await supplierRepo.list()
      const currentIngredients = await ingredientRepo.list()
      const currentRecipes = await recipeRepo.list()

      // Delete in parallel
      await Promise.all([
        ...currentRecipes.map(r => recipeRepo.delete(r.id)),
        ...currentIngredients.map(i => ingredientRepo.delete(i.id)),
        ...currentSuppliers.map(s => supplierRepo.delete(s.id)),
        ...currentCategories.map(c => categoryRepo.delete(c.id)),
        ...currentUnits.map(u => unitRepo.delete(u.id)),
      ])

      // 2. Re-create from backup (sequentially to respect references if needed, but since Firestore doesn't enforce joins, simple loop is fine)
      await Promise.all([
        ...backupData.units.map(u => unitRepo.create(u)),
        ...backupData.ingredientCategories.map(c => categoryRepo.create(c)),
        ...backupData.suppliers.map(s => supplierRepo.create(s)),
        ...backupData.ingredients.map(i => ingredientRepo.create(i)),
        ...backupData.recipes.map(r => recipeRepo.create(r)),
      ])

      // 3. Save settings
      await settingsRepo.update('global', backupData.settings)

      // 4. Invalidate TanStack queries to update components
      queryClient.invalidateQueries()
      triggerToast('Seluruh data berhasil dipulihkan dari backup!')
    } catch (err) {
      console.error(err)
      triggerError('Gagal memproses berkas backup. Pastikan format JSON valid.')
    } finally {
      setIsImporting(false)
      e.target.value = '' // clear input
    }
  }

  // Security Wiped Reset
  const handleResetAllData = async () => {
    if (resetConfirmInput !== 'RESET DATA') {
      alert('Tolong ketik "RESET DATA" untuk memverifikasi tindakan.')
      return
    }

    const confirmed = confirm(
      'Apakah Anda BENAR-BENAR yakin ingin menghapus semua data? Tindakan ini tidak dapat dibatalkan.'
    )
    if (!confirmed) return

    setIsResetting(true)
    try {
      const currentUnits = await unitRepo.list()
      const currentCategories = await categoryRepo.list()
      const currentSuppliers = await supplierRepo.list()
      const currentIngredients = await ingredientRepo.list()
      const currentRecipes = await recipeRepo.list()

      // Delete
      await Promise.all([
        ...currentRecipes.map(r => recipeRepo.delete(r.id)),
        ...currentIngredients.map(i => ingredientRepo.delete(i.id)),
        ...currentSuppliers.map(s => supplierRepo.delete(s.id)),
        ...currentCategories.map(c => categoryRepo.delete(c.id)),
        ...currentUnits.map(u => unitRepo.delete(u.id)),
      ])

      // Reset Settings Global doc
      const defaultSettings: SystemSettings = {
        id: 'global',
        currency: 'Rp',
        taxPercentage: 0,
        defaultMarkup: 100,
        lastBackupDate: null,
      }
      await settingsRepo.update('global', defaultSettings)

      // Trigger seed default units again
      await unitRepo.seedDefaultUnits()

      queryClient.invalidateQueries()
      setResetConfirmInput('')
      triggerToast('Semua data berhasil dibersihkan! Aplikasi telah di-reset ke kondisi awal.')
    } catch (err) {
      console.error(err)
      triggerError('Terjadi kesalahan saat membersihkan data.')
    } finally {
      setIsResetting(false)
    }
  }

  const isSaving = updateSettingsMutation.isPending

  return (
    <div className="space-y-6">
      {/* Toast Alert success */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <span className="text-sm font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Toast Alert error */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex flex-col gap-1.5 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <span className="text-sm font-semibold">{errorMessage}</span>
          </div>
          {importErrors.length > 0 && (
            <ul className="text-xs list-disc pl-5 space-y-0.5 text-red-700 font-mono mt-1 max-h-32 overflow-y-auto">
              {importErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: General Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm">
            <CardHeader className="border-b border-[#E5E7EB] px-6 py-4 bg-gray-50/50">
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-gray-600" />
                <span>Pengaturan Global</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="p-6 flex justify-center items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memuat pengaturan...</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="currency" className="text-sm font-semibold text-gray-700">Simbol Mata Uang *</label>
                      <Input
                        id="currency"
                        placeholder="Rp"
                        className="rounded-lg border-[#E5E7EB]"
                        {...register('currency')}
                      />
                      {errors.currency && (
                        <p className="text-xs text-red-500 font-medium">{errors.currency.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="markup" className="text-sm font-semibold text-gray-700">Default Markup Persentase (%) *</label>
                      <Input
                        id="markup"
                        type="number"
                        placeholder="100"
                        className="rounded-lg border-[#E5E7EB]"
                        {...register('defaultMarkup')}
                      />
                      {errors.defaultMarkup && (
                        <p className="text-xs text-red-500 font-medium">{errors.defaultMarkup.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 max-w-xs">
                    <label htmlFor="tax" className="text-sm font-semibold text-gray-700">Default Pajak Penjualan (%) *</label>
                    <Input
                      id="tax"
                      type="number"
                      placeholder="0"
                      className="rounded-lg border-[#E5E7EB]"
                      {...register('taxPercentage')}
                    />
                    {errors.taxPercentage && (
                      <p className="text-xs text-red-500 font-medium">{errors.taxPercentage.message}</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#E5E7EB] flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={isSaving} 
                      className="w-full sm:w-auto bg-[#111827] text-white hover:bg-gray-800 rounded-xl px-5 flex items-center justify-center gap-2 font-medium"
                    >
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>Simpan Pengaturan</span>
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Secure Wipe Reset Console */}
          <Card className="border-red-200 bg-red-50/20 rounded-xl shadow-sm">
            <CardHeader className="border-b border-red-100 px-6 py-4 bg-red-50/50">
              <CardTitle className="text-base font-bold text-red-950 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-700" />
                <span>Zona Bahaya (Reset Database)</span>
              </CardTitle>
              <CardDescription className="text-xs text-red-800">
                Tindakan di bawah ini bersifat permanen dan menghapus seluruh database lokal di Firestore offline cache.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-xs text-red-700 leading-relaxed font-medium">
                Untuk membersihkan semua bahan baku, resep, kategori, supplier, dan memulihkan aplikasi ke kondisi awal yang kosong (dengan default unit bawaan), ketik <span className="font-mono bg-red-100 px-1 py-0.5 rounded text-red-900 font-extrabold">RESET DATA</span> di kolom bawah ini.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center max-w-md">
                <Input
                  placeholder="Ketik RESET DATA"
                  value={resetConfirmInput}
                  onChange={(e) => setResetConfirmInput(e.target.value)}
                  className="rounded-lg border-red-200 bg-white"
                />
                <Button
                  onClick={handleResetAllData}
                  disabled={isResetting || resetConfirmInput !== 'RESET DATA'}
                  className="bg-red-600 text-white hover:bg-red-700 rounded-xl font-bold flex items-center gap-2 shrink-0 w-full sm:w-auto"
                >
                  {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span>Hapus Semua Data</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: JSON Backup & Restore Tools */}
        <div className="space-y-6">
          {/* User Profile Card */}
          {user && (
            <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="border-b border-[#E5E7EB] px-6 py-4 bg-gray-50/50">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-gray-600" />
                  <span>Akun Sinkronisasi</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#111827] text-white flex items-center justify-center font-bold text-sm shadow-sm uppercase shrink-0">
                    {user.isAnonymous ? 'T' : (user.displayName ? user.displayName.slice(0, 2) : (user.email ? user.email.slice(0, 2) : 'U'))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 truncate">
                      {user.isAnonymous ? 'Mode Tamu (Lokal)' : (user.displayName || 'Pengguna NipBakery')}
                    </h4>
                    <p className="text-xs text-gray-500 truncate text-[10px]">
                      {user.isAnonymous ? 'Data Anda tersimpan lokal di browser' : user.email}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-850 leading-relaxed">
                  {user.isAnonymous ? (
                    <span>
                      ⚠️ <strong>Mode Tamu Aktif</strong>: Data resep Anda hanya disimpan di browser ini saja. Gunakan tombol backup di bawah untuk memindahkan data, atau <strong>Logout</strong> dan masuk dengan Google/Email untuk mengaktifkan sinkronisasi otomatis.
                    </span>
                  ) : (
                    <span>
                      ✅ <strong>Sinkronisasi Cloud Aktif</strong>: Semua data resep dan bahan baku tersinkronisasi otomatis dengan akun ini di seluruh perangkat Anda (laptop & HP).
                    </span>
                  )}
                </div>

                <Button
                  onClick={handleLogout}
                  variant="destructive"
                  className="w-full h-8 rounded-xl flex items-center justify-center gap-2 font-bold cursor-pointer text-xs"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Keluar dari Akun (Logout)</span>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-[#E5E7EB] px-6 py-4 bg-gray-50/50">
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Database className="h-5 w-5 text-gray-600" />
                <span>Backup & Pemulihan</span>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              {/* Export Panel */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Ekspor Database Cadangan</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Ekspor seluruh data bahan baku, supplier, resep, dan satuan unit ke dalam satu berkas berkode <code>.json</code> untuk dipindahkan ke perangkat lain.
                </p>
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full bg-[#111827] text-white hover:bg-gray-800 rounded-xl flex items-center justify-center gap-2 font-medium"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span>Ekspor Berkas Backup</span>
                </Button>
              </div>

              <hr className="border-[#E5E7EB]" />

              {/* Import Panel */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Impor Database Cadangan</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Pilih berkas backup <code>.json</code> yang sudah diekspor sebelumnya untuk memulihkan data. Sistem akan memvalidasi skema berkas sebelum menyalin.
                </p>
                
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    id="import-file"
                    onChange={handleImport}
                    disabled={isImporting}
                    className="hidden"
                  />
                  <label
                    htmlFor="import-file"
                    className={`w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-gray-900 px-4 py-3 rounded-xl cursor-pointer text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors duration-200 ${
                      isImporting ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin text-gray-900" /> : <Upload className="h-4 w-4" />}
                    <span>{isImporting ? 'Sedang Memulihkan...' : 'Unggah Berkas Backup'}</span>
                  </label>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
export default SettingsPanel
